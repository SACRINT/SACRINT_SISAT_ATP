import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Iniciando actualización de Entregas...");

    // Find all entregas that are PENDIENTE but have no files attached.
    // Wait, any PENDIENTE entrega right now should be NO_ENTREGADO, unless it has a file attached.
    // The user said they just uploaded ONE file for PMC. So there's 1 file in the DB.

    // We can just set EVERYTHING to NO_ENTREGADO where archivos count is 0.
    const entregasWithoutFiles = await prisma.entrega.findMany({
        where: {
            archivos: { none: {} },
            estado: "PENDIENTE"
        }
    });

    console.log(`Encontradas ${entregasWithoutFiles.length} entregas PENDIENTES sin archivos.`);

    if (entregasWithoutFiles.length > 0) {
        const result = await prisma.entrega.updateMany({
            where: {
                id: { in: entregasWithoutFiles.map(e => e.id) }
            },
            data: {
                estado: "NO_ENTREGADO"
            }
        });
        console.log(`Actualizadas ${result.count} entregas a NO_ENTREGADO.`);
    }

    // Double check if any delivery HAS files but is NO_ENTREGADO (shouldn't happen but just in case)
    const entregasWithFiles = await prisma.entrega.findMany({
        where: {
            archivos: { some: {} },
            estado: "NO_ENTREGADO"
        }
    });

    if (entregasWithFiles.length > 0) {
        const result2 = await prisma.entrega.updateMany({
            where: {
                id: { in: entregasWithFiles.map(e => e.id) }
            },
            data: {
                estado: "PENDIENTE" // pending review 
            }
        });
        console.log(`Corregidas ${result2.count} entregas con archivos a PENDIENTE.`);
    }

    console.log("¡Actualización completada!");
}

main()
    .catch((e) => {
        console.error("Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
