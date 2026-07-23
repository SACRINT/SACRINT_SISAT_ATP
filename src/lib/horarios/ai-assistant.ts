import { callGemini } from "@/lib/gemini";
import { CeldaResultado } from "./solver";

export interface AccionHorario {
  tipo: "MOVER_CELDA" | "INTERCAMBIAR_CELDAS" | "FIJAR_CELDA" | "DESBLOQUEAR_CELDA";
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
    grupos: { id: string; nombre: string }[];
    docentes: { id: string; nombreCompleto: string }[];
    materias: { id: string; nombre: string }[];
    celdasActuales: CeldaResultado[];
  },
  escuelaId?: string
): Promise<RespuestaIAHorario> {
  const systemInstruction = `Eres un Asistente Experto en Gestión de Horarios Escolares para SISAT-ATP (SEP Puebla).
Tu objetivo es ayudar a los directores de escuela a realizar ajustes en su matriz de horarios de forma amigable y en lenguaje natural.

REGLAS DE RESPUESTA:
Debes responder SIEMPRE en formato JSON estricto con la siguiente estructura:
{
  "explicacion": "Explicación clara y amable de lo que realizaste o por qué no se puede realizar",
  "factible": true | false,
  "advertencia": "Mensaje de advertencia si hay algún inconveniente potencial o nulo si no hay",
  "acciones": [
    {
      "tipo": "MOVER_CELDA" | "INTERCAMBIAR_CELDAS" | "FIJAR_CELDA" | "DESBLOQUEAR_CELDA",
      "grupoId": "ID del grupo",
      "docenteId": "ID del docente",
      "diaOrigen": 1..5,
      "periodoOrigen": 1..7,
      "diaDestino": 1..5,
      "periodoDestino": 1..7
    }
  ]
}

Días de la semana: 1: Lunes, 2: Martes, 3: Miércoles, 4: Jueves, 5: Viernes.
Periodos: 1 a 7 (Salvo configuración contraria).`;

  const prompt = `
CONTEXTO DE LA ESCUELA:
Escuela: ${contextoHorario.nombreEscuela}
Grupos: ${JSON.stringify(contextoHorario.grupos)}
Docentes (Muestreo): ${JSON.stringify(contextoHorario.docentes.slice(0, 15))}
Materias (Muestreo): ${JSON.stringify(contextoHorario.materias.slice(0, 15))}

ESTADO ACTUAL DE CELDAS PROGRAMADAS (${contextoHorario.celdasActuales.length} celdas):
${JSON.stringify(contextoHorario.celdasActuales.slice(0, 30))}

INSTRUCCIÓN DEL DIRECTOR:
"${mensajeUsuario}"

Analiza la solicitud y devuelve la acción matemática requerida en formato JSON.`;

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

    // Limpiar markdown json codeblock si existe
    const cleanJson = rawResponse
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson) as RespuestaIAHorario;
    return parsed;
  } catch (error) {
    console.error("[ai-assistant] Error procesando comando de horario:", error);
    return {
      explicacion: "No pude procesar el comando correctamente. Por favor intenta reformular tu instrucción (ej. 'Mueve Matemáticas de 1°A del lunes a la 1ª hora al martes a la 3ª hora').",
      acciones: [],
      factible: false,
      advertencia: "Error de comunicación con el motor de IA."
    };
  }
}
