import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

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
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

/**
 * Extrae TODO el texto de un .docx de manera confiable.
 * Intenta docxtemplater primero (más limpio), con fallback a stripping de XML.
 */
function extractTextFromDocx(buffer: Buffer): string {
    let text = "";

    try {
        const zip = new PizZip(buffer);

        // Intento 1: docxtemplater con delimitadores seguros (evita errores con {CAMPO} en el doc)
        try {
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: "[[", end: "]]" } // Delimitadores distintos a {} para no parsear {CAMPO} como variable
            });
            text = doc.getFullText();
            console.log(`[IA-EXTRACCION] docxtemplater OK: ${text.length} chars`);
        } catch (dtErr) {
            console.warn("[IA-EXTRACCION] docxtemplater falló, usando XML strip:", dtErr);
        }

        // Si docxtemplater no produjo texto o falló, usar XML stripping (siempre funciona)
        if (!text || text.trim().length < 20) {
            const rawXml = zip.file("word/document.xml")?.asText() || "";
            if (rawXml) {
                text = rawXml
                    .replace(/<\/w:p>/gi, "\n")   // Párrafos → saltos de línea
                    .replace(/<\/w:tc>/gi, " | ") // Celdas de tabla → separador
                    .replace(/<[^>]+>/g, "")       // Quitar todos los tags XML
                    .replace(/[ \t]{2,}/g, " ")    // Comprimir espacios
                    .replace(/\n{3,}/g, "\n\n")    // Máx 2 saltos de línea
                    .trim();
                console.log(`[IA-EXTRACCION] XML strip OK: ${text.length} chars`);
            }
        }
    } catch (err) {
        console.error("[IA-EXTRACCION] Error leyendo el .docx:", err);
    }

    return text;
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

        // Hash para detectar duplicados
        const hash = crypto.createHash("sha256").update(buffer).digest("hex");
        const existente = await prisma.plantillaDocumento.findFirst({ where: { hash } });
        if (existente) {
            // Si existe pero tiene 0 campos, borrar y re-subir con nuevo análisis
            if (!existente.configuracionCampos || (existente.configuracionCampos as any[]).length === 0) {
                await prisma.plantillaDocumento.delete({ where: { id: existente.id } });
            } else {
                return NextResponse.json({
                    success: true,
                    message: "Plantilla ya existe y tiene campos configurados. Elimínala si quieres re-analizarla.",
                    plantilla: existente
                });
            }
        }

        // Subir a Cloudinary
        const { publicId, url } = await uploadFileToCloudinary(
            buffer,
            file.name,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Documentos_Administrativos/Plantillas",
            file.name.replace(/\.[^.]+$/, "")
        );

        // ─── EXTRACCIÓN DE TEXTO ────────────────────────────────────────────────
        const extractedText = extractTextFromDocx(buffer);
        console.log(`[IA-EXTRACCION] Texto final (${extractedText.length} chars):\n${extractedText.substring(0, 500)}`);

        // ─── ANÁLISIS CON IA ────────────────────────────────────────────────────
        let camposDetectados: Array<{ campoPlantilla: string; sugerenciaSistema: string; explicacion: string }> = [];

        if (extractedText.trim().length < 10) {
            console.error("[IA] No se pudo extraer texto del documento. El archivo puede estar dañado.");
        } else {
            try {
                const apiKeyRecord = await prisma.apiKey.findFirst({ where: { provider: "gemini", active: true } });
                const aiKey = apiKeyRecord?.key || process.env.GEMINI_API_KEY;

                if (!aiKey) {
                    console.error("[IA] No hay API Key de Gemini configurada en el sistema.");
                } else {
                    const ai = new GoogleGenAI({ apiKey: aiKey });

                    const prompt = `Eres un experto en análisis de documentos oficiales para el sistema SISAT-ATP (gestión escolar mexicana).

Analiza el siguiente texto extraído de una plantilla de constancia/documento oficial y detecta TODOS los campos donde se deben insertar datos del director o escuela.

CAMPOS DISPONIBLES EN EL SISTEMA (usa exactamente estos nombres en sugerenciaSistema):
- NOMBRE_DIRECTOR: Nombre completo del director o titular
- RFC_DIRECTOR: RFC del director
- CURP_DIRECTOR: CURP del director
- FECHA_INGRESO_DIRECTOR: Fecha de ingreso al servicio docente
- CLAVE_PRESUPUESTAL_DIRECTOR: Clave presupuestal
- TELEFONO_DIRECTOR: Teléfono
- CORREO_DIRECTOR: Correo electrónico
- NOMBRE_ESCUELA: Nombre completo de la escuela o centro de trabajo
- CCT_ESCUELA: Clave del Centro de Trabajo (CCT o C.T.)
- LOCALIDAD_ESCUELA: Localidad donde está ubicada la escuela
- MUNICIPIO_ESCUELA: Municipio donde está la escuela
- ZONA_ESCOLAR: Zona escolar
- FECHA_ACTUAL: Fecha del día en que se genera el documento

INSTRUCCIONES:
1. Lee el texto y busca etiquetas, labels o encabezados de tabla que correspondan a datos de una persona o escuela
2. Las etiquetas pueden tener formato: "El (La) Director(a):", "R.F.C.", "{NOMBRE_DIRECTOR}", "Nombre del Centro de Trabajo:", "Clave del C.T.", "______", etc.
3. Para cada campo encontrado, indica el nombre exacto de la etiqueta en el documento (campo campoPlantilla) y el campo del sistema que corresponde (campo sugerenciaSistema)
4. Si la etiqueta ya usa formato {NOMBRE_CAMPO}, úsala exactamente así en campoPlantilla
5. Si es una etiqueta de tabla sin llaves (ej: "R.F.C."), úsala tal cual en campoPlantilla

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown:
{"campos":[{"campoPlantilla":"El (La) Director(a):","sugerenciaSistema":"NOMBRE_DIRECTOR","explicacion":"Nombre del director"},{"campoPlantilla":"R.F.C.","sugerenciaSistema":"RFC_DIRECTOR","explicacion":"RFC del director"}]}

TEXTO DEL DOCUMENTO:
${extractedText.substring(0, 8000)}`;

                    const response = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: prompt
                    });

                    const aiText = response.text || "";
                    console.log(`[IA] Respuesta (${aiText.length} chars): ${aiText.substring(0, 800)}`);

                    if (!aiText.trim()) {
                        console.error("[IA] La IA devolvió una respuesta vacía.");
                    } else {
                        const jsonMatch = aiText.match(/\{[\s\S]*"campos"[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (Array.isArray(parsed.campos)) {
                                    camposDetectados = parsed.campos;
                                    console.log(`[IA] ${camposDetectados.length} campos detectados exitosamente.`);
                                }
                            } catch (parseErr) {
                                console.error("[IA] Error parseando JSON:", parseErr, "\nJSON recibido:", jsonMatch[0].substring(0, 300));
                            }
                        } else {
                            console.error("[IA] La respuesta no contiene JSON con 'campos':", aiText.substring(0, 300));
                        }
                    }
                }
            } catch (aiError: any) {
                console.error("[IA] Error en llamada a Gemini:", aiError?.message || aiError);
            }
        }

        // Guardar en BD
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
