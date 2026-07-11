import { prisma } from "./db";

export interface GeminiResponse {
    signed?: boolean;
    sealed?: boolean;
    explanation?: string;
    incidents_exist?: boolean;
    email_draft?: string;
    text?: string;
}

/**
 * Helper to call AI models (Gemini, Claude, OpenAI, DeepSeek, OpenRouter)
 * with automatic rotative API Key pool and failover.
 */
export async function callGemini(
    systemInstruction: string,
    prompt: string,
    pdfBuffer?: Buffer,
    pdfMimeType: string = "application/pdf",
    responseSchema?: any,
    usePremiumModel: boolean = false
): Promise<string> {
    // 1. Cargar la configuración actual de IA
    let config = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });
    if (!config) {
        config = await prisma.preRevisionConfig.create({
            data: { id: "singleton", activoDirectores: false, limiteIntentos: 3 },
        });
    }

    const providerToUse = usePremiumModel ? config.providerPremium : config.providerDefault;
    const modelToUse = usePremiumModel ? config.modelPremium : config.modelDefault;

    console.log(`[orquestador-ia] Solicitud de IA. Proveedor: ${providerToUse}, Modelo: ${modelToUse}, Premium: ${usePremiumModel}`);
    // Reactivar automáticamente llaves bloqueadas hace más de 15 minutos
    const checkTime = new Date(Date.now() - 15 * 60 * 1000);
    try {
        await prisma.apiKey.updateMany({
            where: {
                active: false,
                errorCount: { gte: 5 },
                updatedAt: { lte: checkTime },
            },
            data: {
                active: true,
                errorCount: 0,
            },
        });
    } catch (err) {
        console.error("[orquestador-ia] Error reactivando llaves bloqueadas automáticamente:", err);
    }

    // 2. Obtener llaves de API activas para el proveedor seleccionado
    const keys = await prisma.apiKey.findMany({
        where: {
            provider: providerToUse,
            active: true,
            isPremium: usePremiumModel ? undefined : false, // para uso estándar de directores, no usar llaves premium
        },
        orderBy: {
            errorCount: "asc", // Priorizar llaves con menos errores recientes
        },
    });

    console.log(`[orquestador-ia] Encontradas ${keys.length} llaves activas en base de datos para el proveedor ${providerToUse}.`);

    // 3. Si no hay llaves configuradas en la BD, buscar en las variables de entorno (.env) como fallback
    if (keys.length === 0) {
        const fallbackKey = getFallbackEnvKey(providerToUse);
        if (!fallbackKey) {
            console.warn(`[orquestador-ia] Sin llaves en base de datos ni variable de entorno para ${providerToUse}. Iniciando simulación.`);
            return getSimulatedResponse(responseSchema);
        }

        // Crear una llave "virtual" temporal de fallback
        console.log(`[orquestador-ia] Usando llave de fallback desde archivo de configuración (.env) para ${providerToUse}.`);
        return await executeRequestWithRetry(
            providerToUse,
            modelToUse,
            fallbackKey,
            systemInstruction,
            prompt,
            pdfBuffer,
            pdfMimeType,
            responseSchema
        );
    }

    // 4. Intentar realizar la llamada rotando las llaves del pool
    for (const keyRecord of keys) {
        try {
            console.log(`[orquestador-ia] Intentando llamada con llave "${keyRecord.label}" (ID: ${keyRecord.id})`);
            const result = await executeRequestWithRetry(
                providerToUse,
                modelToUse,
                keyRecord.key,
                systemInstruction,
                prompt,
                pdfBuffer,
                pdfMimeType,
                responseSchema
            );

            // Al tener éxito, restablecer el contador de errores si era mayor a 0
            if (keyRecord.errorCount > 0) {
                await prisma.apiKey.update({
                    where: { id: keyRecord.id },
                    data: { errorCount: 0 },
                });
            }

            console.log(`[orquestador-ia] Llamada exitosa con llave: ${keyRecord.label}`);
            return result;
        } catch (err: any) {
            console.error(`[orquestador-ia] Fallo con la llave "${keyRecord.label}":`, err.message || err);
            
            // Incrementar contador de errores
            const newErrorCount = keyRecord.errorCount + 1;
            const deactivate = newErrorCount >= 5;

            await prisma.apiKey.update({
                where: { id: keyRecord.id },
                data: {
                    errorCount: newErrorCount,
                    active: !deactivate, // Desactivar automáticamente tras 5 fallos consecutivos
                },
            });

            if (deactivate) {
                console.warn(`[orquestador-ia] Llave "${keyRecord.label}" desactivada automáticamente tras 5 fallos consecutivos.`);
            }
        }
    }

    throw new Error(`[orquestador-ia] Todas las llaves del pool para el proveedor ${providerToUse} fallaron.`);
}

/**
 * Retorna la llave de API configurada en variables de entorno como fallback secundario.
 */
