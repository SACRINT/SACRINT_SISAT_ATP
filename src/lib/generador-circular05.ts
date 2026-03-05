import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, WidthType, PageBreak,
    convertInchesToTwip, TableLayoutType, VerticalAlign, ShadingType,
} from "docx";

// ─── Tipos ────────────────────────────────────────
export interface AlumnoCircular05 {
    nombre: string;
    curp: string;
    nia: string;
    nss: string;
    disciplina: string;
}

export interface ResponsableDisciplina {
    nombre: string;
    cargo: string; // "Docente responsable", "Docente de apoyo", etc.
}

export interface GrupoDisciplina {
    disciplina: string;
    responsables: ResponsableDisciplina[];
    alumnos: AlumnoCircular05[];
}

export interface DatosCircular05 {
    // Institucionales
    supervisorNombre: string;
    zonaEscolar: string;
    directorNombre: string;
    bachilleratoNombre: string;
    cct: string;
    municipio: string;
    localidad: string;
    // Destinatario
    destinatario: string;
    cargoDestinatario: string;
    zonaDestinatario: string;
    // Evento
    nombreEvento: string;
    disciplinaRama: string; // campo general (se usa si no hay grupos)
    sede: string;
    domicilioSede: string;
    fechaEvento: string;
    horaInicio: string;
    horaTermino: string;
    // Proyecto Operativo
    objetivoEducativo: string;
    itinerario: { hora: string; actividad: string; lugar: string }[];
    // Gastos
    gastoTransporteIda: string;
    gastoAlimentos: string;
    gastoTransporteRegreso: string;
    financiamiento: string;
    // Transporte
    tipoTransporte: string;
    descripcionVehiculo: string;
    nombreConductor: string;
    aseguradora: string;
    numeroPóliza: string;
    // Custodia (legacy - para compatibilidad)
    docentesResponsables?: { nombre: string; cargo: string }[];
    personaPrimerosAuxilios: string;
    // ── NUEVA ESTRUCTURA: Grupos por disciplina ──
    gruposPorDisciplina?: GrupoDisciplina[];
    // Alumnos (legacy - si no hay grupos se usa esta lista plana)
    alumnos?: AlumnoCircular05[];
    // Lema y ciclo
    lemaInstitucional?: string;
    cicloEscolar?: string;
}

// ─── Helpers ──────────────────────────────────────

function encabezado(): Paragraph[] {
    const lines = [
        "SECRETARÍA DE EDUCACIÓN",
        "SUBSECRETARÍA DE EDUCACIÓN BÁSICA Y MEDIA SUPERIOR",
        "DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA",
        "SUPERVISIÓN DE BACHILLERATOS GENERALES ESTATALES",
    ];
    return lines.map(
        (text) =>
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                    new TextRun({ text, bold: true, size: 20, font: "Arial" }),
                ],
            })
    );
}

function zonaEscolarParagraph(zona: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
            new TextRun({ text: `ZONA ESCOLAR ${zona}`, bold: true, size: 22, font: "Arial" }),
        ],
    });
}

function parrafo(text: string, opts?: { bold?: boolean; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacing?: number }): Paragraph {
    return new Paragraph({
        alignment: opts?.alignment ?? AlignmentType.JUSTIFIED,
        spacing: { after: opts?.spacing ?? 120 },
        children: [
            new TextRun({
                text,
                bold: opts?.bold ?? false,
                size: opts?.size ?? 22,
                font: "Arial",
            }),
        ],
    });
}

function tituloSeccion(text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 240, after: 120 },
        children: [
            new TextRun({ text, bold: true, size: 24, font: "Arial" }),
        ],
    });
}

function lineaFirma(nombre: string, cargo: string): Paragraph[] {
    return [
        new Paragraph({ spacing: { before: 600 }, children: [] }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "__________________________", size: 22, font: "Arial" })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [new TextRun({ text: nombre, bold: true, size: 22, font: "Arial" })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: cargo, size: 20, font: "Arial" })],
        }),
    ];
}

