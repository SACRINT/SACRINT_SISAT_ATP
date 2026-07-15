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
        // Llamada de prueba muy sencilla y ligera al modelo gemini-1.5-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: "Hola, responde únicamente con la palabra OK." }] }]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse) {
                return NextResponse.json({
                    success: true,
                    message: "Clave de API válida y activa. Respuesta de prueba exitosa."
                });
            } else {
                return NextResponse.json({
                    success: false,
                    error: "La clave se conectó, pero Google devolvió una respuesta vacía o no estructurada."
                }, { status: 400 });
            }
        } else {
            const errText = await response.text();
            let parsedMsg = "Error desconocido de Google";
            try {
                const errObj = JSON.parse(errText);
                parsedMsg = errObj.error?.message || errText;
            } catch (e) {
                parsedMsg = errText;
            }

            return NextResponse.json({
                success: false,
                error: `Fallo de validación de Google API: ${parsedMsg}`
            }, { status: 400 });
        }

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || "Error al realizar la prueba de conexión"
        }, { status: 500 });
    }
}
