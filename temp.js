const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.autoridadesConfig.findUnique({where: {id: 'singleton'}}));
}
main().finally(() => prisma.$disconnect());
