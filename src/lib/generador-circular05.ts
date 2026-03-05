import {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, WidthType, PageBreak, BorderStyle,
    Header, Footer, TabStopPosition, TabStopType, convertInchesToTwip,
} from "docx";

// ─── Tipos ────────────────────────────────────────
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
    cargoDestinatario: string;   // Ahora "Cargo/Zona"
    zonaDestinatario: string;    // Ahora "Ubicado en"
    // Evento
    nombreEvento: string;
    disciplinaRama: string;
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
    // Custodia
    docentesResponsables: { nombre: string; cargo: string }[];
    personaPrimerosAuxilios: string;
    // Alumnos
    alumnos: {
        nombre: string;
        curp: string;
        nia: string;
        nss: string;
        disciplina: string;
    }[];
    // Lema institucional personalizable
    lemaInstitucional?: string;
    // Ciclo escolar editable
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

function crearCeldaTexto(text: string, opts?: { bold?: boolean; width?: number; size?: number }): TableCell {
    return new TableCell({
        width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        children: [
            new Paragraph({
                children: [
                    new TextRun({ text, bold: opts?.bold ?? false, size: opts?.size ?? 20, font: "Arial" }),
                ],
            }),
        ],
    });
}

// Helper: línea c.c.p. con tamaño 12 (~6pt) y sin espaciado
function lineaCcp(text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0, before: 0 },
        children: [
            new TextRun({ text, size: 12, font: "Arial" }),
        ],
    });
}

// ─── Generador Principal ──────────────────────────

