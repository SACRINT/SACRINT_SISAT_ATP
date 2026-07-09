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
 * Helper to call Gemini API directly using native fetch to keep the project lightweight.
 */
export async function callGemini(
    systemInstruction: string,
    prompt: string,
    pdfBuffer?: Buffer,
    pdfMimeType: string = "application/pdf"
): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY not configured in .env. Returning simulated AI response.");
        return JSON.stringify({
            warning: "GEMINI_API_KEY no configurada en el archivo .env",
            signed: true,
            sealed: true,
            explanation: "Clave de API de Gemini no disponible. Simulación activada: Todo correcto.",
            email_draft: "Estimados directores,\n\nSe ha recibido el reporte sin incidencias. Gracias por su puntualidad.\n\nAtentamente,\nSupervisión Escolar.",
            incidents_exist: false,
            text: "Simulación de respuesta de IA."
        });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const parts: any[] = [];

    // Add PDF if provided
    if (pdfBuffer) {
        parts.push({
            inlineData: {
                mimeType: pdfMimeType,
                data: pdfBuffer.toString("base64")
            }
        });
    }

    // Add prompt text
    parts.push({
        text: prompt
    });

    const body = {
        contents: [
            {
                role: "user",
                parts: parts
            }
        ],
        systemInstruction: systemInstruction ? {
            parts: [{ text: systemInstruction }]
        } : undefined,
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
        }
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
            throw new Error("No response text found from Gemini candidates");
        }

        return candidateText;
    } catch (error) {
        console.error("Error in callGemini:", error);
        throw error;
    }
}
