import fs from "fs";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
        if (line.startsWith("DATABASE_URL=")) {
            process.env.DATABASE_URL = line.substring("DATABASE_URL=".length).trim().replace(/"/g, "");
        }
    }
}

async function main() {
    const { prisma } = await import("../src/lib/db");

    console.log("Starting DB neutralization of IA terms...");

    // 1. Update Entrega.observacionesATP
    const entregas = await prisma.entrega.findMany({
        where: {
            observacionesATP: {
                contains: "IA"
            }
        }
    });
    console.log(`Found ${entregas.length} entregas with IA references in observacionesATP.`);

    let updatedCount = 0;
    for (const ent of entregas) {
        if (ent.observacionesATP) {
            const original = ent.observacionesATP;
            const updated = original
                .replace(/asistente de IA/g, "plataforma SISAT-ATP")
                .replace(/asistente de la IA/g, "plataforma SISAT-ATP")
                .replace(/la IA/g, "la plataforma SISAT-ATP")
                .replace(/ Inteligencia Artificial/g, " SISAT-ATP")
                .replace(/Evaluado exitosamente por el asistente de IA\./g, "Evaluado exitosamente por la plataforma SISAT-ATP.");

            if (original !== updated) {
                await prisma.entrega.update({
                    where: { id: ent.id },
                    data: { observacionesATP: updated }
                });
                updatedCount++;
            }
        }
    }
    console.log(`Updated ${updatedCount} entregas successfully.`);

    // 2. Clear out any specific PreRevision results that reference "IA" directly in user-facing texts
    const preRevisions = await prisma.preRevision.findMany();
    console.log(`Auditing ${preRevisions.length} pre-revisions for user-facing IA references...`);
    let prUpdated = 0;
    for (const pr of preRevisions) {
        if (pr.resultado) {
            let resStr = JSON.stringify(pr.resultado);
            if (resStr.includes("asistente de IA") || resStr.includes("IA")) {
                const updatedResStr = resStr
                    .replace(/asistente de IA/g, "plataforma SISAT-ATP")
                    .replace(/asistente de la IA/g, "plataforma SISAT-ATP")
                    .replace(/la IA/g, "la plataforma SISAT-ATP");
                
                await prisma.preRevision.update({
                    where: { id: pr.id },
                    data: { resultado: JSON.parse(updatedResStr) }
                });
                prUpdated++;
            }
        }
    }
    console.log(`Updated ${prUpdated} pre-revisions successfully.`);

    console.log("DB neutralization completed successfully.");
}

main().catch(console.error);
