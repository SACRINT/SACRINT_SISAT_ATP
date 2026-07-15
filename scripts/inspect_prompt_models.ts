import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const prompts = await prisma.prompt.findMany();
    console.log("Modelos configurados en la tabla Prompt:");
    prompts.forEach(p => {
        console.log(`- ID: ${p.id}, Nombre: ${p.nombre}, Modelo: ${p.modelo}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
