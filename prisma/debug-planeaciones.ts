import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
    const config = await prisma.planeacionesConfig.findUnique({ where: { id: "singleton" } });
    console.log("Config actual en BD:", config);

    const escuela = await prisma.escuela.findUnique({
        where: { cct: "21EBH0088T" },
        select: { id: true, cct: true, nombre: true, esDePrueba: true, permisos: true }
    });
    console.log("Escuela 21EBH0088T:", escuela);

    if (escuela) {
        const entregaPaec = await prisma.entrega.findFirst({
            where: {
                escuelaId: escuela.id,
                estado: { in: ["APROBADO", "EN_REVISION", "REQUIERE_CORRECCION", "ENTREGADO_FISICO"] },
                periodoEntrega: { programa: { nombre: { contains: "PAEC", mode: "insensitive" } } },
            },
            select: { id: true, estado: true, periodoEntrega: { select: { programa: { select: { nombre: true } } } } },
        });
        console.log("Entrega PAEC encontrada:", entregaPaec);
    }
}

main()
    .catch(e => { console.error("Error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
