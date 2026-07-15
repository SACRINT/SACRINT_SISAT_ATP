import fs from "fs";
import path from "path";

// Manually load ALL environment variables from .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index !== -1) {
            const key = trimmed.substring(0, index).trim();
            const val = trimmed.substring(index + 1).trim().replace(/^["']|["']$/g, "");
            process.env[key] = val;
        }
    }
}

async function main() {
    // Dynamic imports
    const { prisma } = await import("../src/lib/db");
    const { analizarEntregaConIA } = await import("../src/lib/pre-revision");

    console.log("Reactivating all API Keys in the DB...");
    await prisma.apiKey.updateMany({
        data: {
            active: true,
            errorCount: 0
        }
    });
    console.log("All API Keys reactivated.");

    console.log("Fetching deliveries with failed/empty pre-revisions...");
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

    const failedPreRevs = preRevs.filter(pr => {
        const res = pr.resultado as any;
        if (!res || Object.keys(res).length === 0) return true; // Empty {}
        if (res.explicacion && res.explicacion.includes("Error en análisis automático")) return true;
        return false;
    });

    console.log(`Found ${failedPreRevs.length} failed/empty evaluations to run.`);

    for (let i = 0; i < failedPreRevs.length; i++) {
        const pr = failedPreRevs[i];
        const entregaId = pr.entregaId;
        const escuelaName = pr.entrega.escuela.nombre;
        const programaName = pr.entrega.periodoEntrega.programa.nombre;

        console.log(`\n[${i + 1}/${failedPreRevs.length}] Starting evaluation for ${escuelaName} (${programaName})...`);

        try {
            await analizarEntregaConIA(entregaId);
            console.log(`[SUCCESS] Evaluation complete for ${escuelaName} (${programaName})`);
        } catch (err: any) {
            console.error(`[ERROR] Evaluation failed for ${escuelaName} (${programaName}):`, err.message || err);
        }

        // Delay 6 seconds between runs to prevent rate limit (10 RPM limit for free keys collectively)
        if (i < failedPreRevs.length - 1) {
            console.log("Waiting 6 seconds before next evaluation...");
            await new Promise(resolve => setTimeout(resolve, 6000));
        }
    }

    console.log("\nAll done!");
}

main().catch(console.error);
