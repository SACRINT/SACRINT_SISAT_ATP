import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    HeadingLevel,
} from "docx";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const programa = searchParams.get("programa"); // "BANAVIM" | "CEDAVIM"
        const mes = searchParams.get("mes") || "Julio";
        const anio = searchParams.get("anio") || "2026";
        const oficioNum = searchParams.get("oficioNum") || "118";
        const tieneAcoso = searchParams.get("tieneAcoso") === "true";

        // Caso de acoso (si aplica)
        const escuelaNombre = searchParams.get("escuelaNombre") || "";
        const escuelaCct = searchParams.get("escuelaCct") || "";
        const escuelaMunicipio = searchParams.get("escuelaMunicipio") || "";
        const tipoViolencia = searchParams.get("tipoViolencia") || "";
        const acciones = searchParams.get("acciones") || "";
        const estatus = searchParams.get("estatus") || "";

        const mesMayus = mes.toUpperCase();
        const fechaDocumento = `Villa Lázaro Cárdenas, Venustiano Carranza, Pue., a 01 de ${mes} del ${anio}.`;

        const paragraphs: Paragraph[] = [];

        const today = new Date();
        const monthToday = today.getMonth() + 1;
        const semestreLetra = (monthToday >= 8 || monthToday === 1) ? "A" : "B";

        // 1. Oficio header
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({
                        text: `OFICIO NÚMERO: SEP-${semestreLetra}/ZONA004/${oficioNum}\n`,
                        bold: true,
                        size: 22,
                        font: "Arial",
                    }),
                    new TextRun({
                        text: `Fecha: 01/${mesMayus === "ENERO" ? "01" : mesMayus === "FEBRERO" ? "02" : "07"}/${anio}\n\n`,
                        size: 20,
                        font: "Arial",
                    }),
                ],
            })
        );

        // 2. Asunto
        let asuntoText = "";
        if (programa === "BANAVIM") {
            asuntoText = "Asunto: INFORME";
        } else {
            if (tieneAcoso) {
                asuntoText = `Asunto: INFORME MENSUAL (${mesMayus}) TEMAS DE ACOSO ESCOLAR ${anio}`;
            } else {
                asuntoText = `Asunto: INFORME MENSUAL (${mesMayus}) SIN TEMAS DE ACOSO ESCOLAR ${anio}`;
            }
        }

        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({
                        text: asuntoText,
                        bold: true,
                        size: 22,
                        font: "Arial",
                    }),
                ],
                spacing: { after: 360 },
            })
        );

        // 3. Destinatario
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                    new TextRun({ text: "C. MARINA HUERTA GÓMEZ\n", bold: true, size: 22, font: "Arial" }),
                    new TextRun({ text: "DIRECTORA DE BACHILLERATOS ESTATALES\nY PREPARATORIA ABIERTA\n", bold: true, size: 20, font: "Arial" }),
                    new TextRun({ text: "P R E S E N T E.", bold: true, size: 20, font: "Arial" }),
                ],
                spacing: { after: 360 },
            })
        );

        // 4. Body
        let bodyParagraphs: string[] = [];

        if (programa === "BANAVIM") {
            bodyParagraphs = [
                `En respuesta a su oficio SE-1.3.2.1-DBEPA/0667/25, y con fundamento en los artículos 3º y 4º de la Constitución Política de los Estados Unidos Mexicanos; 83 de la Constitución Política del Estado Libre y Soberano de Puebla; 31 fracción XII; 43 fracción XXXVIII de la Ley Orgánica de la Administración Pública del Estado de Puebla; 1, 4 fracción ll, 6, 18 fracción lV, y 19 de la Ley de Educación del Estado de Puebla; con el objetivo de consolidar el Banco Estatal de Datos de Violencia contra las mujeres, que integra la Secretaría de Seguridad Pública, me permito informarle que durante el mes de ${mes} del año en curso, no se ha recibido ningún reporte de casos de violencia contra niñas, adolescentes o mujeres de los planteles adscritos a esta Supervisión.`,
                `Sin otro particular, le envío un cordial saludo y quedo a sus órdenes para cualquier duda o aclaración.`
            ];
        } else {
            // CEDAVIM
            if (tieneAcoso) {
                bodyParagraphs = [
                    `En atención al oficio identificado con número SEP-1.1.2.1-DBEPA/2026, mediante el cual se solicita el reporte mensual correspondiente al formato denominado "TEMAS ACOSO ESCOLAR 2026", me permito informar a usted que, derivado del seguimiento realizado en las instituciones educativas que integran la Zona Escolar 004 a mi cargo, durante el mes de ${mes} de ${anio} se registró un (1) caso relacionado con ${tipoViolencia}, en el Bachillerato General "${escuelaNombre}", con CCT. ${escuelaCct}, ubicado en el municipio de ${escuelaMunicipio}, Puebla.`,
                    `Al respecto, el plantel educativo, en coordinación con esta Supervisión Escolar y las instancias competentes, implementó las acciones de atención e intervención correspondientes, entre las que destacan ${acciones}. Derivado de dichas intervenciones, el caso se reporta con estatus de ${estatus}, conforme a la información proporcionada por el plantel.`,
                    `Asimismo, se remite adjunto el formato correspondiente debidamente requisitado, para los efectos administrativos conducentes y en cumplimiento a lo solicitado.`,
                    `Sin otro particular, le envío un cordial saludo y quedo a sus órdenes para cualquier duda o aclaración.`
                ];
            } else {
                bodyParagraphs = [
                    `En atención al oficio identificado con número SEP-1.1.2.1-DBEPA/2026, mediante el cual se solicita el reporte mensual correspondiente al formato denominado “TEMAS ACOSO ESCOLAR 2026”, me permito informar a usted que, derivado de la revisión realizada en las instituciones educativas que integran la Zona Escolar 004 a mi cargo, no se presentó ningún caso relacionado con los rubros señalados (Acoso Escolar, Acoso Sexual, Violencia Intrafamiliar, Violencia Cibernética, Violencia por parte del docente y Violencia contra el docente por parte del alumno o alumna) durante el mes de ${mes} del presente año.`,
                    `Lo anterior se comunica para los efectos administrativos correspondientes, dando cumplimiento en tiempo y forma a lo solicitado.`,
                    `Sin otro particular, le envío un cordial saludo y quedo a sus órdenes para cualquier duda o aclaración.`
                ];
            }
        }

        for (const bp of bodyParagraphs) {
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({
                            text: bp,
                            size: 22,
                            font: "Arial",
                        }),
                    ],
                    spacing: { after: 200, line: 360 }, // 1.5 line spacing
                })
            );
        }

        // 5. Place and Date
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                    new TextRun({
                        text: `\n${fechaDocumento}\n\n`,
                        size: 20,
                        font: "Arial",
                        italics: true,
                    }),
                ],
            })
        );

        // 6. Signature
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: "ATENTAMENTE\n", bold: true, size: 22, font: "Arial" }),
                    new TextRun({ text: "SUPERVISOR DE LA ZONA ESCOLAR 004\n\n\n\n", bold: true, size: 20, font: "Arial" }),
                    new TextRun({ text: "____________________________________________\n", size: 20, font: "Arial" }),
                    new TextRun({ text: "ING. ALEJANDRO ESCAMILLA MARTÍNEZ", bold: true, size: 22, font: "Arial" }),
                ],
                spacing: { before: 360 },
            })
        );

        const doc = new Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: 1440, // 1 inch
                                bottom: 1440,
                                left: 1440,
                                right: 1440,
                            },
                        },
                    },
                    children: paragraphs,
                },
            ],
        });

        const buffer = await Packer.toBuffer(doc);
        const prefix = programa === "BANAVIM" ? "REPORTE_BANAVIM" : tieneAcoso ? "REPORTE_CEDAVIM_SI_ACOSO" : "REPORTE_CEDAVIM_NO_ACOSO";
        const filename = `${prefix}_ZONA004_${mesMayus}_${anio}.docx`;

        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: any) {
        console.error("Error al generar reporte oficial de supervisión:", error);
        return NextResponse.json({ error: error.message || "Error interno al generar el reporte" }, { status: 500 });
    }
}
