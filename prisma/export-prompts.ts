import "dotenv/config";
import { prisma } from "../src/lib/db";
import fs from "fs";

async function main() {
    const plantillas = await prisma.plantillaEvaluacion.findMany({
        orderBy: { modulo: "asc" }
    });
    
    for (const p of plantillas) {
        const filename = `prompt_${p.modulo}_actual.txt`;
        fs.writeFileSync(`/tmp/${filename}`, `=== MODULO: ${p.modulo} ===\nNOMBRE: ${p.nombre}\nACTIVO: ${p.activo}\n\n${p.contenido}`, "utf8");
        console.log(`✓ Exportado: ${filename} (${p.contenido.length} chars)`);
    }
    console.log("\nListo.");
}

main()
    .catch(e => { console.error("Error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
