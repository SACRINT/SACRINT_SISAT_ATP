import fs from "fs";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
        if (line.startsWith("DATABASE_URL=")) {
            process.env.DATABASE_URL = line.substring("DATABASE_URL=".length).trim().replace(/"/g, "");
        }
    }
}

async function main() {
    const { prisma } = await import("../src/lib/db");

    const apiKeys = await prisma.apiKey.findMany({
        where: { provider: "gemini", active: true }
    });

    console.log(`Found ${apiKeys.length} active Gemini keys to test.`);

    for (const k of apiKeys) {
        console.log(`\nTesting key: ${k.label}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k.key}`;
        const body = {
            contents: [{ role: "user", parts: [{ text: "Hola, responde con la palabra 'OK'." }] }],
            generationConfig: { responseMimeType: "application/json" }
        };

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`  🔴 Failed with HTTP ${res.status}: ${errText}`);
            } else {
                const data = await res.json();
                console.log(`  🟢 Success! Response:`, JSON.stringify(data));
            }
        } catch (err: any) {
            console.error(`  🔴 Fetch exception:`, err?.message || err);
        }
    }
}

main().catch(console.error);
