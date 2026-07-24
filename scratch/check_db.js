const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cargas = await prisma.horarioCargaDocente.findMany({
    include: {
      personal: true,
      grupo: true,
      asignatura: true
    }
  });

  console.log("=== TOTAL CARGAS DOCENTES IN DB ===", cargas.length);
  cargas.forEach(c => {
    console.log({
      id: c.id,
      docente: c.personal ? `${c.personal.nombre} ${c.personal.apellidoPaterno}` : c.personalId,
      grupo: c.grupo ? `${c.grupo.nombre} (sem ${c.grupo.semestre})` : c.grupoId,
      uac: c.asignatura ? c.asignatura.uacName : 'null',
      uacId: c.asignaturaId,
      horas: c.horasSemanales
    });
  });
}

main().finally(() => prisma.$disconnect());
