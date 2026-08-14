/**
 * planeaciones-evaluator.ts
 * Motor de evaluación de Planeaciones Didácticas con IA (gemini-3.5-flash-lite)
 *
 * Soporta tres rutas de evaluación:
 *  - Semestres 1-4 : MCCEMS 2025-2028 (Propósitos Formativos) → Anexo 12 CC 1-4
 *  - Semestres 5-6 : Generación 2023-2026 (Progresiones)      → Anexo 12 CC 5-6
 *  - Formación Laboral                                         → Guía de Retroalimentación
 */

import { callGemini } from "@/lib/gemini";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type TipoEvaluacion = "FUNDAMENTAL_1_4" | "FUNDAMENTAL_5_6" | "LABORAL";

export interface CriterioResultado {
    id: string;
    criterio: string;
    categoria: string;
    puntajeMax: number;
    puntajeObtenido: number;
    cumple: "SI" | "PARCIAL" | "NO";
    evidencia: string;     // "Archivo, p.X, sección Y"
    observacion: string;   // 1-2 frases sobre el hallazgo
    recomendacion: string; // Texto propuesto para reemplazar/mejorar
}

export interface ResultadoEvaluacion {
    rubricaUsada: string;
    puntajeTotal: number;
    puntajeMaximo: number;
    nivelCumplimiento: "COMPLETO" | "PARCIAL" | "REQUIERE_CORRECCION";
    criterios: CriterioResultado[];
    puntosFuertes: string[];
    mejorasUrgentes: string[];
    observacionesExtendidas: string;
    alineacionPaecPec: string;
    retroalimentacionDocente: string; // Texto formal listo para entregar
}

export interface InputEvaluacion {
    tipoEvaluacion: TipoEvaluacion;
    asignatura: string;
    semestre: number;
    docenteNombre: string;
    cct: string;
    bloqueCorte?: string;
    // Contenidos del archivo planeación (texto extraído del PDF/DOCX)
    textoPlanificacion: string;
    // Contexto del PAEC-PEC (obligatorio)
    textoPaecPec: string;
    // Propósitos / Progresiones del programa oficial (si están en DB)
    propositosOficiales?: string;
    // Buffer del PDF original para enviarlo directamente a Gemini (opcional)
    pdfBuffer?: Buffer;
}

// ── Criterios Oficiales (Anexo 12 USICAMM) ───────────────────────────────────

const CRITERIOS_ANEXO_12_1_4 = `
RUBRO I — PLANEACIÓN DIDÁCTICA (total: 90 pts)
1. Datos generales: institución, docente, grupo, semestre, periodo de evaluación (5 pts)
2. Contextualización: ubicación de la UAC en el Mapa Curricular, correlación de Propósitos Formativos con UACs del semestre (10 pts)
3. Dosificación: identificación de horas-clase-semestre (calendario real), dosificación de Propósitos atendiendo el calendario real en los 3 momentos de evaluación semestral (10 pts)
4. Armonización: explicación de la interrelación entre Categoría–Conceptos centrales–Subcategorías–Conceptos transversales–Metas de aprendizaje–Aprendizaje de trayectoria o Competencias laborales–Proyecto escolar comunitario (20 pts)
5. Secuencia didáctica completa (para uno de los 3 cortes):
   - Planeación de actividades de enseñanza áulica y a distancia
   - Acuerdo de evaluación
   - Estrategias didácticas activas
   - Dinamización / evidencias del logro académico
   - Actividades específicas de Evaluación formativa
   - Fuentes de información física y digital (45 pts)
6. Entrega a tiempo (5 pts — evaluar indicador de fecha)
7. Da a conocer la planeación a los alumnos (5 pts)
8. Elige recursos didácticos diversos y acordes a las actividades (5 pts)

RUBRO II — PRÁCTICA E INTERVENCIÓN EDUCATIVA (total: 70 pts)
1. Crea clima de aprendizaje socioafectivo: normas de convivencia, confianza, diálogo, escucha activa (10 pts)
2. Fomenta relaciones basadas en respeto, comunicación, diálogo y sensibilidad a la diversidad (10 pts)
3. Organiza actividades individual y colectivamente (10 pts)
4. Presenta dominio del contenido y lo vincula transversalmente con otras UAC (30 pts)
5. Usa herramientas tecnológicas según posibilidades del contexto (10 pts)

RUBRO III — EVALUACIÓN Y MEJORA DE LA PRÁCTICA DOCENTE (total: 140 pts)
1. Evalúa coherentemente con su planeación (conocimientos teóricos y prácticos) (20 pts)
2. Adapta/ajusta pertinentemente según condiciones del grupo y retroalimenta (20 pts)
3. Informa resultados de evaluación oportunamente (alumnado y administrativo) (5 pts)
4. Genera estrategias de apoyo para estudiantes en riesgo de reprobación/abandono (10 pts)
5. Evidencia contribuciones al PAEC/PEC (20 pts)
6. Realiza autoevaluación para detectar áreas de oportunidad (20 pts)
7. Realiza análisis de resultados comparando inicio vs. cierre del semestre para mejorar indicadores académicos (30 pts)

PUNTAJE MÁXIMO TOTAL: 300 puntos
`;

