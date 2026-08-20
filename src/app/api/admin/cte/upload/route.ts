import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import { extraerTemasAcuerdosCapemsIA } from "@/lib/cte/capems-extractor-ia";
import crypto from "crypto";
import { TipoFaseCte } from "@prisma/client";

export const dynamic = "force-dynamic";

// Límite máximo de tamaño: 100 MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = (user.role || "director") as "admin" | "supervision" | "director";
    if (userRole === "director") {
      return NextResponse.json(
        { error: "No tiene permisos para subir archivos de sesiones CAPEMS" },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID || "zona004";

    const formData = await req.formData();
    const file = formData.get("archivo") as File | null;
    const numeroStr = formData.get("numero") as string | null;
    const fase = formData.get("fase") as string | null;
    const descripcion = formData.get("descripcion") as string | null;
    const fechaSesion = formData.get("fechaSesion") as string | null;
    const fechaLimite = formData.get("fechaLimite") as string | null;
    const guiaUrl = formData.get("guiaUrl") as string | null;

    if (!numeroStr || isNaN(Number(numeroStr))) {
      return NextResponse.json({ error: "El número de sesión es requerido y debe ser numérico." }, { status: 400 });
    }
    const numero = Number(numeroStr);

    if (!fase || !["ORDINARIA", "INTENSIVA"].includes(fase)) {
      return NextResponse.json({ error: "La fase debe ser ORDINARIA o INTENSIVA." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo excede el tamaño máximo permitido de 100 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).` },
        { status: 400 }
      );
    }

    const fileNameLower = file.name.toLowerCase();
    const isPptx = fileNameLower.endsWith(".pptx") || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const isPdf = fileNameLower.endsWith(".pdf") || file.type === "application/pdf" || file.type.includes("pdf");

    if (!isPptx && !isPdf) {
      return NextResponse.json(
        { error: "Formato no admitido. Solo se permiten archivos PDF (.pdf) o presentaciones PowerPoint (.pptx)." },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const mimeType = isPptx
      ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : "application/pdf";

    // Cálculo de SHA-256 para integridad
    const sha256Hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // 1. Subida a Cloudinary
    console.log(`[api/admin/cte/upload] Subiendo archivo "${file.name}" a Cloudinary...`);
    const uploadResult = await uploadFileToCloudinary(
      fileBuffer,
      file.name,
      mimeType,
      "CAPEMS/zona004"
    );
    console.log(`[api/admin/cte/upload] Archivo subido exitosamente: ${uploadResult.url}`);

    // 2. Extracción de Temas y Acuerdos con IA
    let iaProcessed = false;
    let temas: { titulo: string; descripcion: string | null }[] = [];
    let acuerdosSugeridos: { texto: string }[] = [];

    try {
      console.log(`[api/admin/cte/upload] Iniciando extracción de IA para "${file.name}"...`);
      const resultadoIA = await extraerTemasAcuerdosCapemsIA(fileBuffer, mimeType, file.name);
      temas = resultadoIA.temas;
      acuerdosSugeridos = resultadoIA.acuerdosSugeridos;
      iaProcessed = true;
      console.log(`[api/admin/cte/upload] Extracción exitosa. ${temas.length} temas, ${acuerdosSugeridos.length} acuerdos sugeridos.`);
    } catch (iaError: any) {
      console.error("[api/admin/cte/upload] Error durante la extracción con IA:", iaError);
      iaProcessed = false;
      temas = [];
      acuerdosSugeridos = [];
    }

    // 3. Upsert en Base de Datos
    const sesion = await prisma.cteSesionConfig.upsert({
      where: {
        tenantId_numero_fase: {
          tenantId,
          numero,
          fase: fase as TipoFaseCte,
        },
      },
      update: {
        descripcion: descripcion || null,
        fechaSesion: fechaSesion ? new Date(fechaSesion) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        guiaUrl: guiaUrl || null,
        archivoNombre: file.name,
        archivoUrl: uploadResult.url,
        archivoPublicId: uploadResult.publicId,
        sha256Hash,
        iaProcessed,
        temasIA: (temas && temas.length > 0 ? (temas as any) : []),
        acuerdosSugeridosIA: (acuerdosSugeridos && acuerdosSugeridos.length > 0 ? (acuerdosSugeridos as any) : []),
        activo: true,
      },
      create: {
        tenantId,
        numero,
        fase: fase as TipoFaseCte,
        descripcion: descripcion || null,
        fechaSesion: fechaSesion ? new Date(fechaSesion) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        guiaUrl: guiaUrl || null,
        archivoNombre: file.name,
        archivoUrl: uploadResult.url,
        archivoPublicId: uploadResult.publicId,
        sha256Hash,
        iaProcessed,
        temasIA: (temas && temas.length > 0 ? (temas as any) : []),
        acuerdosSugeridosIA: (acuerdosSugeridos && acuerdosSugeridos.length > 0 ? (acuerdosSugeridos as any) : []),
        activo: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        sesion,
        temas,
        acuerdosSugeridos,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/admin/cte/upload] Error general:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar la subida del archivo de sesión CAPEMS." },
      { status: 500 }
    );
  }
}
