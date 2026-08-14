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

    // 2. Filtrado y Ponderación Semántica de Documentos Relevantes
    const terminoBusqueda = mensajeUsuario.toLowerCase();
    const palabrasClave = terminoBusqueda
      .replace(/[^\w\sáéíóúñ]/gi, "")
      .split(/\s+/)
      .filter((p) => p.length > 2);

    const documentosPonderados = documentos.map((doc: any) => {
      let score = 0;
      const tituloLow = doc.titulo.toLowerCase();
      const descLow = (doc.descripcion || "").toLowerCase();
      const contenidoLow = doc.contenidoTexto.toLowerCase();
      const tagsLow = (doc.tags || []).map((t: string) => t.toLowerCase());

      for (const palabra of palabrasClave) {
        if (tituloLow.includes(palabra)) score += 10;
        if (tagsLow.some((t: string) => t.includes(palabra))) score += 7;
        if (descLow.includes(palabra)) score += 4;
        if (contenidoLow.includes(palabra)) score += 2;
      }

      return { doc, score };
    });

    // Ordenar por relevancia y tomar los 3 mejores (o los primeros si no hay coincidencia directa)
    documentosPonderados.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    const mejoresDocs = documentosPonderados
      .slice(0, 3)
      .map((item: { doc: any }) => item.doc);

    // 3. Preparar contexto de la base de conocimientos (máx 100000 chars por documento)
    const MAX_CHARS_POR_DOC = 100000;
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
2. Fundamenta tus respuestas ESTRICTAMENTE en la información disponible en el CONTEXTO DE NORMATIVAS OFICIALES.
3. Si el usuario pregunta por un formato o fecha límite específica, indícala con precisión de manera clara (recuerda no usar markdown).
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

    // 4. Llamada al motor LLM Gemini 3.5
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
