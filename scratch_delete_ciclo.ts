import 'dotenv/config';
import { prisma } from './src/lib/db';

async function main() {
  try {
    const ciclo = await prisma.cicloEscolar.findUnique({
      where: { nombre: '2026-2027' }
    });

    if (!ciclo) {
      console.log('El ciclo 2026-2027 no existe.');
      return;
    }

    // Buscar y eliminar Capems
    const capems = await prisma.capem.findMany({ where: { cicloEscolarId: ciclo.id } });
    if (capems.length > 0) {
      const capemIds = capems.map(c => c.id);
      await prisma.capemFichaRegistro.deleteMany({ where: { capemId: { in: capemIds } } });
      await prisma.capem.deleteMany({ where: { cicloEscolarId: ciclo.id } });
      console.log(`Eliminados ${capems.length} Capems`);
    }

    // Buscar y eliminar PeriodosEntrega y sus Entregas
    const periodos = await prisma.periodoEntrega.findMany({ where: { cicloEscolarId: ciclo.id } });
    if (periodos.length > 0) {
      const periodoIds = periodos.map(p => p.id);
      const entregas = await prisma.entrega.findMany({ where: { periodoEntregaId: { in: periodoIds } } });
      
      if (entregas.length > 0) {
        const entregaIds = entregas.map(e => e.id);
        await prisma.archivo.deleteMany({ where: { entregaId: { in: entregaIds } } });
        await prisma.correccion.deleteMany({ where: { entregaId: { in: entregaIds } } });
        await prisma.preRevision.deleteMany({ where: { entregaId: { in: entregaIds } } });
        await prisma.chatMensaje.deleteMany({ where: { entregaId: { in: entregaIds } } });
        await prisma.entrega.deleteMany({ where: { periodoEntregaId: { in: periodoIds } } });
        console.log(`Eliminadas ${entregas.length} Entregas relacionadas.`);
      }
      
      await prisma.periodoEntrega.deleteMany({ where: { cicloEscolarId: ciclo.id } });
      console.log(`Eliminados ${periodos.length} PeriodosEntrega`);
    }

    // Finalmente eliminar el CicloEscolar
    const deleted = await prisma.cicloEscolar.delete({
      where: { id: ciclo.id }
    });
    console.log('Resultado de la eliminación del ciclo:', deleted);
  } catch (error) {
    console.error('Error al eliminar el ciclo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
