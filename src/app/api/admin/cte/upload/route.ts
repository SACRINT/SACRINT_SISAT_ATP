import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { extraerTemasAcuerdosCapemsIA } from "@/lib/cte/capems-extractor-ia";
import { downloadCloudinaryBuffer } from "@/lib/cloudinary";
import crypto from "crypto";
import { TipoFaseCte } from "@prisma/client";

export const dynamic = "force-dynamic";

// Límite máximo de tamaño: 100 MB (límite de Cloudinary)
const MAX_FILE_SIZE = 100 * 1024 * 1024;
// Gemini Vision no acepta entradas mayores a ~20 MB
const MAX_VISION_SIZE = 20 * 1024 * 1024;

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

    const body = await req.json();
    const {
      numero,
      fase,
      tipoSesion = "CAPEMS",
      descripcion,
      fechaSesion,
      fechaLimite,
      guiaUrl,
      archivoNombre,
      archivoUrl,
      archivoPublicId,
    } = body || {};

    if (numero == null || isNaN(Number(numero))) {
      return NextResponse.json({ error: "El número de sesión es requerido y debe ser numérico." }, { status: 400 });
    }
    const numeroFinal = Number(numero);

    if (!fase || !["ORDINARIA", "INTENSIVA"].includes(fase)) {
      return NextResponse.json({ error: "La fase debe ser ORDINARIA o INTENSIVA." }, { status: 400 });
    }

    if (!archivoUrl || !archivoNombre || !archivoPublicId) {
      return NextResponse.json(
        { error: "Se requiere archivoUrl, archivoNombre y archivoPublicId (el archivo debe subirse a Cloudinary primero)." },
        { status: 400 }
      );
    }

    const fileNameLower = String(archivoNombre).toLowerCase();
    const isPptx = fileNameLower.endsWith(".pptx");
    const isPdf = fileNameLower.endsWith(".pdf");

    if (!isPptx && !isPdf) {
      return NextResponse.json(
        { error: "Formato no admitido. Solo se permiten archivos PDF (.pdf) o presentaciones PowerPoint (.pptx)." },
        { status: 400 }
      );
    }

    // Descarga el archivo desde Cloudinary (flujo salida, sin límite de body de Vercel)
    console.log(`[api/admin/cte/upload] Descargando "${archivoNombre}" (publicId ${archivoPublicId}) desde Cloudinary...`);
    const fileBuffer = await downloadCloudinaryBuffer({
      archivoUrl: String(archivoUrl),
      archivoPublicId: String(archivoPublicId),
      nombreArchivo: String(archivoNombre),
    });
    console.log(`[api/admin/cte/upload] Archivo descargado: ${fileBuffer.length} bytes.`);

    if (fileBuffer.length === 0) {
      return NextResponse.json({ error: "El archivo descargado está vacío." }, { status: 400 });
    }
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo excede el tamaño máximo permitido de 100 MB (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB).` },
        { status: 400 }
      );
    }

    const mimeType = isPptx
      ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : "application/pdf";

    // Cálculo de SHA-256 para integridad
    const sha256Hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Extracción de Temas y Acuerdos con IA
    let iaProcessed = false;
    let temas: { titulo: string; descripcion: string | null }[] = [];
    let acuerdosSugeridos: { texto: string }[] = [];
    let iaWarning: string | null = null;

    try {
      console.log(`[api/admin/cte/upload] Iniciando extracción de IA para "${archivoNombre}"...`);
      const resultadoIA = await extraerTemasAcuerdosCapemsIA(fileBuffer, mimeType, String(archivoNombre));
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

    if (!iaProcessed && isPdf && fileBuffer.length > MAX_VISION_SIZE) {
      iaWarning =
        "El documento es un PDF escaneado demasiado grande para la visión de IA (máx 20 MB). " +
        "Sube la versión digital del PDF o el PPTX original para extraer temas automáticamente.";
    }

    // Upsert en Base de Datos
    const tipoSesionFinal = String(tipoSesion || "CAPEMS");
    const sesion = await prisma.cteSesionConfig.upsert({
      where: {
        tenantId_numero_fase_tipoSesion: {
          tenantId,
          numero: numeroFinal,
          fase: fase as TipoFaseCte,
          tipoSesion: tipoSesionFinal,
        },
      },
      update: {
        tipoSesion: tipoSesionFinal,
        descripcion: descripcion || null,
        fechaSesion: fechaSesion ? new Date(fechaSesion) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        guiaUrl: guiaUrl || null,
        archivoNombre: String(archivoNombre),
        archivoUrl: String(archivoUrl),
        archivoPublicId: String(archivoPublicId),
        sha256Hash,
        iaProcessed,
        temasIA: (temas && temas.length > 0 ? (temas as any) : []),
        acuerdosSugeridosIA: (acuerdosSugeridos && acuerdosSugeridos.length > 0 ? (acuerdosSugeridos as any) : []),
        activo: true,
      },
      create: {
        tenantId,
        numero: numeroFinal,
        fase: fase as TipoFaseCte,
        tipoSesion: tipoSesionFinal,
        descripcion: descripcion || null,
        fechaSesion: fechaSesion ? new Date(fechaSesion) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        guiaUrl: guiaUrl || null,
        archivoNombre: String(archivoNombre),
        archivoUrl: String(archivoUrl),
        archivoPublicId: String(archivoPublicId),
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
        iaWarning,
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