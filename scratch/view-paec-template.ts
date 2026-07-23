import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
    const template = await prisma.plantillaEvaluacion.findUnique({
        where: { id: "seed-paec-master" }
    });
    if (template) {
        console.log(template.contenido);
    } else {
        console.log("Not found");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
