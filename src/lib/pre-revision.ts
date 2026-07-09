if (typeof global !== "undefined" && !(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {
        constructor(init?: any) {
            if (init && init.length >= 6) {
                this.a = init[0]; this.b = init[1];
                this.c = init[2]; this.d = init[3];
                this.e = init[4]; this.f = init[5];
            }
        }
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    };
}

import { prisma } from "./db";
import { callGemini } from "./gemini";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { v2 as cloudinary } from "cloudinary";

function parseCloudinaryUrl(url: string) {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(
        /res\.cloudinary\.com\/([^/]+)\/(\w+)\/upload\/(?:v\d+\/)?(.+)$/
    );
    if (!match) return null;

    const cloudName    = match[1];
    const resourceType = match[2];          // "image" | "raw" | "video"
    const fullPath     = match[3];
    const lastDot      = fullPath.lastIndexOf(".");
    const format       = lastDot > 0 ? fullPath.slice(lastDot + 1) : "";

    const publicId =
        resourceType === "raw"
            ? fullPath
            : (lastDot > 0 ? fullPath.slice(0, lastDot) : fullPath);

    return { cloudName, resourceType, publicId, format };
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
        throw new Error("No word/document.xml found in DOCX file");
    }
    const docXml = await docFile.async("string");
    const matches = docXml.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
    const rawText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
    const text = rawText
        .replace(/[ \t]+/g, " ")
        .replace(/\r\n/g, "\n")
        .replace(/\n\s*\n/g, "\n")
        .trim();
    return text;
}

export async function extractTextFromPdf(
    buffer: Buffer,
    pageOptions?: { start?: number; end?: number }
): Promise<{ text: string; total: number }> {
    try {
        console.log("[pre-revision] Starting local PDF text extraction, buffer size:", buffer.length);
        // @ts-ignore
        const pdf = await import("pdf-parse");
        // @ts-ignore
        const { GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        
        const fs = await import("fs");
        const path = await import("path");

        // Read local worker file and encode it to base64 Data URL at runtime
        const workerPath = path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
        console.log("[pre-revision] Reading worker file dynamically at:", workerPath);
        const workerContent = fs.readFileSync(workerPath, "utf8");
        const base64Worker = "data:text/javascript;base64," + Buffer.from(workerContent).toString("base64");
        
        GlobalWorkerOptions.workerSrc = base64Worker;
        console.log("[pre-revision] Configured GlobalWorkerOptions.workerSrc dynamically using fs base64 worker data URL.");

        const uint8Array = new Uint8Array(buffer);
        console.log("[pre-revision] PDFParse constructor initializing with disableWorker: true...");
        const parser: any = new pdf.PDFParse({ data: uint8Array, verbosity: 0, disableWorker: true } as any);
        console.log("[pre-revision] PDFParse loading document...");
        await parser.load();
        console.log("[pre-revision] PDFParse document loaded. Extracting text...");
        
        const parseParams: any = {};
        if (pageOptions?.start && pageOptions?.end) {
            parseParams.first = pageOptions.start;
            parseParams.last = pageOptions.end;
        }
        
        const result = await parser.getText(parseParams);
        const rawText = result?.text || "";
        const text = rawText
            .replace(/[ \t]+/g, " ")
            .replace(/\r\n/g, "\n")
            .replace(/\n\s*\n/g, "\n")
            .trim();
        console.log(`[pre-revision] Text extraction complete. Pages parsed: ${result?.pages?.length || 0}/${result?.total || 0}. Raw length: ${rawText.length}, Clean length: ${text.length}`);
        return { text, total: result?.total || 0 };
    } catch (error) {
        console.error("[pre-revision] Error extracting text from PDF locally:", error);
        throw error;
    }
}

function cleanAndParseGeminiJson(raw: string) {
    let text = raw.trim();
    if (text.startsWith("```")) {
        text = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("[pre-revision] JSON.parse failed, attempting regex fallback repair...", e);
        try {
            const aprobadoMatch = text.match(/"aprobado"\s*:\s*(true|false)/i);
            const puntuacionMatch = text.match(/"puntuacion"\s*:\s*"([^"]*)"/i);
            const estadoMatch = text.match(/"estadoRecomendado"\s*:\s*"([^"]*)"/i);
            
            let observaciones = "";
            const obsStart = text.indexOf('"observaciones"');
            if (obsStart !== -1) {
                const rest = text.substring(obsStart + 15);
                const firstQuote = rest.indexOf('"');
                if (firstQuote !== -1) {
                    const content = rest.substring(firstQuote + 1);
                    const nextKey = content.search(/"\s*,\s*"(?:estadoRecomendado|aprobado|puntuacion)"/);
                    if (nextKey !== -1) {
                        observaciones = content.substring(0, nextKey);
                    } else {
                        const lastBrace = content.lastIndexOf("}");
                        if (lastBrace !== -1) {
                            const trimmed = content.substring(0, lastBrace).trim();
                            observaciones = trimmed.endsWith('"') ? trimmed.slice(0, -1) : trimmed;
                        } else {
                            observaciones = content;
                        }
                    }
                }
            }
            
            return {
                aprobado: aprobadoMatch ? aprobadoMatch[1] === "true" : false,
                puntuacion: puntuacionMatch ? puntuacionMatch[1] : "N/D",
                observaciones: observaciones || "Sin observaciones específicas.",
                estadoRecomendado: estadoMatch ? estadoMatch[1] : "REQUIERE_CORRECCION"
            };
        } catch (repairError) {
            console.error("[pre-revision] Regex repair failed:", repairError);
        }
        throw e;
    }
}

