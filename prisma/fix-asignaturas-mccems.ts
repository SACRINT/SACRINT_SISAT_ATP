/**
 * Script de migracion: Actualiza nombres de asignaturas en HorarioAsignaturaCatalogo
 * Corrige nombres incorrectos segun el catalogo oficial MCCEMS BGE Puebla 2025-2026
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando migracion de nombres de asignaturas MCCEMS 2025-2026...");

  const updSem1 = await (prisma as any).horarioAsignaturaCatalogo.updateMany({
    where: { uacName: { contains: "La Materia y sus Interacciones", mode: "insensitive" }, semester: 1 },
    data: { uacName: "Ciencias Naturales, Experimentales y Tecnologia I" },
  });
  console.log("Sem1 actualizados:", updSem1.count);

  const updSem3 = await (prisma as any).horarioAsignaturaCatalogo.updateMany({
    where: { uacName: { contains: "Ecosistemas: Interacciones", mode: "insensitive" }, semester: 3 },
    data: { uacName: "Ciencias Naturales, Experimentales y Tecnologia III" },
  });
  console.log("Sem3 actualizados:", updSem3.count);

  const updConciencia = await (prisma as any).horarioAsignaturaCatalogo.updateMany({
    where: { uacName: { contains: "La Conciencia Historica II", mode: "insensitive" }, semester: 5 },
    data: { uacName: "Conciencia Historica II. Mexico Durante el Expansionismo Capitalista" },
  });
  console.log("Sem5 Conciencia actualizados:", updConciencia.count);

  console.log("Migracion completada.");
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
