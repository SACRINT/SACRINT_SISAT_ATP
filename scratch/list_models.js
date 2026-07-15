const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
        if (line.startsWith("DATABASE_URL=")) {
            const val = line.substring("DATABASE_URL=".length).trim().replace(/"/g, "");
            process.env.DATABASE_URL = val;
            break;
        }
    }
}

async function main() {
    const { prisma } = require("../src/lib/db");
    const keyRecord = await prisma.apiKey.findFirst({
        where: { provider: "gemini", active: true }
    });

    if (!keyRecord) {
        console.error("No active Gemini keys found in DB");
        return;
    }

    const key = keyRecord.key;
    console.log(`Using key: ${keyRecord.label} (${key.substring(0, 10)}...)`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) {
            console.error("API Error:", JSON.stringify(data.error, null, 2));
            return;
        }
        console.log("Supported Models:");
        for (const m of data.models || []) {
            console.log(`- ${m.name} (supports: ${m.supportedGenerationMethods?.join(", ")})`);
        }
    } catch (err) {
        console.error("Fetch failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