const CRITERIOS_ANEXO_12_5_6 = `
RUBRO I — PLANEACIÓN DIDÁCTICA (total: 90 pts)
1. Datos generales: institución, docente, grupo, semestre, periodo de evaluación (5 pts)
2. Contextualización: ubicación de la UAC en el Mapa Curricular, correlación de Progresiones con UACs del semestre (10 pts)
3. Dosificación: identificación de horas-clase-semestre (calendario real), dosificación de Progresiones atendiendo el calendario real en los 3 momentos de evaluación semestral (10 pts)
4. Armonización: explicación de la interrelación entre Categoría–Conceptos centrales–Subcategorías–Conceptos transversales–Metas de aprendizaje–Aprendizaje de trayectoria–Proyecto escolar comunitario (20 pts)
5. Secuencia didáctica completa (para uno de los 3 cortes):
   - Planeación de actividades de enseñanza áulica y a distancia
   - Acuerdo de evaluación
   - Estrategias didácticas activas
   - Dinamización / evidencias del logro académico
   - Actividades específicas de Evaluación formativa
   - Fuentes de información física y digital (45 pts)
6. Entrega a tiempo (5 pts)
7. Da a conocer la planeación a los alumnos (5 pts)
8. Elige recursos didácticos diversos y acordes a las actividades (5 pts)

RUBRO II — PRÁCTICA E INTERVENCIÓN EDUCATIVA (total: 70 pts)
(Mismo que semestres 1-4)

RUBRO III — EVALUACIÓN Y MEJORA DE LA PRÁCTICA DOCENTE (total: 140 pts)
(Mismo que semestres 1-4)

NOTA CLAVE PARA SEMESTRES 5-6: En lugar de "Propósitos Formativos" se evalúan "Progresiones" (Categorías, Subcategorías, Conceptos centrales y Metas de Aprendizaje del MCCEMS generación 2023-2026).

PUNTAJE MÁXIMO TOTAL: 300 puntos
`;

const CRITERIOS_GUIA_LABORAL = `
EVALUACIÓN DE SECUENCIA DIDÁCTICA DE FORMACIÓN LABORAL — BACHILLERATO GENERAL
1. Datos de identificación del plantel y del docente (CCT, nombre, módulo/submódulo, semestre, corte)
2. Competencias laborales que se desarrollan (tomadas del programa oficial de Capacitación)
3. Dosificación: horas por corte, sesiones planificadas vs. calendario real
4. Actividades de aprendizaje práctico: talleres, proyectos, productos, simulaciones
5. Evidencias del logro (portafolios, productos, demostraciones, rúbricas)
6. Instrumentos de evaluación (rúbrica, lista de cotejo, guía de observación)
7. Evaluación formativa y retroalimentación al alumno
8. Contribución al Proyecto Escolar Comunitario (PAEC/PEC)
9. Recursos materiales, equipos y espacios requeridos
10. Estrategias de inclusión y diversidad
`;

const LISTA_COTEJO_BASE = `
LISTA DE COTEJO — VERIFICACIÓN MÍNIMA (todos los semestres)
Cada planeación DEBE incluir como mínimo:
□ Nombre de la institución y CCT
□ Nombre completo del docente
□ Asignatura / UAC / Módulo
□ Semestre y grupo(s)
□ Período / Corte de evaluación
□ Propósito Formativo o Progresión (según semestre)
□ Estrategias didácticas (al menos 2 descritas)
□ Actividades de evaluación formativa
□ Fuentes de información (bibliografía/webgrafía)
□ Firma o constancia de entrega al director
□ Evidencia de que fue dado a conocer a los alumnos
`;

// ── Función principal de evaluación ──────────────────────────────────────────

