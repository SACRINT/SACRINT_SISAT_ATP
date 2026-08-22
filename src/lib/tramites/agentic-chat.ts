import { prisma } from "@/lib/db";
import { AGENT_TOOLS_DECLARATIONS, getAgentToolsDeclarations, getOpenAIToolsDeclarations, executeAgentTool, AgentSessionContext } from "./agentic-tools";
import { sanitizeOutput } from "./sanitizer";
import { getAppUrl } from "@/lib/app-url";

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
 * Puntero global en memoria para rotación Round-Robin de llaves (Gemini y OpenRouter).
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
Tu función es orientar, responder dudas y agilizar la gestión administrativa y académica de los centros de trabajo de la zona escolar.
El usuario actual es: ${context.nombreUsuario || "Personal de la Zona"} con cargo de ${rolDescriptivo}.

1. CAPACIDADES Y FUENTE PRIMARIA OBLIGATORIA:
   - Tienes acceso a herramientas para consultar información oficial y en tiempo real de la base de datos de la Supervisión.
   - REGLA DE FUENTE PRIMARIA OBLIGATORIA: Ante cualquier pregunta o duda sobre lineamientos, normativas, manuales, reglamentos, protocolos, leyes, acuerdos oficiales de la SEP o patrimonio/inventarios de bienes (muebles e inmuebles, altas, bajas, resguardos, siniestros), DEBES consultar obligatoriamente 'consultarNormativasSEP' antes de responder.
   - Para consultar el personal docente, directivo, administrativo o de apoyo registrado en expedientes de personal y su estado de integración documental usa obligatoriamente 'consultarExpedientesPersonal'.
   - Para estadísticas de matrícula, alumnos o grupos en el formato estadístico anual 911 / SICEP usa 'consultarResumen911' (esta herramienta es EXCLUSIVA de dicho formato estadístico y no sustituye al expediente de personal).
   - Para consultar estados de entrega, tareas o programas usa 'consultarEstatusEntregas'.
   - Para consultar oficios activos, alertas y plazos urgentes usa 'consultarOficiosPendientes'.
   - Para fechas y guías de Consejo Técnico Escolar usa 'consultarSesionesCTE'.
   - Para convocatorias de promoción y cambio de categoría usa 'consultarConvocatoriasUsicamm'.
   - Para ranking o cumplimiento de toda la zona usa 'consultarCumplimientoZonal'.
   - Para redactar propuestas formales de oficios usa 'redactarBorradorOficio'.
   - Para auditar matemáticamente datos estadísticos usa 'validarCoherenciaEstadistica911'.
   - Para asesorar detalladamente sobre trámites USICAMM usa 'orientarConvocatoriaUsicamm'.
   - Para acuerdos, diapositivas y presentaciones de Consejo Académico (CAPEMS) y Reuniones Educativas Regionales CORDE usa 'consultarSesionesCAPEMS' (como fuente complementaria si la consulta cruza acuerdos o presentaciones de reuniones regionales) y 'consultarCompromisosZonales'.

2. REGLAS DE SEGURIDAD Y PERMISOS:
   - La escuela con estatus de prueba (esDePrueba: true) nunca se cuenta en las estadísticas ni consultas oficiales.
   - La sede de Supervisión Escolar (esSupervision: true) es la oficina central de la zona (Supervisora y ATPs) y no tiene docentes frente a grupo.
   - Si una herramienta te responde con 'Acceso denegado', explica cortésmente al usuario que su rol actual no cuenta con los permisos requeridos para consultar esa información global.
   - NUNCA inventes datos numéricos ni fechas cuando una herramienta esté disponible. Basa tu respuesta en los datos retornados por la herramienta.
   - NUNCA expongas datos personales de becarios, RFCs, CURPs ni cuentas bancarias.

3. ESTILO DE COMUNICACIÓN INSTITUCIONAL:
   - Responde siempre en un tono profesional, cortés e institucional ("Estimado(a) Director(a)..." o "Estimada Supervisión...").
   - Redacta de forma clara y ejecutiva.
   - Al final de tu respuesta cita las fuentes o módulos consultados.

