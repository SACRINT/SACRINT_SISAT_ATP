import { prisma } from "@/lib/db";
import { AGENT_TOOLS_DECLARATIONS, getAgentToolsDeclarations, executeAgentTool, AgentSessionContext } from "./agentic-tools";
import { sanitizeOutput } from "./sanitizer";

export interface MensajeHistorial {
  role: "user" | "assistant";
  content: string;
}

export interface ModuloCopilotoConfig {
  moduloId: string;
  nombreVisible?: string;
  systemInstruction?: string;
  toolsAllowlist?: string[];
  contextoExtra?: Record<string, any>;
}

export interface RespuestaAgentica {
  respuesta: string;
  fuentes: string[];
  huboFuentes: boolean;
  herramientasEjecutadas: string[];
}

/**
 * Puntero global en memoria para rotación Round-Robin de llaves Gemini.
 */
let globalKeyIndex = 0;

/**
 * Orquestador del Chatbot Agéntico con Function Calling y consultas en vivo a la BD.
 */
export async function procesarConsultaAgentica(
  mensaje: string,
  context: AgentSessionContext,
  historial: MensajeHistorial[] = [],
  moduloConfig?: ModuloCopilotoConfig
): Promise<RespuestaAgentica> {
  const rolDescriptivo = context.role === "director" 
    ? "Director de Plantel Escolar" 
    : context.role === "supervision" 
      ? "Supervisión Escolar" 
      : "Administrador / ATP";

  let systemInstruction = `Eres el Asistente Inteligente Oficial de Supervisión Escolar (SISAT-ATP) de la Secretaría de Educación Pública del Estado de Puebla.
Estás interactuando con un usuario con el rol de: ${rolDescriptivo}.

INSTRUCCIONES CLAVE DE OPERACIÓN:
1. TIENES HERRAMIENTAS DECLARADAS DISPONIBLES:
   - Para consultar estados de entrega, tareas o programas usa 'consultarEstatusEntregas'.
   - Para consultar oficios activos, alertas y plazos urgentes usa 'consultarOficiosPendientes'.
   - Para estadísticas de matrícula, 911 o SICEP usa 'consultarResumen911'.
   - Para fechas y guías de Consejo Técnico Escolar usa 'consultarSesionesCTE'.
   - Para convocatorias de promoción y cambio de categoría usa 'consultarConvocatoriasUsicamm'.
   - Para ranking o cumplimiento de toda la zona usa 'consultarCumplimientoZonal'.
   - Para dudas sobre lineamientos, circulares, PAEC, rúbricas o modelos educativos usa 'consultarNormativasSEP'.
   - Para redactar propuestas formales de oficios usa 'redactarBorradorOficio'.
   - Para auditar matemáticamente datos estadísticos usa 'validarCoherenciaEstadistica911'.
   - Para asesorar detalladamente sobre trámites USICAMM usa 'orientarConvocatoriaUsicamm'.

2. REGLAS DE SEGURIDAD Y PERMISOS:
   - Si una herramienta te responde con 'Acceso denegado', explica cortésmente al usuario que su rol actual no cuenta con los permisos requeridos para consultar esa información global.
   - NUNCA inventes datos numéricos ni fechas cuando una herramienta esté disponible. Basa tu respuesta en los datos retornados por la herramienta.
   - NUNCA expongas datos personales de becarios, RFCs, CURPs ni cuentas bancarias.

3. ESTILO DE COMUNICACIÓN INSTITUCIONAL:
   - Responde siempre en un tono profesional, cortés e institucional ("Estimado(a) Director(a)..." o "Estimada Supervisión...").
   - Utiliza viñetas y tablas limpias para presentar cifras y listas.
   - Al final de tu respuesta cita las fuentes o módulos consultados.`;

  if (moduloConfig?.systemInstruction) {
    systemInstruction += `\n\nCONTEXTO ESPECIALIZADO DEL MÓDULO (${moduloConfig.nombreVisible || moduloConfig.moduloId}):\n${moduloConfig.systemInstruction}`;
  }

  // 1. Obtener llaves activas de Gemini en la BD
  let keys = await prisma.apiKey.findMany({
    where: { provider: "gemini", active: true },
    orderBy: { errorCount: "asc" }
  });

  if (keys.length === 0) {
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
      keys = [{ id: "env", key: envKey, label: "Env Gemini Key", active: true, errorCount: 0 } as any];
    } else {
      throw new Error("No hay llaves de API activas disponibles para el Asistente Inteligente.");
    }
  }

  // 2. Preparar el contenido de la conversación
  const contents: any[] = [];
  
  // Agregar historial previo
  for (const m of historial) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    });
  }

  // Agregar mensaje actual del usuario
  contents.push({
    role: "user",
    parts: [{ text: mensaje }]
  });

  const declarations = getAgentToolsDeclarations(moduloConfig?.toolsAllowlist);
  const toolsPayload = declarations.length > 0
    ? [
        {
          functionDeclarations: declarations
        }
      ]
    : undefined;

  const herramientasEjecutadas: string[] = [];
  const fuentes: string[] = [];
  let respuestaTexto = "";

  // 3. Ejecutar llamada inicial a Gemini con rotación de llaves
  let intento = 0;
  const maxIntentos = keys.length;
  let rawGeminiResponse: any = null;
  let activeKey: string = "";

  while (intento < maxIntentos) {
    const keyObj = keys[globalKeyIndex % keys.length];
    globalKeyIndex++;
    activeKey = keyObj.key;

    try {
      rawGeminiResponse = await callGeminiApiDirect(
        activeKey,
        systemInstruction,
        contents,
        toolsPayload
      );
      break; // Éxito
    } catch (err: any) {
      console.warn(`[agentic-chat] Error con llave "${keyObj.label}": ${err.message}. Intentando siguiente...`);
      if (err.message.includes("401") && keyObj.id !== "env") {
        prisma.apiKey.update({ where: { id: keyObj.id }, data: { active: false, errorCount: 5 } }).catch(() => {});
      }
      intento++;
      if (intento >= maxIntentos) {
        throw new Error("Todos los intentos con las llaves de IA fallaron.");
      }
    }
  }

  const candidate = rawGeminiResponse?.candidates?.[0];
  const modelParts = candidate?.content?.parts || [];
  const functionCallPart = modelParts.find((p: any) => p.functionCall);

  if (functionCallPart?.functionCall) {
    const { name: toolName, args: toolArgs } = functionCallPart.functionCall;
    herramientasEjecutadas.push(toolName);

    console.log(`[agentic-chat] ⚡ Gemini solicitó ejecutar herramienta: "${toolName}" con args:`, toolArgs);

    // 4. Ejecutar la herramienta de forma segura en el servidor
    const toolResult = await executeAgentTool(toolName, toolArgs, context, mensaje);

    if (toolName === "consultarNormativasSEP" && toolResult.data?.fuentes) {
      fuentes.push(...toolResult.data.fuentes);
    } else {
      fuentes.push(`Base de Datos SISAT-ATP (${toolName})`);
    }

    // 5. Construir el turno de respuesta de la función para el modelo
    contents.push({
      role: "model",
      parts: [functionCallPart]
    });

    contents.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: toolName,
            response: {
              output: toolResult
            }
          }
        }
      ]
    });

    // 6. Segunda llamada a Gemini para sintetizar la respuesta final en lenguaje natural con rotación si falla
    let secondTurnSuccess = false;
    let secondAttempt = 0;

    while (secondAttempt < keys.length && !secondTurnSuccess) {
      const currentKey = activeKey || keys[globalKeyIndex % keys.length].key;
      try {
        const secondTurnResponse = await callGeminiApiDirect(
          currentKey,
          systemInstruction,
          contents,
          toolsPayload
        );
        const secondCandidate = secondTurnResponse?.candidates?.[0];
        const textParts = secondCandidate?.content?.parts?.filter((p: any) => p.text) || [];
        respuestaTexto = textParts.map((p: any) => p.text).join("\n").trim();
        secondTurnSuccess = true;
      } catch (secondErr: any) {
        console.warn(`[agentic-chat] Intento de síntesis falló con llave activa: ${secondErr.message}`);
        globalKeyIndex++;
        activeKey = keys[globalKeyIndex % keys.length].key;
        secondAttempt++;
      }
    }

    if (!secondTurnSuccess) {
      respuestaTexto = `Se ejecutó la consulta institucional correctamente:\n\`\`\`json\n${JSON.stringify(toolResult.data || toolResult.mensaje, null, 2)}\n\`\`\``;
    }
  } else {
    // Si Gemini no llamó a ninguna herramienta, tomar el texto directo
    const textParts = modelParts.filter((p: any) => p.text);
    respuestaTexto = textParts.map((p: any) => p.text).join("\n").trim();
  }

  // 7. Aplicar el Sanitizer estricto para evitar cualquier fuga de CURP o RFC
  const respuestaSanitizada = sanitizeOutput(respuestaTexto);

  return {
    respuesta: respuestaSanitizada || "No se pudo generar una respuesta en este momento.",
    fuentes: Array.from(new Set(fuentes)),
    huboFuentes: fuentes.length > 0,
    herramientasEjecutadas
  };
}

/**
 * Llamada HTTP directa a la API v1beta de Google Gemini con soporte de Tools.
 */
async function callGeminiApiDirect(
  apiKey: string,
  systemInstruction: string,
  contents: any[],
  tools?: any[]
): Promise<any> {
  const model = "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents,
    systemInstruction: systemInstruction ? {
      parts: [{ text: systemInstruction }]
    } : undefined,
    tools: tools && tools.length > 0 ? tools : undefined,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  return await response.json();
}
