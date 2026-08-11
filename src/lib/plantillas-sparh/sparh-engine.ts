import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export interface ReglaValidacionConfig {
    maxHorasJornadaDocente: number;
    permitirDoblePlaza: boolean;
}

export interface PlazaParsed {
    rfc?: string;
    curp?: string;
    nombreDocente?: string;
    escuelaCCT?: string;
    clavePlaza?: string;
    funcion?: string;
    horasAsignadas: number;
    tipoJornada?: string;
    esIncompatible?: boolean;
    datosExtra?: Record<string, unknown>;
}

export interface InconsistenciaParsed {
    tipoInconsistencia: "DUPLICADO_RFC" | "EXCESO_HORAS" | "CAMPO_VACIO" | "INCOMPATIBILIDAD_PLAZA" | "CLAVE_INVALIDA";
    severidad: "INFO" | "ADVERTENCIA" | "ERROR_CRITICO";
    filaNumero?: number;
    columnaCampo?: string;
    valorEncontrado?: string;
    descripcion: string;
    detalles?: Record<string, unknown>;
}

export interface ParsedPlantillaResult {
    nombreArchivo: string;
    totalRegistros: number;
    totalHoras: number;
    escuelaCCT?: string;
    escuelaNombre?: string;
    plazas: PlazaParsed[];
    inconsistencias: InconsistenciaParsed[];
}

/**
 * Normaliza textos removiendo acentos y espacios dobles
 */
