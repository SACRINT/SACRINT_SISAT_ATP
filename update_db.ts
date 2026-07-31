import 'dotenv/config';
import { prisma } from './src/lib/db';

async function main() {
  console.log("Iniciando actualización de BD...");

  // 1. Eliminar escuela fantasma
  try {
    const escuela = await prisma.escuela.findFirst({
      where: { cct: '21EBH0200X' }
    });

    if (escuela) {
      console.log(`Escuela encontrada: ${escuela.nombre} (${escuela.cct}). Eliminando...`);
      await prisma.escuela.delete({
        where: { id: escuela.id }
      });
      console.log("Escuela eliminada exitosamente.");
    } else {
      console.log("La escuela 21EBH0200X no se encontró.");
    }
  } catch (e) {
    console.error("Error eliminando escuela:", e);
  }

  // 2. Actualizar horas de Apoyo/Administrativo a 36
  try {
    const result = await prisma.personal.updateMany({
      where: {
        cargo: {
          in: ['APOYO', 'ADMINISTRATIVO', 'APOYO_ADMINISTRATIVO', 'PERSONAL_DE_ASISTENCIA']
        }
      },
      data: {
        horasOficiales: 36
      }
    });
    console.log(`Horas actualizadas a 36 para ${result.count} registros de apoyo/administrativo.`);
  } catch (e) {
    console.error("Error actualizando horas:", e);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
