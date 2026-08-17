import { prisma } from "@/lib/db";
import { callGemini } from "@/lib/gemini";
import { sanitizeOutput } from "./sanitizer";

export interface FuenteOficial {
  id: string;
  titulo: string;
  categoria: string;
  archivoUrl?: string | null;
}

export interface MensajeHistorial {
  role: "user" | "assistant";
  content: string;
}

export interface RespuestaRAGTramite {
  respuesta: string;
  fuentes: FuenteOficial[];
  huboFuentes: boolean;
}

const STOP_WORDS = new Set([
  "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "u",
  "a", "en", "para", "por", "con", "sin", "sobre", "entre", "hacia", "hasta", "desde",
  "cual", "cuales", "cuál", "cuáles", "que", "qué", "quien", "quienes", "quién", "quiénes",
  "como", "cómo", "cuando", "cuándo", "donde", "dónde", "cuanto", "cuantos", "cuánto", "cuántos",
  "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "aquel", "aquella",
  "del", "al", "es", "son", "fue", "era", "ser", "estar", "hay", "tiene", "tienen", "hacer",
  "me", "mi", "mis", "tu", "tus", "su", "sus", "nos", "se", "le", "les", "lo"
]);

type TipoIntencion =
  | "TEMPORAL_CRONOGRAMA"
  | "TRAMITE_FORMATO"
  | "PEDAGOGICO_NORMATIVA"
  | "CONVIVENCIA_SEGURIDAD"
  | "GENERAL";

const TEMPORAL_KEYWORDS = new Set([
  "fecha", "fechas", "cuando", "cuándo", "limite", "límite", "plazo", "plazos",
  "entrega", "entregas", "entregar", "envio", "envío", "enviar", "recepcion", "recepción",
  "periodo", "periodos", "período", "períodos", "cronograma", "calendario", "dias", "días",
  "mes", "meses", "corte", "cortes", "sesion", "sesión", "sesiones",
  "regularizacion", "regularización", "inscripcion", "inscripción", "reinscripcion", "reinscripción",
  "exposicion", "exposición", "visita", "visitas", "inicio", "termino", "término", "fin",
  "extraordinario", "extraordinarios", "titulo", "suficiencia"
]);

const TRAMITE_KEYWORDS = new Set([
  "formato", "formatos", "11 columnas", "kardex", "crad", "cedula", "cédula", "sicep",
  "cordes", "traslado", "traslados", "baja", "bajas", "alta", "altas", "certificado",
  "certificados", "oficio", "oficios", "bitacora", "bitácora", "salida no conforme",
  "salidas no conformes", "link", "enlace", "formulario", "forms", "requisito", "requisitos"
]);

const CONVIVENCIA_KEYWORDS = new Set([
  "emociones", "emocion", "paz", "violencia", "fentanilo", "adicciones", "adiccion",
  "salud", "higiene", "limpieza", "derechos humanos", "mujer", "niña", "ciencia", "tierra"
]);

const PEDAGOGICO_KEYWORDS = new Set([
  "paec", "pec", "pmc", "capems", "cte", "pips", "rubrica", "rúbrica", "cotejo",
  "progresiones", "progresion", "planeacion", "planeación", "secuencia", "uac", "uacs",
  "competencias", "mccems", "mccms", "usicamm", "perfil", "docente"
]);

/**
 * Detecta la categoría/intención temática de la consulta del usuario
 */
function detectarIntencion(queryLower: string): TipoIntencion {
  const palabras = queryLower.replace(/[^\w\sáéíóúñ]/gi, "").split(/\s+/);
  
  if (palabras.some((w) => TEMPORAL_KEYWORDS.has(w))) return "TEMPORAL_CRONOGRAMA";
  if (palabras.some((w) => TRAMITE_KEYWORDS.has(w))) return "TRAMITE_FORMATO";
  if (palabras.some((w) => CONVIVENCIA_KEYWORDS.has(w))) return "CONVIVENCIA_SEGURIDAD";
  if (palabras.some((w) => PEDAGOGICO_KEYWORDS.has(w))) return "PEDAGOGICO_NORMATIVA";
  
  return "GENERAL";
}

/**
 * Expansión semántica ligera de consulta con Gemini
 */
