import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import PizZip from "pizzip";
import { v2 as cloudinary } from "cloudinary";

// ─── Helper: Descarga desde Cloudinary ─────────────────────────────────────
async function downloadFromCloudinary(url: string, publicId: string): Promise<Buffer> {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
    });

    // Intentar con signed URL primero
    try {
        const secureUrl = cloudinary.utils.private_download_url(publicId, "docx", {
            type: "upload",
            resource_type: "raw"
        });
        const res = await fetch(secureUrl);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* ignorar, usar fallback */ }

    // Fallback a URL directa
    const res2 = await fetch(url);
    if (!res2.ok) throw new Error("No se pudo descargar la plantilla de Cloudinary");
    return Buffer.from(await res2.arrayBuffer());
}

/**
 * Reemplaza placeholders en el XML del documento Word de forma robusta.
 * Maneja el caso donde docxtemplater fragmenta el texto en múltiples <w:r> runs.
 * 
 * Estrategia:
 * 1. Primero une todos los runs consecutivos de texto dentro de cada párrafo
 *    para que los placeholders queden en un solo run.
 * 2. Luego reemplaza {CAMPO} con el valor real.
 */
function reemplazarPlaceholdersEnXml(
    xmlContent: string,
    datos: Record<string, string>
): string {
    let xml = xmlContent;

    // Paso 1: Limpiar y unir runs fragmentados que pueden dividir un placeholder
    // Esto une corridas consecutivas que no tienen propiedades de formateo diferente
    // para que {NOMBRE_DIRECTOR} esté en un solo <w:t>
    xml = xml.replace(/<\/w:r><w:r><w:t( [^>]*)?>(\{[A-Z_]+)/g, "$2");

    // Paso 2: Reemplazar cada placeholder {CAMPO} con su valor
    for (const [campo, valor] of Object.entries(datos)) {
        const placeholder = `{${campo}}`;
        // Escapar caracteres especiales XML en el valor
        const valorXml = (valor || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        // Reemplazar todas las ocurrencias (puede aparecer varias veces en el doc)
        while (xml.includes(placeholder)) {
            xml = xml.replace(placeholder, valorXml);
        }
    }

    return xml;
}

// ─── POST: Generar Documento ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { plantillaId, escuelaId, directorId, personalId, datosFinales, actualizarExpediente } = body;

        if (!plantillaId || !datosFinales) {
            return NextResponse.json({ error: "Faltan datos (plantillaId, datosFinales)" }, { status: 400 });
        }

        const plantilla = await prisma.plantillaDocumento.findUnique({ where: { id: plantillaId } });
        if (!plantilla) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

        // ─── Actualizar Expediente Permanente (si aplica) ──────────────────
        if (actualizarExpediente && directorId) {
            const updateData: any = {};
            if (datosFinales.NOMBRE_DIRECTOR) updateData.nombreCompleto = datosFinales.NOMBRE_DIRECTOR;
            if (datosFinales.RFC_DIRECTOR) updateData.rfc = datosFinales.RFC_DIRECTOR;
            if (datosFinales.CURP_DIRECTOR) updateData.curp = datosFinales.CURP_DIRECTOR;
            if (datosFinales.CLAVE_PRESUPUESTAL_DIRECTOR) updateData.clavePresupuestal = datosFinales.CLAVE_PRESUPUESTAL_DIRECTOR;
            if (datosFinales.TELEFONO_DIRECTOR) updateData.telefono = datosFinales.TELEFONO_DIRECTOR;
            if (datosFinales.CORREO_DIRECTOR) updateData.correo = datosFinales.CORREO_DIRECTOR;
            if (datosFinales.FECHA_INGRESO_DIRECTOR) updateData.fechaIngreso = new Date(datosFinales.FECHA_INGRESO_DIRECTOR);

            if (Object.keys(updateData).length > 0) {
                await prisma.directorExpediente.update({
                    where: { id: directorId },
                    data: updateData
                });
            }
        }

        // ─── Autoridades Educativas ────────────────────────────────────────
        const autoridadesConfig = await prisma.autoridadesConfig.findUnique({
            where: { id: "singleton" }
        });

        // ─── Construir mapa completo de datos ──────────────────────────────
        const renderData: Record<string, string> = {
            ...datosFinales,
            SUPERVISOR: autoridadesConfig?.supervisor || "C. SUPERVISOR(A)",
            SUPERVISOR_RFC: autoridadesConfig?.supervisorRFC || "",
            SUPERVISOR_FECHA: autoridadesConfig?.supervisorFecha || "",
            SUPERVISOR_CLAVE: autoridadesConfig?.supervisorClave || "",
            COORDINADOR_REGIONAL: autoridadesConfig?.coordinadorRegional || "C. COORDINADOR(A) REGIONAL",
            DIRECTOR_NIVEL: autoridadesConfig?.directorNivel || "C. DIRECTOR(A) DEL NIVEL",
            ATP1_NOMBRE: autoridadesConfig?.atp1Nombre || "",
            ATP1_RFC: autoridadesConfig?.atp1RFC || "",
            ATP2_NOMBRE: autoridadesConfig?.atp2Nombre || "",
            ATP2_RFC: autoridadesConfig?.atp2RFC || "",
            ATP3_NOMBRE: autoridadesConfig?.atp3Nombre || "",
            ATP3_RFC: autoridadesConfig?.atp3RFC || "",
            ATP4_NOMBRE: autoridadesConfig?.atp4Nombre || "",
            ATP4_RFC: autoridadesConfig?.atp4RFC || "",
        };

        console.log(`[GENERAR] Datos a insertar:`, Object.keys(renderData));

        // ─── Descargar template y reemplazar placeholders via XML ──────────
        const templateBuffer = await downloadFromCloudinary(plantilla.archivoDriveUrl, plantilla.archivoDriveId);

        const zip = new PizZip(templateBuffer);
        const xmlContent = zip.file("word/document.xml")?.asText();
        if (!xmlContent) throw new Error("No se encontró word/document.xml en la plantilla");

        // Log para debug: verificar qué placeholders están en el template
        const placeholdersEnTemplate = (xmlContent.match(/\{[A-Z_]+\}/g) || []);
        console.log(`[GENERAR] Placeholders detectados en template: ${placeholdersEnTemplate.join(", ") || "NINGUNO"}`);

        // Reemplazar usando manipulación directa de XML (más confiable que docxtemplater para tablas)
        const xmlModificado = reemplazarPlaceholdersEnXml(xmlContent, renderData);

        // Verificar qué placeholders quedaron sin reemplazar
        const sinReemplazar = (xmlModificado.match(/\{[A-Z_]+\}/g) || []);
        if (sinReemplazar.length > 0) {
            console.warn(`[GENERAR] Placeholders sin reemplazar: ${sinReemplazar.join(", ")}`);
        }

        zip.file("word/document.xml", xmlModificado);
        const generatedBuf = Buffer.from(zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));

        // ─── Subir a Cloudinary (historial) ───────────────────────────────
        const safeNombre = plantilla.nombre.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
        const fileName = `${safeNombre}_${Date.now()}.docx`;
        const { publicId, url } = await uploadFileToCloudinary(
            generatedBuf,
            fileName,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Documentos_Administrativos/Generados",
            fileName.replace(/\.docx$/, "")
        );

        // ─── Guardar Historial ─────────────────────────────────────────────
        const historial = await prisma.documentoAdministrativo.create({
            data: {
                tipo: "CONSTANCIA",
                plantillaId,
                escuelaId,
                directorId: directorId || null,
                personalId: personalId || null,
                generadoPorId: (session.user as any).id,
                datosUtilizados: datosFinales,
                archivoWordId: publicId,
                archivoWordUrl: url
            }
        });

        console.log(`[GENERAR] Documento generado: ${fileName}`);

        return NextResponse.json({
            success: true,
            url,
            fileName, // incluir el nombre con extensión para la descarga
            historial
        });

    } catch (error: any) {
        console.error("Error generando documento:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
