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
        const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), "utf8"));
        const text = data.text || "";

        const entrega = await prisma.entrega.findUnique({
            where: { id },
            include: {
                escuela: true,
                periodoEntrega: { include: { programa: true } }
            }
        });

        if (!entrega) continue;

        const progName = entrega.periodoEntrega.programa.nombre.toUpperCase();
        console.log("=========================================");
        console.log(`School: ${entrega.escuela.nombre} (${entrega.escuela.cct})`);
        console.log(`Program: ${entrega.periodoEntrega.programa.nombre}`);

        if (text.length < 500) {
            console.log("  [WARN] Very short text. Length:", text.length);
            continue;
        }

        // Try to extract project title or theme (for PAEC)
        if (progName.includes("PAEC") || progName.includes("PEC")) {
            const titleMatch = text.match(/(?:título|proyecto|nombre del proyecto|denominación)\s*:?\s*["“'«]([^"”'»\n]+)/i)
                || text.match(/(?:título|proyecto|nombre del proyecto|denominación)\s*:?\s*([^\n]+)/i);
            console.log("  PAEC Title Match:", titleMatch ? titleMatch[1].trim().substring(0, 100) : "Not found");
        }

        // Try to extract diagnostic/FODA mentions (for PMC)
        if (progName.includes("PMC") && !progName.includes("INFORME")) {
            const fodaMatch = text.match(/(foda|f.o.d.a|fortalezas|oportunidades|debilidades|amenazas)/i);
            const diagMatch = text.match(/(diagnóstico|diagnostico|contexto|matrícula|aprovechamiento)/i);
            console.log("  PMC Features: FODA?", !!fodaMatch, "Diagnostic?", !!diagMatch);
        }

        // Try to extract metas/indicadores (for INFORME FINAL)
        if (progName.includes("INFORME")) {
            const metaMatch = text.match(/(meta|metas|indicador|indicadores|resultado|resultados|logro)/i);
            console.log("  Informe Final Features: Metas/Resultados?", !!metaMatch);
        }
    }
}

main().catch(console.error);
