/**
 * POST /api/admin/oficios/upload
 *
 * Carga un oficio PDF/imagen, calcula SHA-256 en memoria,
 * guarda el archivo en OFICIOS_DIR, llama al extractor IA
 * y crea el registro Oficio en BD.
 *
 * Nunca se guarda el payload binario en BD.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getOficioConfig,
    calcularCriticidad,
    guardarArchivoOficio,
} from "@/lib/oficios/oficios-engine";
import { extraerMetadatosOficioIA } from "@/lib/oficios/oficio-extractor-ia";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SessionUser = {
    role?: string;
    organizacionId?: string;
    tenantId?: string;
};

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as SessionUser | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json(
                { error: "Usuario sin organización/tenant asignado" },
                { status: 401 }
            );
        }

        // Parsear form-data
        const formData = await req.formData();
        const archivo = formData.get("archivo") as File | null;
        const numeroOficio = (formData.get("numeroOficio") as string | null)?.trim();
        const asuntoManual = (formData.get("asunto") as string | null)?.trim();
        const fechaLimiteManual = (formData.get("fechaLimite") as string | null)?.trim();
        const usarIA = formData.get("usarIA") !== "false"; // default true

        if (!archivo) {
            return NextResponse.json({ error: "Archivo requerido (campo 'archivo')" }, { status: 400 });
        }
        if (!numeroOficio) {
            return NextResponse.json({ error: "numeroOficio es requerido" }, { status: 400 });
        }

        // Validación de tamaño (máximo 25 MB)
        const MAX_FILE_SIZE = 25 * 1024 * 1024;
        if (archivo.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "El archivo excede el tamaño máximo permitido de 25 MB" },
                { status: 400 }
            );
        }

        // Validación de formato (PDF, JPEG, PNG, TIFF, HEIC)
        const mimeLower = (archivo.type || "").toLowerCase();
        const nameLower = (archivo.name || "").toLowerCase();
        const esFormatoValido =
            mimeLower.includes("pdf") ||
            mimeLower.includes("jpeg") ||
            mimeLower.includes("jpg") ||
            mimeLower.includes("png") ||
            mimeLower.includes("tiff") ||
            mimeLower.includes("heic") ||
            /\.(pdf|jpeg|jpg|png|tiff|heic)$/i.test(nameLower);

        if (!esFormatoValido) {
            return NextResponse.json(
                { error: "Formato de archivo no permitido. Formatos válidos: PDF, JPEG, PNG, TIFF, HEIC" },
                { status: 400 }
            );
        }

        const mimeType = archivo.type || (nameLower.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
        const arrayBuffer = await archivo.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 1. Guardar físicamente + calcular SHA-256
        const { rutaRelativa, sha256 } = guardarArchivoOficio(tenantId, archivo.name, buffer);

        // 2. Extracción IA (si se solicita y el archivo es PDF/imagen)
        let metadatosIA = null;
        let asuntoFinal = asuntoManual ?? "";
        let fechaLimiteFinal: Date | null = fechaLimiteManual ? new Date(fechaLimiteManual) : null;
        let remitenteNombre: string | null = null;
        let remitenteEmail: string | null = null;

        if (usarIA && (mimeType.includes("pdf") || mimeType.includes("image"))) {
            const extraido = await extraerMetadatosOficioIA(buffer, mimeType);
            metadatosIA = extraido;

            // Los datos manuales tienen prioridad; IA rellena los vacíos
            if (!asuntoFinal && extraido.asunto) asuntoFinal = extraido.asunto;
            if (!fechaLimiteFinal && extraido.fechaLimite) {
                fechaLimiteFinal = new Date(extraido.fechaLimite);
            }
            remitenteNombre = extraido.remitenteNombre ?? null;
            remitenteEmail = extraido.remitenteEmail ?? null;
        }

        if (!asuntoFinal) {
            return NextResponse.json(
                { error: "No se pudo determinar el asunto. Proporciona 'asunto' manualmente." },
                { status: 400 }
            );
        }

        // 3. Calcular criticidad según config del tenant
        const config = await getOficioConfig(tenantId);
        const criticidad = calcularCriticidad(
            fechaLimiteFinal,
            config.umbralRojoHoras,
            config.umbralAmarilloHoras
        );

        // 4. Crear registro en BD
        const oficio = await prisma.oficio.create({
            data: {
                tenantId,
                numeroOficio,
                asunto: asuntoFinal,
                remitenteNombre,
                remitenteEmail,
                fechaLimite: fechaLimiteFinal,
                rutaArchivo: rutaRelativa,
                sha256Hash: sha256,
                metadatosIA: metadatosIA ? (JSON.parse(JSON.stringify(metadatosIA)) as Prisma.InputJsonValue) : Prisma.JsonNull,
                iaProcessed: usarIA,
                criticidad,
                esRecibido: true,
            },
        });

        return NextResponse.json(
            {
                oficio,
                metadatosIA,
                mensaje: `Oficio ${numeroOficio} registrado correctamente.`,
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al subir el oficio";
        console.error("[POST /api/admin/oficios/upload]", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