function getFallbackEnvKey(provider: string): string | undefined {
    switch (provider) {
        case "gemini":
            return process.env.GEMINI_API_KEY;
        case "openai":
            return process.env.OPENAI_API_KEY;
        case "claude":
            return process.env.ANTHROPIC_API_KEY;
        case "deepseek":
            return process.env.DEEPSEEK_API_KEY;
        case "openrouter":
            return process.env.OPENROUTER_API_KEY;
        default:
            return undefined;
    }
}

/**
 * Ejecuta la llamada HTTP correspondiente al proveedor de IA seleccionado.
 */
async function executeRequestWithRetry(
    provider: string,
    model: string,
    apiKey: string,
    systemInstruction: string,
    prompt: string,
    pdfBuffer?: Buffer,
    pdfMimeType: string = "application/pdf",
    responseSchema?: any
): Promise<string> {
    switch (provider) {
        case "gemini":
            return await callGeminiNative(model, apiKey, systemInstruction, prompt, pdfBuffer, pdfMimeType, responseSchema);
        case "openai":
            return await callOpenAiCompatible(`https://api.openai.com/v1/chat/completions`, model, apiKey, systemInstruction, prompt, responseSchema);
        case "deepseek":
            return await callOpenAiCompatible(`https://api.deepseek.com/v1/chat/completions`, model, apiKey, systemInstruction, prompt, responseSchema);
        case "openrouter":
            return await callOpenAiCompatible(`https://openrouter.ai/api/v1/chat/completions`, model, apiKey, systemInstruction, prompt, responseSchema);
        case "claude":
            return await callClaudeNative(model, apiKey, systemInstruction, prompt, pdfBuffer, responseSchema);
        default:
            throw new Error(`Proveedor de IA desconocido o no soportado: ${provider}`);
    }
}

/**
 * API nativa de Google Gemini (generativelanguage.googleapis.com)
 */
async function callGeminiNative(
    model: string,
    apiKey: string,
    systemInstruction: string,
    prompt: string,
    pdfBuffer?: Buffer,
    pdfMimeType: string = "application/pdf",
    responseSchema?: any
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts: any[] = [];
    if (pdfBuffer) {
        parts.push({
            inlineData: {
                mimeType: pdfMimeType,
                data: pdfBuffer.toString("base64"),
            },
        });
    }
    parts.push({ text: prompt });

    const body = {
        contents: [
            {
                role: "user",
                parts: parts,
            },
        ],
        systemInstruction: systemInstruction ? {
            parts: [{ text: systemInstruction }],
        } : undefined,
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            responseSchema: responseSchema || undefined,
        },
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error("Gemini no retornó texto de respuesta.");
    }
    return text;
}

/**
 * Llamada genérica a APIs compatibles con la interfaz de OpenAI (OpenAI, DeepSeek, OpenRouter)
 */
async function callOpenAiCompatible(
    url: string,
    model: string,
    apiKey: string,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any
): Promise<string> {
    const messages = [];
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const body: any = {
        model,
        messages,
        temperature: 0.2,
    };

    if (responseSchema) {
        body.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
    };

    // OpenRouter requiere opcionalmente ciertos encabezados informativos
    if (url.includes("openrouter.ai")) {
        headers["HTTP-Referer"] = "https://sacrint-sisat-atp.vercel.app";
        headers["X-Title"] = "SISAT-ATP";
    }

    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI-compatible API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error("El modelo compatible con OpenAI no retornó texto de respuesta.");
    }
    return text;
}

/**
 * API nativa de Anthropic Claude (api.anthropic.com)
 */
async function callClaudeNative(
    model: string,
    apiKey: string,
    systemInstruction: string,
    prompt: string,
    pdfBuffer?: Buffer,
    responseSchema?: any
): Promise<string> {
    const url = "https://api.anthropic.com/v1/messages";

    const contentParts: any[] = [];
    if (pdfBuffer) {
        contentParts.push({
            type: "document",
            source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBuffer.toString("base64"),
            },
        });
    }
    contentParts.push({
        type: "text",
        text: prompt,
    });

    const body: any = {
        model,
        max_tokens: 4000,
        temperature: 0.2,
        system: systemInstruction || undefined,
        messages: [
            { role: "user", content: contentParts },
        ],
    };

    // Si se requiere JSON, Claude no tiene una propiedad responseMimeType general pero responde muy bien a prompts de formato.
    // Además, a partir de Claude 3.5 Sonnet podemos solicitarle de forma estricta.
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Claude API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (!text) {
        throw new Error("Claude no retornó texto de respuesta.");
    }
    return text;
}

/**
 * Retorna una simulación estructurada en JSON en caso de no contar con llaves de API
 */
function getSimulatedResponse(schema?: any): string {
    return JSON.stringify({
        warning: "Simulación por falta de configuración de clave de API",
        signed: true,
        sealed: true,
        explanation: "Asistente de Autoevaluación en modo simulación debido a que no hay llaves configuradas.",
        email_draft: "Estimados directores,\n\nSe ha recibido su documento preliminar y todo parece estar correcto.\n\nAtentamente,\nSupervisión Escolar.",
        incidents_exist: false,
        text: "Simulación de respuesta de IA."
    });
}
