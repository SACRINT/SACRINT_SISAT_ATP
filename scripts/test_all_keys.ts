import fs from "fs";
import path from "path";

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

async function testKey(label: string, key: string): Promise<boolean> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`;
    const body = {
        contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
            console.log(`[TEST] Key "${label}" is WORKING!`);
            return true;
        } else {
            const txt = await res.text();
            console.log(`[TEST] Key "${label}" FAILED: ${res.status} - ${txt.substring(0, 100)}`);
            return false;
        }
    } catch (err: any) {
        console.log(`[TEST] Key "${label}" ERROR: ${err.message}`);
        return false;
    }
}

async function main() {
    const { prisma } = await import("../src/lib/db");
    const keys = await prisma.apiKey.findMany({ where: { provider: "gemini" } });
    console.log(`Testing all ${keys.length} keys...`);
    
    let workingCount = 0;
    for (const k of keys) {
        const ok = await testKey(k.label, k.key);
        if (ok) workingCount++;
        // stagger 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`Test complete. Working keys: ${workingCount}/${keys.length}`);
}

main().catch(console.error);
