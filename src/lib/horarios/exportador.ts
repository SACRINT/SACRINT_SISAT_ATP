import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  ShadingType,
  HeadingLevel,
  BorderStyle
} from "docx";

export interface FilaExportacion {
  encabezado: string;
  subtitulo?: string;
  celdas: {
    [diaPeriodo: string]: {
      materia: string;
      docente?: string;
      grupo?: string;
      aula?: string;
      colorBg?: string;
    } | string; // Compatibilidad con string simple
  };
}

export interface DatosExportacionHorario {
  nombreEscuela: string;
  cct: string;
  zonaEscolar?: string;
  cicloEscolar?: string;
  tipoVista: "GRUPO" | "DOCENTE" | "AULA" | "SUMARIO" | "PAQUETE_DOCENTES" | "PAQUETE_GRUPOS";
  tituloTabla: string;
  dias: string[];
  periodos: string[];
  filas: FilaExportacion[];
}

// Colores pastel/elegantes para asignaturas
const PALETA_COLORES_DOC = [
  "#eff6ff", "#f0fdf4", "#fefce8", "#fff7ed", "#fdf2f8",
  "#f5f3ff", "#ecfeff", "#f0fdfa", "#fafaf9", "#eef2ff"
];

export function getHashColor(texto: string): string {
  if (!texto) return "#f8fafc";
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETA_COLORES_DOC.length;
  return PALETA_COLORES_DOC[index];
}

