import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import PizZip from "pizzip";
import JSZip from "jszip";
import { v2 as cloudinary } from "cloudinary";

// ─── Helper: Descarga desde Cloudinary ─────────────────────────────────────
async function downloadFromCloudinary(url: string, publicId: string): Promise<Buffer> {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
    });

    try {
        const secureUrl = cloudinary.utils.private_download_url(publicId, "docx", {
            type: "upload",
            resource_type: "raw"
        });
        const res = await fetch(secureUrl);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* fallback */ }

    const res2 = await fetch(url);
    if (!res2.ok) throw new Error("No se pudo descargar la plantilla de Cloudinary");
    return Buffer.from(await res2.arrayBuffer());
}

// ─── Helper: Reemplazar XML ─────────────────────────────────────────────────
function reemplazarPlaceholdersEnXml(xmlContent: string, datos: Record<string, string>): string {
    let xml = xmlContent;
    xml = xml.replace(/<\/w:r><w:r><w:t( [^>]*)?>(\{[A-Z_]+)/g, "$2");

    for (const [campo, valor] of Object.entries(datos)) {
        const placeholder = `{${campo}}`;
        const valorXml = (valor || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        while (xml.includes(placeholder)) {
            xml = xml.replace(placeholder, valorXml);
        }
    }
    return xml;
}

// ─── POST: Generar Documentos Masivos ───────────────────────────────────────
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { constancias } = body;

        if (!Array.isArray(constancias) || constancias.length === 0) {
            return NextResponse.json({ error: "No hay constancias para generar" }, { status: 400 });
        }

        const autoridadesConfig = await prisma.autoridadesConfig.findUnique({
            where: { id: "singleton" }
        });

        // Cachear las plantillas ya descargadas en este lote para no descargar múltiple veces la misma
        const plantillaCache: Record<string, { buffer: Buffer, nombre: string }> = {};

        const zip = new JSZip();

        // Procesar cada constancia secuencialmente
        for (let i = 0; i < constancias.length; i++) {
            const reqItem = constancias[i];
            const { plantillaId, escuelaId, directorId, personalId, datosFinales, actualizarExpediente, personaNombre } = reqItem;

            if (!plantillaCache[plantillaId]) {
                const plantilla = await prisma.plantillaDocumento.findUnique({ where: { id: plantillaId } });
                if (!plantilla) throw new Error(`Plantilla no encontrada: ${plantillaId}`);
                
                const buffer = await downloadFromCloudinary(plantilla.archivoDriveUrl, plantilla.archivoDriveId);
                plantillaCache[plantillaId] = { buffer, nombre: plantilla.nombre };
            }

            const { buffer: templateBuffer, nombre: plantillaNombre } = plantillaCache[plantillaId];

            // ─── Actualizar Expediente Permanente (si aplica) ────────────────
            if (actualizarExpediente && directorId) {
                const updateData: any = {};
                // Soportamos tanto _DIRECTOR como _PERSONA
                if (datosFinales.NOMBRE_DIRECTOR || datosFinales.NOMBRE_PERSONA) updateData.nombreCompleto = datosFinales.NOMBRE_DIRECTOR || datosFinales.NOMBRE_PERSONA;
                if (datosFinales.RFC_DIRECTOR || datosFinales.RFC_PERSONA) updateData.rfc = datosFinales.RFC_DIRECTOR || datosFinales.RFC_PERSONA;
                if (datosFinales.CURP_DIRECTOR || datosFinales.CURP_PERSONA) updateData.curp = datosFinales.CURP_DIRECTOR || datosFinales.CURP_PERSONA;
                if (datosFinales.CLAVE_PRESUPUESTAL_DIRECTOR || datosFinales.CLAVE_PRESUPUESTAL_PERSONA) updateData.clavePresupuestal = datosFinales.CLAVE_PRESUPUESTAL_DIRECTOR || datosFinales.CLAVE_PRESUPUESTAL_PERSONA;
                if (datosFinales.TELEFONO_DIRECTOR || datosFinales.TELEFONO_PERSONA) updateData.telefono = datosFinales.TELEFONO_DIRECTOR || datosFinales.TELEFONO_PERSONA;
                if (datosFinales.CORREO_DIRECTOR || datosFinales.CORREO_PERSONA) updateData.correo = datosFinales.CORREO_DIRECTOR || datosFinales.CORREO_PERSONA;
                
                const fechaInput = datosFinales.FECHA_INGRESO_DIRECTOR || datosFinales.FECHA_INGRESO_PERSONA;
                if (fechaInput) {
                    const parsed = new Date(fechaInput);
                    if (!isNaN(parsed.getTime())) updateData.fechaIngreso = parsed;
                }

                if (Object.keys(updateData).length > 0) {
                    await prisma.directorExpediente.update({
                        where: { id: directorId },
                        data: updateData
                    });
                }
            }

            // ─── Construir mapa completo de datos ──────────────────────────────
            const datosFinalesMayus = Object.fromEntries(
                Object.entries(datosFinales || {}).map(([k, v]) => [k, typeof v === "string" ? v.toUpperCase() : v])
            );

            const renderData: Record<string, string> = {
                ...datosFinalesMayus,
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

            const pZip = new PizZip(templateBuffer);
            const xmlContent = pZip.file("word/document.xml")?.asText();
            if (!xmlContent) throw new Error("No se encontró word/document.xml en la plantilla");

            const xmlModificado = reemplazarPlaceholdersEnXml(xmlContent, renderData);
            pZip.file("word/document.xml", xmlModificado);
            const generatedBuf = Buffer.from(pZip.generate({ type: "nodebuffer", compression: "DEFLATE" }));

            // ─── Generar nombre único para el archivo ───────────────────────
            const cleanName = (personaNombre || "Documento").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
            const fileName = `${plantillaNombre.replace(/[^a-zA-Z0-9_-]/g, "")}_${cleanName}_${i+1}.docx`;

            // Agregar al ZIP final
            zip.file(fileName, generatedBuf);

            // ─── Subir a Cloudinary (historial) ─────────────────────────────
            const { publicId, url } = await uploadFileToCloudinary(
                generatedBuf,
                fileName,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Documentos_Administrativos/Generados",
                fileName.replace(/\.docx$/, "")
            );

            // ─── Guardar Historial ──────────────────────────────────────────
            await prisma.documentoAdministrativo.create({
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
        }

        // ─── Generar archivo ZIP ────────────────────────────────────────────
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="constancias_masivas.zip"`
            }
        });

    } catch (error: any) {
        console.error("Error generando documentos masivos:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
