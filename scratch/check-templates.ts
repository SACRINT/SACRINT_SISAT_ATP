import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
    const templates = await prisma.plantillaEvaluacion.findMany();
    console.log(`Found ${templates.length} templates:`);
    for (const t of templates) {
        console.log(`\n=======================================\nID: ${t.id}\nModulo: ${t.modulo}\nNombre: ${t.nombre}\nActivo: ${t.activo}\nContenido Preview:\n${t.contenido.slice(0, 500)}...\n=======================================\n`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
