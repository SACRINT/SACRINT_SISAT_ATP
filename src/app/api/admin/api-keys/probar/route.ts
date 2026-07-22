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
        // 1. Probar gemini-1.5-flash primero (modelo estándar de producción)
        const url15 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const payload = {
            contents: [{ parts: [{ text: "Responde OK" }] }]
        };

        try {
            const res15 = await fetch(url15, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000)
            });

            if (res15.ok) {
                // Probar adicionalmente gemini-2.5-flash para saber si es cuenta Pro
                let isPro = false;
                try {
                    const url25 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
                    const res25 = await fetch(url25, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                        signal: AbortSignal.timeout(5000)
                    });
                    if (res25.ok) isPro = true;
                } catch (e) {
                    // ignorar
                }

                return {
                    label,
                    provider: "gemini",
                    status: isPro ? "OK_PRO" : "OK_FREE",
                    message: isPro 
                        ? "🟢 Excelente: Llave activa (Cuenta Pro / Soporta todos los modelos)"
                        : "🟢 Activa: Llave funcional en Plan Gratuito (Soporta Gemini 1.5 Flash)",
                    modelsSupported: isPro ? ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"] : ["gemini-1.5-flash"]
                };
            }

            const errText15 = await res15.text();

            if (res15.status === 429 || errText15.toLowerCase().includes("resource_exhausted") || errText15.toLowerCase().includes("quota exceeded")) {
                const isDaily = errText15.toLowerCase().includes("perday") || errText15.toLowerCase().includes("per_day") || errText15.toLowerCase().includes("free_tier_requests");
                if (isDaily) {
                    return {
                        label,
                        provider: "gemini",
                        status: "QUOTA_EXHAUSTED",
                        message: "🔴 Cuota Diaria Agotada: Esta cuenta gratuita agotó sus solicitudes por hoy.",
                        modelsSupported: [],
                        rawError: errText15
                    };
                }
                return {
                    label,
                    provider: "gemini",
                    status: "RATE_LIMITED",
                    message: "🟡 Saturada por minuto: Límite por minuto alcanzado. Disponible en ~45s.",
                    modelsSupported: ["gemini-1.5-flash"],
                    rawError: errText15
                };
            }

            if (res15.status === 400 || res15.status === 403 || errText15.toLowerCase().includes("api_key_invalid")) {
                return {
                    label,
                    provider: "gemini",
                    status: "INVALID_KEY",
                    message: "❌ Clave Inválida: La API key es incorrecta o fue borrada en Google Cloud.",
                    modelsSupported: [],
                    rawError: errText15
                };
            }

            return {
                label,
                provider: "gemini",
                status: "ERROR",
                message: `⚠️ Error de API (${res15.status}): ${errText15.substring(0, 150)}`,
                modelsSupported: [],
                rawError: errText15
            };

        } catch (e: any) {
            return {
                label,
                provider: "gemini",
                status: "ERROR",
                message: `⚠️ Error de conexión/timeout: ${e.message}`,
                modelsSupported: [],
                rawError: e.message
            };
        }
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
