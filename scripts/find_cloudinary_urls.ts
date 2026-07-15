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
    const docxDeliveries = await prisma.entrega.findMany({
        where: {
            id: {
                in: [
                    "cmluh9wwb0011s8d0crudeifw", // JUAN ALDAMA (PMC)
                    "cmr10q6ek000704l73k6v8hgp", // MOISÉS SÁENZ GARZA (INFORME FINAL)
                    "cmr10q6d2000204l7nzr5zce8"  // DIEGO RIVERA (INFORME FINAL)
                ]
            }
        },
        include: {
            archivos: true,
            escuela: true
        }
    });

    for (const d of docxDeliveries) {
        console.log("=========================================");
        console.log(`Escuela: ${d.escuela.nombre}, ID: ${d.id}`);
        for (const f of d.archivos) {
            console.log(`File: ${f.nombre}, URL: ${f.driveUrl}`);
        }
    }
}

main().catch(console.error);
