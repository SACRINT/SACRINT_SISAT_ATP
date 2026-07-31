import 'dotenv/config';
import { prisma } from './src/lib/db';

async function main() {
  const escuelas = await prisma.escuela.findMany({
    where: { nombre: { contains: 'héroes', mode: 'insensitive' } }
  });
  console.log('Escuelas con héroes:', escuelas.map(e => ({ id: e.id, nombre: e.nombre, cct: e.cct })));

  const escuelas2 = await prisma.escuela.findMany({
    where: { nombre: { contains: 'heroes', mode: 'insensitive' } }
  });
  console.log('Escuelas con heroes:', escuelas2.map(e => ({ id: e.id, nombre: e.nombre, cct: e.cct })));
  
  const apoyos = await prisma.personal.findMany({
    where: { cargo: { contains: 'APOYO', mode: 'insensitive' } }
  });
  console.log('Cargos con APOYO:', apoyos.map(p => ({ id: p.id, nombre: p.nombre, cargo: p.cargo })));
}

main().finally(() => prisma.$disconnect());
