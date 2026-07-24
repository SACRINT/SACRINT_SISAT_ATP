import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const cargas = await prisma.horarioCargaDocente.findMany({
    select: {
      id: true,
      escuelaId: true,
      personalId: true,
      grupoId: true,
      horasSemanales: true,
      personal: { select: { nombre: true, apellidoPaterno: true } },
      asignatura: { select: { uacName: true } }
    }
  });

  const escuelas = new Set(cargas.map(c => c.escuelaId));
  console.log("=== DISTINCT ESCUELA_IDs IN HorarioCargaDocente ===");
  escuelas.forEach(e => console.log("EscuelaID:", e));

  console.log("=== SUMMARY BY ESCUELA_ID ===");
  for (const escId of escuelas) {
    const escCargas = cargas.filter(c => c.escuelaId === escId);
    console.log(`Escuela ${escId}: ${escCargas.length} cargas total.`);
  }

  const armindaCargas = cargas.filter(c => c.personal?.nombre?.includes("ARMINDA") || c.personal?.apellidoPaterno?.includes("ARMINDA") || c.personal?.nombre?.includes("MARIA"));
  console.log("=== ARMINDA CARGAS IN DB ===");
  armindaCargas.forEach(c => {
    console.log({
      id: c.id,
      escuelaId: c.escuelaId,
      docente: `${c.personal?.nombre} ${c.personal?.apellidoPaterno}`,
      uac: c.asignatura?.uacName,
      horas: c.horasSemanales
    });
  });
}

main().finally(() => prisma.$disconnect());