function crearCeldaTexto(text: string, opts?: { bold?: boolean; width?: number; size?: number; shading?: string }): TableCell {
    return new TableCell({
        width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        shading: opts?.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
        children: [
            new Paragraph({
                spacing: { after: 20, before: 20 },
                children: [
                    new TextRun({ text, bold: opts?.bold ?? false, size: opts?.size ?? 20, font: "Arial" }),
                ],
            }),
        ],
    });
}

function crearCeldaColspan(text: string, columnSpan: number, opts?: { bold?: boolean; size?: number; shading?: string }): TableCell {
    return new TableCell({
        columnSpan,
        verticalAlign: VerticalAlign.CENTER,
        shading: opts?.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
        children: [
            new Paragraph({
                spacing: { after: 20, before: 20 },
                children: [
                    new TextRun({ text, bold: opts?.bold ?? true, size: opts?.size ?? 22, font: "Arial" }),
                ],
            }),
        ],
    });
}

function lineaCcp(text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0, before: 0 },
        children: [
            new TextRun({ text, size: 12, font: "Arial" }),
        ],
    });
}

// ─── Calcular texto de disciplinas para asunto ────
function textoAsuntoDisciplinas(grupos: GrupoDisciplina[], nombreEvento: string): string {
    const disciplinas = grupos.map(g => g.disciplina);
    if (disciplinas.length === 1) {
        return `Solicitud para participar en ${nombreEvento} — ${disciplinas[0]}`;
    } else if (disciplinas.length <= 3) {
        const last = disciplinas.pop();
        return `Solicitud para participar en ${nombreEvento} — ${disciplinas.join(", ")} y ${last}`;
    } else {
        return `Solicitud para participar en ${nombreEvento}`;
    }
}

function textoCuerpoDisciplinas(grupos: GrupoDisciplina[], nombreEvento: string): string {
    const disciplinas = grupos.map(g => g.disciplina);
    if (disciplinas.length === 1) {
        return `en la disciplina de ${disciplinas[0]}`;
    } else if (disciplinas.length <= 3) {
        const last = disciplinas.pop();
        return `en las disciplinas de ${disciplinas.join(", ")} y ${last}`;
    } else {
        return `en las ${disciplinas.length} disciplinas que se detallan en la relación de asistentes adjunta`;
    }
}

// ─── Obtener todos los responsables de todos los grupos ───
function todosLosResponsables(grupos: GrupoDisciplina[]): { nombre: string; cargo: string; disciplina: string }[] {
    const result: { nombre: string; cargo: string; disciplina: string }[] = [];
    for (const g of grupos) {
        for (const r of g.responsables) {
            result.push({ ...r, disciplina: g.disciplina });
        }
    }
    return result;
}

// ─── Generador Principal ──────────────────────────

