import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";
import path from "path";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const JSON_PATH = "C:\\NotebookLM\\documentos_referencia\\Horarios\\uacs_master_203.json";

function getComponentColor(component: string): string {
  const comp = component.toLowerCase();
  if (comp.includes("fundamental")) return "#2563eb"; // Azul
  if (comp.includes("ffeo") || comp.includes("socioem")) return "#059669"; // Verde
  if (comp.includes("ffe") || comp.includes("ext_")) return "#d97706"; // Ámbar
  if (comp.includes("laboral")) return "#7c3aed"; // Púrpura
  return "#4b5563"; // Gris
}

async function main() {
  console.log("🌱 Iniciando carga de las 203 UACs del catálogo maestro MCCEMS...");

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ No se encontró el archivo maestro en: ${JSON_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(JSON_PATH, "utf-8");
  const uacsList = JSON.parse(rawData);

  console.log(`📌 Se leyeron ${uacsList.length} asignaturas del archivo JSON.`);

  // Limpiar catálogo previo global si existe
  await prisma.horarioAsignaturaCatalogo.deleteMany({
    where: { escuelaId: null }
  });

  let insertados = 0;
  for (const item of uacsList) {
    const totalHours = item.total_hours || item.totalHours || 48;
    const horasSemanales = Math.max(1, Math.round(totalHours / 16));
    const colorHex = getComponentColor(item.component || "fundamental");

    await prisma.horarioAsignaturaCatalogo.create({
      data: {
        escuelaId: null, // Pertenece al catálogo global oficial
        uacName: item.uac_name || item.uacName,
        semester: Number(item.semester),
        component: item.component || "fundamental",
        totalHours: totalHours,
        horasSemanales: horasSemanales,
        colorHex: colorHex
      }
    });
    insertados++;
  }

  console.log(`✅ ¡Éxito! Se insertaron ${insertados} UACs al catálogo global del Generador de Horarios.`);
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando seed-uacs-203:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
