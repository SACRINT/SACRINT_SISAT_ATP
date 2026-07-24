import { callGemini } from "@/lib/gemini";

export interface AccionHorario {
  tipo: "REGENERAR_CON_RESTRICCIONES" | "MOVER_CELDA" | "FIJAR_CELDA";
  bloqueosDocentes?: { docenteId: string; diasIndisponibles?: number[] }[];
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
  },
  escuelaId?: string
): Promise<RespuestaIAHorario> {
  const systemInstruction = `Eres el Asistente Inteligente de Horarios Escolares para SISAT-ATP (SEP Puebla).
Tu tarea es analizar en lenguaje natural los comandos de directores, VALIDAR LA FACTIBILIDAD MATEMÁTICA de sus peticiones y ejecutar la reorganización óptima mediante el Solver de Restricciones.

REGLA DE VALIDACIÓN MATEMÁTICA DE DÍAS LIBRES (CRÍTICO):
1. Si un director pide otorgar un día libre a un docente (ej: "darle el miércoles libre a X"):
   - Días lectivos restantes para el docente = 4 días.
   - Capacidad máxima de horas en 4 días = 4 × horasPorDia (ej: 4 × 6 = 24 horas).
   - Compara las 'horasAsignadas' del docente con la capacidad máxima:
     * Si horasAsignadas > capacidadMáxima (ej: 25 hrs > 24 hrs): ES MATEMÁTICAMENTE IMPOSIBLE otorgar el día entero libre.
     * En este caso DEBES responder con "factible": false, "acciones": [] y explicar claramente al director: "Estimado Director, no es matemáticamente posible otorgarle el día libre completo al docente X porque cuenta con 25 horas asignadas y en 4 días de trabajo (a 6 hrs por día) solo se pueden cubrir máximo 24 horas. El docente debe asistir al menos 1 hora el 5º día."

2. Si la petición ES FACTIBLE (ej: docente con 20 hrs solicita día libre, y 20 hrs <= 24 hrs):
   - Genera la acción "REGENERAR_CON_RESTRICCIONES" incluyendo el 'docenteId' y los 'diasIndisponibles' (1: Lunes, 2: Martes, 3: Miércoles, 4: Jueves, 5: Viernes).

FORMATO DE RESPUESTA OBLIGATORIO (JSON ESTRICTO):
{
  "explicacion": "Explicación amable y profesional sobre la factibilidad y las acciones aplicadas",
  "factible": true | false,
  "advertencia": "Advertencia en caso de colisión o nulo",
  "acciones": [
    {
      "tipo": "REGENERAR_CON_RESTRICCIONES",
      "bloqueosDocentes": [
        {
          "docenteId": "ID_DEL_DOCENTE",
          "diasIndisponibles": [3]
        }
      ]
    }
  ]
}`;

  const prompt = `
CONTEXTO DE LA ESCUELA:
Escuela: ${contextoHorario.nombreEscuela}
Jornada: ${contextoHorario.horasPorDia} Horas/Día × ${contextoHorario.diasLectivos} Días = ${contextoHorario.horasPorDia * contextoHorario.diasLectivos} hrs semanales máximas por grupo.
Grupos: ${JSON.stringify(contextoHorario.grupos)}
Docentes con Horas Asignadas: ${JSON.stringify(contextoHorario.docentes)}

INSTRUCCIÓN DEL DIRECTOR:
"${mensajeUsuario}"

Analiza la factibilidad matemática y responde exclusivamente en JSON.`;

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
