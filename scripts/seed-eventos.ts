/**
 * Script para poblar las categorías y disciplinas de Eventos PAEC 2026.
 * Ejecutar con: npx tsx scripts/seed-eventos.ts
 * 
 * Es idempotente: si las categorías ya existen, las actualiza.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { CATEGORIAS_EVENTOS_2026 } from "../src/lib/categorias-eventos";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🎭 Poblando categorías y disciplinas de Eventos PAEC 2026...\n");

    // Ensure EventosConfig singleton exists
    await prisma.eventosConfig.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton", activo: false },
    });
    console.log("⚙️  EventosConfig singleton creado/verificado");

    let totalCategorias = 0;
    let totalDisciplinas = 0;

    for (const cat of CATEGORIAS_EVENTOS_2026) {
        // Upsert category
        const categoria = await prisma.categoriaEvento.upsert({
            where: { nombre: cat.nombre },
            update: { color: cat.color, orden: cat.orden },
            create: { nombre: cat.nombre, color: cat.color, orden: cat.orden },
        });
        totalCategorias++;
        console.log(`📂 Categoría: ${cat.nombre} (${cat.disciplinas.length} disciplinas)`);

        for (const disc of cat.disciplinas) {
            // Check if discipline already exists for this category
            const existing = await prisma.disciplinaEvento.findFirst({
                where: { categoriaId: categoria.id, nombre: disc.nombre },
            });

            if (existing) {
                await prisma.disciplinaEvento.update({
                    where: { id: existing.id },
                    data: {
                        tipo: disc.tipo,
                        minParticipantes: disc.minParticipantes,
                        maxParticipantes: disc.maxParticipantes,
                        grupoExclusion: disc.grupoExclusion || null,
                        orden: disc.orden,
                    },
                });
            } else {
                await prisma.disciplinaEvento.create({
                    data: {
                        categoriaId: categoria.id,
                        nombre: disc.nombre,
                        tipo: disc.tipo,
                        minParticipantes: disc.minParticipantes,
                        maxParticipantes: disc.maxParticipantes,
                        grupoExclusion: disc.grupoExclusion || null,
                        orden: disc.orden,
                    },
                });
            }
            totalDisciplinas++;
        }
    }

    console.log(`\n✅ Seed de eventos completado:`);
    console.log(`   - ${totalCategorias} categorías`);
    console.log(`   - ${totalDisciplinas} disciplinas`);
}

main()
    .catch((e) => {
        console.error("❌ Error en seed de eventos:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
