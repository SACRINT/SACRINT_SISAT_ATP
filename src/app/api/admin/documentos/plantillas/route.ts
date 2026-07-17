import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import PizZip from "pizzip";

// ─── Helpers de extracción de XML ──────────────────────────────────────────────

/**
 * Extrae el texto de un fragmento XML de Word concatenando todos los <w:t> dentro del párrafo.
 * Esto resuelve el problema de que Word fragmenta {NOMBRE_DIRECTOR} en múltiples nodos XML.
 */
function getTextFromXmlFragment(xml: string): string {
    const texts = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    return texts.map(t => t.replace(/<[^>]+>/g, "")).join("").trim();
}

/**
 * Extrae el contenido estructurado del documento Word:
 * - Párrafos normales
 * - Tablas como filas "Etiqueta | Valor" (donde Valor puede estar vacío)
 */
function extractDocumentStructure(xmlContent: string): {
    paragraphs: string[];
    tableRows: Array<{ label: string; value: string }>;
    fullText: string;
} {
    const paragraphs: string[] = [];
    const tableRows: Array<{ label: string; value: string }> = [];

    // Extraer tablas
    const tables = xmlContent.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
    for (const table of tables) {
        const rows = table.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
        for (const row of rows) {
            const cells = row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
            if (cells.length >= 1) {
                const label = cells[0] ? getTextFromXmlFragment(cells[0]) : "";
                const value = cells[1] ? getTextFromXmlFragment(cells[1]) : "";
                if (label) {
                    tableRows.push({ label, value });
                }
            }
        }
    }

    // Extraer párrafos fuera de tablas
    let xmlWithoutTables = xmlContent;
    for (const table of tables) {
        xmlWithoutTables = xmlWithoutTables.replace(table, "");
    }
    const paraMatches = xmlWithoutTables.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
    for (const para of paraMatches) {
        const text = getTextFromXmlFragment(para);
        if (text) paragraphs.push(text);
    }

    // Construir texto completo para la IA
    const tableText = tableRows.map(r => `"${r.label}" -> "${r.value || "(vacío - aquí va el dato)"}"` ).join("\n");
    const paraText = paragraphs.join("\n");
    const fullText = [
        tableRows.length > 0 ? `=== TABLA DEL DOCUMENTO (Etiqueta | Celda de valor) ===\n${tableText}` : "",
        paragraphs.length > 0 ? `=== TEXTO DEL DOCUMENTO ===\n${paraText}` : "",
    ].filter(Boolean).join("\n\n");

    return { paragraphs, tableRows, fullText };
}

