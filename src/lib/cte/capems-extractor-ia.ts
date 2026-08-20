import JSZip from "jszip";
import { extractTextFromPdf } from "@/lib/pre-revision";
import { callGemini } from "@/lib/gemini";

export interface TemaCapemsIA {
  titulo: string;
  descripcion: string | null;
}

export interface AcuerdoSugeridoCapemsIA {
  texto: string;
}

export interface ResultadoExtraccionCapemsIA {
  temas: TemaCapemsIA[];
  acuerdosSugeridos: AcuerdoSugeridoCapemsIA[];
}

const SYSTEM_INSTRUCTION = `
Eres un asistente experto en gestión pedagógica y administración escolar de Educación Media Superior en México.
Tu tarea es analizar presentaciones y documentos oficiales de sesiones de Consejos Académicos (CAPEMS) y Consejos Técnicos Escolares para extraer la orden del día, temas tratados y compromisos o acuerdos explícitos.
Responde ÚNICAMENTE con el objeto JSON solicitado, sin explicaciones ni markdown.
`.trim();

const PROMPT_BASE = `
Analiza el contenido del documento/presentación oficial de la sesión de CAPEMS adjunto y extrae los temas y acuerdos en formato JSON estricto con la siguiente estructura:

{
  "temas": [
    {
      "titulo": "Título de la sección u orden del día (string)",
      "descripcion": "Resumen conciso del contenido tratado (string o null si es solo un título breve)"
    }
  ],
  "acuerdosSugeridos": [
    {
      "texto": "Texto del acuerdo, compromiso o tarea explicitada (string)"
    }
  ]
}

Reglas estrictas:
1. "temas": Extrae la Orden del Día o los temas/secciones clave desarrollados a lo largo del documento.
2. "acuerdosSugeridos": Incluye acuerdos o compromisos ÚNICAMENTE si el documento los declara de manera explícita (por ejemplo: secciones tituladas "Acuerdos y Compromisos", "Acuerdos Zonales", "Acuerdo 1...", tablas de responsables/evidencias).
3. Si el documento NO declara acuerdos explícitos, devuelve un arreglo vacío [] en "acuerdosSugeridos". NO inventes, infieras ni supongas compromisos.
4. Responde SOLO con el JSON válido, sin bloques de código \`\`\`json ni texto introductorio.
`.trim();

/**
 * Decodifica entidades básicas de XML.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extrae texto de un archivo PPTX analizando los XML de diapositivas en orden numérico.
 */
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries: { name: string; num: number }[] = [];

  // Buscar solo diapositivas: ppt/slides/slide{N}.xml
  zip.forEach((relativePath) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (match) {
      slideEntries.push({
        name: relativePath,
        num: parseInt(match[1], 10),
      });
    }
  });

  // Ordenar numéricamente por número de diapositiva
  slideEntries.sort((a, b) => a.num - b.num);

  const slidesText: string[] = [];

  for (const entry of slideEntries) {
    const file = zip.file(entry.name);
    if (!file) continue;
    const xml = await file.async("text");

    // Extraer todo el texto dentro de etiquetas <a:t>...</a:t>
    const textMatches = Array.from(xml.matchAll(/<a:t(?:[^>]*)>([^<]*)<\/a:t>/g));
    const slideText = textMatches
      .map((m) => decodeXmlEntities(m[1] || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (slideText.length > 0) {
      slidesText.push(`[Diapositiva ${entry.num}]\n${slideText}`);
    }
  }

  return slidesText.join("\n\n---\n\n");
}

/**
 * Limpia y parsea la respuesta JSON de Gemini.
 */
function parseJsonResult(raw: string): ResultadoExtraccionCapemsIA {
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  }

  const parsed = JSON.parse(clean);

  const temas: TemaCapemsIA[] = Array.isArray(parsed.temas)
    ? parsed.temas.map((t: any) => ({
        titulo: String(t.titulo || "").trim(),
        descripcion: t.descripcion ? String(t.descripcion).trim() : null,
      })).filter((t: TemaCapemsIA) => t.titulo.length > 0)
    : [];

  const acuerdosSugeridos: AcuerdoSugeridoCapemsIA[] = Array.isArray(parsed.acuerdosSugeridos)
    ? parsed.acuerdosSugeridos.map((a: any) => ({
        texto: String(a.texto || "").trim(),
      })).filter((a: AcuerdoSugeridoCapemsIA) => a.texto.length > 0)
    : [];

  return { temas, acuerdosSugeridos };
}

/**
 * Extrae orden del día, temas y acuerdos sugeridos de un archivo CAPEMS (PDF o PPTX) usando IA.
 */
export async function extraerTemasAcuerdosCapemsIA(
  buffer: Buffer,
  mimeType: string,
  nombreArchivo: string
): Promise<ResultadoExtraccionCapemsIA> {
  const isPptx =
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    nombreArchivo.toLowerCase().endsWith(".pptx");

  const isPdf =
    mimeType.includes("pdf") ||
    mimeType === "application/pdf" ||
    nombreArchivo.toLowerCase().endsWith(".pdf");

  if (isPptx) {
    console.log(`[capems-extractor-ia] Procesando archivo PPTX: "${nombreArchivo}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    const pptxText = await extractTextFromPptx(buffer);
    console.log(`[capems-extractor-ia] Texto extraído de PPTX: ${pptxText.length} caracteres.`);

    const promptConTexto = `${PROMPT_BASE}\n\nTexto extraído de la presentación PPTX:\n---\n${pptxText.slice(0, 35000)}\n---`;
    const rawResponse = await callGemini(
      SYSTEM_INSTRUCTION,
      promptConTexto,
      undefined,
      undefined,
      undefined,
      false
    );

    return parseJsonResult(rawResponse);
  }

  if (isPdf) {
    console.log(`[capems-extractor-ia] Procesando archivo PDF: "${nombreArchivo}" (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    let extractedText = "";

    try {
      const textResult = await extractTextFromPdf(buffer);
      extractedText = textResult.text || "";
    } catch (e) {
      console.warn("[capems-extractor-ia] No se pudo extraer texto nativo del PDF con pdf-parse:", e);
    }

    if (extractedText.length >= 150) {
      console.log(`[capems-extractor-ia] PDF Digital (${extractedText.length} caracteres). Enviando texto plano a Gemini.`);
      const promptConTexto = `${PROMPT_BASE}\n\nTexto extraído del documento PDF:\n---\n${extractedText.slice(0, 35000)}\n---`;
      const rawResponse = await callGemini(
        SYSTEM_INSTRUCTION,
        promptConTexto,
        undefined,
        undefined,
        undefined,
        false
      );
      return parseJsonResult(rawResponse);
    } else {
      if (buffer.length > 20 * 1024 * 1024) {
        console.warn(
          `[capems-extractor-ia] PDF escaneado demasiado grande para Gemini Vision (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 20 MB). Se omite la extracción con visión.`
        );
        return { temas: [], acuerdosSugeridos: [] };
      }
      console.log(`[capems-extractor-ia] PDF Escaneado o con poco texto (${extractedText.length} caracteres). Usando Gemini Vision.`);
      const rawResponse = await callGemini(
        SYSTEM_INSTRUCTION,
        PROMPT_BASE,
        buffer,
        "application/pdf",
        undefined,
        false
      );
      return parseJsonResult(rawResponse);
    }
  }

  // Fallback si no es PDF ni PPTX
  throw new Error(`Tipo de archivo no soportado para extracción CAPEMS: ${mimeType || nombreArchivo}`);
}
