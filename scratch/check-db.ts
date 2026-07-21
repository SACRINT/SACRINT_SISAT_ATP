import { prisma } from '../src/lib/db';
async function run() {
    console.log(await prisma.preRevisionConfig.findUnique({where: {id: 'singleton'}}));
}
run();
