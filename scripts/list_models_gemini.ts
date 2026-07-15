import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || "";

async function main() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            console.log("Modelos soportados en v1beta por esta API key:");
            data.models.forEach((m: any) => {
                console.log(`- Nombre: ${m.name}, Métodos: ${m.supportedGenerationMethods.join(", ")}`);
            });
        } else {
            console.error(`Error listando modelos HTTP ${response.status}:`, await response.text());
        }
    } catch (err: any) {
        console.error("Error de red:", err.message);
    }
}

main();