// =========================================================================
// EXPORTACIÓN A EXCEL (.XLSX)
// =========================================================================
export function exportarHorarioExcel(datos: DatosExportacionHorario) {
  const wb = XLSX.utils.book_new();

  const headerRow = ["Periodo / Día", ...datos.dias.map(d => d.toUpperCase())];

  for (const fila of datos.filas) {
    const rowsData: string[][] = [
      [`SECRETARÍA DE EDUCACIÓN PÚBLICA - ZONA ESCOLAR 004`],
      [`ESCUELA: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`],
      [`HORARIO OFICIAL DE CLASES - ${datos.tituloTabla.toUpperCase()}`],
      [`${fila.encabezado} ${fila.subtitulo ? " - " + fila.subtitulo : ""}`],
      [],
      headerRow
    ];

    for (let p = 0; p < datos.periodos.length; p++) {
      const row: string[] = [`Hora ${p + 1}`];

      for (let d = 1; d <= datos.dias.length; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];

        if (!val) {
          row.push("Libre");
        } else if (typeof val === "string") {
          row.push(val);
        } else {
          // Formatear celda rica
          const partes: string[] = [];
          if (val.materia) partes.push(val.materia);
          if (val.docente) partes.push(`Prof. ${val.docente}`);
          if (val.grupo) partes.push(`Grupo ${val.grupo}`);
          row.push(partes.join("\n"));
        }
      }
      rowsData.push(row);
    }

    rowsData.push([]);
    rowsData.push(["Generado por SISAT-ATP | Sistema Inteligente de Horarios IA"]);

    const ws = XLSX.utils.aoa_to_sheet(rowsData);

    // Ajustar ancho de columnas
    ws["!cols"] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 32 },
      { wch: 32 },
      { wch: 32 },
      { wch: 32 }
    ];

    const sheetName = fila.encabezado.replace(/[\\/?*:[\]]/g, "_").slice(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const fileName = `Horario_${datos.cct}_${datos.tipoVista}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// =========================================================================
// EXPORTACIÓN A PDF OFICIAL FORMAL (Landscape A4)
// =========================================================================
export function exportarHorarioPDF(datos: DatosExportacionHorario) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const totalFilas = datos.filas.length;

  datos.filas.forEach((fila, idxFila) => {
    if (idxFila > 0) {
      doc.addPage();
    }

    // 1. Membrete Oficial Zona Escolar 004 (Limpio, sin caracteres unicode extraños)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 138); // Azul institucional
    doc.text("GOBIERNO DEL ESTADO DE PUEBLA", 14, 14);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("SECRETARIA DE EDUCACION PUBLICA - SUBSECRETARIA DE EDUCACION OBLIGATORIA", 14, 19);
    doc.text("SUPERVISION ESCOLAR DE BACHILLERATOS GENERALES ZONA ESCOLAR 004", 14, 24);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`ESCUELA: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`, 14, 31);

    const tituloCompleto = `HORARIO OFICIAL DE CLASES - ${datos.tituloTabla.toUpperCase()}`;
    doc.text(tituloCompleto, 14, 36);

    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text(`${fila.encabezado.toUpperCase()} ${fila.subtitulo ? " - " + fila.subtitulo : ""}`, 14, 43);

    doc.setLineWidth(0.5);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 46, 283, 46);

    // 2. Construir cuerpo de la tabla
    const head = [["Periodo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes"]];
    const body: any[][] = [];

    for (let p = 0; p < datos.periodos.length; p++) {
      const row: string[] = [`Hora ${p + 1}`];

      for (let d = 1; d <= 5; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];

        if (!val) {
          row.push("Libre");
        } else if (typeof val === "string") {
          row.push(val);
        } else {
          const lineas: string[] = [];
          if (val.materia) lineas.push(val.materia);
          if (val.docente) lineas.push(`Docente: ${val.docente}`);
          if (val.grupo) lineas.push(`Grupo: ${val.grupo}`);
          if (val.aula) lineas.push(`Aula: ${val.aula}`);
          row.push(lineas.join("\n"));
        }
      }
      body.push(row);
    }

    // 3. Renderizar autoTable con formato formal y limpio
    autoTable(doc, {
      startY: 50,
      head: head,
      body: body,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        halign: "center",
        valign: "middle",
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        halign: "center"
      },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: "bold", fillColor: [241, 245, 249] }
      },
      didParseCell: function(data) {
        // Estilar casillas ocupadas con fondo suave
        if (data.section === "body" && data.column.index > 0) {
          const txt = data.cell.raw as string;
          if (txt && txt !== "Libre") {
            data.cell.styles.fillColor = [240, 249, 255]; // Azul helado muy claro
            data.cell.styles.textColor = [15, 23, 42];    // Texto oscuro legible
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [148, 163, 184]; // Gris claro para Libre
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    // 4. Pie de página formal
    const pageNum = idxFila + 1;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `SISAT-ATP | Sistema Inteligente de Horarios IA | Zona Escolar 004 - Hoja ${pageNum} de ${totalFilas}`,
      14,
      200
    );
  });

  // Descargar PDF
  const fileName = `Horario_Oficial_${datos.cct}_${datos.tipoVista}.pdf`;
  doc.save(fileName);
}

// =========================================================================
// EXPORTACIÓN A WORD (.DOCX) — Formato editable
// =========================================================================
export async function exportarHorarioDOCX(datos: DatosExportacionHorario) {
  const sections: any[] = [];

  for (const fila of datos.filas) {
    // Encabezado de sección
    sections.push(
      new Paragraph({
        text: "GOBIERNO DEL ESTADO DE PUEBLA",
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        text: "SECRETARÍA DE EDUCACIÓN PÚBLICA — ZONA ESCOLAR 004",
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "SECRETARÍA DE EDUCACIÓN PÚBLICA — ZONA ESCOLAR 004", bold: false, size: 20 })]
      }),
      new Paragraph({
        text: `ESCUELA: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `ESCUELA: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`, bold: true, size: 22 })]
      }),
      new Paragraph({
        text: fila.encabezado.toUpperCase(),
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: fila.encabezado.toUpperCase(), bold: true, size: 24, color: "1e3a8a" })]
      }),
      new Paragraph({ text: "" })
    );

    // Cabecera de la tabla: Periodo | Lunes | Martes | ... | Viernes
    const headerCells = ["Periodo", ...datos.dias].map(
      (d) =>
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: d, bold: true, size: 18, color: "FFFFFF" })] })],
          shading: { type: ShadingType.SOLID, color: "1e3a8a", fill: "1e3a8a" },
          width: { size: d === "Periodo" ? 1500 : 2000, type: WidthType.DXA }
        })
    );
    const headerRow = new TableRow({ children: headerCells, tableHeader: true });

    // Filas de datos
    const bodyRows: TableRow[] = [];
    for (let p = 0; p < datos.periodos.length; p++) {
      const cells: TableCell[] = [
        new TableCell({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Hora ${p + 1}`, bold: true, size: 18 })] })],
          shading: { type: ShadingType.SOLID, color: "f1f5f9", fill: "f1f5f9" },
          width: { size: 1500, type: WidthType.DXA }
        })
      ];

      for (let d = 1; d <= datos.dias.length; d++) {
        const key = `${d}_${p + 1}`;
        const val = fila.celdas[key];
        let textoLineas: string[] = [];

        if (!val) {
          textoLineas = ["Libre"];
        } else if (typeof val === "string") {
          textoLineas = [val];
        } else {
          if (val.materia) textoLineas.push(val.materia);
          if (val.docente) textoLineas.push(`Prof. ${val.docente}`);
          if (val.grupo) textoLineas.push(`Grupo ${val.grupo}`);
        }

        const esLibre = textoLineas[0] === "Libre";
        cells.push(
          new TableCell({
            children: textoLineas.map(
              (l) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l, size: 16, color: esLibre ? "94a3b8" : "0f172a" })] })
            ),
            shading: esLibre ? undefined : { type: ShadingType.SOLID, color: "eff6ff", fill: "eff6ff" },
            width: { size: 2000, type: WidthType.DXA }
          })
        );
      }
      bodyRows.push(new TableRow({ children: cells }));
    }

    const tabla = new Table({
      rows: [headerRow, ...bodyRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" }
      }
    });
    sections.push(tabla, new Paragraph({ text: "" }));
  }

  const doc = new Document({
    sections: [{ children: sections }]
  });

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Horario_Oficial_${datos.cct}_${datos.tipoVista}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// =========================================================================
// SUMARIO MAESTRO — Excel con todos los docentes en filas, horas en columnas
// Formato: Docente | Lun/H1 | Lun/H2 | ... | Vie/H6
// =========================================================================
export interface DatosSumario {
  nombreEscuela: string;
  cct: string;
  dias: string[];
  numHorasPorDia: number;
  entidades: {
    id: string;
    etiqueta: string; // Nombre del docente o grupo
  }[];
  obtenerCelda: (entidadId: string, dia: number, periodo: number) => { texto: string } | null;
}

export function exportarSumarioExcel(datos: DatosSumario, tipo: "DOCENTE" | "GRUPO") {
  const wb = XLSX.utils.book_new();
  const { dias, numHorasPorDia } = datos;

  // Construir encabezados: Docente/Grupo + una columna por cada hora de cada día
  const headerRow: string[] = [tipo === "DOCENTE" ? "Docente" : "Grupo"];
  for (let d = 0; d < dias.length; d++) {
    for (let h = 1; h <= numHorasPorDia; h++) {
      headerRow.push(`${dias[d].substring(0, 3)}/H${h}`);
    }
  }

  const rowsData: string[][] = [
    [`SECRETARÍA DE EDUCACIÓN PÚBLICA — ZONA ESCOLAR 004`],
    [`ESCUELA: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`],
    [`SUMARIO ${tipo === "DOCENTE" ? "MAESTRO" : "POR GRUPO"} — HORARIO SEMANAL COMPLETO`],
    [],
    headerRow
  ];

  for (const entidad of datos.entidades) {
    const fila: string[] = [entidad.etiqueta];
    for (let d = 1; d <= dias.length; d++) {
      for (let h = 1; h <= numHorasPorDia; h++) {
        const celda = datos.obtenerCelda(entidad.id, d, h);
        fila.push(celda ? celda.texto : "—");
      }
    }
    rowsData.push(fila);
  }

  rowsData.push([]);
  rowsData.push(["Generado por SISAT-ATP | Sistema Inteligente de Horarios IA"]);

  const ws = XLSX.utils.aoa_to_sheet(rowsData);

  // Ajustar ancho de columnas
  const wCols = [{ wch: 30 }]; // Primera columna más ancha
  for (let i = 0; i < dias.length * numHorasPorDia; i++) {
    wCols.push({ wch: 22 });
  }
  ws["!cols"] = wCols;

  const sheetName = tipo === "DOCENTE" ? "Sumario Maestros" : "Sumario Grupos";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const fileName = `Sumario_${tipo === "DOCENTE" ? "Maestro" : "Grupos"}_${datos.cct}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