export interface PreRevisionResult {
    tipo: "DIA_NARANJA" | "ACOSO_ESCOLAR" | "PMC" | "PAEC" | "OTROS";
    aprobado?: boolean;
    error?: string;
    // Día Naranja fields
    archivos?: {
        nombre: string;
        etiqueta: string;
        firmado: boolean;
        sellado: boolean;
        explicacion: string;
    }[];
    // Acoso Escolar fields
    tieneIncidencias?: boolean;
    incidenciasDetalle?: {
        mes: string;
        categoria: string;
        edad: string;
        violencia: string[];
        escuela: string;
        cct: string;
        localidad: string;
    }[];
    borradorCorreo?: string;
    firmado?: boolean;
    sellado?: boolean;
    explicacion?: string;
    puntuacion?: string;
}

/**
 * Downloads a file as buffer from a URL (e.g. Cloudinary secure URL)
 */
export async function downloadFile(url: string): Promise<Buffer> {
    if (url.includes("res.cloudinary.com")) {
        try {
            const parsed = parseCloudinaryUrl(url);
            if (parsed) {
                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                    secure: true,
                });

                const tryTypes = [parsed.resourceType, "image", "raw", "video"]
                    .filter((v, i, a) => a.indexOf(v) === i);

                for (const resType of tryTypes) {
                    let id = parsed.publicId;
                    if (resType === "raw" && parsed.format && !id.endsWith(`.${parsed.format}`)) {
                        id = `${id}.${parsed.format}`;
                    } else if (resType !== "raw" && /\.\w{2,5}$/.test(id)) {
                        id = id.replace(/\.[^/.]+$/, "");
                    }

                    try {
                        const signedUrl = cloudinary.utils.private_download_url(id, parsed.format, {
                            resource_type: resType as "image" | "raw" | "video",
                            type: "upload",
                        });

                        console.log(`[pre-revision] Trying to download signed url with resType: ${resType}, id: ${id}`);
                        const res = await fetch(signedUrl, {
                            signal: AbortSignal.timeout(10000)
                        });
                        if (res.ok) {
                            console.log(`[pre-revision] Download success for resType: ${resType}`);
                            const arrayBuffer = await res.arrayBuffer();
                            return Buffer.from(arrayBuffer);
                        } else {
                            console.warn(`[pre-revision] Download failed for resType ${resType} with status: ${res.status}`);
                        }
                    } catch (err) {
                        console.error(`[pre-revision] Error fetching signed URL for ${resType}:`, err);
                    }
                }
            }
        } catch (e: any) {
            console.error("[pre-revision] Error generating signed Cloudinary URL:", e);
        }
    }

    console.log(`[pre-revision] Falling back to direct fetch for URL: ${url}`);
    const res = await fetch(url, {
        signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
        throw new Error(`Failed to download file from ${url} (status ${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Performs background pre-revision analysis for a school delivery
 */
export async function analizarEntregaConIA(entregaId: string, textoCompletoInput?: string): Promise<void> {
    try {
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: {
                archivos: true,
                periodoEntrega: { include: { programa: true } },
                escuela: true,
            }
        });

        if (!entrega || entrega.archivos.length === 0) {
            console.warn(`No files found for delivery ${entregaId} in pre-revision.`);
            return;
        }

        const programaNombre = entrega.periodoEntrega.programa.nombre.toUpperCase().trim();
        const escuelaCct = entrega.escuela.cct;
        const escuelaNombre = entrega.escuela.nombre;

        let resultado: PreRevisionResult | null = null;

        if (programaNombre.includes("DÍA NARANJA") || programaNombre.includes("DIA NARANJA")) {
            // --- DÍA NARANJA PRE-REVISION ---
            const pdfFiles = entrega.archivos.filter(a => a.tipo === "ENTREGA" && a.driveUrl);
            const reportes: any[] = [];

            for (const file of pdfFiles) {
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    
                    const systemInstruction = "Eres un Asesor Técnico Pedagógico experto en revisión de expedientes escolares.";
                    const prompt = `Analiza este documento PDF de entrega correspondiente a la escuela ${escuelaNombre} (${escuelaCct}).
Determina si cuenta con:
1. La firma autógrafa del Director del plantel en la página final o donde se presenten las firmas.
2. El sello oficial de la institución.

Responde únicamente en formato JSON con la siguiente estructura:
{
  "signed": true/false,
  "sealed": true/false,
  "explanation": "Breve explicación detallada de lo encontrado (máximo 2 líneas)"
}`;

                    const rawResponse = await callGemini(systemInstruction, prompt, buffer);
                    const parsed = JSON.parse(rawResponse);

                    reportes.push({
                        nombre: file.nombre,
                        etiqueta: file.etiqueta || "Archivo",
                        firmado: !!parsed.signed,
                        sellado: !!parsed.sealed,
                        explicacion: parsed.explanation || "Analizado correctamente."
                    });
                } catch (e: any) {
                    console.error(`Error analyzing file ${file.nombre}:`, e);
                    reportes.push({
                        nombre: file.nombre,
                        etiqueta: file.etiqueta || "Archivo",
                        firmado: false,
                        sellado: false,
                        explicacion: `Error de análisis: ${e.message}`
                    });
                }
            }

            resultado = {
                tipo: "DIA_NARANJA",
                archivos: reportes,
                aprobado: reportes.every(r => r.firmado && r.sellado)
            };

        } else if (programaNombre.includes("ACOSO ESCOLAR")) {
            // --- ACOSO ESCOLAR PRE-REVISION ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (!file) return;

            const isExcel = file.nombre.toLowerCase().endsWith(".xlsx") || file.nombre.toLowerCase().endsWith(".xls");

            if (isExcel) {
                // EXCEL: Report with incidents
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    const workbook = XLSX.read(buffer, { type: "buffer" });
                    const sheetNames = workbook.SheetNames;
                    const incidencias: any[] = [];

                    for (const sheetName of sheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
                        
                        let currentCategoria = "";
                        for (let r = 7; r < rows.length; r++) {
                            const row = rows[r];
                            if (!row || row.length === 0) continue;
                            
                            if (row[0] && typeof row[0] === 'string' && ['NIÑAS', 'NIÑOS', 'ADOLESCENTES', 'MUJER', 'HOMBRE'].includes(row[0].toUpperCase().trim())) {
                                currentCategoria = row[0].toUpperCase().trim();
                            }
                            
                            const schoolName = row[7];
                            const cct = row[8];
                            
                            if (schoolName || cct) {
                                const agFisica = row[2];
                                const hostigamiento = row[3];
                                const discriminatorio = row[4];
                                const otro = row[5];
                                
                                const tieneCaso = [agFisica, hostigamiento, discriminatorio, otro].some(val => 
                                    val && typeof val === 'string' && val.toUpperCase().trim() === 'X'
                                );
                                
                                if (tieneCaso) {
                                    const tiposViolencia: string[] = [];
                                    if (agFisica && agFisica.toUpperCase().trim() === 'X') tiposViolencia.push("Agresión Física");
                                    if (hostigamiento && hostigamiento.toUpperCase().trim() === 'X') tiposViolencia.push("Hostigamiento");
                                    if (discriminatorio && discriminatorio.toUpperCase().trim() === 'X') tiposViolencia.push("Discriminatorio");
                                    if (otro && otro.toUpperCase().trim() === 'X') tiposViolencia.push("Otro");

                                    incidencias.push({
                                        mes: sheetName,
                                        categoria: currentCategoria || "General",
                                        edad: row[1] || "S/D",
                                        violencia: tiposViolencia,
                                        escuela: schoolName ? schoolName.toString().trim() : "N/D",
                                        cct: cct ? cct.toString().trim() : "N/D",
                                        localidad: row[9] ? row[9].toString().trim() : "N/D"
                                    });
                                }
                            }
                        }
                    }

                    let borradorCorreo = "";
                    if (incidencias.length > 0) {
                        // Call Gemini to draft a formal email with the parsed incidents
                        const systemInstruction = "Eres un Asesor Técnico Pedagógico (ATP) de supervisión escolar de bachilleratos.";
                        const prompt = `Redacta un correo institucional formal dirigido a la Dirección General de Bachilleratos, notificando que se detectaron incidencias de acoso escolar en la zona escolar.
Los detalles de las incidencias reportadas por el director en el archivo Excel son los siguientes:
${JSON.stringify(incidencias, null, 2)}

El correo debe:
- Ser formal, claro y profesional.
- Resumir de forma consolidada las escuelas afectadas, el tipo de población y el tipo de violencia/acoso reportado.
- Mencionar que el reporte fue consolidado por la supervisión de zona a cargo del ATP.

Responde únicamente en formato JSON con la siguiente estructura:
{
  "email_draft": "Cuerpo completo del correo redactado..."
}`;

                        try {
                            const rawResponse = await callGemini(systemInstruction, prompt);
                            const parsed = JSON.parse(rawResponse);
                            borradorCorreo = parsed.email_draft || "";
                        } catch (e) {
                            console.error("Error generating email draft with Gemini:", e);
                            borradorCorreo = `Error al redactar borrador: ${e instanceof Error ? e.message : String(e)}`;
                        }
                    }

                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: true,
                        incidenciasDetalle: incidencias,
                        borradorCorreo: borradorCorreo || "No se pudo generar el borrador."
                    };

                } catch (e: any) {
                    console.error("Error parsing acoso Excel:", e);
                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: true,
                        error: `Error al leer Excel: ${e.message}`,
                        borradorCorreo: "Error al leer el archivo Excel."
                    };
                }

            } else {
                // PDF: Report without incidents (standard letter declaring zero cases)
                try {
                    const buffer = await downloadFile(file.driveUrl!);
                    const systemInstruction = "Eres un Asesor Técnico Pedagógico experto en revisión de expedientes escolares.";
                    const prompt = `Analiza este informe de Acoso Escolar en PDF de la escuela ${escuelaNombre} (${escuelaCct}).
Determina si:
1. El informe cuenta con la firma autógrafa del Director.
2. Cuenta con el sello oficial del plantel.

Responde únicamente en formato JSON con la siguiente estructura:
{
  "signed": true/false,
  "sealed": true/false,
  "explanation": "Breve explicación del análisis visual (máximo 2 líneas)"
}`;

                    const rawResponse = await callGemini(systemInstruction, prompt, buffer);
                    const parsed = JSON.parse(rawResponse);

                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: false,
                        firmado: !!parsed.signed,
                        sellado: !!parsed.sealed,
                        explicacion: parsed.explanation || "Reporte sin incidencias validado correctamente."
                    };
                } catch (e: any) {
                    console.error("Error analyzing acoso PDF:", e);
                    resultado = {
                        tipo: "ACOSO_ESCOLAR",
                        tieneIncidencias: false,
                        firmado: false,
                        sellado: false,
                        explicacion: `Error de análisis visual: ${e.message}`
                    };
                }
            }
        } else if (programaNombre.includes("PMC") || programaNombre.includes("PAEC") || programaNombre.includes("PEC") || programaNombre.includes("PLAN DE MEJORA CONTINUA")) {
            // --- PMC / PAEC PRE-REVISION (Fase 3: Rúbricas y Prompts) ---
            const file = entrega.archivos.find(a => a.tipo === "ENTREGA" && a.driveUrl);
            if (file) {
                const isPmc = programaNombre.includes("PMC") || programaNombre.includes("PLAN DE MEJORA CONTINUA");
                const modulo = isPmc ? "PMC" : "PAEC";

                // 1. Fetch active evaluation template
                const template = await prisma.plantillaEvaluacion.findFirst({
                    where: { modulo, activo: true }
                });

                const templateContent = template?.contenido || (isPmc 
                    ? "Evalúa este Plan de Mejora Continua (PMC) y verifica si cuenta con objetivos, metas y responsables."
                    : "Evalúa este Proyecto Escolar Comunitario (PEC) y verifica que cumpla con los lineamientos del PAEC.");

                try {
                    console.log(`[pre-revision] Starting evaluation of ${modulo} for delivery ${entregaId}...`);
                    
                    let extractedText = textoCompletoInput || "";
                    let buffer: Buffer | null = null;
                    const isDocx = file.nombre.toLowerCase().endsWith(".docx");
                    const isPdf = file.nombre.toLowerCase().endsWith(".pdf");

                    if (!extractedText) {
                        console.log(`[pre-revision] Downloading file: ${file.nombre} from Cloudinary...`);
                        buffer = await downloadFile(file.driveUrl!);
                        console.log(`[pre-revision] File downloaded. Size: ${buffer.length} bytes. Format isDocx: ${isDocx}, isPdf: ${isPdf}`);
                        
                        if (isDocx) {
                            console.log("[pre-revision] Extracting text from DOCX...");
                            extractedText = await extractTextFromDocx(buffer);
                            console.log(`[pre-revision] DOCX text extraction successful. Characters: ${extractedText.length}`);
                        } else if (isPdf) {
                            try {
                                const resPdf = await extractTextFromPdf(buffer);
                                extractedText = resPdf.text;
                            } catch (err) {
                                console.error("[pre-revision] Local PDF text extraction failed. Falling back to raw binary.", err);
                            }
                        }
                    } else {
                        console.log(`[pre-revision] Using provided pre-extracted text. Characters: ${extractedText.length}`);
                    }
                    
                    let geminiRawRes = "";
                    const systemInstruction = "Eres un Asesor Técnico Pedagógico (ATP) experto en evaluación y planeación escolar.";
 
                    const prompt = `A continuación se presenta el prompt maestro de evaluación oficial de la supervisión que define los lineamientos y rúbricas a evaluar:
---
${templateContent}
---
 
Evalúa el documento entregado por el plantel: ${escuelaNombre} (${escuelaCct}).
${extractedText 
    ? "Texto extraído del documento para tu evaluación:\n" + extractedText
    : "El documento se incluye en formato binario para tu análisis."
}
 
Debes responder en formato JSON.
IMPORTANTE - DETALLE Y EXTENSIÓN:
- En la sección "observaciones", redacta un informe de pre-revisión completo, exhaustivo y detallado (de aproximadamente 1000 a 1500 palabras).
- Describe con precisión cada hallazgo, fortaleza, área de oportunidad e inconsistencia detectada.
- Utiliza títulos, subtítulos y viñetas en Markdown dentro de la cadena de texto para dar una estructura sumamente clara.
- Sé específico citando partes del texto analizado si es necesario.`;

                    const responseSchema = {
                        type: "OBJECT",
                        properties: {
                            aprobado: { type: "BOOLEAN" },
                            puntuacion: { type: "STRING" },
                            observaciones: { type: "STRING" },
                            estadoRecomendado: { type: "STRING", enum: ["APROBADO", "REQUIERE_CORRECCION"] }
                        },
                        required: ["aprobado", "puntuacion", "observaciones", "estadoRecomendado"]
                    };
 
                    if (extractedText) {
                        console.log(`[pre-revision] Calling Gemini with EXTRACTED TEXT (${prompt.length} chars). No binary sent.`);
                        geminiRawRes = await callGemini(systemInstruction, prompt, undefined, undefined, responseSchema);
                    } else {
                        if (!buffer) {
                            console.log(`[pre-revision] Downloading file for binary fallback: ${file.nombre}...`);
                            buffer = await downloadFile(file.driveUrl!);
                        }
                        console.log(`[pre-revision] Calling Gemini with BINARY PDF BUFFER (${buffer.length} bytes) and prompt (${prompt.length} chars).`);
                        geminiRawRes = await callGemini(systemInstruction, prompt, buffer, "application/pdf", responseSchema);
                    }
                    console.log(`[pre-revision] Gemini response received. Length: ${geminiRawRes.length} chars.`);
 
                    const parsed = cleanAndParseGeminiJson(geminiRawRes);

                    resultado = {
                        tipo: modulo,
                        aprobado: !!parsed.aprobado,
                        explicacion: `Puntuación obtenida: ${parsed.puntuacion || "N/D"}. Ver detalles de observaciones en el panel de control.`,
                        borradorCorreo: parsed.observaciones || "Sin observaciones específicas.",
                        tieneIncidencias: parsed.estadoRecomendado === "REQUIERE_CORRECCION"
                    };

                } catch (e: any) {
                    console.error(`Error analyzing PMC/PAEC delivery ${entregaId}:`, e);
                    resultado = {
                        tipo: modulo,
                        aprobado: false,
                        explicacion: `Error en análisis automático: ${e.message}`,
                        tieneIncidencias: true
                    };
                }
            }
        }

        // Save result in DB
        if (resultado) {
            await prisma.preRevision.upsert({
                where: { entregaId },
                update: {
                    resultado: resultado as any
                },
                create: {
                    entregaId,
                    resultado: resultado as any
                }
            });
            console.log(`Pre-revision results saved successfully for delivery ${entregaId}`);
        }

    } catch (error) {
        console.error(`Critical error in analizarEntregaConIA for delivery ${entregaId}:`, error);
    }
}
