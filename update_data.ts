import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as xlsx from 'xlsx';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Updating AutoridadesConfig...");
    await prisma.autoridadesConfig.upsert({
        where: { id: "singleton" },
        update: {
            supervisor: "ALEJANDRO ESCAMILLA MARTINEZ",
            supervisorRFC: "EAMA670930DFA",
            supervisorFecha: "01/10/1997",
            supervisorClave: "E482700.0 000500",
            
            atp1Nombre: "SAMUEL CRUZ INTERIAL",
            atp1RFC: "CUIS770306LS0",
            atp1Fecha: "16/10/2005",
            atp1Clave: "E472500.0 000800",

            atp2Nombre: "VICTOR MANUEL SAENZ CUELLAR",
            atp2RFC: "SACV770114692",
            atp2Fecha: "01/09/2004",
            atp2Clave: "E761100.0 000742",

            atp3Nombre: "IMELDA HERNÁNDEZ GARCÍA",
            atp3RFC: "HEGI730315M72",
            atp3Fecha: "01/11/2000",
            atp3Clave: "E472500.0 00491",

            atp4Nombre: "LILIA CASTILLO LEYVA",
            atp4RFC: "CALL7707274K0",
            atp4Fecha: "01/04/2014",
            atp4Clave: "E462500.0 000233"
        },
        create: {
            id: "singleton",
            supervisor: "ALEJANDRO ESCAMILLA MARTINEZ",
            supervisorRFC: "EAMA670930DFA",
            supervisorFecha: "01/10/1997",
            supervisorClave: "E482700.0 000500",
            
            atp1Nombre: "SAMUEL CRUZ INTERIAL",
            atp1RFC: "CUIS770306LS0",
            atp1Fecha: "16/10/2005",
            atp1Clave: "E472500.0 000800",

            atp2Nombre: "VICTOR MANUEL SAENZ CUELLAR",
            atp2RFC: "SACV770114692",
            atp2Fecha: "01/09/2004",
            atp2Clave: "E761100.0 000742",

            atp3Nombre: "IMELDA HERNÁNDEZ GARCÍA",
            atp3RFC: "HEGI730315M72",
            atp3Fecha: "01/11/2000",
            atp3Clave: "E472500.0 00491",

            atp4Nombre: "LILIA CASTILLO LEYVA",
            atp4RFC: "CALL7707274K0",
            atp4Fecha: "01/04/2014",
            atp4Clave: "E462500.0 000233"
        }
    });

    console.log("Reading Excel file...");
    const excelPath = "C:/NotebookLM/documentos_referencia/DATOS DE DIRECTORES Y BACHILLERATOS.xlsx";
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(sheet);
    
    // Data expected headers: "C. C. T.", "LOCALIDAD", "MUNICIPIO", "NOMBRE DEL DIRECTOR"
    // Print first row to see keys
    if (data.length > 0) {
        console.log("Excel headers:", Object.keys(data[0]));
    }

    let updatedCount = 0;
    for (const row of data as any[]) {
        let cct = row["C. C. T."] || row["C.C.T."] || row["C.C.T"];
        if (cct) {
            cct = cct.toString().trim().toUpperCase();
            
            const localidad = row["LOCALIDAD"]?.toString().trim();
            const municipio = row["MUNICIPIO"]?.toString().trim();
            
            if (localidad || municipio) {
                // Find school
                const esc = await prisma.escuela.findFirst({
                    where: { cct }
                });

                if (esc) {
                    await prisma.escuela.update({
                        where: { id: esc.id },
                        data: {
                            localidad: localidad || esc.localidad,
                            municipio: municipio || esc.municipio,
                            zonaEscolar: "004" // As requested, always 004 for these schools
                        }
                    });
                    updatedCount++;
                } else {
                    console.log(`School not found in DB: ${cct}`);
                }
            }
        }
    }
    console.log(`Updated ${updatedCount} schools.`);
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
