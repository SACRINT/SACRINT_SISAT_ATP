import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "@/lib/cloudinary";
import PizZip from "pizzip";
import { v2 as cloudinary } from "cloudinary";

/** Descarga un archivo desde Cloudinary y retorna su Buffer */
async function downloadBuffer(archivoDriveId: string, archivoDriveUrl: string): Promise<Buffer> {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
    });
    const signedUrl = cloudinary.utils.private_download_url(archivoDriveId, "docx", {
        type: "upload",
        resource_type: "raw"
    });
    const res = await fetch(signedUrl);
    if (!res.ok) {
        // fallback a la URL directa
        const res2 = await fetch(archivoDriveUrl);
        if (!res2.ok) throw new Error("No se pudo descargar la plantilla de Cloudinary");
        return Buffer.from(await res2.arrayBuffer());
    }
    return Buffer.from(await res.arrayBuffer());
}

/** 
 * Modifica el XML del documento Word para insertar {CAMPO} en las celdas vacías
 * que están junto a etiquetas reconocidas en el mapeo.
 * Soporta tanto tablas de 2 columnas (etiqueta | valor) como placeholders explícitos.
 */
function insertPlaceholdersInXml(
    xmlContent: string,
    mappings: Array<{ campoPlantilla: string; sugerenciaSistema: string }>
): string {
    let modifiedXml = xmlContent;

    // Para cada fila de tabla, si la primera celda contiene la etiqueta del campo,
    // insertar el placeholder en la segunda celda vacía
    for (const mapping of mappings) {
        const placeholder = `{${mapping.sugerenciaSistema}}`;
        const labelSearch = mapping.campoPlantilla.replace(/[{}]/g, "").trim();

        // Si ya es un placeholder explícito {CAMPO}, no modificar la tabla
        if (mapping.campoPlantilla.startsWith("{") && mapping.campoPlantilla.endsWith("}")) {
            continue;
        }

        // Buscar filas de tabla que contengan esta etiqueta en la primera celda
        // y que tengan la segunda celda vacía
        const rowRegex = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
        modifiedXml = modifiedXml.replace(rowRegex, (rowXml) => {
            const cells = rowXml.match(/<w:tc>[\s\S]*?<\/w:tc>/g);
            if (!cells || cells.length < 2) return rowXml;

            // Extraer texto de la primera celda
            const firstCellTexts = cells[0].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
            const firstCellText = firstCellTexts.map(t => t.replace(/<[^>]+>/g, "")).join("").trim();

            // Verificar si coincide con la etiqueta del campo (búsqueda flexible)
            const normalizeStr = (s: string) => s.toLowerCase().replace(/[\s:.()/\\-]/g, "");
            if (!normalizeStr(firstCellText).includes(normalizeStr(labelSearch).substring(0, 8))) {
                return rowXml;
            }

            // Verificar si la segunda celda está vacía o solo tiene espacios
            const secondCellTexts = cells[1].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
            const secondCellText = secondCellTexts.map(t => t.replace(/<[^>]+>/g, "")).join("").trim();

            if (secondCellText) return rowXml; // Ya tiene contenido, no modificar

            // Insertar el placeholder en la segunda celda vacía
            // Busca el primer <w:p> dentro de la segunda celda y agrega el run con el placeholder
            const newSecondCell = cells[1].replace(
                /(<w:p[ >])([\s\S]*?)(<\/w:p>)/,
                `$1$2<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r>$3`
            );

            return rowXml.replace(cells[1], newSecondCell);
        });
    }

    return modifiedXml;
}

// PUT: Confirmar configuración de campos y auto-insertar placeholders en el template
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { configuracionCampos, estado } = body;

        const plantillaActual = await prisma.plantillaDocumento.findUnique({ where: { id } });
        if (!plantillaActual) {
            return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
        }

        let nuevoDriveId = plantillaActual.archivoDriveId;
        let nuevaUrl = plantillaActual.archivoDriveUrl;

        // ─── Auto-insertar placeholders en el documento Word ──────────────────────
        // Solo si hay mapeos que corresponden a etiquetas de tabla (no a {PLACEHOLDER} explícitos)
        const mappingsDeTabla = (configuracionCampos || []).filter(
            (m: any) => m.campoPlantilla && !m.campoPlantilla.startsWith("{")
        );

        if (mappingsDeTabla.length > 0) {
            try {
                console.log(`[PLANTILLA] Insertando ${mappingsDeTabla.length} placeholders en el template...`);
                const buffer = await downloadBuffer(plantillaActual.archivoDriveId, plantillaActual.archivoDriveUrl);

                const zip = new PizZip(buffer);
                const xmlContent = zip.file("word/document.xml")?.asText();
                if (!xmlContent) throw new Error("No se encontró word/document.xml");

                const modifiedXml = insertPlaceholdersInXml(xmlContent, mappingsDeTabla);
                zip.file("word/document.xml", modifiedXml);

                const modifiedBuffer = Buffer.from(zip.generate({ type: "nodebuffer" }));

                // Subir el template modificado (con los placeholders) a Cloudinary
                const newFileName = plantillaActual.archivoNombre.replace(".docx", "_configurada.docx");
                const uploadResult = await uploadFileToCloudinary(
                    modifiedBuffer,
                    newFileName,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "Documentos_Administrativos/Plantillas",
                    `${plantillaActual.archivoDriveId}_configurada`
                );

                nuevoDriveId = uploadResult.publicId;
                nuevaUrl = uploadResult.url;

                // Actualizar campoPlantilla a {CAMPO} para que el generador funcione con docxtemplater
                for (const m of mappingsDeTabla) {
                    m.campoPlantilla = `{${m.sugerenciaSistema}}`;
                }

                console.log(`[PLANTILLA] Template modificado subido: ${nuevaUrl}`);
            } catch (modErr) {
                console.error("[PLANTILLA] Error al modificar el template, usando original:", modErr);
                // Si falla la modificación, se guarda igual el mapeo sin modificar el archivo
            }
        }

        // Actualizar en BD con la configuración final
        const plantilla = await prisma.plantillaDocumento.update({
            where: { id },
            data: {
                configuracionCampos,
                estado: estado || "CONFIGURADA",
                archivoDriveId: nuevoDriveId,
                archivoDriveUrl: nuevaUrl,
            }
        });

        return NextResponse.json({ success: true, plantilla });
    } catch (error: any) {
        console.error("Error actualizando plantilla:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}

// DELETE: Eliminar plantilla
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const plantilla = await prisma.plantillaDocumento.findUnique({ where: { id } });
        if (!plantilla) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

        if (plantilla.archivoDriveId) {
            await deleteFileFromCloudinary(plantilla.archivoDriveId).catch(console.error);
        }

        await prisma.documentoAdministrativo.deleteMany({ where: { plantillaId: id } });
        await prisma.plantillaDocumento.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error borrando plantilla:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
