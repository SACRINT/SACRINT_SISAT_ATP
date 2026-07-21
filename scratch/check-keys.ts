import { prisma } from '../src/lib/db';
async function run() {
  const keys = await prisma.apiKey.findMany();
  console.log(keys);
}
run();
