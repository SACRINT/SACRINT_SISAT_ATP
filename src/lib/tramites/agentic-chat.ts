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
   - Para consultar el personal docente, directivo, administrativo o de apoyo registrado en expedientes de personal y su estado de integración documental usa obligatoriamente 'consultarExpedientesPersonal'.
   - Para estadísticas de matrícula, alumnos o grupos en el formato estadístico anual 911 / SICEP usa 'consultarResumen911' (esta herramienta es EXCLUSIVA de dicho formato estadístico y no sustituye al expediente de personal).
   - Para consultar estados de entrega, tareas o programas usa 'consultarEstatusEntregas'.
   - Para consultar oficios activos, alertas y plazos urgentes usa 'consultarOficiosPendientes'.
   - Para fechas y guías de Consejo Técnico Escolar usa 'consultarSesionesCTE'.
   - Para convocatorias de promoción y cambio de categoría usa 'consultarConvocatoriasUsicamm'.
   - Para ranking o cumplimiento de toda la zona usa 'consultarCumplimientoZonal'.
   - Para dudas sobre lineamientos, circulares, PAEC, rúbricas o modelos educativos usa 'consultarNormativasSEP'.
   - Para redactar propuestas formales de oficios usa 'redactarBorradorOficio'.
   - Para auditar matemáticamente datos estadísticos usa 'validarCoherenciaEstadistica911'.
   - Para asesorar detalladamente sobre trámites USICAMM usa 'orientarConvocatoriaUsicamm'.
   - Para temas, acuerdos, diapositivas y presentaciones de Consejo Académico (CAPEMS) y Reuniones Educativas Regionales CORDE usa 'consultarSesionesCAPEMS' (con parámetro 'query' para buscar temas en diapositivas) y 'consultarCompromisosZonales'.

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
  let activeKeyObj: any = null;

  while (intento < maxIntentos) {
    const keyObj = keys[globalKeyIndex % keys.length];
    globalKeyIndex++;

    try {
      rawGeminiResponse = await callGeminiApiDirect(
        keyObj.key,
        systemInstruction,
        contents,
        toolsPayload
      );
      activeKeyObj = keyObj;
      break; // Éxito
    } catch (err: any) {
      console.warn(`[agentic-chat] Error con llave "${keyObj.label}": ${err.message}. Intentando siguiente...`);
      if (err.message.includes("401") && keyObj.id !== "env") {
        prisma.apiKey.update({ where: { id: keyObj.id }, data: { active: false, errorCount: 10 } }).catch(() => {});
      }
      intento++;
    }
  }

  // Fallback de emergencia a OpenRouter si todas las llaves de Gemini están temporalmente saturadas
  if (!rawGeminiResponse) {
    try {
      const openRouterKeys = await prisma.apiKey.findMany({
        where: { provider: "openrouter", active: true }
      });
      const orKey = openRouterKeys[0]?.key || process.env.OPENROUTER_API_KEY;
      if (orKey) {
        console.log("[agentic-chat] Activando fallback de emergencia con OpenRouter...");
        rawGeminiResponse = await callOpenRouterCompatible(orKey, systemInstruction, contents);
      }
    } catch (orErr: any) {
      console.warn("[agentic-chat] Fallback OpenRouter no disponible:", orErr.message);
    }
  }

  if (!rawGeminiResponse) {
    return {
      respuesta: "Estimado usuario: Los servicios de inteligencia artificial de Google se encuentran experimentando una alta demanda en este momento. Por favor intente su consulta nuevamente en unos instantes.",
      fuentes: [],
      huboFuentes: false,
      herramientasEjecutadas: []
    };
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
      const currentKeyObj = activeKeyObj || keys[globalKeyIndex % keys.length];
      try {
        const secondTurnResponse = await callGeminiApiDirect(
          currentKeyObj.key,
          systemInstruction,
          contents,
          toolsPayload
        );
        const secondCandidate = secondTurnResponse?.candidates?.[0];
        const textParts = secondCandidate?.content?.parts?.filter((p: any) => p.text) || [];
        respuestaTexto = textParts.map((p: any) => p.text).join("\n").trim();
        if (respuestaTexto) {
          secondTurnSuccess = true;
        }
      } catch (secondErr: any) {
        console.warn(`[agentic-chat] Intento de síntesis falló con llave "${currentKeyObj.label}": ${secondErr.message}`);
        if (secondErr.message.includes("401") && currentKeyObj.id !== "env") {
          prisma.apiKey.update({ where: { id: currentKeyObj.id }, data: { active: false, errorCount: 10 } }).catch(() => {});
        }
        globalKeyIndex++;
        activeKeyObj = keys[globalKeyIndex % keys.length];
        secondAttempt++;
      }
    }

    if (!secondTurnSuccess) {
      // Formateo institucional de respaldo limpio garantizado
      if (toolResult.data?.respuesta) {
        respuestaTexto = toolResult.data.respuesta;
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
          respuestaTexto = `Estimado(a) usuario(a):\n\nCon base en las presentaciones oficiales registradas en el sistema, se localizó la siguiente información:\n\n${secciones}\n\nFuente: Base de Datos SISAT-ATP (${toolName})`;
        } else {
          const listaFormateada = toolResult.data.map((item: any) => {
            const itemTitulo = item.titulo || item.descripcion || item.asunto || item.nombre || item.numeroOficio || "Elemento";
            const itemDetalle = item.fechaLimite || item.fechaSesion || item.tipo || "";
            return itemDetalle ? `• ${itemTitulo}: ${itemDetalle}` : `• ${itemTitulo}`;
          }).join("\n");
          respuestaTexto = `Estimado(a) usuario(a):\n\nConforme a los registros del sistema, se localizó la siguiente información institucional:\n\n${listaFormateada}\n\nFuente: Base de Datos SISAT-ATP (${toolName})`;
        }
      } else if (toolResult.mensaje) {
        respuestaTexto = `Estimado(a) usuario(a):\n\n${toolResult.mensaje}`;
      } else if (toolResult.data && typeof toolResult.data === "object" && Object.keys(toolResult.data).length > 0) {
        const campos = Object.entries(toolResult.data)
          .filter(([k]) => k !== "fuentes" && k !== "huboFuentes")
          .map(([k, v]) => `• ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join("\n");
        respuestaTexto = `Estimado(a) usuario(a):\n\nConforme a los registros institucionales:\n\n${campos}\n\nFuente: Base de Datos SISAT-ATP (${toolName})`;
      } else {
        respuestaTexto = "Estimado(a) usuario(a):\n\nNo se encontraron registros activos o pendientes para los criterios consultados en la base de datos de la Supervisión.";
      }
    }
  } else {
    // Si Gemini no llamó a ninguna herramienta, tomar el texto directo
    const textParts = modelParts.filter((p: any) => p.text);
    respuestaTexto = textParts.map((p: any) => p.text).join("\n").trim();
    if (!respuestaTexto && rawGeminiResponse?.choices?.[0]?.message?.content) {
      respuestaTexto = rawGeminiResponse.choices[0].message.content;
    }
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
 * Llamada HTTP directa a la API v1beta de Google Gemini con soporte de Tools y cascada de modelos.
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
      // Si el modelo específico arrojó 404 (no disponible) o 503 (sobrecarga temporal de ese modelo), intentar el siguiente modelo
      if (response.status === 404 || response.status === 503) {
        lastError = new Error(`Gemini API Error (${response.status}): ${errText}`);
        continue;
      }

      // Si es 401 (llave inválida) o 429 (cuota de la cuenta agotada), propagar de inmediato para cambiar de llave
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
 * Fallback a OpenRouter si todos los endpoints nativos de Gemini fallan.
 */
async function callOpenRouterCompatible(
  apiKey: string,
  systemInstruction: string,
  contents: any[]
): Promise<any> {
  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  for (const c of contents) {
    const role = c.role === "model" ? "assistant" : c.role === "user" ? "user" : "user";
    const text = c.parts?.map((p: any) => p.text || JSON.stringify(p)).join("\n") || "";
    if (text) {
      messages.push({ role, content: text });
    }
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-lite-001",
      messages,
      temperature: 0.2
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter Error (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json;
}
