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

    const failed = preRevs.filter(pr => {
        const res = pr.resultado as any;
        const prog = pr.entrega.periodoEntrega.programa.nombre.toUpperCase();
        const isAiProg = prog.includes("PMC") || prog.includes("PAEC") || prog.includes("PEC");
        if (!isAiProg) return false;
        
        if (!res || Object.keys(res).length === 0) return true;
        if (res.explicacion && res.explicacion.includes("Error en análisis automático")) return true;
        return false;
    });

    console.log(`Total failed/empty AI pre-revisions: ${failed.length}`);
    for (const pr of failed) {
        console.log(`EntregaID: ${pr.entregaId}, Escuela: ${pr.entrega.escuela.nombre}, Programa: ${pr.entrega.periodoEntrega.programa.nombre}`);
    }
}

main().catch(console.error);