function normalizarTexto(txt: unknown): string {
    if (txt === null || txt === undefined) return "";
    let str = "";
    if (typeof txt === "object") {
        const obj = txt as { result?: unknown; text?: unknown };
        str = String(obj.text || obj.result || "");
    } else {
        str = String(txt);
    }
    return str
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Motor Parser y Validador de Plantillas Excel (SPARH / CENSUS)
 */
export async function parsearYValidarPlantillaExcel(
    fileBuffer: Buffer | Uint8Array,
    filename: string,
    config: ReglaValidacionConfig = { maxHorasJornadaDocente: 40, permitirDoblePlaza: false }
): Promise<ParsedPlantillaResult> {
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error ExcelJS supports Buffer or Uint8Array
    await workbook.xlsx.load(fileBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
        throw new Error("El archivo Excel no contiene hojas de trabajo válidas.");
    }

    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    // 1. Escanear filas para detectar la fila de encabezados
    sheet.eachRow((row, rowNumber) => {
        if (headerRowIdx !== -1) return;
        const rowVals = row.values as unknown[];
        const strRow = rowVals.map((v) => normalizarTexto(v)).join(" | ");

        if (
            strRow.includes("RFC") ||
            strRow.includes("CURP") ||
            strRow.includes("NOMBRE") ||
            strRow.includes("CCT") ||
            strRow.includes("FUNCION") ||
            strRow.includes("CLAVE")
        ) {
            headerRowIdx = rowNumber;
            rowVals.forEach((val, colIdx) => {
                const norm = normalizarTexto(val);
                if (norm.includes("RFC")) colMap["rfc"] = colIdx;
                else if (norm.includes("CURP")) colMap["curp"] = colIdx;
                else if (norm.includes("NOMBRE") || norm.includes("DOCENTE") || norm.includes("PERSONAL")) colMap["nombre"] = colIdx;
                else if (norm.includes("PATERNO") && !colMap["paterno"]) colMap["paterno"] = colIdx;
                else if (norm.includes("MATERNO") && !colMap["materno"]) colMap["materno"] = colIdx;
                else if (norm.includes("CCT") || norm.includes("CENTRO DE TRABAJO")) colMap["cct"] = colIdx;
                else if (norm.includes("CLAVE") || norm.includes("PRESUPUESTAL")) colMap["clavePlaza"] = colIdx;
                else if (norm.includes("FUNCION") || norm.includes("PUESTO")) colMap["funcion"] = colIdx;
                else if (
                    norm.includes("HORAS") ||
                    norm.includes("HRS") ||
                    norm.includes("HORARIO") ||
                    norm.includes("H.S.M") ||
                    norm.includes("HSM") ||
                    norm.includes("CARGA")
                ) colMap["horas"] = colIdx;
                else if (norm.includes("JORNADA") || norm.includes("TIPO")) colMap["jornada"] = colIdx;
            });
        }
    });

    // Fallback si no se encontró fila explícita
    if (headerRowIdx === -1) {
        headerRowIdx = 1;
        colMap = { nombre: 1, cct: 2, funcion: 3, rfc: 4, curp: 5, horas: 6 };
    }

    const plazas: PlazaParsed[] = [];
    const inconsistencias: InconsistenciaParsed[] = [];
    let detectedCCT = "";

    // Inconsistencia INFO si no hay columna de horas
    if (colMap["horas"] === undefined) {
        inconsistencias.push({
            tipoInconsistencia: "CAMPO_VACIO",
            severidad: "INFO",
            filaNumero: headerRowIdx > 0 ? headerRowIdx : 1,
            columnaCampo: "Horas",
            valorEncontrado: "Ausente",
            descripcion: "Archivo sin columna de horas — no parece sábana de plantillas SPARH"
        });
    }

    const rfcMap: Record<string, { count: number; filas: number[]; horasTotal: number; plazaFullTime: boolean }> = {};

    // 2. Procesar filas de datos
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIdx) return;
        const rowVals = row.values as unknown[];
        if (!rowVals || rowVals.length === 0) return;

        const valNombre = normalizarTexto(rowVals[colMap["nombre"]]);
        const valPaterno = colMap["paterno"] ? normalizarTexto(rowVals[colMap["paterno"]]) : "";
        const valMaterno = colMap["materno"] ? normalizarTexto(rowVals[colMap["materno"]]) : "";
        const valRFC = normalizarTexto(rowVals[colMap["rfc"]]);
        const valCURP = normalizarTexto(rowVals[colMap["curp"]]);
        const valCCT = normalizarTexto(rowVals[colMap["cct"]]);
        const valClave = normalizarTexto(rowVals[colMap["clavePlaza"]]);
        const valFuncion = normalizarTexto(rowVals[colMap["funcion"]]);
        const rawHoras = rowVals[colMap["horas"]];

        let horas = 0;
        if (typeof rawHoras === "number") {
            horas = rawHoras;
        } else if (rawHoras) {
            const parsed = parseFloat(String(rawHoras).replace(/[^0-9.]/g, ""));
            if (!isNaN(parsed)) horas = parsed;
        }

        let nombreCompleto = valNombre;
        if (valPaterno || valMaterno) {
            nombreCompleto = `${valPaterno} ${valMaterno} ${valNombre}`.trim();
        }

        if (!nombreCompleto && !valRFC && !valCURP && !valCCT) {
            return; // Fila vacía o de pie de página
        }

        if (valCCT && !detectedCCT) {
            detectedCCT = valCCT;
        }

        // --- VALIDACIONES DE FILA ---

        // Regla 1: Campos obligatorios faltantes
        if (!nombreCompleto) {
            inconsistencias.push({
                tipoInconsistencia: "CAMPO_VACIO",
                severidad: "ERROR_CRITICO",
                filaNumero: rowNumber,
                columnaCampo: "Nombre",
                valorEncontrado: "",
                descripcion: `El nombre del personal en la fila ${rowNumber} está vacío.`
            });
        }

        if (!valRFC && !valCURP) {
            inconsistencias.push({
                tipoInconsistencia: "CAMPO_VACIO",
                severidad: "ADVERTENCIA",
                filaNumero: rowNumber,
                columnaCampo: "RFC/CURP",
                valorEncontrado: "",
                descripcion: `El registro en fila ${rowNumber} (${nombreCompleto || "Sin Nombre"}) no cuenta con RFC ni CURP.`
            });
        }

        // Regla 2: Agrupación por RFC / CURP para sobrecupo y duplicidad
        const keyPersona = valRFC || valCURP || nombreCompleto;
        if (keyPersona) {
            if (!rfcMap[keyPersona]) {
                rfcMap[keyPersona] = { count: 0, filas: [], horasTotal: 0, plazaFullTime: false };
            }
            rfcMap[keyPersona].count += 1;
            rfcMap[keyPersona].filas.push(rowNumber);
            rfcMap[keyPersona].horasTotal += horas;

            if (valFuncion.includes("DIRECTOR") || valFuncion.includes("SUPERVISOR") || valFuncion.includes("COMPLETO")) {
                rfcMap[keyPersona].plazaFullTime = true;
            }
        }

        plazas.push({
            nombreDocente: nombreCompleto,
            rfc: valRFC,
            curp: valCURP,
            escuelaCCT: valCCT || detectedCCT,
            clavePlaza: valClave,
            funcion: valFuncion || "DOCENTE",
            horasAsignadas: horas,
            tipoJornada: valFuncion.includes("DIRECTOR") ? "TIEMPO_COMPLETO" : "HORAS",
            esIncompatible: false
        });
    });

    // 3. Validaciones Globales de Archivo (Duplicidad de RFC y Exceso de Horas)
    for (const [key, data] of Object.entries(rfcMap)) {
        // RFC Duplicado
        if (data.count > 1) {
            inconsistencias.push({
                tipoInconsistencia: "DUPLICADO_RFC",
                severidad: "ADVERTENCIA",
                filaNumero: data.filas[0],
                columnaCampo: "RFC/CURP",
                valorEncontrado: key,
                descripcion: `El docente con identificador ${key} aparece registrado ${data.count} veces en las filas [${data.filas.join(", ")}].`,
                detalles: { filas: data.filas, identificador: key }
            });
        }

        // Exceso de horas vs jornada legal
        if (data.horasTotal > config.maxHorasJornadaDocente) {
            inconsistencias.push({
                tipoInconsistencia: "EXCESO_HORAS",
                severidad: "ERROR_CRITICO",
                filaNumero: data.filas[0],
                columnaCampo: "Horas Asignadas",
                valorEncontrado: `${data.horasTotal} hrs`,
                descripcion: `El docente ${key} acumula un total de ${data.horasTotal} horas, superando el límite legal configurado (${config.maxHorasJornadaDocente} hrs).`,
                detalles: { horasAcumuladas: data.horasTotal, limiteLegal: config.maxHorasJornadaDocente }
            });
        }

        // Incompatibilidad por tiempo completo
        if (data.count > 1 && data.plazaFullTime && !config.permitirDoblePlaza) {
            inconsistencias.push({
                tipoInconsistencia: "INCOMPATIBILIDAD_PLAZA",
                severidad: "ERROR_CRITICO",
                filaNumero: data.filas[0],
                columnaCampo: "Función",
                valorEncontrado: key,
                descripcion: `El docente ${key} ostenta una plaza de Tiempo Completo / Dirección y tiene cargos o plazas adicionales no compatibles.`,
                detalles: { identificador: key }
            });
        }
    }

    if (plazas.length < 5) {
        inconsistencias.push({
            tipoInconsistencia: "CAMPO_VACIO",
            severidad: "INFO",
            filaNumero: 0,
            columnaCampo: "Filas Datos",
            valorEncontrado: `${plazas.length} filas`,
            descripcion: "Archivo con menos de 5 filas de datos — archivo sin datos o layout de estructura"
        });
    }

    const totalHoras = plazas.reduce((acc, p) => acc + p.horasAsignadas, 0);

    return {
        nombreArchivo: filename,
        totalRegistros: plazas.length,
        totalHoras,
        escuelaCCT: detectedCCT,
        plazas,
        inconsistencias
    };
}