4. REGLAS ESTRICTAS DE FORMATO Y PRESENTACIÓN VISUAL (TEXTO NORMAL):
   - Redacta estrictamente en formato de texto normal, limpio y legible.
   - PROHIBIDO EL USO DE ASTERISCOS: NO utilices asteriscos (** ni *) para poner negritas o cursivas.
   - Para estructurar títulos o destacar conceptos, escribe el nombre del campo seguido de dos puntos (ejemplo: "Fecha límite: 26 de octubre de 2026").
   - Para listar elementos, utiliza viñetas estándar con punto limpio (• ) o numeración ordenada (1., 2., 3.) con separación clara entre renglones.
   - NO utilices símbolos de encabezados markdown (#, ##, ###). Escribe los títulos en un renglón propio con mayúsculas iniciales.`;

  if (moduloConfig?.systemInstruction) {
    systemInstruction += `\n\nCONTEXTO ESPECIALIZADO DEL MÓDULO (${moduloConfig.nombreVisible || moduloConfig.moduloId}):\n${moduloConfig.systemInstruction}`;
  }

  // 1. Obtener llaves activas de Gemini y OpenRouter en la BD (Pool Híbrido)
  let keys = await prisma.apiKey.findMany({
    where: {
      provider: { in: ["gemini", "openrouter"] },
      active: true
    },
    orderBy: [
      { errorCount: "asc" },
      { provider: "asc" }
    ]
  });

  if (keys.length === 0) {
    const envGemini = process.env.GEMINI_API_KEY;
    const envOR = process.env.OPENROUTER_API_KEY;
    if (envGemini) {
      keys.push({ id: "env", key: envGemini, label: "Env Gemini Key", provider: "gemini", active: true, errorCount: 0 } as any);
    }
    if (envOR) {
      keys.push({ id: "env-or", key: envOR, label: "Env OpenRouter Key", provider: "openrouter", active: true, errorCount: 0 } as any);
    }
  }

  if (keys.length === 0) {
    throw new Error("No hay llaves de API activas disponibles para el Asistente Inteligente.");
  }

  // 2. Preparar el contenido de la conversación (formato canónico de contenidos)
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
  const geminiToolsPayload = declarations.length > 0
    ? [
        {
          functionDeclarations: declarations
        }
      ]
    : undefined;
  const openAiToolsPayload = getOpenAIToolsDeclarations(moduloConfig?.toolsAllowlist);

  const herramientasEjecutadas: string[] = [];
  const fuentes: string[] = [];
  let respuestaTexto = "";

  // 3. Ejecutar llamada inicial con rotación de llaves híbrida (Gemini / OpenRouter)
  let intento = 0;
  const maxIntentos = keys.length;
  let rawModelResponse: any = null;
  let activeKeyObj: any = null;

  while (intento < maxIntentos) {
    const keyObj = keys[globalKeyIndex % keys.length];
    globalKeyIndex++;

    try {
      rawModelResponse = await callModelDirect(
        keyObj,
        systemInstruction,
        contents,
        geminiToolsPayload,
        openAiToolsPayload
      );
      activeKeyObj = keyObj;
      break; // Éxito
    } catch (err: any) {
      console.warn(`[agentic-chat] Error con llave "${keyObj.label}" (${keyObj.provider}): ${err.message}. Intentando siguiente...`);
      // 401/403: Desactivar llave permanente en BD. 429/402: Transitorio, NO desactivar.
      if ((err.message.includes("401") || err.message.includes("403")) && !keyObj.id.startsWith("env")) {
        prisma.apiKey.update({ where: { id: keyObj.id }, data: { active: false, errorCount: 10 } }).catch(() => {});
      }
      intento++;
    }
  }

  if (!rawModelResponse) {
    return {
      respuesta: "Estimado usuario: Los servicios de inteligencia artificial se encuentran experimentando una alta demanda en este momento. Por favor intente su consulta nuevamente en unos instantes.",
      fuentes: [],
      huboFuentes: false,
      herramientasEjecutadas: []
    };
  }

  const candidate = rawModelResponse?.candidates?.[0];
  const modelParts = candidate?.content?.parts || [];
  const functionCallParts = modelParts.filter((p: any) => p.functionCall).slice(0, 4);

  if (functionCallParts.length > 0) {
    // 4. Ejecutar todas las herramientas solicitadas en paralelo con Promise.all (máx 4)
    const toolExecutions = await Promise.all(
      functionCallParts.map(async (fcp: any) => {
        const { name: toolName, args: toolArgs } = fcp.functionCall;
        herramientasEjecutadas.push(toolName);
        console.log(`[agentic-chat] ⚡ Modelo solicitó ejecutar herramienta: "${toolName}" con args:`, toolArgs);
        const result = await executeAgentTool(toolName, toolArgs, context, mensaje);
        return {
          fcp,
          toolName,
          toolArgs,
          result
        };
      })
    );

    // Acumular fuentes de cada herramienta ejecutada
    for (const exec of toolExecutions) {
      if (exec.toolName === "consultarNormativasSEP" && exec.result.data?.fuentes) {
        fuentes.push(...exec.result.data.fuentes);
      } else {
        fuentes.push(`Base de Datos SISAT-ATP (${exec.toolName})`);
      }
    }

    // 5. Construir el turno de respuesta de las funciones para el modelo
    contents.push({
      role: "model",
      parts: toolExecutions.map(e => e.fcp)
    });

    contents.push({
      role: "user",
      parts: toolExecutions.map(e => ({
        functionResponse: {
          name: e.toolName,
          response: {
            output: e.result
          }
        }
      }))
    });

    // 6. Segunda llamada para sintetizar la respuesta final con rotación de llaves híbrida
    let secondTurnSuccess = false;
    let secondAttempt = 0;

    while (secondAttempt < keys.length && !secondTurnSuccess) {
      const currentKeyObj = activeKeyObj || keys[globalKeyIndex % keys.length];
      try {
        const secondTurnResponse = await callModelDirect(
          currentKeyObj,
          systemInstruction,
          contents,
          geminiToolsPayload,
          openAiToolsPayload
        );
        const secondCandidate = secondTurnResponse?.candidates?.[0];
        const textParts = secondCandidate?.content?.parts?.filter((p: any) => p.text) || [];
        respuestaTexto = textParts.map((p: any) => p.text).join("\n").trim();
        if (respuestaTexto) {
          secondTurnSuccess = true;
          console.log(`[agentic-chat] ✅ Síntesis LLM completada exitosamente (${currentKeyObj.provider}): ${respuestaTexto.length} caracteres`);
        }
      } catch (secondErr: any) {
        console.warn(`[agentic-chat] Intento de síntesis falló con llave "${currentKeyObj.label}" (${currentKeyObj.provider}): ${secondErr.message}`);
        if ((secondErr.message.includes("401") || secondErr.message.includes("403")) && !currentKeyObj.id.startsWith("env")) {
          prisma.apiKey.update({ where: { id: currentKeyObj.id }, data: { active: false, errorCount: 10 } }).catch(() => {});
        }
        globalKeyIndex++;
        activeKeyObj = keys[globalKeyIndex % keys.length];
        secondAttempt++;
      }
    }

    if (!secondTurnSuccess) {
      console.warn("[agentic-chat] ⚠️ Síntesis LLM no disponible tras agotar intentos; activando formateo de respaldo institucional.");
      // Formateo institucional de respaldo limpio garantizado para cada herramienta
      const seccionesRespaldos = toolExecutions.map(exec => {
        const { toolName, result: toolResult } = exec;
        if (toolResult.data?.respuesta) {
          return toolResult.data.respuesta;
        } else if (toolResult.data && Array.isArray(toolResult.data) && toolResult.data.length > 0) {
          const tieneDiapositivas = toolResult.data.some((item: any) => item.diapositivasCoincidentes && item.diapositivasCoincidentes.length > 0);
          if (tieneDiapositivas) {
            const secciones = toolResult.data
              .filter((item: any) => item.diapositivasCoincidentes && item.diapositivasCoincidentes.length > 0)
              .map((item: any) => {
                const encabezado = item.descripcion || item.archivoNombre || `Sesión ${item.numeroSesion}`;
                const diapositivas = (item.diapositivasCoincidentes || []).map((d: any) => `• Diapositiva ${d.diapositivaNumero}:\n${d.contenido}`).join("\n\n");
                return `Información oficial de "${encabezado}":\n\n${diapositivas}`;
              }).join("\n\n---\n\n");
            return `Con base en las presentaciones oficiales registradas en el sistema:\n\n${secciones}\n\nFuente: Base de Datos SISAT-ATP (${toolName})`;
          } else {
            const listaFormateada = toolResult.data.map((item: any) => {
              const itemTitulo = item.titulo || item.descripcion || item.asunto || item.nombre || item.numeroOficio || "Elemento";
              const itemDetalle = item.fechaLimite || item.fechaSesion || item.tipo || "";
              return itemDetalle ? `• ${itemTitulo}: ${itemDetalle}` : `• ${itemTitulo}`;
            }).join("\n");
            return `Conforme a los registros del sistema:\n\n${listaFormateada}\n\nFuente: Base de Datos SISAT-ATP (${toolName})`;
          }
        } else if (toolResult.mensaje) {
          return toolResult.mensaje;
        } else if (toolResult.data && typeof toolResult.data === "object" && Object.keys(toolResult.data).length > 0) {
          const campos = Object.entries(toolResult.data)
            .filter(([k]) => k !== "fuentes" && k !== "huboFuentes")
            .map(([k, v]) => `• ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
            .join("\n");
          return `Conforme a los registros institucionales:\n\n${campos}\n\nFuente: Base de Datos SISAT-ATP (${toolName})`;
        } else {
          return `No se encontraron registros activos para los criterios consultados en ${toolName}.`;
        }
      });

      respuestaTexto = `Estimado(a) usuario(a):\n\n${seccionesRespaldos.join("\n\n---\n\n")}`;
    }
  } else {
    // Si el modelo no llamó a ninguna herramienta, tomar el texto directo
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
 * Despacha la llamada al proveedor correspondiente (Gemini nativo u OpenRouter con Tools).
 */
async function callModelDirect(
  keyObj: { provider: string; key: string; label: string; id: string },
  systemInstruction: string,
  contents: any[],
  geminiToolsPayload?: any[],
  openAiToolsPayload?: any[]
): Promise<any> {
  if (keyObj.provider === "openrouter") {
    return await callOpenRouterWithTools(keyObj.key, systemInstruction, contents, openAiToolsPayload);
  } else {
    return await callGeminiApiDirect(keyObj.key, systemInstruction, contents, geminiToolsPayload);
  }
}

/**
 * Llamada HTTP directa a la API v1beta de Google Gemini con soporte de Tools y modelos 500 RPD.
 */
async function callGeminiApiDirect(
  apiKey: string,
  systemInstruction: string,
  contents: any[],
  tools?: any[]
): Promise<any> {
  const candidateModels = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
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

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        return await response.json();
      }

      const errText = await response.text();
      // Si el modelo específico arrojó 404 (no disponible) o 503 (sobrecarga temporal), intentar el siguiente modelo
      if (response.status === 404 || response.status === 503) {
        lastError = new Error(`Gemini API Error (${response.status}): ${errText}`);
        continue;
      }

      // 401 (llave inválida) o 429 (cuota de la cuenta agotada): propagar para rotar llave
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    } catch (fetchErr: any) {
      if (fetchErr.message.includes("(401)") || fetchErr.message.includes("(429)")) {
        throw fetchErr;
      }
      lastError = fetchErr;
    }
  }

  throw lastError || new Error("No se pudo conectar con los modelos de Gemini disponibles.");
}

/**
 * Convierte contenidos de estructura canónica Gemini a formato OpenAI Messages compatible con OpenRouter.
 */
function geminiContentsToOpenAI(contents: any[], systemInstruction?: string): any[] {
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  // Mapa para correlacionar functionCall con su functionResponse por (nombre, índice)
  const toolCallMap = new Map<string, string>();

  for (const c of contents) {
    if (c.role === "model") {
      const parts = c.parts || [];
      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join("\n");
      const functionCalls = parts.filter((p: any) => p.functionCall);
      
      if (functionCalls.length > 0) {
        const toolCalls = functionCalls.map((fc: any, idx: number) => {
          const actualId = fc.functionCall.tool_call_id || `call_${fc.functionCall.name}_${idx}`;
          // Registrar en el mapa por (nombre + índice) y por nombre para lookup seguro
          toolCallMap.set(`${fc.functionCall.name}_${idx}`, actualId);
          toolCallMap.set(fc.functionCall.name, actualId);

          return {
            id: actualId,
            type: "function",
            function: {
              name: fc.functionCall.name,
              arguments: JSON.stringify(fc.functionCall.args || {})
            }
          };
        });

        messages.push({
          role: "assistant",
          content: textParts || null,
          tool_calls: toolCalls
        });
      } else {
        messages.push({ role: "assistant", content: textParts });
      }
    } else if (c.role === "user") {
      const parts = c.parts || [];
      const funcResponses = parts.filter((p: any) => p.functionResponse);
      
      if (funcResponses.length > 0) {
        for (let idx = 0; idx < funcResponses.length; idx++) {
          const fr = funcResponses[idx].functionResponse;
          // Buscar el id real correlacionado con el assistant previo
          const matchedId = toolCallMap.get(`${fr.name}_${idx}`) 
            || toolCallMap.get(fr.name) 
            || `call_${fr.name}_${idx}`;

          messages.push({
            role: "tool",
            tool_call_id: matchedId,
            content: JSON.stringify(fr.response?.output || fr.response || {})
          });
        }
      } else {
        const text = parts.map((p: any) => p.text || JSON.stringify(p)).join("\n");
        messages.push({ role: "user", content: text });
      }
    }
  }

  return messages;
}

/**
 * Transforma respuesta de chat completions de OpenAI/OpenRouter a estructura canónica de Gemini.
 */
function openAiResponseToGeminiFormat(openAiJson: any): any {
  const choice = openAiJson?.choices?.[0];
  const message = choice?.message;
  const parts: any[] = [];

  if (message?.tool_calls && message.tool_calls.length > 0) {
    for (const tc of message.tool_calls) {
      let args = {};
      try {
        args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || {});
      } catch {
        args = {};
      }
      parts.push({
        functionCall: {
          name: tc.function?.name,
          args,
          tool_call_id: tc.id
        }
      });
    }
  }

  if (message?.content) {
    parts.push({ text: message.content });
  }

  return {
    candidates: [
      {
        content: {
          role: "model",
          parts
        }
      }
    ],
    rawOpenAi: openAiJson
  };
}

/**
 * Llamada a la API de OpenRouter con soporte completo de Function / Tool Calling y failover de modelos.
 */
async function callOpenRouterWithTools(
  apiKey: string,
  systemInstruction: string,
  contents: any[],
  toolsPayload?: any[]
): Promise<any> {
  const messages = geminiContentsToOpenAI(contents, systemInstruction);
  
  // Modelos verificados en OpenRouter con soporte de tool calling
  const candidateModels = [
    "google/gemini-3.5-flash-lite",
    "deepseek/deepseek-chat",
    "liquid/lfm-2.5-2.6b:free"
  ];

  const appUrl = getAppUrl();
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": appUrl,
          "X-Title": "SISAT-ATP"
        },
        body: JSON.stringify({
          model,
          messages,
          tools: toolsPayload && toolsPayload.length > 0 ? toolsPayload : undefined,
          temperature: 0.2,
          max_tokens: 4096
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (res.ok) {
        const json = await res.json();
        return openAiResponseToGeminiFormat(json);
      }

      const errText = await res.text();
      // Si el modelo específico arrojó 404 (no disponible o descontinuado), intentar siguiente modelo
      if (res.status === 404) {
        console.warn(`[agentic-chat] Modelo OpenRouter "${model}" arrojó 404. Probando siguiente modelo...`);
        lastError = new Error(`OpenRouter Error (${res.status}): ${errText}`);
        continue;
      }

      // Propagar errores de cuota o autorización para rotar llave
      throw new Error(`OpenRouter Error (${res.status}): ${errText}`);
    } catch (fetchErr: any) {
      if (fetchErr.message.includes("(401)") || fetchErr.message.includes("(402)") || fetchErr.message.includes("(403)") || fetchErr.message.includes("(429)")) {
        throw fetchErr;
      }
      lastError = fetchErr;
    }
  }

  throw lastError || new Error("No se pudo conectar con los modelos de OpenRouter.");
}
