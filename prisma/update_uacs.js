require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const fs = require("fs");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Actualizando catálogo global en DB desde uacs_master_203.json (Corregido por el Usuario)...");

  const jsonPath = "C:\\NotebookLM\\documentos_referencia\\Horarios\\uacs_master_203.json";
  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const uacs = JSON.parse(rawData);

  console.log(`📌 Se leyeron ${uacs.length} asignaturas del archivo JSON corregido.`);

  await prisma.horarioAsignaturaCatalogo.deleteMany({
    where: { escuelaId: null }
  });
  console.log("🗑️ Catálogo previo eliminado.");

  function getColor(comp) {
    const c = comp.toLowerCase();
    if (c.includes("fundamental")) return "#2563eb";
    if (c.includes("ffeo") || c.includes("socioem")) return "#059669";
    if (c.includes("ffe") || c.includes("ext")) return "#d97706";
    if (c.includes("laboral")) return "#7c3aed";
    return "#4b5563";
  }

  let count = 0;
  for (const item of uacs) {
    const totalHrs = item.total_hours || item.totalHours || 54;
    const hrsSem = Math.max(1, Math.round(totalHrs / 16));
    const colorHex = getColor(item.component || "fundamental");

    await prisma.horarioAsignaturaCatalogo.create({
      data: {
        escuelaId: null,
        uacName: item.uac_name || item.uacName,
        semester: Number(item.semester),
        component: item.component || "fundamental",
        totalHours: totalHrs,
        horasSemanales: hrsSem,
        colorHex
      }
    });
    count++;
  }

  console.log(`✅ ¡Éxito! Se guardaron ${count} UACs corregidas en la base de datos PostgreSQL.`);
}

main()
  .catch((e) => {
    console.error("❌ Error actualizando catálogo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
