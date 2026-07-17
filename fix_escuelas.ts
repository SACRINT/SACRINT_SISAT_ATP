import * as xlsx from 'xlsx';
import { prisma } from './src/lib/db';

async function run() {
    console.log("Reading Excel file...");
    const excelPath = "C:/NotebookLM/documentos_referencia/DATOS DE DIRECTORES Y BACHILLERATOS.xlsx";
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rawData: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let headerRowIndex = -1;
    let cctColIndex = -1;
    let localidadColIndex = -1;
    let municipioColIndex = -1;
    let directorColIndex = -1;

    for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j]).trim().toUpperCase();
            if (cell.includes("C. C. T.") || cell.includes("C.C.T")) {
                headerRowIndex = i;
                cctColIndex = j;
            } else if (cell.includes("LOCALIDAD")) {
                localidadColIndex = j;
            } else if (cell.includes("MUNICIPIO")) {
                municipioColIndex = j;
            } else if (cell.includes("DIRECTOR")) {
                directorColIndex = j;
            }
        }
        if (headerRowIndex !== -1) break;
    }

    if (headerRowIndex === -1) {
        console.error("Could not find header row in Excel");
        return;
    }

    console.log(`Headers found at row ${headerRowIndex}. CCT:${cctColIndex}, Loc:${localidadColIndex}, Mun:${municipioColIndex}, Dir:${directorColIndex}`);

    let updatedCount = 0;
    const escuelasInDb = await prisma.escuela.findMany();

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !row[cctColIndex]) continue;

        let cctExcel = String(row[cctColIndex]).trim().toUpperCase();
        if (cctExcel) {
            const localidad = row[localidadColIndex] ? String(row[localidadColIndex]).trim() : undefined;
            const municipio = row[municipioColIndex] ? String(row[municipioColIndex]).trim() : undefined;
            const director = row[directorColIndex] ? String(row[directorColIndex]).trim() : undefined;
            
            // Try to find the school in DB. Due to typos like 21EBI instead of 21EBH, let's match by exact or similar (e.g. ignoring the 5th char if everything else matches)
            let esc = escuelasInDb.find(e => e.cct.toUpperCase() === cctExcel);
            if (!esc) {
                // Try fuzzy match (e.g. 21EBH0186U vs 21EBI0186U)
                esc = escuelasInDb.find(e => e.cct.substring(0,4) === cctExcel.substring(0,4) && e.cct.substring(5) === cctExcel.substring(5));
            }

            if (esc) {
                console.log(`Matching ${cctExcel} to ${esc.cct} - Loc: ${localidad}, Mun: ${municipio}`);
                await prisma.escuela.update({
                    where: { id: esc.id },
                    data: {
                        localidad: localidad || esc.localidad || "",
                        municipio: municipio || esc.municipio || "",
                        zonaEscolar: "004",
                        director: director || esc.director || ""
                    }
                });
                updatedCount++;
            } else {
                console.log(`School not found in DB: ${cctExcel}`);
            }
        }
    }
    console.log(`Updated ${updatedCount} schools.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
