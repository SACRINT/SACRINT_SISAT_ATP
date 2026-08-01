import { callGemini } from "@/lib/gemini";

export interface AccionHorario {
  tipo: "REGENERAR_CON_RESTRICCIONES" | "MOVER_CELDA" | "FIJAR_CELDA";
  bloqueosDocentes?: { docenteId: string; diasIndisponibles?: number[] }[];
  restriccionDistribucion?: "MAX_1_HR_DIA";
  grupoId?: string;
  docenteId?: string;
  diaOrigen?: number;
  periodoOrigen?: number;
  diaDestino?: number;
  periodoDestino?: number;
}

export interface RespuestaIAHorario {
  explicacion: string;
  acciones: AccionHorario[];
  factible: boolean;
  advertencia?: string;
}

export async function procesarComandoIA(
  mensajeUsuario: string,
  contextoHorario: {
    nombreEscuela: string;
    horasPorDia: number;
    diasLectivos: number;
    grupos: { id: string; nombre: string }[];
    docentes: { id: string; nombreCompleto: string; horasAsignadas: number }[];
    materias: { id: string; nombre: string }[];
    celdasActuales: any[];
    slotsLibresBloqueados?: string[];
    historialConversacion?: { role: string; content: string }[];
  },
  escuelaId?: string
): Promise<RespuestaIAHorario> {
  const systemInstruction = `Eres el Asistente Inteligente de Horarios Escolares para SISAT-ATP (SEP Puebla).
Tu tarea es analizar en lenguaje natural los comandos de directores, VALIDAR LA FACTIBILIDAD MATEMÁTICA de sus peticiones y ejecutar la reorganización óptima mediante el Solver de Restricciones.

REGLAS DE BLOQUEO DE HORAS LIBRES (ESTRICTO E INVIOLABLE):
- El director ha fijado previamente horas libres y bloqueos con candado (🔒).
- Las horas libres bloqueadas NUNCA deben asignarse a ninguna materia.
- Si el usuario dice "respeta las horas libres bloqueadas", debes confirmarle que el Solver las mantendrá estrictamente protegidas como intocables.

IMPORTANTE SOBRE LA MEMORIA CONVERSACIONAL:
- Si el usuario te da una nueva instrucción, DEBES acumularla con las instrucciones anteriores del historial.
- Si te pidió darle el lunes libre a un docente en el mensaje 1, y en el mensaje 2 te pide el martes libre a otro docente, en tu respuesta DEBES INCLUIR LAS RESTRICCIONES DE AMBOS. Si no lo haces, destruirás el trabajo previo.

REGLA DE VALIDACIÓN MATEMÁTICA DE DÍAS LIBRES (CRÍTICO):
1. Si un director pide otorgar un día libre a un docente (ej: "darle el miércoles libre a X"):
   - Días lectivos restantes para el docente = 4 días.
   - Capacidad máxima de horas en 4 días = 4 × horasPorDia (ej: 4 × 6 = 24 horas).
   - Compara las 'horasAsignadas' del docente con la capacidad máxima:
     * Si horasAsignadas > capacidadMáxima (ej: 25 hrs > 24 hrs): ES MATEMÁTICAMENTE IMPOSIBLE otorgar el día entero libre.
     * En este caso DEBES responder con "factible": false, "acciones": [] y explicar claramente al director.

2. Si piden distribuir asignaturas "equitativamente" o "1 hora por día":
   - Agrega a la acción la propiedad "restriccionDistribucion": "MAX_1_HR_DIA".

FORMATO DE RESPUESTA OBLIGATORIO (JSON ESTRICTO):
{
  "explicacion": "Explicación amable y profesional sobre la factibilidad y las acciones aplicadas, mencionando que conservas los cambios previos y los bloqueos de horas libres",
  "factible": true | false,
  "advertencia": "Advertencia en caso de colisión o nulo",
  "acciones": [
    {
      "tipo": "REGENERAR_CON_RESTRICCIONES",
      "restriccionDistribucion": "MAX_1_HR_DIA",
      "bloqueosDocentes": [
        {
          "docenteId": "ID_DEL_DOCENTE",
          "diasIndisponibles": [3]
        }
      ]
    }
  ]
}`;

  const historialPrompt = contextoHorario.historialConversacion && contextoHorario.historialConversacion.length > 0 
    ? `\nHISTORIAL DE LA CONVERSACIÓN (¡Conserva y acumula estas peticiones si son restricciones!):\n${contextoHorario.historialConversacion.map(m => `${m.role === 'user' ? 'DIRECTOR' : 'ASISTENTE'}: ${m.content}`).join('\n')}`
    : "";

  const slotsLibresInfo = contextoHorario.slotsLibresBloqueados && contextoHorario.slotsLibresBloqueados.length > 0
    ? `\nSLOTS LIBRES BLOQUEADOS POR EL DIRECTOR (INTOCABLES): ${JSON.stringify(contextoHorario.slotsLibresBloqueados)}`
    : "";

  const prompt = `
CONTEXTO DE LA ESCUELA:
Escuela: ${contextoHorario.nombreEscuela}
Jornada: ${contextoHorario.horasPorDia} Horas/Día × ${contextoHorario.diasLectivos} Días = ${contextoHorario.horasPorDia * contextoHorario.diasLectivos} hrs semanales máximas por grupo.
Grupos: ${JSON.stringify(contextoHorario.grupos)}
Docentes con Horas Asignadas: ${JSON.stringify(contextoHorario.docentes)}${slotsLibresInfo}${historialPrompt}

NUEVA INSTRUCCIÓN DEL DIRECTOR:
"${mensajeUsuario}"

Analiza la factibilidad matemática, ACUMULA las peticiones previas con la nueva y responde exclusivamente en JSON.`;

  try {
    const rawResponse = await callGemini(
      systemInstruction,
      prompt,
      undefined,
      "application/json",
      undefined,
      false,
      escuelaId
    );

    const cleanJson = rawResponse
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson) as RespuestaIAHorario;
    return parsed;
  } catch (error) {
    console.error("[ai-assistant] Error procesando comando de horario:", error);
    return {
      explicacion: "No pude procesar la instrucción en este momento. Por favor reformula la solicitud.",
      acciones: [],
      factible: false,
      advertencia: "Error de comunicación con el motor de IA."
    };
  }
}
