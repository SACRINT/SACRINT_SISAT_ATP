import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface DatosExportacionHorario {
  nombreEscuela: string;
  cct: string;
  zonaEscolar?: string;
  cicloEscolar?: string;
  tipoVista: "GRUPO" | "DOCENTE" | "AULA" | "SUMARIO";
  tituloTabla: string;
  dias: string[];
  periodos: string[];
  filas: {
    encabezado: string;
    celdas: { [diaPeriodo: string]: string };
  }[];
}

export function exportarHorarioExcel(datos: DatosExportacionHorario) {
  const wb = XLSX.utils.book_new();

  // Construir matriz de datos para Excel
  const headerRow = ["Fila / Periodo", ...datos.dias.map((d, i) => `Día ${i + 1} (${d})`)];
  const rowsData: string[][] = [
    [`ESCUELA: ${datos.nombreEscuela} - CLAVE CCT: ${datos.cct}`],
    [`SUPERVISIÓN ESCOLAR BACHILLERATOS GENERALES ZONA ESCOLAR 004`],
    [`VISTA: ${datos.tituloTabla}`],
    [],
    headerRow
  ];

  for (const fila of datos.filas) {
    for (let p = 0; p < datos.periodos.length; p++) {
      const row: string[] = [`${fila.encabezado} - Periodo ${p + 1}`];
      for (let d = 1; d <= datos.dias.length; d++) {
        const key = `${d}_${p + 1}`;
        row.push(fila.celdas[key] || "—");
      }
      rowsData.push(row);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rowsData);
  XLSX.utils.book_append_sheet(wb, ws, "Horario");

  // Descargar archivo
  const fileName = `Horario_${datos.cct}_${datos.tipoVista}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportarHorarioPDF(datos: DatosExportacionHorario) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  // Membrete Oficial Zona Escolar 004
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138); // Azul marino
  doc.text("GOBIERNO DEL ESTADO DE PUEBLA", 14, 15);
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text("SECRETARÍA DE EDUCACIÓN PÚBLICA - SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA", 14, 21);
  doc.text(`SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES ZONA ESCOLAR 004`, 14, 27);
  
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`ESCUELA: ${datos.nombreEscuela.toUpperCase()} (CCT: ${datos.cct})`, 14, 34);
  doc.text(`HORARIO OFICIAL DE CLASES - ${datos.tituloTabla.toUpperCase()}`, 14, 40);

  doc.setLineWidth(0.5);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 43, 283, 43);

  // Generar tablas por cada grupo / docente
  let currentY = 48;

  for (const fila of datos.filas) {
    if (currentY > 170) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text(`📌 ${fila.encabezado}`, 14, currentY);
    currentY += 4;

    const head = [["Periodo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]];
    const body: string[][] = [];

    for (let p = 0; p < datos.periodos.length; p++) {
      const row: string[] = [`Hora ${p + 1}`];
      for (let d = 1; d <= 5; d++) {
        const key = `${d}_${p + 1}`;
        row.push(fila.celdas[key] || "Libre");
      }
      body.push(row);
    }

    autoTable(doc, {
      startY: currentY,
      head: head,
      body: body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, halign: "center" },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Pie de página oficial
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`SISAT-ATP | Sistema Inteligente de Horarios IA | Zona Escolar 004 - Página ${i} de ${pageCount}`, 14, 200);
  }

  doc.save(`Horario_Oficial_${datos.cct}_${datos.tipoVista}.pdf`);
}
