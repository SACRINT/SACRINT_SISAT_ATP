/**
 * ATP-MOD-01 — Extractor OCR y procesador de documentos oficiales
 * 
 * Implementa estrategia en 2 pasos:
 * 1. PDF Digital (pdf-parse extrae >= 150 caracteres): envía el texto plano extraído a Gemini, omitiendo el binario de páginas.
 * 2. PDF Escaneado o Imagen (texto < 150 caracteres): OCR con Gemini Vision.
 *    - Si el PDF escaneado excede 1.5 MB o 10 páginas, lo divide con pdf-lib en bloques de máx 5 páginas / ~800 KB,
 *      extrae metadatos por bloque y fusiona asignando prioridad por nivel de confianza.
 */

import { extractTextFromPdf } from "@/lib/pre-revision";
import { callGemini } from "@/lib/gemini";
import type { ExtraerMetadatosIA } from "./oficios-engine";
import { PDFDocument } from "pdf-lib";

const SYSTEM_INSTRUCTION = `
Eres un asistente experto en administración pública educativa en México.
Tu tarea es extraer metadatos estructurados de documentos oficiales (oficios, circulares, acuerdos).
Responde SOLO con el JSON solicitado, sin markdown ni texto adicional.
`.trim();

const PROMPT_BASE = `
Analiza el documento oficial adjunto y extrae los siguientes campos en formato JSON estricto:

{
  "remitenteNombre": "Nombre completo del firmante o área emisora (string o null)",
  "remitenteEmail": "Correo electrónico del emisor si aparece explícitamente (string o null)",
  "asunto": "Asunto o título del oficio (string)",
  "fechaLimite": "Fecha límite para responder o acusar, en formato ISO 8601 YYYY-MM-DD (string o null si no se menciona)",
  "instrucciones": "Instrucción principal que debe ejecutar el receptor (string, máximo 200 caracteres)",
  "confianza": "Nivel de confianza en la extracción, de 0.0 a 1.0"
}

Reglas:
- Si no encuentras la fecha límite con certeza, devuelve null en fechaLimite.
- El asunto debe ser el del documento, no inferido.
- Usa la fecha del documento como referencia para calcular plazos relativos ("en 5 días hábiles").
- Responde SOLO con el JSON, sin explicaciones.
`.trim();

/**
 * Función principal para procesar un documento (PDF o imagen) con estrategia en 2 pasos y división de PDFs grandes.
 */
export async function procesarDocumentoOcr(
    buffer: Buffer,
    mimeType: string
): Promise<ExtraerMetadatosIA> {
    const isPdf = mimeType.includes("pdf") || mimeType === "application/pdf";

    if (isPdf) {
        let textResult = { text: "", total: 0 };
        try {
            textResult = await extractTextFromPdf(buffer);
        } catch (e) {
            console.warn("[OCR Documento] Error al extraer texto local con pdf-parse:", e);
        }

        const extractedText = textResult.text || "";
        const totalPages = textResult.total || 0;

        // ── Paso 1: PDF Digital con suficiente texto (>= 150 caracteres) ──
        if (extractedText.length >= 150) {
            console.log(`[OCR Documento] PDF Digital detectado (${extractedText.length} caracteres, ${totalPages} págs). Enviando texto plano a Gemini.`);
            const promptConTexto = `${PROMPT_BASE}\n\nTexto extraído del documento PDF:\n---\n${extractedText.slice(0, 15000)}\n---`;
            try {
                const rawResponse = await callGemini(
                    SYSTEM_INSTRUCTION,
                    promptConTexto,
                    undefined, // No enviamos buffer binario para PDF digital
                    undefined,
                    undefined,
                    false
                );
                const clean = rawResponse.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
                const parsed = JSON.parse(clean) as ExtraerMetadatosIA;
                return {
                    ...parsed,
                    bloquesProcesados: 1,
                    modoExtraccion: "TEXTO_DIGITAL",
                    confianza: parsed.confianza ?? 0.95,
                };
            } catch (err) {
                console.error("[OCR Documento] Error procesando texto digital en Gemini:", err);
                // Si falla el envío de texto, continuar al flujo binario/OCR
            }
        }

        // ── Paso 2: PDF Escaneado (o fallback) -> Verificar división (> 1.5MB o > 10 páginas) ──
        const sizeMb = buffer.length / (1024 * 1024);
        const necesitaDivision = sizeMb > 1.5 || totalPages > 10;

        if (necesitaDivision) {
            console.log(`[OCR Documento] PDF grande detectado (${sizeMb.toFixed(2)} MB, ${totalPages} págs). Dividiendo en bloques con pdf-lib.`);
            try {
                const subBuffers = await dividirPdfEnBloques(buffer, 5);
                console.log(`[OCR Documento] PDF dividido exitosamente en ${subBuffers.length} bloques.`);

                const resultados: ExtraerMetadatosIA[] = [];
                for (let i = 0; i < subBuffers.length; i++) {
                    const blockBuf = subBuffers[i];
                    console.log(`[OCR Documento] Procesando bloque ${i + 1}/${subBuffers.length} (${(blockBuf.length / 1024).toFixed(0)} KB)...`);
                    try {
                        const rawRes = await callGemini(
                            SYSTEM_INSTRUCTION,
                            PROMPT_BASE,
                            blockBuf,
                            "application/pdf",
                            undefined,
                            false
                        );
                        const clean = rawRes.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
                        const parsed = JSON.parse(clean) as ExtraerMetadatosIA;
                        resultados.push(parsed);
                    } catch (errBlock) {
                        console.error(`[OCR Documento] Error en bloque ${i + 1}:`, errBlock);
                    }
                }

                if (resultados.length > 0) {
                    const fusionado = fusionarMetadatos(resultados);
                    return {
                        ...fusionado,
                        bloquesProcesados: subBuffers.length,
                        modoExtraccion: "OCR_CHUNKS",
                    };
                }
            } catch (errSplit) {
                console.error("[OCR Documento] Error dividiendo PDF:", errSplit);
                // Fallback al procesamiento directo si falla el splitting
            }
        }

        // PDF Escaneado estándar (sin división)
        console.log(`[OCR Documento] Procesando PDF completo vía Gemini Vision OCR (${sizeMb.toFixed(2)} MB)...`);
        try {
            const rawResponse = await callGemini(
                SYSTEM_INSTRUCTION,
                PROMPT_BASE,
                buffer,
                "application/pdf",
                undefined,
                false
            );
            const clean = rawResponse.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
            const parsed = JSON.parse(clean) as ExtraerMetadatosIA;
            return {
                ...parsed,
                bloquesProcesados: 1,
                modoExtraccion: "OCR_VISION",
            };
        } catch (err) {
            console.error("[OCR Documento] Error en OCR Vision completo:", err);
            return fallbackError();
        }
    } else {
        // Imagen (JPEG, PNG, TIFF, HEIC)
        console.log(`[OCR Documento] Procesando imagen (${mimeType}, ${(buffer.length / 1024).toFixed(0)} KB) vía Gemini Vision OCR...`);
        try {
            const rawResponse = await callGemini(
                SYSTEM_INSTRUCTION,
                PROMPT_BASE,
                buffer,
                mimeType,
                undefined,
                false
            );
            const clean = rawResponse.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
            const parsed = JSON.parse(clean) as ExtraerMetadatosIA;
            return {
                ...parsed,
                bloquesProcesados: 1,
                modoExtraccion: "OCR_VISION",
            };
        } catch (err) {
            console.error("[OCR Documento] Error en OCR de imagen:", err);
            return fallbackError();
        }
    }
}

