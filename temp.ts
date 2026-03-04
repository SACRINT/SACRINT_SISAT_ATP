import { prisma } from './src/lib/db'

async function main() {
    const programa = await prisma.programa.findFirst({
        where: { nombre: { contains: 'Acoso', mode: 'insensitive' } },
        include: { periodos: { include: { entregas: true } } }
    })
    console.dir(programa, { depth: null })
    console.log(`Numero de periodos: ${programa?.periodos.length}`);
}

main()
    .catch(e => { console.error(e) })
