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
    const preRevs = await prisma.preRevision.findMany({
        where: {
            entrega: {
                escuela: {
                    cct: "21EBH0608L"
                }
            }
        },
        include: {
            entrega: {
                include: {
                    escuela: true,
                    periodoEntrega: {
                        include: { programa: true }
                    }
                }
            }
        }
    });

    console.log(`Found ${preRevs.length} pre-revisions for Zapata.`);
    for (const pr of preRevs) {
        console.log("=========================================");
        console.log("ID:", pr.id);
        console.log("Programa:", pr.entrega.periodoEntrega.programa.nombre);
        console.log("UpdatedAt:", pr.updatedAt);
        console.log("Resultado (Explicación):", (pr.resultado as any)?.explicacion || "N/A");
    }
}

main().catch(console.error);
