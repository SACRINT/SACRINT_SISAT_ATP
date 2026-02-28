import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";

/**
 * GET /api/admin/exportar-excel-eventos
 * Generates and downloads the Excel file with all schools' event registrations.
 * Uses exceljs (serverless-compatible, no native dependencies).
 */
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Fetch discipline catalog
        const categorias = await prisma.categoriaEvento.findMany({
            include: { disciplinas: { orderBy: { orden: "asc" } } },
            orderBy: { orden: "asc" },
        });

        // Fetch all schools with their inscriptions
        const escuelas = await prisma.escuela.findMany({
            include: { inscripcionEvento: true },
            orderBy: { nombre: "asc" },
        });

        // Build flat list of all disciplines for column mapping
        const allDisciplinas = categorias.flatMap(c => c.disciplinas);

        // ─── Create Excel Workbook ───────────────────────
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "SISAT-ATP";
        workbook.created = new Date();

        // ═══ Sheet 1: Registro General ═══════════════════
        const ws = workbook.addWorksheet("Registro General");

        // Freeze first 3 rows + 3 columns
        ws.views = [{ state: "frozen", xSplit: 3, ySplit: 3, topLeftCell: "D4" }];

        // Column widths: CCT(15), Nombre(35), Localidad(22) + disciplines(12 each)
        ws.getColumn(1).width = 15;
        ws.getColumn(2).width = 35;
        ws.getColumn(3).width = 22;
        for (let i = 0; i < allDisciplinas.length; i++) {
            ws.getColumn(4 + i).width = 14;
        }

        // ─── Row 1: Category Headers ─────────────────────
        const row1 = ws.getRow(1);
        // Merge A1:C1 for "DATOS DEL PLANTEL"
        ws.mergeCells(1, 1, 1, 3);
        const plantelCell = ws.getCell(1, 1);
        plantelCell.value = "DATOS DEL PLANTEL";
        plantelCell.alignment = { horizontal: "center", vertical: "middle" };
        plantelCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        plantelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1f4e78" } };
        plantelCell.border = thinBorder();

        let colOffset = 4; // 1-based, start after CCT/Nombre/Localidad
        for (const cat of categorias) {
            const numCols = cat.disciplinas.length;
            if (numCols > 1) {
                ws.mergeCells(1, colOffset, 1, colOffset + numCols - 1);
            }
            const cell = ws.getCell(1, colOffset);
            cell.value = cat.nombre;
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + cat.color.replace("#", "") } };
            cell.border = thinBorder();

            // Fill border on merged cells
            for (let i = 1; i < numCols; i++) {
                const mergedCell = ws.getCell(1, colOffset + i);
                mergedCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + cat.color.replace("#", "") } };
                mergedCell.border = thinBorder();
            }

            colOffset += numCols;
        }
        row1.height = 28;

        // ─── Row 2: Discipline Headers ───────────────────
        const row2 = ws.getRow(2);
        // A2:C2 empty with same styling
        for (let c = 1; c <= 3; c++) {
            const cell = ws.getCell(2, c);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1f4e78" } };
            cell.border = thinBorder();
        }

        colOffset = 4;
        for (const disc of allDisciplinas) {
            const cell = ws.getCell(2, colOffset);
            cell.value = disc.nombre;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            cell.font = { bold: true, size: 9 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFddebf7" } };
            cell.border = thinBorder();
            colOffset++;
        }
        row2.height = 40;

        // ─── Row 3: Sub-headers ──────────────────────────
        const row3 = ws.getRow(3);
        const subHeaderStyle = {
            font: { bold: true, size: 9 } as Partial<ExcelJS.Font>,
            fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFf2f2f2" } },
            alignment: { horizontal: "center" as const, vertical: "middle" as const },
        };

        ws.getCell(3, 1).value = "CCT";
        ws.getCell(3, 2).value = "Nombre del Plantel";
        ws.getCell(3, 3).value = "Localidad";
        for (let c = 1; c <= 3; c++) {
            const cell = ws.getCell(3, c);
            Object.assign(cell, subHeaderStyle);
            cell.border = thinBorder();
        }

        colOffset = 4;
        for (const disc of allDisciplinas) {
            const cell = ws.getCell(3, colOffset);
            if (disc.tipo === "simple") {
                cell.value = "Participa?";
            } else if (disc.tipo === "grupo") {
                cell.value = "Part. / Nº";
            } else {
                cell.value = "Participa?";
            }
            Object.assign(cell, subHeaderStyle);
            cell.border = thinBorder();
            colOffset++;
        }

        // ─── Data Rows ───────────────────────────────────
        const lockedFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFe2efda" } };
        const yesFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFc6efce" } };
        const noFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };

        for (let i = 0; i < escuelas.length; i++) {
            const esc = escuelas[i];
            const rowNum = 4 + i;
            const dataRow = ws.getRow(rowNum);

            // School info columns
            ws.getCell(rowNum, 1).value = esc.cct;
            ws.getCell(rowNum, 2).value = esc.nombre;
            ws.getCell(rowNum, 3).value = esc.localidad;
            for (let c = 1; c <= 3; c++) {
                const cell = ws.getCell(rowNum, c);
                cell.fill = lockedFill;
                cell.border = thinBorder();
                cell.alignment = { vertical: "middle" };
                if (c === 1) cell.alignment = { horizontal: "center", vertical: "middle" };
            }

            // Discipline columns
            const datos = (esc.inscripcionEvento?.datos as Record<string, { participa: boolean; numParticipantes: number }>) || {};

            colOffset = 4;
            for (const disc of allDisciplinas) {
                const cell = ws.getCell(rowNum, colOffset);
                const entry = datos[disc.id];
                const participa = entry?.participa ?? false;

                if (participa) {
                    if (disc.tipo === "simple" || disc.tipo === "individual") {
                        cell.value = "Sí";
                    } else if (disc.tipo === "grupo" || disc.tipo === "equipo") {
                        cell.value = entry?.numParticipantes ?? "";
                    }
                    cell.fill = yesFill;
                } else {
                    cell.value = "No";
                    cell.fill = noFill;
                }

                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = thinBorder();
                colOffset++;
            }
            dataRow.height = 20;
        }

        // ═══ Sheet 2: Resumen ════════════════════════════
        const wsResumen = workbook.addWorksheet("Resumen");
        wsResumen.getColumn(1).width = 40;
        wsResumen.getColumn(2).width = 20;
        wsResumen.getColumn(3).width = 15;

        const resHeaderCell = wsResumen.getCell(1, 1);
        resHeaderCell.value = "RESUMEN DE PARTICIPACIÓN POR DISCIPLINA";
        resHeaderCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        resHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1f4e78" } };
        wsResumen.mergeCells(1, 1, 1, 3);
        for (let c = 1; c <= 3; c++) {
            wsResumen.getCell(1, c).border = thinBorder();
            wsResumen.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1f4e78" } };
        }

        // Column headers
        wsResumen.getCell(2, 1).value = "Disciplina";
        wsResumen.getCell(2, 2).value = "Escuelas Participando";
        wsResumen.getCell(2, 3).value = "% Participación";
        for (let c = 1; c <= 3; c++) {
            const cell = wsResumen.getCell(2, c);
            cell.font = { bold: true, size: 10 };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFddebf7" } };
            cell.border = thinBorder();
            cell.alignment = { horizontal: "center" };
        }

        let resRow = 3;
        for (const cat of categorias) {
            // Category header
            const catCell = wsResumen.getCell(resRow, 1);
            catCell.value = cat.nombre;
            catCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
            catCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + cat.color.replace("#", "") } };
            wsResumen.mergeCells(resRow, 1, resRow, 3);
            for (let c = 1; c <= 3; c++) {
                wsResumen.getCell(resRow, c).border = thinBorder();
                wsResumen.getCell(resRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + cat.color.replace("#", "") } };
            }
            resRow++;

            for (const disc of cat.disciplinas) {
                const count = escuelas.filter(esc => {
                    const datos = (esc.inscripcionEvento?.datos as Record<string, { participa: boolean }>) || {};
                    return datos[disc.id]?.participa === true;
                }).length;

                const pct = escuelas.length > 0 ? Math.round((count / escuelas.length) * 100) : 0;

                wsResumen.getCell(resRow, 1).value = disc.nombre;
                wsResumen.getCell(resRow, 2).value = `${count} / ${escuelas.length}`;
                wsResumen.getCell(resRow, 3).value = `${pct}%`;
                for (let c = 1; c <= 3; c++) {
                    const cell = wsResumen.getCell(resRow, c);
                    cell.border = thinBorder();
                    cell.alignment = { horizontal: c > 1 ? "center" : "left", vertical: "middle" };
                }
                resRow++;
            }
        }

        // ─── Generate Buffer ─────────────────────────────
        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer as ArrayBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Registro_Eventos_2026_${new Date().toISOString().split("T")[0]}.xlsx"`,
            },
        });
    } catch (error: unknown) {
        console.error("Error exportar-excel-eventos:", error);
        return NextResponse.json({ error: "Error generando Excel" }, { status: 500 });
    }
}

function thinBorder(): Partial<ExcelJS.Borders> {
    return {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
}
