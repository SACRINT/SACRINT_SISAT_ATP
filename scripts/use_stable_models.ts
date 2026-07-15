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

async function main() {
    const { prisma } = await import("../src/lib/db");

    console.log("Updating PreRevisionConfig to use stable Gemini 1.5 models...");
    const updated = await prisma.preRevisionConfig.upsert({
        where: { id: "singleton" },
        update: {
            modelDefault: "gemini-1.5-flash",
            modelPremium: "gemini-1.5-pro"
        },
        create: {
            id: "singleton",
            activoDirectores: false,
            limiteIntentos: 3,
            modelDefault: "gemini-1.5-flash",
            modelPremium: "gemini-1.5-pro"
        }
    });

    console.log("PreRevisionConfig updated:", updated);
}

main().catch(console.error);