// GET: Listar plantillas
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const plantillas = await prisma.plantillaDocumento.findMany({
            orderBy: { createdAt: "desc" }
        });
        return NextResponse.json(plantillas);
    } catch (error: any) {
        console.error("Error obteniendo plantillas:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

// POST: Subir nueva plantilla y analizar con IA
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const nombre = formData.get("nombre") as string;

        if (!file || !nombre) {
            return NextResponse.json({ error: "Faltan datos requeridos (file, nombre)" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Calcular Hash para detectar duplicados
        const hash = crypto.createHash("sha256").update(buffer).digest("hex");

        const existente = await prisma.plantillaDocumento.findFirst({ where: { hash } });
        if (existente) {
            return NextResponse.json({
                success: true,
                message: "Esta plantilla ya existe. Si quieres re-analizarla elimínala y vuelve a subirla.",
                plantilla: existente
            });
        }

        // Subir a Cloudinary
        const { publicId, url } = await uploadFileToCloudinary(
            buffer,
            file.name,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Documentos_Administrativos/Plantillas",
            file.name.replace(/\.[^.]+$/, "")
        );

        // ─── Extraer estructura del documento ────────────────────────────────────
        let documentStructure = { paragraphs: [] as string[], tableRows: [] as Array<{ label: string; value: string }>, fullText: "" };

        try {
            const zip = new PizZip(buffer);
            const rawXml = zip.file("word/document.xml")?.asText() || "";
            if (rawXml) {
                documentStructure = extractDocumentStructure(rawXml);
            }
        } catch (err) {
            console.error("[PLANTILLA] Error al extraer el XML del Word:", err);
        }

        console.log(`[PLANTILLA] Estructura extraída:`, {
            párrafos: documentStructure.paragraphs.length,
            filasDeTablal: documentStructure.tableRows.length,
            texto: documentStructure.fullText.substring(0, 400)
        });

        // ─── Analizar con IA ──────────────────────────────────────────────────────
        let camposDetectados: Array<{ campoPlantilla: string; sugerenciaSistema: string; explicacion: string }> = [];

        if (documentStructure.fullText && documentStructure.fullText.trim().length > 10) {
            try {
                const apiKeyRecord = await prisma.apiKey.findFirst({ where: { provider: "gemini", active: true } });
                const aiKey = apiKeyRecord?.key || process.env.GEMINI_API_KEY;

                if (aiKey) {
                    const ai = new GoogleGenAI({ apiKey: aiKey });

                    const prompt = `Eres un experto en análisis de documentos oficiales para el sistema SISAT-ATP (sistema de gestión escolar en México).

Te voy a mostrar el contenido de una plantilla de constancia o documento oficial que se usa para certificar información de directores y escuelas.

TU MISIÓN: Identificar TODOS los campos donde el sistema debe insertar datos automáticamente cuando se genere el documento para un director específico.

CAMPOS DISPONIBLES EN EL SISTEMA (úsalos EXACTAMENTE como aparecen aquí):
• NOMBRE_DIRECTOR → Nombre completo del director o ATP
• RFC_DIRECTOR → RFC del director
• CURP_DIRECTOR → CURP del director
• FECHA_INGRESO_DIRECTOR → Fecha de ingreso al servicio
• CLAVE_PRESUPUESTAL_DIRECTOR → Clave presupuestal
• TELEFONO_DIRECTOR → Teléfono
• CORREO_DIRECTOR → Correo electrónico
• NOMBRE_ESCUELA → Nombre de la escuela
• CCT_ESCUELA → Clave del Centro de Trabajo
• LOCALIDAD_ESCUELA → Localidad de la escuela
• MUNICIPIO_ESCUELA → Municipio de la escuela
• ZONA_ESCOLAR → Zona escolar
• FECHA_ACTUAL → Fecha del día en que se genera el documento

REGLAS DE DETECCIÓN:
1. Si el documento tiene una TABLA con etiquetas en la columna izquierda y celdas VACÍAS en la derecha → esas celdas vacías son donde van los datos
2. Si hay etiquetas entre llaves como {NOMBRE} → esas son variables explícitas
3. Si hay guiones o subrayados: _________ → ahí van datos
4. Si hay frases como "El (La) Director(a):", "R.F.C.", "Nombre del Centro de Trabajo" seguidas de espacio vacío → ahí van los datos correspondientes
5. Para cada campo encontrado, el campoPlantilla debe ser exactamente la etiqueta/label del documento tal como aparece (ej: "El (La) Director(a):", "{RFC}", "___________")

IMPORTANTE: El campo "campoPlantilla" es la etiqueta o placeholder TAL COMO ESTÁ en el documento. El campo "sugerenciaSistema" es el nombre del campo del sistema que mejor corresponde.

Devuelve ÚNICAMENTE el siguiente JSON sin ningún texto adicional, sin markdown:
{"campos":[{"campoPlantilla":"El (La) Director(a):","sugerenciaSistema":"NOMBRE_DIRECTOR","explicacion":"Nombre del director de la escuela"},{"campoPlantilla":"R.F.C.","sugerenciaSistema":"RFC_DIRECTOR","explicacion":"RFC del director"}]}

CONTENIDO DEL DOCUMENTO A ANALIZAR:
${documentStructure.fullText.substring(0, 7000)}`;

                    const response = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: prompt,
                        config: { temperature: 0.1 }
                    });

                    const aiText = response.text || "";
                    console.log(`[PLANTILLA] Respuesta IA: ${aiText.substring(0, 600)}`);

                    // Extraer JSON de la respuesta
                    const jsonMatch = aiText.match(/\{[\s\S]*"campos"[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.campos && Array.isArray(parsed.campos)) {
                                camposDetectados = parsed.campos;
                                console.log(`[PLANTILLA] Detectados ${camposDetectados.length} campos`);
                            }
                        } catch (parseErr) {
                            console.error("[PLANTILLA] Error parseando JSON:", parseErr);
                        }
                    } else {
                        console.warn("[PLANTILLA] La IA no devolvió JSON válido. Respuesta:", aiText.substring(0, 400));
                    }
                } else {
                    console.warn("[PLANTILLA] No hay API Key configurada para Gemini");
                }
            } catch (aiError) {
                console.error("[PLANTILLA] Error en llamada a IA:", aiError);
            }
        } else {
            console.warn("[PLANTILLA] No se pudo extraer texto suficiente del documento.");
        }

        // Guardar en BD (incluyendo la estructura de tabla para usarla en la generación)
        const plantilla = await prisma.plantillaDocumento.create({
            data: {
                nombre,
                archivoNombre: file.name,
                archivoDriveId: publicId,
                archivoDriveUrl: url,
                hash,
                estado: "NUEVA",
                configuracionCampos: camposDetectados
            }
        });

        return NextResponse.json({ success: true, plantilla });
    } catch (error: any) {
        console.error("Error subiendo plantilla:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