export function generarDocumentoCircular05(datos: DatosCircular05): Document {
    const children: Paragraph[] = [];

    const lema = datos.lemaInstitucional ? `"${datos.lemaInstitucional}"` : "";
    const ciclo = datos.cicloEscolar || "2025-2026";

    // Construir grupos por disciplina
    let grupos: GrupoDisciplina[] = [];
    if (datos.gruposPorDisciplina && datos.gruposPorDisciplina.length > 0) {
        grupos = datos.gruposPorDisciplina;
    } else if (datos.alumnos && datos.alumnos.length > 0) {
        // Compatibilidad: agrupar alumnos planos por disciplina
        const mapa = new Map<string, AlumnoCircular05[]>();
        for (const a of datos.alumnos) {
            const disc = a.disciplina || "General";
            if (!mapa.has(disc)) mapa.set(disc, []);
            mapa.get(disc)!.push(a);
        }
        const responsablesLegacy = datos.docentesResponsables || [];
        let rIdx = 0;
        for (const [disc, als] of mapa) {
            const resps: ResponsableDisciplina[] = [];
            if (rIdx < responsablesLegacy.length) {
                resps.push(responsablesLegacy[rIdx]);
                rIdx++;
            }
            grupos.push({ disciplina: disc, responsables: resps, alumnos: als });
        }
    }

    const totalAlumnos = grupos.reduce((s, g) => s + g.alumnos.length, 0);
    const allResponsables = todosLosResponsables(grupos);
    const asuntoTexto = textoAsuntoDisciplinas([...grupos], datos.nombreEvento);
    const cuerpoDisciplinas = textoCuerpoDisciplinas([...grupos], datos.nombreEvento);

    // ════════ PÁGINA 1: OFICIO DE SOLICITUD ════════
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

    // Asunto – DERECHA
    children.push(parrafo(`Asunto: ${asuntoTexto}`, { bold: true, alignment: AlignmentType.RIGHT }));
    children.push(parrafo(`${datos.localidad.toUpperCase()}, PUE; a ${datos.fechaEvento}.`, { alignment: AlignmentType.RIGHT }));

    // Destinatario
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo(datos.destinatario, { bold: true, alignment: AlignmentType.LEFT }));
    children.push(parrafo(datos.cargoDestinatario, { alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo(datos.zonaDestinatario, { alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo("PRESENTE", { bold: true, alignment: AlignmentType.LEFT }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

    // Cuerpo
    const textoOficio = `Por medio de la presente reciba un cordial saludo de parte del responsable del plantel ${datos.directorNombre} y de todo el personal docente, apoyo administrativo y de servicio del Bachillerato General Estatal "${datos.bachilleratoNombre}", con C.C.T: ${datos.cct} de ${datos.localidad}, Puebla, perteneciente a la ${datos.zonaDestinatario}, el motivo por el cual me dirijo a usted es para hacer de su entero conocimiento el proyecto y logística para asistir a ${datos.nombreEvento} ${cuerpoDisciplinas}; a realizarse en ${datos.sede}, ${datos.domicilioSede}.`;
    children.push(parrafo(textoOficio));

    // Anexos
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo("NOTA: Se anexan a este oficio, los documentos siguientes:", { bold: true }));
    const anexos = [
        "Autorización para participar en eventos deportivos.",
        "Objetivo educativo de la participación.",
        "Destino y duración del traslado.",
        "Itinerario del traslado.",
        "Relación de asistentes.",
        "Transporte y custodia.",
        "Constancia e INE del responsable de primeros auxilios.",
        "Seguro del viajero.",
        "Contrato de transporte.",
        "Comisiones de docentes y demás personal.",
        "Oficio de autorización por parte de la supervisión escolar.",
        "Permiso firmado por los padres de familia o tutores, se anexan copias de INE.",
        "Credencial escolar y seguro facultativo de todos los aprendientes del plantel.",
    ];
    for (const item of anexos) {
        children.push(new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [new TextRun({ text: item, size: 20, font: "Arial" })],
        }));
    }

    // Cierre
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    children.push(parrafo("Sin más por el momento y en espera de una favorable respuesta, le reiteramos nuestro más sincero agradecimiento."));
    children.push(parrafo("A T E N T A M E N T E", { bold: true, alignment: AlignmentType.CENTER }));
    if (lema) children.push(parrafo(lema, { alignment: AlignmentType.CENTER, size: 20 }));
    children.push(...lineaFirma(datos.directorNombre, "DIRECTOR"));

    // c.c.p.
    children.push(new Paragraph({ spacing: { after: 20 }, children: [] }));
    children.push(lineaCcp(`c.c.p. ${datos.destinatario}, ${datos.cargoDestinatario}, ${datos.zonaDestinatario}. Para su conocimiento`));
    children.push(lineaCcp("c.c.p. Comité de APF. Para su conocimiento"));
    children.push(lineaCcp("c.c.p. Archivo del plantel."));

    // ════════ PÁGINA 2: PROYECTO OPERATIVO ════════
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));

    children.push(parrafo(`Asunto: Proyecto para participar en ${datos.nombreEvento}`, { bold: true, alignment: AlignmentType.RIGHT }));
    children.push(parrafo(`${datos.localidad.toUpperCase()}, PUE; a ${datos.fechaEvento}.`, { alignment: AlignmentType.RIGHT }));

    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo(datos.destinatario, { bold: true, alignment: AlignmentType.LEFT }));
    children.push(parrafo(datos.cargoDestinatario, { alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo(datos.zonaDestinatario, { alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo("PRESENTE", { bold: true, alignment: AlignmentType.LEFT }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

    const textoProyecto = `Por medio de la presente reciba un cordial saludo de parte del responsable del bachillerato ${datos.directorNombre} y de todo el personal docente, apoyo administrativo del Bachillerato General Estatal "${datos.bachilleratoNombre}", C.C.T: ${datos.cct} de ${datos.localidad}, Puebla, el motivo por el cual me dirijo a usted es para hacer de su entero conocimiento el proyecto y logística para asistir a ${datos.nombreEvento} de la zona escolar ${datos.zonaEscolar} ${cuerpoDisciplinas}; a realizarse en ${datos.sede}, ${datos.domicilioSede}.`;
    children.push(parrafo(textoProyecto));

    children.push(tituloSeccion("PROYECTO"));
    children.push(tituloSeccion("OBJETIVO EDUCATIVO"));
    children.push(parrafo(datos.objetivoEducativo));

    children.push(tituloSeccion("DESTINO Y DURACIÓN"));
    const tablaDestino = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [crearCeldaTexto("LUGAR Y FECHA", { bold: true, width: 30 }), crearCeldaTexto(`${datos.domicilioSede.toUpperCase()}, PUEBLA A ${datos.fechaEvento.toUpperCase()}`, { width: 70 })] }),
            new TableRow({ children: [crearCeldaTexto("DESTINO", { bold: true, width: 30 }), crearCeldaTexto(`${datos.sede.toUpperCase()}`, { width: 70 })] }),
            new TableRow({ children: [crearCeldaTexto("DURACIÓN", { bold: true, width: 30 }), crearCeldaTexto(`${datos.horaInicio} a ${datos.horaTermino}`, { width: 70 })] }),
        ],
    });
    children.push(tablaDestino as unknown as Paragraph);

    children.push(tituloSeccion("ITINERARIO"));
    const tablaItinerario = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [crearCeldaTexto("HORA", { bold: true, width: 20 }), crearCeldaTexto("EVENTO", { bold: true, width: 50 }), crearCeldaTexto("LUGAR", { bold: true, width: 30 })] }),
            ...datos.itinerario.map(item => new TableRow({ children: [crearCeldaTexto(item.hora, { width: 20 }), crearCeldaTexto(item.actividad, { width: 50 }), crearCeldaTexto(item.lugar, { width: 30 })] })),
        ],
    });
    children.push(tablaItinerario as unknown as Paragraph);

    // ════════ PÁGINA 3+: RELACIÓN DE ASISTENTES (por disciplina) ════════
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));
    children.push(tituloSeccion("RELACIÓN DE ASISTENTES"));
    children.push(parrafo(`Ciclo escolar ${ciclo}. Total de alumnos: ${totalAlumnos}. Total de responsables: ${allResponsables.length + 1} (incluyendo al Director). Ratio Circular 05: 2 docentes por cada 40 o menos alumnos.`, { size: 18 }));

    // Tabla por cada disciplina
    for (const grupo of grupos) {
        const filas: TableRow[] = [];

        // Fila encabezado de disciplina (colspan)
        filas.push(new TableRow({
            children: [crearCeldaColspan(`DISCIPLINA: ${grupo.disciplina.toUpperCase()}`, 6, { shading: "D9E2F3" })],
        }));

        // Fila de responsables
        for (const resp of grupo.responsables) {
            filas.push(new TableRow({
                children: [crearCeldaColspan(`${resp.cargo.toUpperCase()}: ${resp.nombre}`, 6, { shading: "E8F5E9", size: 20 })],
            }));
        }

        // Encabezado de columnas alumnos
        filas.push(new TableRow({
            children: [
                crearCeldaTexto("N°", { bold: true, width: 5 }),
                crearCeldaTexto("NOMBRE COMPLETO", { bold: true, width: 30 }),
                crearCeldaTexto("CURP", { bold: true, width: 25 }),
                crearCeldaTexto("NIA", { bold: true, width: 15 }),
                crearCeldaTexto("NSS", { bold: true, width: 15 }),
                crearCeldaTexto("DISCIPLINA", { bold: true, width: 10 }),
            ],
        }));

        // Filas de alumnos
        grupo.alumnos.forEach((al, idx) => {
            filas.push(new TableRow({
                children: [
                    crearCeldaTexto((idx + 1).toString(), { width: 5 }),
                    crearCeldaTexto(al.nombre, { width: 30 }),
                    crearCeldaTexto(al.curp, { width: 25 }),
                    crearCeldaTexto(al.nia, { width: 15 }),
                    crearCeldaTexto(al.nss, { width: 15 }),
                    crearCeldaTexto(al.disciplina, { width: 10 }),
                ],
            }));
        });

        const tablaDisciplina = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: filas,
        });
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        children.push(tablaDisciplina as unknown as Paragraph);
    }

    // ── RESPONSABLES OFICIALES (resumen general) ──
    children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    children.push(tituloSeccion("RESPONSABLES OFICIALES"));

    const filasResp: TableRow[] = [
        new TableRow({
            children: [
                crearCeldaTexto("N°", { bold: true, width: 5 }),
                crearCeldaTexto("NOMBRE COMPLETO", { bold: true, width: 30 }),
                crearCeldaTexto("CARGO / FUNCIÓN", { bold: true, width: 35 }),
                crearCeldaTexto("DISCIPLINA", { bold: true, width: 30 }),
            ],
        }),
        new TableRow({
            children: [
                crearCeldaTexto("1", { width: 5 }),
                crearCeldaTexto(datos.directorNombre, { width: 30 }),
                crearCeldaTexto("Responsable del plantel", { width: 35 }),
                crearCeldaTexto("GENERAL", { width: 30 }),
            ],
        }),
    ];

    allResponsables.forEach((r, i) => {
        filasResp.push(new TableRow({
            children: [
                crearCeldaTexto((i + 2).toString(), { width: 5 }),
                crearCeldaTexto(r.nombre, { width: 30 }),
                crearCeldaTexto(r.cargo, { width: 35 }),
                crearCeldaTexto(r.disciplina, { width: 30 }),
            ],
        }));
    });

    // Primeros auxilios
    filasResp.push(new TableRow({
        children: [
            crearCeldaTexto((allResponsables.length + 2).toString(), { width: 5 }),
            crearCeldaTexto(datos.personaPrimerosAuxilios, { width: 30 }),
            crearCeldaTexto("Persona capacitada en primeros auxilios", { width: 35 }),
            crearCeldaTexto("GENERAL", { width: 30 }),
        ],
    }));

    const tablaResumen = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: filasResp,
    });
    children.push(tablaResumen as unknown as Paragraph);

    // Gastos
    children.push(tituloSeccion("GASTOS"));
    children.push(parrafo(`*TRASLADO DIRECTO A LA SEDE: $${datos.gastoTransporteIda}`));
    children.push(parrafo(`ALMUERZO PARA LOS PARTICIPANTES: $${datos.gastoAlimentos}`));
    children.push(parrafo(`*TRASLADO DE REGRESO A LA COMUNIDAD: $${datos.gastoTransporteRegreso}`));
    children.push(parrafo(`FINANCIAMIENTO: ${datos.financiamiento}`));

    // Transporte y Custodia
    children.push(tituloSeccion("TRANSPORTE Y CUSTODIA"));
    children.push(parrafo("Datos de la Empresa y vehículo que proporcionará el servicio de transporte.", { bold: true }));
    children.push(new Paragraph({ spacing: { after: 40 }, bullet: { level: 0 }, children: [new TextRun({ text: `Tipo de transporte: ${datos.tipoTransporte}`, size: 22, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 40 }, bullet: { level: 0 }, children: [new TextRun({ text: `Descripción del vehículo: ${datos.descripcionVehiculo}`, size: 22, font: "Arial" })] }));
    children.push(new Paragraph({ spacing: { after: 40 }, bullet: { level: 0 }, children: [new TextRun({ text: `Nombre del conductor: ${datos.nombreConductor}`, size: 22, font: "Arial" })] }));

    // Custodia resumen
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo("Relación del personal de custodia:", { bold: true }));
    const totalViajeros = totalAlumnos + allResponsables.length + 2;
    children.push(parrafo(`El total de viajeros son ${totalViajeros}, de los cuales ${totalAlumnos} son aprendientes, ${allResponsables.length} son personal docente/administrativo, 1 es el responsable del plantel y 1 es la persona capacitada en primeros auxilios. Ciclo escolar ${ciclo}.`));

    // ════════ PÁGINA: SEGURO Y AUTORIZACIÓN ════════
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));

    children.push(tituloSeccion("SEGURO DEL VIAJERO"));
    children.push(parrafo(`Se anexará copia del contrato, la póliza de seguro de viajero vigente proporcionada por la empresa de transporte contratada para el evento y la licencia del operador. Aseguradora: ${datos.aseguradora}. No. de Póliza: ${datos.numeroPóliza}.`));

    children.push(tituloSeccion("AUTORIZACIÓN DE PADRES DE FAMILIA"));
    children.push(parrafo("Se anexan copias de los formatos de aceptación y permiso firmados por los padres de familia o tutor de los alumnos participantes, con copia de la credencial del INE de los padres de familia o tutor que fueron entregados a la Dirección de esta institución educativa."));

    children.push(tituloSeccion("CUMPLIMIENTO CON LOS LINEAMIENTOS"));
    children.push(parrafo(`El proyecto será presentado a la Dirección Escolar y supervisión de la zona escolar ${datos.zonaEscolar} para solicitar el visto bueno del evento, en estricto apego a los lineamientos establecidos por la Secretaría de Educación Pública del Estado de Puebla. La solicitud será entregada con una anticipación de 72 horas antes de la realización del evento.`));

    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    children.push(parrafo("A T E N T A M E N T E", { bold: true, alignment: AlignmentType.CENTER }));
    if (lema) children.push(parrafo(lema, { alignment: AlignmentType.CENTER, size: 20 }));
    children.push(...lineaFirma(datos.directorNombre, "RESPONSABLE DEL BACHILLERATO"));

    // ════════ PÁGINAS: OFICIOS DE COMISIÓN (uno por responsable) ════════
    for (const grupo of grupos) {
        for (const resp of grupo.responsables) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
            children.push(...encabezado());
            children.push(zonaEscolarParagraph(datos.zonaEscolar));

            children.push(parrafo("Asunto: OFICIO DE COMISIÓN", { bold: true, alignment: AlignmentType.RIGHT }));
            children.push(parrafo(`${datos.localidad.toUpperCase()}, PUE; a ${datos.fechaEvento}.`, { alignment: AlignmentType.RIGHT }));

            children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
            children.push(parrafo(resp.nombre.toUpperCase(), { bold: true, alignment: AlignmentType.LEFT }));
            children.push(parrafo(resp.cargo.toUpperCase(), { alignment: AlignmentType.LEFT }));
            children.push(parrafo(`BACHILLERATO GENERAL ESTATAL "${datos.bachilleratoNombre}"`, { alignment: AlignmentType.LEFT, size: 20 }));
            children.push(parrafo("PRESENTE", { bold: true, alignment: AlignmentType.LEFT }));
            children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

            const nombresAlumnos = grupo.alumnos.map(a => a.nombre).join(", ");
            const textoComision = `Por medio del presente, y en atención a las necesidades del servicio educativo, se le comisiona para acompañar y ser responsable del grupo de ${grupo.alumnos.length} alumno(s) del Bachillerato General Estatal "${datos.bachilleratoNombre}", C.C.T. ${datos.cct}, en la disciplina de ${grupo.disciplina}, durante su participación en ${datos.nombreEvento}, a realizarse el día ${datos.fechaEvento} en ${datos.sede}, ${datos.domicilioSede}.`;
            children.push(parrafo(textoComision));

            // Tabla de datos de comisión
            const tablaComision = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: [crearCeldaTexto("TIPO", { bold: true, width: 30 }), crearCeldaTexto("COMISIÓN", { width: 70 })] }),
                    new TableRow({ children: [crearCeldaTexto("COMISIONADO", { bold: true, width: 30 }), crearCeldaTexto(resp.nombre.toUpperCase(), { width: 70 })] }),
                    new TableRow({ children: [crearCeldaTexto("CARGO", { bold: true, width: 30 }), crearCeldaTexto(resp.cargo, { width: 70 })] }),
                    new TableRow({ children: [crearCeldaTexto("ADSCRIPCIÓN", { bold: true, width: 30 }), crearCeldaTexto(`BGE "${datos.bachilleratoNombre}", C.C.T. ${datos.cct}`, { width: 70 })] }),
                    new TableRow({ children: [crearCeldaTexto("PERÍODO", { bold: true, width: 30 }), crearCeldaTexto(datos.fechaEvento, { width: 70 })] }),
                    new TableRow({ children: [crearCeldaTexto("DISCIPLINA", { bold: true, width: 30 }), crearCeldaTexto(grupo.disciplina, { width: 70 })] }),
                    new TableRow({ children: [crearCeldaTexto("ALUMNOS A CARGO", { bold: true, width: 30 }), crearCeldaTexto(`${grupo.alumnos.length} alumno(s): ${nombresAlumnos}`, { width: 70, size: 18 })] }),
                    new TableRow({ children: [crearCeldaTexto("MOTIVO", { bold: true, width: 30 }), crearCeldaTexto(`Acompañar y custodiar al grupo de alumnos en ${datos.nombreEvento} — ${grupo.disciplina}`, { width: 70 })] }),
                ],
            });
            children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
            children.push(tablaComision as unknown as Paragraph);

            children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
            children.push(parrafo("Se le encomienda la custodia, salvaguardar la integridad física y velar por el bienestar de los alumnos a su cargo durante todo el trayecto y la estancia en la sede del evento."));
            children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
            children.push(parrafo("Sin más por el momento, le envío un cordial saludo."));
            children.push(parrafo("A T E N T A M E N T E", { bold: true, alignment: AlignmentType.CENTER }));
            if (lema) children.push(parrafo(lema, { alignment: AlignmentType.CENTER, size: 20 }));
            children.push(...lineaFirma(datos.directorNombre, "DIRECTOR"));

            // Vo.Bo.
            children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "__________________________", size: 22, font: "Arial" })] }));
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: "Vo.Bo.", bold: true, size: 20, font: "Arial" })] }));
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: datos.supervisorNombre || datos.destinatario, bold: true, size: 20, font: "Arial" })] }));
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "SUPERVISOR ESCOLAR", size: 18, font: "Arial" })] }));

            children.push(new Paragraph({ spacing: { after: 20 }, children: [] }));
            children.push(lineaCcp(`c.c.p. ${datos.destinatario}, ${datos.cargoDestinatario}. Para su conocimiento`));
            children.push(lineaCcp("c.c.p. Comité de APF. Para su conocimiento"));
            children.push(lineaCcp("c.c.p. Archivo del plantel."));
        }
    }

    // ═══ Crear Documento ═══
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(0.8),
                        bottom: convertInchesToTwip(0.8),
                        left: convertInchesToTwip(1),
                        right: convertInchesToTwip(1),
                    },
                },
            },
            children,
        }],
    });

    return doc;
}

export async function generarBuffer(datos: DatosCircular05): Promise<Buffer> {
    const doc = generarDocumentoCircular05(datos);
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}
