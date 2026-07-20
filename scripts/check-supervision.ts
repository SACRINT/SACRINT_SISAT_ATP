import { prisma } from "../src/lib/db";

async function main() {
    const supervision = await prisma.escuela.findFirst({
        where: {
            OR: [
                { nombre: { contains: "supervision", mode: "insensitive" } },
                { cct: { contains: "F", mode: "insensitive" } } // Often ends with F? Wait, let's just search por supervision
            ]
        },
        include: { personal: true }
    });

    console.log("Escuelas que coinciden con 'supervision':");
    const escuelas = await prisma.escuela.findMany({
        where: { nombre: { contains: "supervision", mode: "insensitive" } }
    });
    console.log(escuelas);

    console.log("Todas las escuelas (CCT, Nombre):");
    const all = await prisma.escuela.findMany();
    all.forEach(e => console.log(e.cct, e.nombre));

    const autoridades = await prisma.autoridadesConfig.findUnique({
        where: { id: "singleton" }
    });
    console.log("AutoridadesConfig:", autoridades);
}

main().catch(console.error).finally(() => prisma.$disconnect());