/**
 * Guarda el registro parseado en PostgreSQL con Prisma
 */
export async function guardarPlantillaRegistro(
    tenantId: string,
    nombreArchivo: string,
    fileBuffer: Buffer,
    parsedResult: ParsedPlantillaResult
) {
    const sha256Hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const estadoFinal = parsedResult.inconsistencias.some((i) => i.severidad === "ERROR_CRITICO")
        ? "CON_ERRORES"
        : "VALIDADO";

    const registro = await prisma.plantillaPersonalRegistro.create({
        data: {
            tenantId,
            escuelaCCT: parsedResult.escuelaCCT || "DESCONOCIDO",
            nombreArchivo,
            sha256Hash,
            totalRegistros: parsedResult.totalRegistros,
            totalHoras: parsedResult.totalHoras,
            estado: estadoFinal,
            metadatos: {
                escuelaNombre: parsedResult.escuelaNombre || null,
                totalInconsistencias: parsedResult.inconsistencias.length,
                fechaProcesamiento: new Date().toISOString()
            },
            plazas: {
                create: parsedResult.plazas.map((p) => ({
                    tenantId,
                    escuelaCCT: p.escuelaCCT,
                    rfc: p.rfc,
                    curp: p.curp,
                    nombreDocente: p.nombreDocente,
                    clavePlaza: p.clavePlaza,
                    funcion: p.funcion,
                    horasAsignadas: p.horasAsignadas,
                    tipoJornada: p.tipoJornada,
                    esIncompatible: p.esIncompatible ?? false
                }))
            },
            inconsistencias: {
                create: parsedResult.inconsistencias.map((inc) => ({
                    tenantId,
                    escuelaCCT: parsedResult.escuelaCCT,
                    tipoInconsistencia: inc.tipoInconsistencia,
                    severidad: inc.severidad,
                    filaNumero: inc.filaNumero,
                    columnaCampo: inc.columnaCampo,
                    valorEncontrado: inc.valorEncontrado,
                    descripcion: inc.descripcion,
                    detalles: inc.detalles ? JSON.parse(JSON.stringify(inc.detalles)) : undefined
                }))
            }
        },
        include: {
            plazas: true,
            inconsistencias: true
        }
    });

    return registro;
}