export async function evaluarPlaneacion(input: InputEvaluacion): Promise<ResultadoEvaluacion> {
    const { tipoEvaluacion, asignatura, semestre, docenteNombre, cct, bloqueCorte, textoPlanificacion, textoPaecPec, propositosOficiales } = input;

    // Selección de criterios según tipo de evaluación
    let criteriosAplicables: string;
    let rubricaUsada: string;
    let instruccionSemestre: string;

    if (tipoEvaluacion === "LABORAL") {
        criteriosAplicables = CRITERIOS_GUIA_LABORAL;
        rubricaUsada = "GUIA_LABORAL";
        instruccionSemestre = "Esta es una Secuencia Didáctica de FORMACIÓN LABORAL (Componente de Capacitación). Evalúa con la Guía de Retroalimentación de Formación Laboral.";
    } else if (tipoEvaluacion === "FUNDAMENTAL_5_6") {
        criteriosAplicables = CRITERIOS_ANEXO_12_5_6;
        rubricaUsada = "ANEXO_12_USICAMM_5_6";
        instruccionSemestre = `Esta planeación corresponde al SEMESTRE ${semestre} (Generación 2023-2026). IMPORTANTE: esta generación trabaja con PROGRESIONES (Categorías, Subcategorías, Conceptos centrales, Metas de Aprendizaje). NO uses los términos "Propósitos Formativos" para evaluarla. Evalúa con el Anexo 12 CC 5-6.`;
    } else {
        criteriosAplicables = CRITERIOS_ANEXO_12_1_4;
        rubricaUsada = "ANEXO_12_USICAMM_1_4";
        instruccionSemestre = `Esta planeación corresponde al SEMESTRE ${semestre} (Generación 2025-2028 MCCEMS). Trabaja con PROPÓSITOS FORMATIVOS y Contenidos Formativos. Evalúa con el Anexo 12 CC 1-4.`;
    }

    const systemInstruction = `Eres un evaluador especialista en educación media superior bachillerato general estatal del estado de Puebla, México. Eres experto en:
- Revisión de Planeaciones Didácticas y Secuencias Didácticas
- El Marco Curricular Común de la Educación Media Superior (MCCEMS 2025-2028)
- El programa de Promoción por Cambio de Categoría (USICAMM) — Anexo 12
- Los lineamientos del PAEC/PEC (Proyecto Académico Escolar Comunitario / Proyecto Escolar Comunitario)
- Las rúbricas, listas de cotejo y criterios oficiales de la Supervisión Escolar del estado de Puebla

MODELO A USAR: gemini-3.5-flash-lite (ÚNICO MODELO AUTORIZADO)

REGLA CRÍTICA DE DISTINCIÓN DE SEMESTRES:
- Semestres 1° a 4° (Generación 2025-2028): usan PROPÓSITOS FORMATIVOS y CONTENIDOS FORMATIVOS. Aplica Anexo 12 CC 1-4.
- Semestres 5° y 6° (Generación 2023-2026): usan PROGRESIONES (Categorías, Subcategorías, Metas). Aplica Anexo 12 CC 5-6.
- Formación Laboral: usa Competencias Laborales. Aplica Guía de Retroalimentación de Formación Laboral.

REGLAS CLAVE DE EVALUACIÓN:
1. Extrae DIRECTAMENTE del Anexo 12 los criterios y puntajes. NO inventes puntajes.
2. Para cada criterio registra: cumple (SI/PARCIAL/NO), puntaje obtenido, evidencia exacta (página/sección del documento), observación breve y recomendación concreta.
3. Alineación con PAEC-PEC: verifica que la planeación declare explícitamente cómo contribuye al Proyecto Escolar Comunitario de la escuela. Si no lo declara, marca el criterio como NO CUMPLE.
4. Alineación curricular: verifica que los Propósitos Formativos / Progresiones correspondan exactamente al programa oficial SEP de la asignatura y semestre.
5. Evaluación formativa: busca instrumentos de evaluación (rúbricas, listas de cotejo, auto-evaluación, co-evaluación), momentos de evaluación y evidencias de retroalimentación.
6. NO PREGUNTES al usuario. Si falta información marca "NO ENCONTRADO" y sugiere qué agregar.
7. Tono: formal, jurídico-administrativo y constructivo. Evita confrontación.

TU RESPUESTA DEBE SER ÚNICAMENTE UN OBJETO JSON VÁLIDO con esta estructura exacta:
{
  "rubricaUsada": "string",
  "puntajeTotal": number,
  "puntajeMaximo": 300,
  "nivelCumplimiento": "COMPLETO" | "PARCIAL" | "REQUIERE_CORRECCION",
  "criterios": [
    {
      "id": "string",
      "criterio": "string",
      "categoria": "PLANEACION_DIDACTICA" | "PRACTICA_INTERVENCION" | "EVALUACION_MEJORA",
      "puntajeMax": number,
      "puntajeObtenido": number,
      "cumple": "SI" | "PARCIAL" | "NO",
      "evidencia": "string (archivo:página:sección)",
      "observacion": "string (1-2 frases)",
      "recomendacion": "string (texto concreto sugerido)"
    }
  ],
  "puntosFuertes": ["string"],
  "mejorasUrgentes": ["string"],
  "observacionesExtendidas": "string",
  "alineacionPaecPec": "string (análisis de la vinculación con el PAEC-PEC)",
  "retroalimentacionDocente": "string (texto formal completo listo para entregar al docente, entre 300 y 500 palabras)"
}`;

    const userPrompt = `PLANEACIÓN A REVISAR:
Docente: ${docenteNombre}
Asignatura: ${asignatura}
Semestre: ${semestre}°
Plantel (CCT): ${cct}
Bloque/Corte: ${bloqueCorte || "No especificado"}

INSTRUCCIÓN DE SEMESTRE: ${instruccionSemestre}

CRITERIOS Y RÚBRICA OFICIALES A APLICAR:
${criteriosAplicables}

${LISTA_COTEJO_BASE}

${propositosOficiales ? `PROPÓSITOS FORMATIVOS / PROGRESIONES OFICIALES DEL PROGRAMA SEP PARA ESTA ASIGNATURA:
${propositosOficiales}

` : ""}CONTEXTO DEL PAEC-PEC DE LA ESCUELA (USO OBLIGATORIO PARA EL CRITERIO DE CONTRIBUCIÓN):
${textoPaecPec.substring(0, 3000)}

TEXTO COMPLETO DE LA PLANEACIÓN DIDÁCTICA A EVALUAR:
${textoPlanificacion.substring(0, 8000)}

Realiza el análisis exhaustivo y entrega el JSON con todos los ítems solicitados.`;

    // Llamada a Gemini usando el pool de llaves de la plataforma
    // Firma: callGemini(systemInstruction, prompt, pdfBuffer?, mimeType?, responseSchema?, usePremium?, escuelaId?)
    const respuesta = await callGemini(
        systemInstruction,
        userPrompt,
        input.pdfBuffer,       // PDF buffer (opcional, si está disponible)
        "application/pdf",
        undefined,             // sin responseSchema forzado (queremos texto JSON libre)
        false,                 // usar modelo default (gemini-3.5-flash-lite)
    );

    // Parsear la respuesta JSON
    let resultado: ResultadoEvaluacion;
    try {
        // Limpiar posibles marcadores de código
        const json = respuesta.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        resultado = JSON.parse(json);
        resultado.rubricaUsada = rubricaUsada;
    } catch {
        // Fallback si la IA no devolvió JSON válido
        resultado = generarResultadoFallback(input, rubricaUsada);
    }

    // Calcular nivel de cumplimiento si no vino en la respuesta
    if (!resultado.nivelCumplimiento) {
        const porcentaje = (resultado.puntajeTotal / resultado.puntajeMaximo) * 100;
        resultado.nivelCumplimiento = porcentaje >= 85 ? "COMPLETO" : porcentaje >= 60 ? "PARCIAL" : "REQUIERE_CORRECCION";
    }

    return resultado;
}

