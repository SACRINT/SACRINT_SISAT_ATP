import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
    Table,
    TableRow,
    TableCell,
    WidthType,
} from "docx";

// Helper to parse Markdown content and generate docx paragraphs
function parseMarkdownToParagraphs(markdown: string): Paragraph[] {
    const lines = markdown.split("\n");
    const paragraphs: Paragraph[] = [];

    for (let line of lines) {
        line = line.trim();
        if (!line) {
            paragraphs.push(new Paragraph({ text: "" }));
            continue;
        }

        // Headings
        if (line.startsWith("# ")) {
            paragraphs.push(
                new Paragraph({
                    text: line.substring(2),
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 240, after: 120 },
                })
            );
        } else if (line.startsWith("## ")) {
            paragraphs.push(
                new Paragraph({
                    text: line.substring(3),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 180, after: 80 },
                })
            );
        } else if (line.startsWith("### ")) {
            paragraphs.push(
                new Paragraph({
                    text: line.substring(4),
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 120, after: 60 },
                })
            );
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            const textContent = line.substring(2);
            paragraphs.push(
                new Paragraph({
                    children: [new TextRun({ text: "• ", bold: true }), ...parseInlineStyles(textContent)],
                    spacing: { after: 120 },
                })
            );
        } else if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+)\.\s(.*)/);
            if (match) {
                const num = match[1];
                const textContent = match[2];
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${num}. `, bold: true }),
                            ...parseInlineStyles(textContent),
                        ],
                        spacing: { after: 120 },
                    })
                );
            }
        } else {
            paragraphs.push(
                new Paragraph({
                    children: parseInlineStyles(line),
                    spacing: { after: 160, line: 360 }, // 1.5 line spacing
                })
            );
        }
    }

    return paragraphs.filter(Boolean);
}

function parseInlineStyles(text: string): TextRun[] {
    const runs: TextRun[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const textBefore = text.substring(lastIndex, match.index);
        if (textBefore) {
            runs.push(new TextRun({ text: textBefore, font: "Arial", size: 22 }));
        }

        runs.push(
            new TextRun({
                text: match[1],
                bold: true,
                font: "Arial",
                size: 22,
            })
        );

        lastIndex = regex.lastIndex;
    }

    const textRemaining = text.substring(lastIndex);
    if (textRemaining) {
        runs.push(new TextRun({ text: textRemaining, font: "Arial", size: 22 }));
    }

    return runs;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { entregaId, numeroOficio, lugarFecha, textoAdicional } = body;

        if (!entregaId) {
            return NextResponse.json({ error: "Falta el ID de la entrega" }, { status: 400 });
        }

        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: {
                escuela: true,
                preRevision: true,
                periodoEntrega: {
                    include: { programa: true, cicloEscolar: true }
                }
            }
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        // Si la entrega está aprobada pero aún no tiene CVD/firma (ej: registros anteriores), generarlo al vuelo
        let finalCvd = entrega.cvd;
        let finalFirma = entrega.firmaDigital;
        if (entrega.estado === "APROBADO" && !finalCvd) {
            const crypto = require("crypto");
            const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
            const cleanCct = entrega.escuela.cct.replace(/\s+/g, "");
            finalCvd = `CVD-${cleanCct}-${randomHex}`;
            const dataToSign = `${entrega.escuela.id}-${entrega.periodoEntrega.programa.nombre}-${new Date().toISOString()}-Ing.AlejandroEscamilla`;
            finalFirma = crypto.createHash("sha256").update(dataToSign).digest("hex").substring(0, 32).toUpperCase();

            await prisma.entrega.update({
                where: { id: entregaId },
                data: {
                    cvd: finalCvd,
                    firmaDigital: finalFirma
                }
            });
        }

        const escuelaNombre = entrega.escuela.nombre;
        const cct = entrega.escuela.cct;
        const director = entrega.escuela.director || "DIRECTOR(A) DEL PLANTEL";
        const programaNombre = entrega.periodoEntrega.programa.nombre;
        const cicloNombre = entrega.periodoEntrega.cicloEscolar.nombre;
        const estado = entrega.estado === "APROBADO" ? "APROBADO" : "REQUIERE CORRECCIÓN";

        const resObj = entrega.preRevision?.resultado as any;
        const feedbackText = resObj?.borradorCorreo || resObj?.explicacion || "No se ha generado retroalimentación para esta entrega.";

        const paragraphs: Paragraph[] = [];

        // 1. SEP and Subsecretaría Headers
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({ text: "SECRETARÍA DE EDUCACIÓN PÚBLICA\n", bold: true, size: 18, font: "Arial", color: "475569" }),
                    new TextRun({ text: "SUBSECRETARÍA DE EDUCACIÓN OBLIGATORIA\n", bold: true, size: 16, font: "Arial", color: "475569" }),
                    new TextRun({ text: "DIRECCIÓN DE BACHILLERATOS ESTATALES Y PREPARATORIA ABIERTA\n", bold: true, size: 16, font: "Arial", color: "475569" }),
                    new TextRun({ text: "SUPERVISIÓN ESCOLAR DE LA ZONA 004 (CCT: 21FMS0020X)\n\n", bold: true, size: 16, font: "Arial", color: "475569" }),
                ],
            })
        );

        // 2. Oficio Number & Date
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({ text: `OFICIO No: SEP-B/ZONA004/${numeroOficio}\n`, bold: true, size: 22, font: "Arial" }),
                    new TextRun({ text: `Lugar y Fecha: ${lugarFecha}\n\n`, size: 20, font: "Arial" }),
                ],
            })
        );

        // 3. Asunto
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({ text: "ASUNTO: ", bold: true, size: 22, font: "Arial" }),
                    new TextRun({ text: `Dictamen de Evaluación y Validación de ${programaNombre}`, size: 22, font: "Arial" }),
                ],
                spacing: { after: 360 },
            })
        );

        // 4. Destinatario
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                    new TextRun({ text: `C. ${director.toUpperCase()}\n`, bold: true, size: 22, font: "Arial" }),
                    new TextRun({ text: `DIRECTOR(A) DEL BACHILLERATO GENERAL "${escuelaNombre.toUpperCase()}"\n`, bold: true, size: 20, font: "Arial" }),
                    new TextRun({ text: `C.C.T: ${cct}\n`, bold: true, size: 20, font: "Arial" }),
                    new TextRun({ text: "P R E S E N T E.", bold: true, size: 20, font: "Arial" }),
                ],
                spacing: { after: 360 },
            })
        );

        // 5. Presentación formal
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({
                        text: `Por medio de la presente, me dirijo a usted con el propósito de informarle sobre el resultado de la evaluación correspondiente al documento de ${programaNombre} cargado en la plataforma institucional SISAT-ATP para el ciclo escolar ${cicloNombre}.`,
                        size: 22,
                        font: "Arial",
                    }),
                ],
                spacing: { after: 180, line: 360 },
            })
        );

        // 6. Estatus de la entrega
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({
                        text: "Una vez concluida la revisión técnica y pedagógica de la entrega por parte de esta Supervisión Escolar, se ha emitido el dictamen oficial con estatus de: ",
                        size: 22,
                        font: "Arial",
                    }),
                    new TextRun({
                        text: estado,
                        bold: true,
                        size: 22,
                        font: "Arial",
                        color: estado === "APROBADO" ? "15803d" : "b91c1c",
                    }),
                    new TextRun({
                        text: ".",
                        size: 22,
                        font: "Arial",
                    }),
                ],
                spacing: { after: 200, line: 360 },
            })
        );

        // 7. Texto adicional (observaciones del ATP en el modal)
        if (textoAdicional && textoAdicional.trim()) {
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({
                            text: textoAdicional.trim(),
                            size: 22,
                            font: "Arial",
                        }),
                    ],
                    spacing: { after: 200, line: 360 },
                })
            );
        }

        // 8. Detalle del diagnóstico (explicación o rubros corregidos)
        if (feedbackText) {
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "\nDETALLE DEL DIAGNÓSTICO Y RETROALIMENTACIÓN DE LA ZONA ESCOLAR:",
                            bold: true,
                            size: 20,
                            font: "Arial",
                            color: "1e3a8a",
                        }),
                    ],
                    spacing: { before: 180, after: 120 },
                })
            );

            const parsedParagraphs = parseMarkdownToParagraphs(feedbackText);
            paragraphs.push(...parsedParagraphs);
        }

        // 9. Cierre
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                children: [
                    new TextRun({
                        text: "\nSin otro particular por el momento, le reitero mi consideración distinguida y quedo a su entera disposición.",
                        size: 22,
                        font: "Arial",
                    }),
                ],
                spacing: { before: 240, after: 360, line: 360 },
            })
        );

        // 10. Firmas
        paragraphs.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: "ATENTAMENTE\n", bold: true, size: 22, font: "Arial" }),
                    new TextRun({ text: "SUPERVISOR DE LA ZONA ESCOLAR 004\n\n\n\n\n", bold: true, size: 20, font: "Arial" }),
                    new TextRun({ text: "____________________________________________\n", size: 20, font: "Arial" }),
                    new TextRun({ text: "ING. ALEJANDRO ESCAMILLA MARTÍNEZ", bold: true, size: 22, font: "Arial" }),
                ],
                spacing: { before: 360 },
            })
        );

        // 11. Sello y QR Digital (CVD) - Solo si está aprobado
        if (entrega.estado === "APROBADO" && finalCvd) {
            paragraphs.push(new Paragraph({ text: "" }));
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({ text: "🛡️ VALIDEZ Y SELLO DIGITAL OFICIAL (SISAT-ATP ZONA 004)\n", bold: true, size: 16, font: "Courier New", color: "1e3a8a" }),
                        new TextRun({ text: `Código CVD: ${finalCvd}\n`, bold: true, size: 16, font: "Courier New", color: "4b5563" }),
                        new TextRun({ text: `Firma Electrónica: ${finalFirma}\n`, size: 14, font: "Courier New", color: "6b7280" }),
                        new TextRun({ text: `Enlace de Verificación: https://sacrint-sisat-atp.vercel.app/validar-documento?cvd=${finalCvd}\n`, size: 14, font: "Courier New", color: "2563eb", underline: {} }),
                        new TextRun({ text: "--------------------------------------------------------------------------------", size: 14, font: "Courier New", color: "d1d5db" }),
                    ],
                    spacing: { before: 240, after: 120 },
                })
            );
        }

        const doc = new Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: 1440,
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
        const cleanSchoolName = escuelaNombre.replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `DICTAMEN_${programaNombre.toUpperCase()}_ZONA004_${cleanSchoolName}.docx`;

        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: any) {
        console.error("Error al generar dictamen individual:", error);
        return NextResponse.json({ error: error.message || "Error interno al generar el dictamen" }, { status: 500 });
    }
}
