const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cargas = await prisma.horarioCargaDocente.findMany({
    include: { grupo: true, asignatura: true, personal: true },
    where: {
      asignatura: {
        nombre: {
          contains: 'Educación'
        }
      }
    }
  });
  console.log(JSON.stringify(cargas, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