// ── Resultado de respaldo si la IA falla ─────────────────────────────────────

function generarResultadoFallback(input: InputEvaluacion, rubricaUsada: string): ResultadoEvaluacion {
    return {
        rubricaUsada,
        puntajeTotal: 0,
        puntajeMaximo: 300,
        nivelCumplimiento: "REQUIERE_CORRECCION",
        criterios: [],
        puntosFuertes: [],
        mejorasUrgentes: ["No fue posible analizar automáticamente el documento. Se requiere revisión manual por el ATP."],
        observacionesExtendidas: `El sistema de revisión automática no pudo procesar la planeación del docente ${input.docenteNombre} para la asignatura ${input.asignatura}. Por favor, intente nuevamente o contacte al ATP.`,
        alineacionPaecPec: "No determinado — análisis automático no disponible.",
        retroalimentacionDocente: `Estimado/a Profesor/a:\n\nEl sistema no pudo completar el análisis automático de su Planeación Didáctica de ${input.asignatura}, ${input.semestre}° semestre. Le solicitamos que contacte a su director para programar una revisión manual con el ATP de la zona.\n\nAtentamente,\nSupervisión Escolar de Bachilleratos Generales`,
    };
}

// ── Helper: determinar tipo de evaluación según semestre ─────────────────────

export function determinarTipoEvaluacion(semestre: number, tipoAsignatura: string): TipoEvaluacion {
    if (tipoAsignatura === "LABORAL") return "LABORAL";
    if (semestre >= 5) return "FUNDAMENTAL_5_6";
    return "FUNDAMENTAL_1_4";
}
