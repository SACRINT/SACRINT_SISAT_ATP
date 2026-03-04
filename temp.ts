import { prisma } from './src/lib/db';
import { NextResponse } from 'next/server';

// Let's create a mockup of the exact API logic and see where it goes wrong
async function test() {
    const adminPrograma = await prisma.programa.findFirst({
        where: { nombre: { contains: 'Acoso', mode: 'insensitive' } }
    });

    if (!adminPrograma) return console.log('not found');
    const programaId = adminPrograma.id;

    // Simulate what the payload is: Assuming changing to MENSUAL
    const tipo = 'MENSUAL';

    // Exact API code
    const existingPrograma = await prisma.programa.findUnique({
        where: { id: programaId }
    });

    if (!existingPrograma) {
        return console.log('Programa no encontrado');
    }

    const isTipoChanging = tipo !== undefined && tipo !== existingPrograma.tipo;
    console.log('existingPrograma.tipo', existingPrograma.tipo);
    console.log('tipo passed', tipo);
    console.log('isTipoChanging', isTipoChanging);

    if (isTipoChanging) {
        console.log('It SHOULD recreate periods.');
    }
}
test();
