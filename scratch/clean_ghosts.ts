import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  // 1. Encontrar asignaturas del catálogo que se llamen "Asignatura UAC"
  const catGhost = await prisma.horarioAsignaturaCatalogo.findMany({
    where: { uacName: { contains: "Asignatura UAC", mode: "insensitive" } }
  });
  console.log("Catálogos ghost encontrados:", catGhost.length);
  const ghostAsignaturaIds = catGhost.map(a => a.id);

  // 2. Eliminar celdas de horarios generados que usen esas asignaturas
  const celdasEliminadas = await prisma.horarioCelda.deleteMany({
    where: { asignaturaId: { in: ghostAsignaturaIds } }
  });
  console.log("Celdas de horario ghost eliminadas:", celdasEliminadas.count);

  // 3. Eliminar cargas docentes ghost
  const cargasEliminadas = await prisma.horarioCargaDocente.deleteMany({
    where: {
      OR: [
        { asignaturaId: { in: ghostAsignaturaIds } },
        { asignatura: { uacName: { contains: "Asignatura UAC", mode: "insensitive" } } }
      ]
    }
  });
  console.log("Cargas docentes ghost eliminadas:", cargasEliminadas.count);

  // 4. Eliminar asignaturas del catálogo ghost
  const catEliminados = await prisma.horarioAsignaturaCatalogo.deleteMany({
    where: { uacName: { contains: "Asignatura UAC", mode: "insensitive" } }
  });
  console.log("Catálogos ghost eliminados de DB:", catEliminados.count);

  // 5. Eliminar horarios generados viejos de todas las escuelas para obligar a regeneración limpia
  const horariosGenerados = await prisma.horarioGenerado.deleteMany({});
  console.log("Horarios generados obsoletos eliminados:", horariosGenerados.count);
}

main().finally(() => prisma.$disconnect());
