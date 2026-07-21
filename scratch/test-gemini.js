const key = process.env.GEMINI_API_KEY || "";
const targetModel = "gemini-2.5-flash"; 
const prompt = "Revisa este documento y dame la evaluacion. El texto es corto.";

const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;

const responseSchema = {
    type: "OBJECT",
    properties: {
        aprobado: { type: "BOOLEAN" },
        puntuacion: { type: "STRING" },
        observaciones: { type: "STRING" },
        estadoRecomendado: { type: "STRING", enum: ["APROBADO", "REQUIERE_CORRECCION"] }
    },
    required: ["aprobado", "puntuacion", "observaciones", "estadoRecomendado"]
};

const body = {
    contents: [
        {
            role: "user",
            parts: [{ text: prompt }],
        },
    ],
    generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseSchema: responseSchema
    },
};

console.log("Fetching...", url);
fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
})
.then(async (res) => {
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.substring(0, 500));
})
.catch(err => console.error("Error:", err));
