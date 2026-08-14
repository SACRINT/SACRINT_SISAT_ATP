import { prisma } from "@/lib/db";
import { callGemini } from "@/lib/gemini";

export interface FuenteOficial {
  id: string;
  titulo: string;
  categoria: string;
  archivoUrl?: string | null;
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
  "del", "al", "es", "son", "fue", "era", "ser", "estar", "hay", "tiene", "tienen", "hacer"
]);

const TEMPORAL_KEYWORDS = new Set([
  "fecha", "fechas", "cuando", "cuándo", "limite", "límite", "plazo", "plazos",
  "entrega", "entregas", "entregar", "envio", "envío", "enviar", "recepcion", "recepción",
  "periodo", "periodos", "período", "períodos", "cronograma", "calendario", "dias", "días",
  "mes", "meses", "corte", "cortes", "sesion", "sesión", "sesiones",
  "regularizacion", "regularización", "inscripcion", "inscripción", "reinscripcion", "reinscripción",
  "exposicion", "exposición", "visita", "visitas", "inicio", "termino", "término", "fin"
]);

/**
 * Procesa una consulta en lenguaje natural sobre trámites y normativas SEP
 * utilizando la base de conocimiento registrada en PostgreSQL y el LLM Gemini 3.5.
 */
export async function responderConsultaNormativa(
  mensajeUsuario: string,
  escuelaId?: string
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

    // 2. Filtrado, Ponderación Semántica y Detección de Intención
    const queryClean = mensajeUsuario.toLowerCase().trim();
    const rawWords = queryClean
      .replace(/[^\w\sáéíóúñ]/gi, "")
      .split(/\s+/)
      .filter((p) => p.length > 1);

    const keywords = rawWords.filter((w) => !STOP_WORDS.has(w));
    const isTemporalQuery = rawWords.some((w) => TEMPORAL_KEYWORDS.has(w));

    const documentosPonderados = documentos.map((doc: any) => {
      let score = 0;
      const tituloLow = (doc.titulo || "").toLowerCase();
      const descLow = (doc.descripcion || "").toLowerCase();
      const contenidoLow = (doc.contenidoTexto || "").toLowerCase();
      const tagsLow = (doc.tags || []).map((t: string) => t.toLowerCase());
      const categoria = (doc.categoria || "").toUpperCase();

      // Coincidencia de frase exacta en el contenido
      if (queryClean.length > 8 && contenidoLow.includes(queryClean)) {
        score += 150;
      }

      // Coincidencia de trigramas (3 palabras consecutivas)
      if (rawWords.length >= 3) {
        for (let i = 0; i <= rawWords.length - 3; i++) {
          const trigram = `${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`;
          if (contenidoLow.includes(trigram)) {
            score += 40;
          }
        }
      }

      // Si la consulta pregunta por fechas/plazos/calendario, priorizar Plan Anual de Trabajo
      if (isTemporalQuery) {
        if (categoria === "PLAN_TRABAJO_PAT" || tituloLow.includes("plan anual") || tituloLow.includes("calendario")) {
          score += 60;
        }
      }

      // Ponderación por palabras clave relevantes
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

    // Ordenar por relevancia
    documentosPonderados.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    // Tomar los documentos más relevantes con score > 0 (máximo 6 para dar contexto amplio)
    let mejoresItems = documentosPonderados.filter((item: { score: number }) => item.score > 0);
    if (mejoresItems.length === 0) {
      mejoresItems = documentosPonderados.slice(0, 3);
    } else {
      mejoresItems = mejoresItems.slice(0, 6);
    }
    const mejoresDocs = mejoresItems.map((item: { doc: any }) => item.doc);

    // 3. Preparar contexto de la base de conocimientos (máx 80000 chars por documento)
    const MAX_CHARS_POR_DOC = 80000;
    const contextoNormativo = mejoresDocs
      .map(
        (d: any, idx: number) => {
          const contenidoTruncado = d.contenidoTexto.length > MAX_CHARS_POR_DOC
            ? d.contenidoTexto.substring(0, MAX_CHARS_POR_DOC) + "... [contenido truncado]"
            : d.contenidoTexto;
          return `--- DOCUMENTO [${idx + 1}]: "${d.titulo}" (Categoría: ${d.categoria}) ---\nDESCRIPCIÓN: ${d.descripcion || "N/A"}\nTAGS: ${d.tags?.join(", ") || "N/A"}\nCONTENIDO NORMATIVO:\n${contenidoTruncado}\n`;
        }
      )
      .join("\n\n");

    const systemInstruction = `Eres el Asistente Oficial de Trámites, Normativa y Gestión Pedagógica SEP para la Supervisión Escolar (SISAT-ATP).
Tu función es responder dudas de Directores y Docentes sobre el Plan Anual de Trabajo (PAT), planes semestrales, cronogramas de entrega, cartografía de zona, PMC, PAEC/PEC, sesiones CAPEMS, CTE, PIPS, rúbricas USICAMM, circulares, trámites de control escolar SICEP/CORDES, horarios, estadística 911, becas, protocolos de convivencia y procesos administrativos de la SEP Puebla.

REGLAS OBLIGATORIAS DE RESPUESTA:
1. Responde de forma amable, clara, profesional e institucional estrictamente en texto normal (texto plano). NO uses formato Markdown (sin asteriscos, sin negritas, sin encabezados con #, sin listas de markdown).
2. Fundamenta tus respuestas ESTRICTAMENTE en la información disponible en el CONTEXTO DE NORMATIVAS OFICIALES. Revisa con especial cuidado las tablas de fechas, procesos y cronogramas del Plan Anual de Trabajo y documentos oficiales.
3. Si el usuario pregunta por un formato, enlace de envío o fecha límite específica, indícala con precisión de manera clara (recuerda no usar markdown).
4. Al final de tu respuesta, INCLUYE SIEMPRE una sección estandarizada:
   📌 Fuente(s) Oficial(es) Consultada(s):
   - Nombre de los documentos fuente utilizados.
5. Si la información solicitada no está disponible en los documentos cargados, responde amablemente indicando que no se cuenta con el lineamiento específico en el sistema y sugiere consultar directamente con la Supervisión Escolar.`;

    const promptText = `
CONTEXTO DE NORMATIVAS Y MANUALES OFICIALES DISPONIBLES:
${contextoNormativo}

PREGUNTA DEL DIRECTOR / DOCENTE:
"${mensajeUsuario}"

Proporciona la respuesta institucional basada en las normativas anteriores.`;

    // 4. Llamada al motor LLM Gemini
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
      respuesta: respuestaIA,
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