async function expandirConsultaIA(query: string, escuelaId?: string): Promise<string[]> {
  try {
    const sysPrompt = `Eres un asistente de búsqueda normativa SEP.
Dado el mensaje de un director o docente, devuelve únicamente 2 o 3 frases o términos de búsqueda oficiales equivalentes que podrían aparecer en los manuales, circulares o planes de trabajo.
Responde únicamente las frases separadas por saltos de línea (sin números ni viñetas).`;

    const res = await callGemini(sysPrompt, `Consulta: "${query}"`, undefined, "text", undefined, false, escuelaId);
    if (!res || typeof res !== "string") return [];

    return res
      .split("\n")
      .map((l) => l.replace(/^[-*0-9.)\s]+/, "").trim())
      .filter((l) => l.length > 3 && l.length < 100)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Procesa una consulta en lenguaje natural sobre trámites y normativas SEP
 * utilizando la base de conocimiento registrada en PostgreSQL y el LLM Gemini.
 */
export async function responderConsultaNormativa(
  mensajeUsuario: string,
  escuelaId?: string,
  historialPrevio?: MensajeHistorial[]
): Promise<RespuestaRAGTramite> {
  try {
    // 1. Obtener todos los documentos normativos activos (globales o de la escuela)
    const documentos = await prisma.documentoNormativo.findMany({
      where: {
        activo: true,
        OR: [
          { escuelaId: null },
          ...(escuelaId ? [{ escuelaId }] : [])
        ]
      },
      orderBy: { updatedAt: "desc" }
    });

    if (documentos.length === 0) {
      return {
        respuesta: "Actualmente no se han registrado documentos normativos o manuales oficiales en la base de conocimientos. Por favor solicita al Administrador / Supervisión Escolar que cargue las circulares y rúbricas aplicables.",
        fuentes: [],
        huboFuentes: false
      };
    }

    // 2. Detección de Intención y Expansión Semántica de Consulta
    const queryClean = mensajeUsuario.toLowerCase().trim();
    const intencion = detectarIntencion(queryClean);

    const rawWords = queryClean
      .replace(/[^\w\sáéíóúñ]/gi, "")
      .split(/\s+/)
      .filter((p) => p.length > 1);

    const keywords = rawWords.filter((w) => !STOP_WORDS.has(w));

    // Obtener variantes semánticas si la consulta tiene suficiente contenido
    let variantes: string[] = [];
    if (queryClean.length > 10) {
      variantes = await expandirConsultaIA(mensajeUsuario, escuelaId);
    }

    // 3. Ponderación Híbrida Avanzada de Documentos
    const documentosPonderados = documentos.map((doc: any) => {
      let score = 0;
      const tituloLow = (doc.titulo || "").toLowerCase();
      const descLow = (doc.descripcion || "").toLowerCase();
      const contenidoLow = (doc.contenidoTexto || "").toLowerCase();
      const tagsLow = (doc.tags || []).map((t: string) => t.toLowerCase());
      const categoria = (doc.categoria || "").toUpperCase();

      // A) Coincidencia de frase exacta del usuario (+150)
      if (queryClean.length > 6 && contenidoLow.includes(queryClean)) {
        score += 150;
      }

      // B) Coincidencia de Trigramas y Bigramas
      if (rawWords.length >= 3) {
        for (let i = 0; i <= rawWords.length - 3; i++) {
          const trigram = `${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`;
          if (contenidoLow.includes(trigram)) score += 40;
        }
      }
      if (rawWords.length >= 2) {
        for (let i = 0; i <= rawWords.length - 2; i++) {
          const bigram = `${rawWords[i]} ${rawWords[i + 1]}`;
          if (contenidoLow.includes(bigram)) score += 15;
        }
      }

      // C) Coincidencia de Variantes Semánticas generadas por IA
      for (const variante of variantes) {
        const varLow = variante.toLowerCase();
        if (contenidoLow.includes(varLow)) score += 60;
        const varWords = varLow.split(/\s+/).filter((w) => !STOP_WORDS.has(w));
        for (const vw of varWords) {
          if (contenidoLow.includes(vw)) score += 5;
        }
      }

      // D) Bonificación por Intención
      if (intencion === "TEMPORAL_CRONOGRAMA") {
        if (categoria === "PLAN_TRABAJO_PAT" || tituloLow.includes("plan anual") || tituloLow.includes("calendario")) {
          score += 70;
        }
        if (categoria === "CIRCULARES") score += 25;
      } else if (intencion === "TRAMITE_FORMATO") {
        if (categoria === "TRAMITES_SEP" || categoria === "PLAN_TRABAJO_PAT") score += 50;
        if (contenidoLow.includes("forms.cloud.microsoft") || contenidoLow.includes("formato")) score += 30;
      } else if (intencion === "CONVIVENCIA_SEGURIDAD") {
        if (categoria === "SEGURIDAD_CONVIVENCIA" || tituloLow.includes("convivencia") || tituloLow.includes("paz")) {
          score += 70;
        }
      } else if (intencion === "PEDAGOGICO_NORMATIVA") {
        if (categoria === "PAEC_PEC" || categoria === "CAPEMS" || categoria === "HORARIOS_CURRICULO" || categoria === "USICAMM") {
          score += 50;
        }
      }

      // E) Ponderación por palabras clave individuales
      for (const kw of keywords) {
        if (tituloLow.includes(kw)) score += 15;
        if (tagsLow.some((t: string) => t.includes(kw))) score += 10;
        if (descLow.includes(kw)) score += 8;
        if (contenidoLow.includes(kw)) {
          const matches = (contenidoLow.match(new RegExp(kw, "gi")) || []).length;
          score += Math.min(matches * 2, 25);
        }
      }

      return { doc, score };
    });

    // 4. Ordenar y seleccionar los mejores documentos (hasta 6 relevantes)
    documentosPonderados.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    let mejoresItems = documentosPonderados.filter((item: { score: number }) => item.score > 0);
    if (mejoresItems.length === 0) {
      mejoresItems = documentosPonderados.slice(0, 3);
    } else {
      mejoresItems = mejoresItems.slice(0, 6);
    }
    const mejoresDocs = mejoresItems.map((item: { doc: any }) => item.doc);

    // 5. Preparar contexto de la base de conocimientos
    const MAX_CHARS_POR_DOC = 80000;
    const contextoNormativo = mejoresDocs
      .map((d: any, idx: number) => {
        const contenidoTruncado =
          d.contenidoTexto.length > MAX_CHARS_POR_DOC
            ? d.contenidoTexto.substring(0, MAX_CHARS_POR_DOC) + "... [contenido truncado]"
            : d.contenidoTexto;
        return `--- DOCUMENTO [${idx + 1}]: "${d.titulo}" (Categoría: ${d.categoria}) ---\nDESCRIPCIÓN: ${d.descripcion || "N/A"}\nTAGS: ${d.tags?.join(", ") || "N/A"}\nCONTENIDO NORMATIVO:\n${contenidoTruncado}\n`;
      })
      .join("\n\n");

    // Formatear historial conversacional previo si existe
    let bloqueHistorial = "";
    if (historialPrevio && historialPrevio.length > 0) {
      const lineasHistorial = historialPrevio
        .slice(-4)
        .map((m) => `${m.role === "user" ? "Director/Docente" : "Asistente"}: ${m.content}`)
        .join("\n");
      bloqueHistorial = `\nHISTORIAL RECIENTE DE LA CONVERSACIÓN:\n${lineasHistorial}\n`;
    }

    const systemInstruction = `Eres el Asistente Oficial de Trámites, Normativa y Gestión Pedagógica SEP para la Supervisión Escolar (SISAT-ATP).
Tu función es responder dudas de Directores y Docentes sobre el Plan Anual de Trabajo (PAT), planes semestrales, cronogramas de entrega, cartografía de zona, PMC, PAEC/PEC, sesiones CAPEMS, CTE, PIPS, rúbricas USICAMM, circulares, trámites de control escolar SICEP/CORDES, horarios, estadística 911, becas, protocolos de convivencia y procesos administrativos de la SEP Puebla.

PROTOCOLO DE RAZONAMIENTO Y RESPUESTA OBLIGATORIO:
1. Responde de forma amable, clara, profesional e institucional estrictamente en texto normal (texto plano). NO uses formato Markdown (sin asteriscos, sin negritas, sin encabezados con #, sin listas con guiones tipo markdown).
2. Fundamenta tus respuestas ESTRICTAMENTE en la información disponible en el CONTEXTO DE NORMATIVAS OFICIALES. Revisa exhaustivamente las tablas de fechas, procesos, semestres (Semestre A y B) y enlaces del Plan Anual de Trabajo y documentos oficiales.
3. Si el usuario pregunta por un enlace o formulario de entrega, incluye la URL completa exacta (ej. https://forms.cloud.microsoft/...).
4. Si el usuario hace una pregunta de seguimiento (ej. "¿y qué formato se entrega?", "¿cuál es el link?"), apóyate en el HISTORIAL RECIENTE para resolver a qué proceso se refiere.
5. Al final de tu respuesta, INCLUYE SIEMPRE una sección estandarizada:
   📌 Fuente(s) Oficial(es) Consultada(s):
   - Nombre de los documentos fuente utilizados.
6. Si la información solicitada no está disponible en los documentos cargados, responde amablemente indicando que no se cuenta con el lineamiento específico en el sistema y sugiere consultar directamente con la Supervisión Escolar.`;

    const promptText = `
${bloqueHistorial}
CONTEXTO DE NORMATIVAS Y MANUALES OFICIALES DISPONIBLES:
${contextoNormativo}

PREGUNTA ACTUAL DEL DIRECTOR / DOCENTE:
"${mensajeUsuario}"

Proporciona la respuesta institucional basada en las normativas anteriores siguiendo todas las reglas.`;

    // 6. Llamada al motor LLM Gemini
    const respuestaIA = await callGemini(
      systemInstruction,
      promptText,
      undefined,
      "text",
      undefined,
      false,
      escuelaId
    );

    const fuentesOficiales: FuenteOficial[] = mejoresDocs.map((d: any) => ({
      id: d.id,
      titulo: d.titulo,
      categoria: d.categoria,
      archivoUrl: d.archivoUrl
    }));

    return {
      respuesta: sanitizeOutput(respuestaIA),
      fuentes: fuentesOficiales,
      huboFuentes: mejoresDocs.length > 0
    };
  } catch (error) {
    console.error("[rag-engine] Error respondiendo consulta normativa:", error);
    return {
      respuesta: "Ocurrió un error al procesar tu consulta con el motor de normativas. Por favor intenta de nuevo.",
      fuentes: [],
      huboFuentes: false
    };
  }
}
