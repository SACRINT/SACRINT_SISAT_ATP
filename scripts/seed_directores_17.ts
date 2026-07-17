import 'dotenv/config';
import { prisma } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

const parseSpanishDate = (dateStr: string): Date | null => {
    // Example: "16 de enero de 2011"
    const months: Record<string, number> = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    const regex = /(\d+)\s+de\s+([a-zA-Z]+)\s+de\s+(\d+)/i;
    const match = dateStr.match(regex);
    
    if (match) {
        const day = parseInt(match[1], 10);
        const month = months[match[2].toLowerCase()];
        const year = parseInt(match[3], 10);
        
        if (month !== undefined) {
            return new Date(year, month, day);
        }
    }
    return null;
};

async function main() {
    const filePath = 'C:\\NotebookLM\\documentos_referencia\\Datos_17_Directores_Constancia_NO_Adeudo_2025-2026.md';
    const content = fs.readFileSync(filePath, 'utf-8');

    // Split by '### ' to get each director's block
    const blocks = content.split('### ').slice(1);
    
    let successCount = 0;
    let notFoundCount = 0;

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // First line is something like "1\. ALEJANDRO ESPINOZA SALAS"
        const nameMatch = lines[0].match(/^\d+\\\.\s+(.*)$/);
        const nombreCompleto = nameMatch ? nameMatch[1].trim() : lines[0].replace(/^\d+[\.\\]\s*/, '').trim();

        let rfc = '';
        let fechaIngreso: Date | null = null;
        let clavePresupuestal = '';
        let cct = '';

        for (const line of lines) {
            if (line.includes('**R.F.C.:**')) {
                rfc = line.split('**R.F.C.:**')[1].trim();
            } else if (line.includes('**Fecha de ingreso a SEP:**')) {
                const dateStr = line.split('**Fecha de ingreso a SEP:**')[1].trim();
                fechaIngreso = parseSpanishDate(dateStr);
            } else if (line.includes('**Claves presupuestales:**')) {
                clavePresupuestal = line.split('**Claves presupuestales:**')[1].trim();
            } else if (line.includes('**Clave del C.T.:**')) {
                cct = line.split('**Clave del C.T.:**')[1].trim();
            }
        }

        if (cct) {
            console.log(`Buscando escuela con CCT: ${cct} (Director: ${nombreCompleto})`);
            const escuela = await prisma.escuela.findUnique({
                where: { cct }
            });

            if (escuela) {
                await prisma.directorExpediente.upsert({
                    where: { escuelaActualId: escuela.id },
                    create: {
                        escuelaActualId: escuela.id,
                        nombreCompleto,
                        rfc,
                        fechaIngreso,
                        clavePresupuestal,
                    },
                    update: {
                        nombreCompleto,
                        rfc,
                        fechaIngreso,
                        clavePresupuestal,
                    }
                });
                console.log(`✅ Expediente creado/actualizado para ${nombreCompleto}`);
                successCount++;
            } else {
                console.warn(`⚠️ Escuela no encontrada para el CCT: ${cct}`);
                notFoundCount++;
            }
        }
    }

    console.log(`\nImportación finalizada. ${successCount} actualizados, ${notFoundCount} no encontrados.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
