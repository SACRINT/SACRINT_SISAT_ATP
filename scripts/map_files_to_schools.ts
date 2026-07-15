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
    const dirPath = path.resolve(__dirname, "../scratch/extracted_texts");
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const id = file.replace(".json", "");
        try {
            const entrega = await prisma.entrega.findUnique({
                where: { id },
                include: {
                    escuela: true,
                    periodoEntrega: { include: { programa: true } }
                }
            });
            if (entrega) {
                console.log(`File: ${file}`);
                console.log(`  School: ${entrega.escuela.nombre} (${entrega.escuela.cct})`);
                console.log(`  Program: ${entrega.periodoEntrega.programa.nombre}`);
                const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), "utf8"));
                console.log(`  Text Length: ${data.text?.length || 0} chars`);
            } else {
                console.log(`File: ${file} (Entrega not found in DB)`);
            }
        } catch (err: any) {
            console.error(`Error processing file ${file}:`, err.message || err);
        }
    }
}

main().catch(console.error);
