import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const MESES_MAP: Record<string, number> = {
    "Enero": 1,
    "Febrero": 2,
    "Marzo": 3,
    "Abril": 4,
    "Mayo": 5,
    "Junio": 6,
    "Julio": 7,
    "Agosto": 8,
    "Septiembre": 9,
    "Octubre": 10,
    "Noviembre": 11,
    "Diciembre": 12
};

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const mes = searchParams.get("mes") || "";
        const anio = searchParams.get("anio") || "";

        const mesNum = MESES_MAP[mes];
        if (!mesNum) {
            return NextResponse.json({ error: "Mes no válido" }, { status: 400 });
        }

        const ciclo = await prisma.cicloEscolar.findFirst({
            where: { activo: true }
        });
        if (!ciclo) {
            return NextResponse.json({ error: "Ciclo activo no encontrado" }, { status: 404 });
        }

        const periodo = await prisma.periodoEntrega.findFirst({
            where: {
                programa: { nombre: { contains: "ACOSO", mode: "insensitive" } },
                mes: mesNum,
                cicloEscolarId: ciclo.id
            }
        });

        if (!periodo) {
            return NextResponse.json({ tieneCasos: false, schools: [] });
        }

        const entregas = await prisma.entrega.findMany({
            where: {
                periodoEntregaId: periodo.id
            },
            include: {
                escuela: true,
                archivos: true
            }
        });

        const schoolsWithCases: any[] = [];

        for (const ent of entregas) {
            const excelFile = ent.archivos.find(arch => 
                arch.tipo === "ENTREGA" && 
                (arch.nombre.toLowerCase().endsWith(".xlsx") || 
                 arch.nombre.toLowerCase().endsWith(".xls") ||
                 (arch.driveUrl && arch.driveUrl.toLowerCase().includes(".xlsx")) ||
                 (arch.driveUrl && arch.driveUrl.toLowerCase().includes(".xls")))
            );

            if (excelFile && excelFile.driveUrl) {
                try {
                    const fileRes = await fetch(excelFile.driveUrl);
                    if (fileRes.ok) {
                        const buffer = await fileRes.arrayBuffer();
                        const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
                        
                        let sheetName = workbook.SheetNames.find(
                            name => name.toUpperCase() === mes.toUpperCase()
                        );
                        if (!sheetName) {
                            sheetName = workbook.SheetNames[0];
                        }

                        if (sheetName) {
                            const sheet = workbook.Sheets[sheetName];
                            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                            
                            let currentTipoViolencia = '';
                            const extractedCases: any[] = [];
                            
                            for (let r = 0; r < rows.length; r++) {
                                const row = rows[r];
                                if (!row || row.length === 0) continue;
                                
                                const firstCell = String(row[0] || '').trim().toUpperCase();
                                if (firstCell.startsWith('TIPO DE VIOLENCIA:')) {
                                    const nextRow = rows[r + 1];
                                    if (nextRow && nextRow[0]) {
                                        currentTipoViolencia = String(nextRow[0]).trim();
                                    }
                                    r++;
                                    continue;
                                }
                                
                                const schoolName = String(row[7] || '').trim();
                                const cct = String(row[8] || '').trim();
                                const acciones = String(row[15] || '').trim();
                                
                                if (schoolName === 'NOMBRE DE LA INSTITUCIÓN' || schoolName === 'NOMBRE DE LA INSTITUCION' || !schoolName) {
                                    continue;
                                }
                                
                                if (cct && cct.length >= 8 && cct !== 'C.C.T') {
                                    const concluido = String(row[16] || '').trim().toUpperCase() === 'X';
                                    const estatus = concluido ? 'concluido' : 'pendiente';
                                    
                                    extractedCases.push({
                                        escuela: schoolName,
                                        cct,
                                        municipio: String(row[10] || '').trim().replace(/, PUE\.?$/i, ''),
                                        tipoViolencia: currentTipoViolencia || "Acoso Escolar",
                                        acciones,
                                        estatus
                                    });
                                }
                            }

                            if (extractedCases.length > 0) {
                                schoolsWithCases.push({
                                    id: ent.escuela.id,
                                    nombre: ent.escuela.nombre,
                                    cct: ent.escuela.cct,
                                    municipio: ent.escuela.municipio,
                                    casos: extractedCases
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error parsing excel for school ${ent.escuela.nombre}:`, err);
                }
            }
        }

        return NextResponse.json({
            tieneCasos: schoolsWithCases.length > 0,
            schools: schoolsWithCases
        });
    } catch (error: any) {
        console.error("Error en endpoint acoso-casos:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