/**
 * Consolida todas las plantillas registradas para la Zona Escolar y exporta a Excel oficial SEP/DBEPA
 */
export async function generarConsolidadoZonaExcel(tenantId: string): Promise<Buffer> {
    const plazas = await prisma.plantillaDetallePlaza.findMany({
        where: { tenantId },
        include: {
            plantillaRegistro: true
        },
        orderBy: [{ escuelaCCT: "asc" }, { nombreDocente: "asc" }]
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SISAT-ATP Módulo SPARH";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("CONSOLIDADO DE ZONA SPARH");

    // Estilo de Título
    sheet.mergeCells("A1:H1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "SECRETARÍA DE EDUCACIÓN PÚBLICA — SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA";
    titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("A2:H2");
    const subTitleCell = sheet.getCell("A2");
    subTitleCell.value = `PLANTILLA CONSOLIDADA DE PERSONAL — ZONA ESCOLAR (${tenantId})`;
    subTitleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF334155" } };
    subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    subTitleCell.alignment = { horizontal: "center", vertical: "middle" };

    sheet.addRow([]);

    // Encabezados
    const headerRow = sheet.addRow([
        "No.",
        "CCT PLANTEL",
        "NOMBRE COMPLETO DEL DOCENTE / PERSONAL",
        "RFC",
        "CURP",
        "FUNCIÓN",
        "CLAVE DE PLAZA",
        "HORAS ASIGNADAS"
    ]);

    headerRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Filas de Datos
    let idx = 1;
    plazas.forEach((p: { escuelaCCT?: string | null; nombreDocente?: string | null; rfc?: string | null; curp?: string | null; funcion?: string | null; clavePlaza?: string | null; horasAsignadas: number }) => {
        const row = sheet.addRow([
            idx++,
            p.escuelaCCT || "N/A",
            p.nombreDocente || "SIN NOMBRE",
            p.rfc || "N/A",
            p.curp || "N/A",
            p.funcion || "DOCENTE",
            p.clavePlaza || "N/A",
            p.horasAsignadas
        ]);

        row.eachCell((cell, colNumber) => {
            cell.font = { name: "Arial", size: 9 };
            if (colNumber === 8) {
                cell.alignment = { horizontal: "right" };
                cell.numFmt = "#,##0";
            }
        });
    });

    // Total de horas
    const totalHorasZona = plazas.reduce((acc: number, p: { horasAsignadas: number }) => acc + p.horasAsignadas, 0);
    const totalRow = sheet.addRow(["", "", "", "", "", "", "TOTAL HORAS ZONA:", totalHorasZona]);
    totalRow.getCell(7).font = { bold: true };
    totalRow.getCell(8).font = { bold: true, color: { argb: "FF059669" } };

    // Autoancho de columnas
    sheet.columns.forEach((column) => {
        column.width = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
