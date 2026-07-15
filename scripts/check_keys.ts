import fs from "fs";
import path from "path";

// Manually load .env file
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
    // Dynamic import to ensure process.env.DATABASE_URL is set first
    const { prisma } = await import("../src/lib/db");
    const keys = await prisma.apiKey.findMany();
    console.log(`Total keys: ${keys.length}`);
    for (const k of keys) {
        console.log(`ID: ${k.id}, Provider: ${k.provider}, Active: ${k.active}, Errors: ${k.errorCount}, Key (starts with): ${k.key.substring(0, 10)}...`);
    }
}

main().catch(console.error);
