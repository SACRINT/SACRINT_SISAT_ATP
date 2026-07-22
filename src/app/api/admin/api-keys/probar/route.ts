import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TestResult {
    id: string;
    label: string;
    provider: string;
    status: "OK_PRO" | "OK_FREE" | "QUOTA_EXHAUSTED" | "RATE_LIMITED" | "INVALID_KEY" | "ERROR";
    message: string;
    modelsSupported: string[];
    rawError?: string;
}

async function testSingleKey(apiKey: string, provider: string, label: string = ""): Promise<Omit<TestResult, "id">> {
    const key = apiKey.trim();

    if (provider === "gemini" || !provider) {
        const payload = {
            contents: [{ parts: [{ text: "Responde OK" }] }]
        };

        // Lista de modelos oficiales disponibles en Google AI Studio (del más reciente al más compatible)
        const modelsToTest = [
            "gemini-2.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash-lite",
            "gemini-1.5-flash"
        ];

        let lastErrText = "";
        let lastStatus = 0;

        for (const testModel of modelsToTest) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${key}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(8000)
                });

                if (res.ok) {
                    const isPro = testModel === "gemini-2.5-flash";
                    return {
                        label,
                        provider: "gemini",
                        status: isPro ? "OK_PRO" : "OK_FREE",
                        message: isPro 
                            ? `🟢 Excelente: Llave activa (Cuenta Pro / Soporta ${testModel})`
                            : `🟢 Activa: Llave funcional en Plan Gratuito (Modelo: ${testModel})`,
                        modelsSupported: [testModel]
                    };
                }

                lastStatus = res.status;
                lastErrText = await res.text();

                // Si es 404 (el modelo no existe en esta versión/cuenta), probar el siguiente modelo de la lista
                const is404 = res.status === 404 || lastErrText.toLowerCase().includes("not found");
                if (is404) {
                    continue;
                }

                // Si es 429 (límite o cuota), analizar si es diario o por minuto
                if (res.status === 429 || lastErrText.toLowerCase().includes("resource_exhausted") || lastErrText.toLowerCase().includes("quota exceeded")) {
                    const isDaily = lastErrText.toLowerCase().includes("perday") || lastErrText.toLowerCase().includes("per_day") || lastErrText.toLowerCase().includes("free_tier_requests");
                    return {
                        label,
                        provider: "gemini",
                        status: isDaily ? "QUOTA_EXHAUSTED" : "RATE_LIMITED",
                        message: isDaily 
                            ? "🔴 Cuota Diaria Agotada: Esta cuenta gratuita agotó sus solicitudes por hoy."
                            : "🟡 Saturada por minuto: Límite por minuto alcanzado. Disponible en ~45s.",
                        modelsSupported: [testModel],
                        rawError: lastErrText
                    };
                }

                if (res.status === 400 || res.status === 403 || lastErrText.toLowerCase().includes("api_key_invalid")) {
                    return {
                        label,
                        provider: "gemini",
                        status: "INVALID_KEY",
                        message: "❌ Clave Inválida: La API key es incorrecta o fue borrada en Google Cloud.",
                        modelsSupported: [],
                        rawError: lastErrText
                    };
                }
            } catch (e: any) {
                lastErrText = e.message;
            }
        }

        return {
            label,
            provider: "gemini",
            status: "ERROR",
            message: `⚠️ Error de API (${lastStatus || 404}): ${lastErrText.substring(0, 150)}`,
            modelsSupported: [],
            rawError: lastErrText
        };
    } else if (provider === "morphllm" || provider === "openai" || provider === "openrouter" || provider === "deepseek") {
        const endpoints: Record<string, { url: string; model: string }> = {
            morphllm: { url: "https://api.morphllm.com/v1/chat/completions", model: "morph-glm52-744b" },
            openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
            openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "google/gemini-2.5-flash" },
            deepseek: { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat" }
        };

        const config = endpoints[provider];
        if (!config) {
            return { label, provider, status: "ERROR", message: "Proveedor no soportado para prueba", modelsSupported: [] };
        }

        try {
            const res = await fetch(config.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{ role: "user", content: "OK" }]
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (res.ok) {
                return {
                    label,
                    provider,
                    status: "OK_PRO",
                    message: `🟢 Llave de ${provider.toUpperCase()} activa y funcional`,
                    modelsSupported: [config.model]
                };
            }

            const errText = await res.text();
            if (res.status === 429) {
                return {
                    label,
                    provider,
                    status: "QUOTA_EXHAUSTED",
                    message: `🔴 Cuota o saldo agotado en ${provider.toUpperCase()}`,
                    modelsSupported: [],
                    rawError: errText
                };
            }
            if (res.status === 401 || res.status === 403) {
                return {
                    label,
                    provider,
                    status: "INVALID_KEY",
                    message: `❌ Clave inválida o denegada por ${provider.toUpperCase()}`,
                    modelsSupported: [],
                    rawError: errText
                };
            }
            return {
                label,
                provider,
                status: "ERROR",
                message: `⚠️ Error de ${provider.toUpperCase()} (${res.status}): ${errText.substring(0, 150)}`,
                modelsSupported: [],
                rawError: errText
            };
        } catch (e: any) {
            return { label, provider, status: "ERROR", message: `⚠️ Error de conexión: ${e.message}`, modelsSupported: [] };
        }
    }

    return { label, provider, status: "ERROR", message: "Proveedor desconocido", modelsSupported: [] };
}

// POST /api/admin/api-keys/probar
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { id, testAll, provider } = body;

        if (id) {
            const dbKey = await prisma.apiKey.findUnique({ where: { id } });
            if (!dbKey) {
                return NextResponse.json({ error: "Llave no encontrada en base de datos" }, { status: 404 });
            }

            const result = await testSingleKey(dbKey.key, dbKey.provider, dbKey.label);
            return NextResponse.json({ success: true, result: { ...result, id: dbKey.id } });
        }

        if (testAll) {
            const whereClause = provider ? { provider } : {};
            const dbKeys = await prisma.apiKey.findMany({ where: whereClause, orderBy: { createdAt: "desc" } });

            const results: TestResult[] = [];
            for (const keyRec of dbKeys) {
                const res = await testSingleKey(keyRec.key, keyRec.provider, keyRec.label);
                results.push({ ...res, id: keyRec.id });
                await new Promise(r => setTimeout(r, 200));
            }

            return NextResponse.json({ success: true, results });
        }

        return NextResponse.json({ error: "Se requiere 'id' o 'testAll'" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al probar las llaves" }, { status: 500 });
    }
}
