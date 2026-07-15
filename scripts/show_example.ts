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
    const r = await prisma.preRevision.findFirst({
        where: {
            OR: [
                { resultado: { path: ["tipo"], equals: "PMC" } },
                { resultado: { path: ["tipo"], equals: "PAEC" } },
                { resultado: { path: ["tipo"], equals: "INFORME_FINAL" } }
            ]
        }
    });
    console.log(JSON.stringify(r, null, 2));
}

main().catch(console.error);