/**
 * Divide un PDF con pdf-lib en bloques de máximo maxPaginasPorBloque (default 5) y ~800 KB.
 */
async function dividirPdfEnBloques(buffer: Buffer, maxPaginasPorBloque = 5): Promise<Buffer[]> {
    const srcDoc = await PDFDocument.load(buffer);
    const totalPaginas = srcDoc.getPageCount();
    const bloques: Buffer[] = [];

    for (let i = 0; i < totalPaginas; i += maxPaginasPorBloque) {
        const end = Math.min(i + maxPaginasPorBloque, totalPaginas);
        const subBuffer = await extraerRangoPaginas(srcDoc, i, end);

        // Si el bloque excede 900 KB y tiene más de 1 página, dividir recursivamente a la mitad
        if (subBuffer.length > 900 * 1024 && (end - i) > 1) {
            const mitad = Math.ceil((end - i) / 2);
            const sub1 = await extraerRangoPaginas(srcDoc, i, i + mitad);
            const sub2 = await extraerRangoPaginas(srcDoc, i + mitad, end);
            bloques.push(sub1, sub2);
        } else {
            bloques.push(subBuffer);
        }
    }

    return bloques;
}

async function extraerRangoPaginas(srcDoc: PDFDocument, start: number, end: number): Promise<Buffer> {
    const subDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: end - start }, (_, idx) => start + idx);
    const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => subDoc.addPage(page));
    const bytes = await subDoc.save();
    return Buffer.from(bytes);
}

/**
 * Fusiona los metadatos de múltiples bloques:
 * - Prioriza asunto/fechaLimite del bloque con mayor confianza
 * - Remitente en unión (nombres únicos combinados)
 */
function fusionarMetadatos(resultados: ExtraerMetadatosIA[]): ExtraerMetadatosIA {
    if (resultados.length === 0) return fallbackError();
    if (resultados.length === 1) return resultados[0];

    // Ordenar por confianza descendente
    const ordenados = [...resultados].sort((a, b) => (b.confianza ?? 0) - (a.confianza ?? 0));
    const mejor = ordenados[0];

    // Asunto del bloque con mayor confianza
    let asunto = mejor.asunto;
    if (!asunto) {
        const alt = ordenados.find(r => r.asunto && r.asunto.trim().length > 0);
        if (alt) asunto = alt.asunto;
    }

    // Fecha límite del bloque con mayor confianza (o primera no-null)
    let fechaLimite = mejor.fechaLimite ?? null;
    if (!fechaLimite) {
        const altFecha = ordenados.find(r => r.fechaLimite);
        if (altFecha) fechaLimite = altFecha.fechaLimite ?? null;
    }

    // Nombres de remitente en unión
    const remitentesSet = new Set<string>();
    resultados.forEach(r => {
        if (r.remitenteNombre && r.remitenteNombre.trim().length > 0) {
            remitentesSet.add(r.remitenteNombre.trim());
        }
    });
    const remitenteNombre = Array.from(remitentesSet).join(" / ") || mejor.remitenteNombre;

    // Email de remitente (primero válido)
    const remitenteEmail = resultados.find(r => r.remitenteEmail)?.remitenteEmail ?? mejor.remitenteEmail;

    // Instrucciones principales
    const instrucciones = mejor.instrucciones || resultados.find(r => r.instrucciones)?.instrucciones;

    // Confianza máxima
    const confianzaMax = Math.max(...resultados.map(r => r.confianza ?? 0));

    return {
        remitenteNombre,
        remitenteEmail,
        asunto,
        fechaLimite,
        instrucciones,
        confianza: confianzaMax,
    };
}

function fallbackError(): ExtraerMetadatosIA {
    return {
        remitenteNombre: undefined,
        remitenteEmail: undefined,
        asunto: undefined,
        fechaLimite: null,
        instrucciones: undefined,
        confianza: 0,
        bloquesProcesados: 0,
    };
}
