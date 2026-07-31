const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando actualización de BD...");

  // 1. Eliminar escuela fantasma
  try {
    const escuela = await prisma.escuela.findFirst({
      where: { cct: '21EBH0202X' }
    });

    if (escuela) {
      console.log(`Escuela encontrada: ${escuela.nombre} (${escuela.cct}). Eliminando...`);
      // Use delete instead of deleteMany to hit the relation cascades properly if set up, or we might need to delete relations first. Let's try delete first.
      await prisma.escuela.delete({
        where: { id: escuela.id }
      });
      console.log("Escuela eliminada exitosamente.");
    } else {
      console.log("La escuela 21EBH0202X no se encontró.");
    }
  } catch (e) {
    console.error("Error eliminando escuela:", e);
  }

  // 2. Actualizar horas de Apoyo/Administrativo a 36
  try {
    const result = await prisma.personal.updateMany({
      where: {
        cargo: {
          in: ['APOYO_ADMINISTRATIVO', 'PERSONAL_DE_ASISTENCIA']
        }
      },
      data: {
        horasOficiales: 36
      }
    });
    console.log(`Horas actualizadas a 36 para ${result.count} registros de apoyo/administrativo.`);
  } catch (e) {
    console.error("Error actualizando horas:", e.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
