import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callGemini } from "@/lib/gemini";

export const maxDuration = 60;

// Categorías válidas del sistema
const CATEGORIAS_VALIDAS = [
  "PLAN_TRABAJO_PAT",
  "PMC",
  "PAEC_PEC",
  "CAPEMS",
  "CTE",
  "PIPS",
  "USICAMM",
  "CIRCULARES",
  "TRAMITES_SEP",
  "HORARIOS_CURRICULO",
  "ESTADISTICA_SPARH",
  "SEGURIDAD_CONVIVENCIA",
  "BECAS",
];

async function generarCampo(
  systemInstruction: string,
  prompt: string
): Promise<string> {
  const result = await callGemini(
    systemInstruction,
    prompt,
    undefined,
    "text",
    undefined,
    false,
    undefined
  );
  return result.replace(/^["'`]+|["'`]+$/g, "").replace(/\n+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { titulo, categoria, contenidoTexto } = body;

    if (!contenidoTexto || contenidoTexto.trim().length < 30) {
      return NextResponse.json(
        { error: "El contenido del documento es demasiado corto." },
        { status: 400 }
      );
    }

    // Usar solo los primeros 2500 caracteres del documento
    const extracto = contenidoTexto.substring(0, 2500);

    const sistema = `Eres un asistente especializado en documentos normativos de la SEP (Secretaría de Educación Pública) de México. 
Analizas documentos oficiales escolares con precisión y brevedad.
Responde SOLO con lo que se te pide, sin explicaciones, sin encabezados, sin comillas.`;

    // ── 1. Descripción ──────────────────────────────────────────
    const promptDescripcion = `Analiza este documento oficial y escribe UNA SOLA oración de máximo 180 caracteres que describa:
- Qué tipo de documento es
- Su propósito principal
- A quién va dirigido

Título del documento: "${titulo || "Sin título"}"
Categoría: "${categoria || "General"}"

Extracto:
${extracto}

IMPORTANTE: Responde ÚNICAMENTE con esa oración. Sin comillas. Sin explicaciones. En español institucional.`;

    // ── 2. Tags ────────────────────────────────────────────────
    const promptTags = `Analiza este documento oficial y genera entre 4 y 6 palabras clave (tags) para catalogarlo.

Título: "${titulo || "Sin título"}"
Extracto:
${extracto}

IMPORTANTE:
- Responde ÚNICAMENTE con las palabras clave separadas por comas
- Sin numeración, sin guiones al inicio, sin explicaciones
- En minúsculas, sin acentos
- Ejemplos de buen formato: usicamm, evaluacion-docente, ems, 2026-2027, rubrica
- Incluir: tipo de documento, área, institución, ciclo escolar si aparece`;

    // ── 3. Categoría ────────────────────────────────────────────
    const promptCategoria = `Analiza este documento oficial y determina cuál de las siguientes categorías le corresponde mejor.

Categorías disponibles (responde EXACTAMENTE con uno de estos IDs):
- PLAN_TRABAJO_PAT → Plan Anual de Trabajo (PAT), planes de trabajo semestrales, cronogramas de entrega, cartografía de zona, calendarios oficiales y organización escolar
- PMC → Plan de Mejora Continua (PMC), guías, lineamientos, diagnósticos e informes finales del PMC
- PAEC_PEC → Programa Aula, Escuela y Comunidad (PAEC), proyectos escolares comunitarios (PEC)
- CAPEMS → Consejos Académicos en Comunidades de Aprendizaje Profesional (CAPEMS), fichas, talleres y formación docente
- CTE → Consejo Técnico Escolar (CTE), guías de sesiones, productos y acuerdos de CTE
- PIPS → Plan de Intervención Pedagógica de Supervisión (PIPS), asesoría y acompañamiento pedagógico
- USICAMM → Rúbricas, evaluaciones docentes, convocatorias y procesos de USICAMM
- CIRCULARES → Circulares SEP, circulares de supervisión de zona, comunicados oficiales y memorándums
- TRAMITES_SEP → Trámites escolares, inscripciones, reinscripciones, traslados, certificaciones, regularización, formatos 11 columnas, SICEP, CORDES
- HORARIOS_CURRICULO → Horarios de clases, mapas curriculares, progresiones de aprendizaje, planes de estudio, MCCEMS, NEM
- ESTADISTICA_SPARH → Estadística 911 inicio/fin de cursos, plantillas de personal SPARH, altas y bajas de personal
- SEGURIDAD_CONVIVENCIA → Convivencia escolar, comités de paz, protocolos contra acoso y violencia, BANAVIM, CEDAVIM, salud y nutrición
- BECAS → Convocatorias informativas y avisos de Becas Benito Juárez y programas de apoyo

Título: "${titulo || "Sin título"}"
Extracto:
${extracto.substring(0, 1500)}

Responde ÚNICAMENTE con el ID exacto de la categoría (ejemplo: PLAN_TRABAJO_PAT). Sin explicaciones.`;

    // Ejecutar las 3 llamadas en paralelo para mayor velocidad
    const [rawDescripcion, rawTags, rawCategoria] = await Promise.all([
      generarCampo(sistema, promptDescripcion),
      generarCampo(sistema, promptTags),
      generarCampo(sistema, promptCategoria),
    ]);

    // Limpiar descripción
    const descripcion = rawDescripcion.substring(0, 220);

    // Limpiar tags: separar por coma, limpiar cada uno
    const tags = rawTags
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9\-_áéíóúüñ]/g, ""))
      .filter((t) => t.length > 1)
      .slice(0, 7);

    // Validar categoría: debe ser uno de los IDs válidos
    const categoriaDetectada = CATEGORIAS_VALIDAS.includes(rawCategoria.trim())
      ? rawCategoria.trim()
      : null; // null = no cambiar la categoría actual

    console.log("[generar-descripcion] descripcion:", descripcion);
    console.log("[generar-descripcion] tags:", tags);
    console.log("[generar-descripcion] categoria:", categoriaDetectada);

    return NextResponse.json({
      success: true,
      descripcion,
      tags,
      categoria: categoriaDetectada,
    });
  } catch (error: any) {
    console.error("[generar-descripcion] Error:", error);
    return NextResponse.json(
      { error: "Error al analizar el documento: " + (error?.message || error) },
      { status: 500 }
    );
  }
}
