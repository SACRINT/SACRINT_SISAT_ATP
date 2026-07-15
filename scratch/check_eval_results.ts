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
    const rows = await prisma.preRevision.findMany({
        include: {
            entrega: {
                include: {
                    escuela: true,
                    periodoEntrega: {
                        include: { programa: true }
                    }
                }
            }
        },
        orderBy: { updatedAt: "desc" }
    });

    console.log(`Total PreRevisions in DB: ${rows.length}`);
    for (const r of rows) {
        const res = r.resultado as any;
        let status = "N/A";
        if (res) {
            status = res.explicacion || "N/A";
            if (status.includes("Error") || status.includes("fallaron")) {
                status = "❌ ERROR: " + status.substring(0, 100);
            } else {
                status = "✅ SUCCESS: " + status.substring(0, 100);
            }
        }
        console.log(`Escuela: ${r.entrega.escuela.nombre}, Programa: ${r.entrega.periodoEntrega.programa.nombre}, Updated: ${r.updatedAt.toISOString()}, Status: ${status}`);
    }
}

main().catch(console.error);