export function generarDocumentoCircular05(datos: DatosCircular05): Document {
    const children: Paragraph[] = [];

    // Lema: usar el personalizado o vacío
    const lema = datos.lemaInstitucional
        ? `"${datos.lemaInstitucional}"`
        : "";

    // Ciclo escolar
    const ciclo = datos.cicloEscolar || "2025-2026";

    // ════════ PÁGINA 1: OFICIO DE SOLICITUD ════════
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));

    // Espaciado
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

    // Asunto – ALINEADO A LA DERECHA
    children.push(
        parrafo(`Asunto: Solicitud para participar en ${datos.nombreEvento}`, { bold: true, alignment: AlignmentType.RIGHT })
    );

    // Lugar y fecha – ALINEADO A LA DERECHA
    children.push(
        parrafo(`${datos.localidad.toUpperCase()}, PUE; a ${datos.fechaEvento}.`, { alignment: AlignmentType.RIGHT })
    );

    // Destinatario
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo(datos.destinatario, { bold: true, alignment: AlignmentType.LEFT }));
    children.push(parrafo(datos.cargoDestinatario, { bold: false, alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo(datos.zonaDestinatario, { bold: false, alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo("PRESENTE", { bold: true, alignment: AlignmentType.LEFT }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

    // Cuerpo del oficio
    const textoOficio = `Por medio de la presente reciba un cordial saludo de parte del responsable del plantel ${datos.directorNombre} y de todo el personal docente, apoyo administrativo y de servicio del Bachillerato General Estatal "${datos.bachilleratoNombre}", con C.C.T: ${datos.cct} de ${datos.localidad}, Puebla, perteneciente a la ${datos.zonaDestinatario}, el motivo por el cual me dirijo a usted es para hacer de su entero conocimiento el proyecto y logística para asistir a ${datos.nombreEvento} en la disciplina de ${datos.disciplinaRama}; a realizarse en ${datos.sede}, ${datos.domicilioSede}.`;
    children.push(parrafo(textoOficio));

    // Nota de documentos anexos
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
        children.push(
            new Paragraph({
                spacing: { after: 40 },
                bullet: { level: 0 },
                children: [new TextRun({ text: item, size: 20, font: "Arial" })],
            })
        );
    }

    // Cierre del oficio
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    children.push(parrafo("Sin más por el momento y en espera de una favorable respuesta, le reiteramos nuestro más sincero agradecimiento."));
    children.push(parrafo("A T E N T A M E N T E", { bold: true, alignment: AlignmentType.CENTER }));
    // Lema personalizable (solo si se proporcionó)
    if (lema) {
        children.push(parrafo(lema, { alignment: AlignmentType.CENTER, size: 20 }));
    }
    children.push(...lineaFirma(datos.directorNombre, "DIRECTOR"));

    // Copias para – tamaño 6pt (~12 halfpoints) y sin espaciado
    children.push(new Paragraph({ spacing: { after: 20 }, children: [] }));
    children.push(lineaCcp(`c.c.p. ${datos.destinatario}, ${datos.cargoDestinatario}, ${datos.zonaDestinatario}. Para su conocimiento`));
    children.push(lineaCcp("c.c.p. Comité de APF. Para su conocimiento"));
    children.push(lineaCcp("c.c.p. Archivo del plantel."));

    // ════════ PÁGINA 2: PROYECTO OPERATIVO ════════
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));

    // Asunto del proyecto – ALINEADO A LA DERECHA
    children.push(
        parrafo(`Asunto: Proyecto para participar en ${datos.nombreEvento} - ${datos.disciplinaRama}`, { bold: true, alignment: AlignmentType.RIGHT })
    );
    // Fecha – ALINEADA A LA DERECHA
    children.push(
        parrafo(`${datos.localidad.toUpperCase()}, PUE; a ${datos.fechaEvento}.`, { alignment: AlignmentType.RIGHT })
    );

    // Destinatario nuevamente
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo(datos.destinatario, { bold: true, alignment: AlignmentType.LEFT }));
    children.push(parrafo(datos.cargoDestinatario, { bold: false, alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo(datos.zonaDestinatario, { bold: false, alignment: AlignmentType.LEFT, size: 20 }));
    children.push(parrafo("PRESENTE", { bold: true, alignment: AlignmentType.LEFT }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

    // Texto introductorio del proyecto
    const textoProyecto = `Por medio de la presente reciba un cordial saludo de parte del responsable del bachillerato ${datos.directorNombre} y de todo el personal docente, apoyo administrativo del Bachillerato General Estatal "${datos.bachilleratoNombre}", C.C.T: ${datos.cct} de ${datos.localidad}, Puebla, el motivo por el cual me dirijo a usted es para hacer de su entero conocimiento el proyecto y logística para asistir a ${datos.nombreEvento} de la zona escolar ${datos.zonaEscolar}, denominado "${datos.disciplinaRama}"; a realizarse en ${datos.sede}, ${datos.domicilioSede}.`;
    children.push(parrafo(textoProyecto));

    // PROYECTO
    children.push(tituloSeccion("PROYECTO"));

    // Objetivo Educativo
    children.push(tituloSeccion("OBJETIVO EDUCATIVO"));
    children.push(parrafo(datos.objetivoEducativo));

    // Destino y Duración
    children.push(tituloSeccion("DESTINO Y DURACIÓN"));

    const tablaDestino = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    crearCeldaTexto("LUGAR Y FECHA", { bold: true, width: 30 }),
                    crearCeldaTexto(`${datos.domicilioSede.toUpperCase()}, PUEBLA A ${datos.fechaEvento.toUpperCase()}`, { width: 70 }),
                ],
            }),
            new TableRow({
                children: [
                    crearCeldaTexto("DESTINO", { bold: true, width: 30 }),
                    crearCeldaTexto(`ESCUELA: ${datos.sede.toUpperCase()} C.C.T. ${datos.cct}`, { width: 70 }),
                ],
            }),
            new TableRow({
                children: [
                    crearCeldaTexto("DURACIÓN", { bold: true, width: 30 }),
                    crearCeldaTexto(`${datos.horaInicio} a ${datos.horaTermino}`, { width: 70 }),
                ],
            }),
        ],
    });
    children.push(tablaDestino as unknown as Paragraph);

    // Itinerario
    children.push(tituloSeccion("ITINERARIO"));
    const filas = [
        new TableRow({
            children: [
                crearCeldaTexto("HORA", { bold: true, width: 20 }),
                crearCeldaTexto("EVENTO", { bold: true, width: 50 }),
                crearCeldaTexto("LUGAR", { bold: true, width: 30 }),
            ],
        }),
        ...datos.itinerario.map(
            (item) =>
                new TableRow({
                    children: [
                        crearCeldaTexto(item.hora, { width: 20 }),
                        crearCeldaTexto(item.actividad, { width: 50 }),
                        crearCeldaTexto(item.lugar, { width: 30 }),
                    ],
                })
        ),
    ];
    const tablaItinerario = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: filas,
    });
    children.push(tablaItinerario as unknown as Paragraph);

    // ════════ PÁGINA 3: RELACIÓN DE ASISTENTES ════════
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));

    children.push(tituloSeccion("RELACIÓN DE ASISTENTES"));

    // Tabla de alumnos
    const filasAlumnos = [
        new TableRow({
            children: [
                crearCeldaTexto("N°", { bold: true, width: 5 }),
                crearCeldaTexto("NOMBRE COMPLETO", { bold: true, width: 30 }),
                crearCeldaTexto("CURP", { bold: true, width: 25 }),
                crearCeldaTexto("NIA", { bold: true, width: 15 }),
                crearCeldaTexto("NSS", { bold: true, width: 15 }),
                crearCeldaTexto("DISCIPLINA", { bold: true, width: 10 }),
            ],
        }),
        ...datos.alumnos.map(
            (alumno, index) =>
                new TableRow({
                    children: [
                        crearCeldaTexto((index + 1).toString(), { width: 5 }),
                        crearCeldaTexto(alumno.nombre, { width: 30 }),
                        crearCeldaTexto(alumno.curp, { width: 25 }),
                        crearCeldaTexto(alumno.nia, { width: 15 }),
                        crearCeldaTexto(alumno.nss, { width: 15 }),
                        crearCeldaTexto(alumno.disciplina, { width: 10 }),
                    ],
                })
        ),
    ];
    const tablaAlumnos = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: filasAlumnos,
    });
    children.push(tablaAlumnos as unknown as Paragraph);

    // ── RESPONSABLES OFICIALES ──
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(tituloSeccion("RESPONSABLES OFICIALES"));
    children.push(parrafo("Personal designado oficialmente para acompañar y ser responsable de los estudiantes durante el evento:", { size: 20 }));

    const filasResponsables = [
        new TableRow({
            children: [
                crearCeldaTexto("N°", { bold: true, width: 8 }),
                crearCeldaTexto("NOMBRE COMPLETO", { bold: true, width: 42 }),
                crearCeldaTexto("CARGO / FUNCIÓN", { bold: true, width: 50 }),
            ],
        }),
        // Director como responsable del plantel
        new TableRow({
            children: [
                crearCeldaTexto("1", { width: 8 }),
                crearCeldaTexto(datos.directorNombre, { width: 42 }),
                crearCeldaTexto("Responsable del plantel", { width: 50 }),
            ],
        }),
        // Docentes responsables
        ...datos.docentesResponsables.map(
            (doc, i) =>
                new TableRow({
                    children: [
                        crearCeldaTexto((i + 2).toString(), { width: 8 }),
                        crearCeldaTexto(doc.nombre, { width: 42 }),
                        crearCeldaTexto(doc.cargo, { width: 50 }),
                    ],
                })
        ),
        // Persona de primeros auxilios
        new TableRow({
            children: [
                crearCeldaTexto((datos.docentesResponsables.length + 2).toString(), { width: 8 }),
                crearCeldaTexto(datos.personaPrimerosAuxilios, { width: 42 }),
                crearCeldaTexto("Persona capacitada en primeros auxilios", { width: 50 }),
            ],
        }),
    ];
    const tablaResponsables = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: filasResponsables,
    });
    children.push(tablaResponsables as unknown as Paragraph);

    // Gastos
    children.push(tituloSeccion("GASTOS"));
    children.push(parrafo(`*TRASLADO DIRECTO A LA SEDE: $${datos.gastoTransporteIda}`));
    children.push(parrafo(`ALMUERZO PARA LOS PARTICIPANTES: $${datos.gastoAlimentos}`));
    children.push(parrafo(`*TRASLADO DE REGRESO A LA COMUNIDAD: $${datos.gastoTransporteRegreso}`));
    children.push(parrafo(`FINANCIAMIENTO: ${datos.financiamiento}`));

    // Transporte y Custodia
    children.push(tituloSeccion("TRANSPORTE Y CUSTODIA"));
    children.push(parrafo("Datos de la Empresa y vehículo que proporcionará el servicio de transporte.", { bold: true }));
    children.push(
        new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [new TextRun({ text: `Tipo de transporte: ${datos.tipoTransporte}`, size: 22, font: "Arial" })],
        })
    );
    children.push(
        new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [new TextRun({ text: `Descripción del vehículo: ${datos.descripcionVehiculo}`, size: 22, font: "Arial" })],
        })
    );
    children.push(
        new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [new TextRun({ text: `Nombre del conductor: ${datos.nombreConductor}`, size: 22, font: "Arial" })],
        })
    );

    // Personal de custodia
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo("Relación del personal de custodia:", { bold: true }));

    const filasCustodia = [
        new TableRow({
            children: [
                crearCeldaTexto("N°", { bold: true, width: 10 }),
                crearCeldaTexto("NOMBRE", { bold: true, width: 50 }),
                crearCeldaTexto("CARGO", { bold: true, width: 40 }),
            ],
        }),
        // Director primero
        new TableRow({
            children: [
                crearCeldaTexto("1", { width: 10 }),
                crearCeldaTexto(datos.directorNombre, { width: 50 }),
                crearCeldaTexto("Responsable del plantel", { width: 40 }),
            ],
        }),
        // Docentes responsables
        ...datos.docentesResponsables.map(
            (doc, i) =>
                new TableRow({
                    children: [
                        crearCeldaTexto((i + 2).toString(), { width: 10 }),
                        crearCeldaTexto(doc.nombre, { width: 50 }),
                        crearCeldaTexto(doc.cargo, { width: 40 }),
                    ],
                })
        ),
        // Persona de primeros auxilios
        new TableRow({
            children: [
                crearCeldaTexto((datos.docentesResponsables.length + 2).toString(), { width: 10 }),
                crearCeldaTexto(datos.personaPrimerosAuxilios, { width: 50 }),
                crearCeldaTexto("Persona capacitada en primeros auxilios", { width: 40 }),
            ],
        }),
    ];
    const tablaCustodia = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: filasCustodia,
    });
    children.push(tablaCustodia as unknown as Paragraph);

    const totalViajeros = datos.alumnos.length + datos.docentesResponsables.length + 2; // +director +primeros auxilios
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    children.push(parrafo(`El total de viajeros son ${totalViajeros}, de los cuales ${datos.alumnos.length} son aprendientes, ${datos.docentesResponsables.length} son personal docente/administrativo, 1 es el responsable del plantel y 1 es la persona capacitada en primeros auxilios. Ciclo escolar ${ciclo}.`));

    // ════════ PÁGINA 4: SEGURO, AUTORIZACIÓN Y CIERRE ════════
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...encabezado());
    children.push(zonaEscolarParagraph(datos.zonaEscolar));

    // Seguro del viajero
    children.push(tituloSeccion("SEGURO DEL VIAJERO"));
    children.push(parrafo(`Se anexará copia del contrato, la póliza de seguro de viajero vigente proporcionada por la empresa de transporte contratada para el evento y la licencia del operador. Aseguradora: ${datos.aseguradora}. No. de Póliza: ${datos.numeroPóliza}.`));

    // Autorización de padres
    children.push(tituloSeccion("AUTORIZACIÓN DE PADRES DE FAMILIA"));
    children.push(parrafo("Se anexan copias de los formatos de aceptación y permiso firmados por los padres de familia o tutor de los alumnos participantes, con copia de la credencial del INE de los padres de familia o tutor que fueron entregados a la Dirección de esta institución educativa."));

    // Cumplimiento
    children.push(tituloSeccion("CUMPLIMIENTO CON LOS LINEAMIENTOS"));
    children.push(parrafo(`El proyecto será presentado a la Dirección Escolar y supervisión de la zona escolar ${datos.zonaEscolar} para solicitar el visto bueno del evento, en estricto apego a los lineamientos establecidos por la Secretaría de Educación Pública del Estado de Puebla. La solicitud será entregada con una anticipación de 72 horas antes de la realización del evento.`));

    // Cierre
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    children.push(parrafo("A T E N T A M E N T E", { bold: true, alignment: AlignmentType.CENTER }));
    if (lema) {
        children.push(parrafo(lema, { alignment: AlignmentType.CENTER, size: 20 }));
    }
    children.push(...lineaFirma(datos.directorNombre, "RESPONSABLE DEL BACHILLERATO"));

    // ════════ PÁGINAS ADICIONALES: OFICIOS DE COMISIÓN ════════
    for (const docente of datos.docentesResponsables) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(...encabezado());
        children.push(zonaEscolarParagraph(datos.zonaEscolar));

        // Asunto y Fecha – ALINEADOS A LA DERECHA
        children.push(
            parrafo("Asunto: OFICIO DE COMISIÓN", { bold: true, alignment: AlignmentType.RIGHT })
        );
        children.push(
            parrafo(`${datos.localidad.toUpperCase()}, PUE; a ${datos.fechaEvento}.`, { alignment: AlignmentType.RIGHT })
        );

        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        children.push(parrafo(docente.nombre.toUpperCase(), { bold: true, alignment: AlignmentType.LEFT }));
        children.push(parrafo(docente.cargo.toUpperCase(), { alignment: AlignmentType.LEFT }));
        children.push(parrafo(`BACHILLERATO GENERAL ESTATAL "${datos.bachilleratoNombre}"`, { alignment: AlignmentType.LEFT, size: 20 }));
        children.push(parrafo("PRESENTE", { bold: true, alignment: AlignmentType.LEFT }));
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));

        // Texto de comisión mejorado
        const textoComision = `Por medio del presente, y en atención a las necesidades del servicio educativo, se le comisiona para acompañar y ser responsable del grupo de alumnos del Bachillerato General Estatal "${datos.bachilleratoNombre}", C.C.T. ${datos.cct}, durante su participación en ${datos.nombreEvento} - ${datos.disciplinaRama}, a realizarse el día ${datos.fechaEvento} en ${datos.sede}, ${datos.domicilioSede}.`;
        children.push(parrafo(textoComision));

        // Datos de la comisión
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        children.push(parrafo("Datos de la comisión:", { bold: true, size: 20 }));

        const tablaComision = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        crearCeldaTexto("TIPO", { bold: true, width: 30 }),
                        crearCeldaTexto("COMISIÓN", { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        crearCeldaTexto("COMISIONADO", { bold: true, width: 30 }),
                        crearCeldaTexto(docente.nombre.toUpperCase(), { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        crearCeldaTexto("CARGO", { bold: true, width: 30 }),
                        crearCeldaTexto(docente.cargo, { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        crearCeldaTexto("ADSCRIPCIÓN", { bold: true, width: 30 }),
                        crearCeldaTexto(`BGE "${datos.bachilleratoNombre}", C.C.T. ${datos.cct}`, { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        crearCeldaTexto("PERÍODO", { bold: true, width: 30 }),
                        crearCeldaTexto(datos.fechaEvento, { width: 70 }),
                    ],
                }),
                new TableRow({
                    children: [
                        crearCeldaTexto("MOTIVO", { bold: true, width: 30 }),
                        crearCeldaTexto(`Acompañar y custodiar al grupo de alumnos en ${datos.nombreEvento} - ${datos.disciplinaRama}`, { width: 70 }),
                    ],
                }),
            ],
        });
        children.push(tablaComision as unknown as Paragraph);

        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        children.push(parrafo("Se le encomienda la custodia, salvaguardar la integridad física y velar por el bienestar de los alumnos a su cargo durante todo el trayecto y la estancia en la sede del evento."));

        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        children.push(parrafo("Sin más por el momento, le envío un cordial saludo."));
        children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
        children.push(parrafo("A T E N T A M E N T E", { bold: true, alignment: AlignmentType.CENTER }));
        if (lema) {
            children.push(parrafo(lema, { alignment: AlignmentType.CENTER, size: 20 }));
        }
        children.push(...lineaFirma(datos.directorNombre, "DIRECTOR"));

        // Firmas adicionales
        children.push(new Paragraph({ spacing: { after: 40 }, children: [] }));

        // Vo.Bo. del Supervisor
        children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "__________________________", size: 22, font: "Arial" })],
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [new TextRun({ text: "Vo.Bo.", bold: true, size: 20, font: "Arial" })],
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [new TextRun({ text: datos.supervisorNombre || datos.destinatario, bold: true, size: 20, font: "Arial" })],
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: "SUPERVISOR ESCOLAR", size: 18, font: "Arial" })],
        }));

        // Copias oficiales – tamaño 6pt y sin espaciado
        children.push(new Paragraph({ spacing: { after: 20 }, children: [] }));
        children.push(lineaCcp(`c.c.p. ${datos.destinatario}, ${datos.cargoDestinatario}. Para su conocimiento`));
        children.push(lineaCcp("c.c.p. Comité de APF. Para su conocimiento"));
        children.push(lineaCcp("c.c.p. Archivo del plantel."));
    }

    // ═══ Crear Documento ═══
    const doc = new Document({
        sections: [
            {
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
                children: children,
            },
        ],
    });

    return doc;
}

export async function generarBuffer(datos: DatosCircular05): Promise<Buffer> {
    const doc = generarDocumentoCircular05(datos);
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}
