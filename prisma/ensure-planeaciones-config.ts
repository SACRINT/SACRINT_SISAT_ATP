import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
    const config = await prisma.planeacionesConfig.upsert({
        where: { id: "singleton" },
        create: {
            id: "singleton",
            activoGlobal: true,
            requierePaecPec: false,
            requiereApiKey: false,
            modoSinRestricciones: true,
        },
        update: {
            activoGlobal: true,
            modoSinRestricciones: true,
        }
    });

    console.log("✓ Configuración de planeaciones en DB asegurada:", config);
}

main()
    .catch(e => { console.error("Error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
