import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST - Probar clave API del director antes de guardarla
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { geminiApiKey } = await req.json();

        if (!geminiApiKey || geminiApiKey.trim() === "") {
            return NextResponse.json({ error: "La clave API no puede estar vacía" }, { status: 400 });
        }

        const apiKey = geminiApiKey.trim();
        const isOpenAIFormat = apiKey.startsWith("sk-");

        let response;
        if (isOpenAIFormat) {
            // Probar MorphLLM / OpenAI-compatible
            const url = `https://api.morphllm.com/v1/chat/completions`;
            response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "morph-glm52-744b",
                    messages: [{ role: "user", content: "Hola, responde únicamente con la palabra OK." }],
                    max_tokens: 10
                })
            });
        } else {
            // Probar Gemini
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: "Hola, responde únicamente con la palabra OK." }] }]
            };
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        if (response.ok) {
            const data = await response.json();
            const textResponse = isOpenAIFormat 
                ? data.choices?.[0]?.message?.content
                : data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (textResponse) {
                return NextResponse.json({
                    success: true,
                    message: `Clave de API (${isOpenAIFormat ? 'MorphLLM/OpenAI' : 'Google Gemini'}) válida y activa.`
                });
            } else {
                return NextResponse.json({
                    success: false,
                    error: "La clave se conectó, pero el proveedor devolvió una respuesta vacía o no estructurada."
                }, { status: 400 });
            }
        } else {
            const errText = await response.text();
            let parsedMsg = "Error desconocido del proveedor";
            try {
                const errObj = JSON.parse(errText);
                parsedMsg = errObj.error?.message || errText;
            } catch (e) {
                parsedMsg = errText;
            }

            return NextResponse.json({
                success: false,
                error: `Fallo de validación de API: ${parsedMsg}`
            }, { status: 400 });
        }

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || "Error al realizar la prueba de conexión"
        }, { status: 500 });
    }
}
