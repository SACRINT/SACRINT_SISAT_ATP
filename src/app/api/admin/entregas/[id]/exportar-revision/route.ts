import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
} from "docx";

// Helper to parse Markdown content and generate docx elements
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
            // Bullet points
            const textContent = line.substring(2);
            paragraphs.push(
                new Paragraph({
                    children: parseInlineStyles(textContent),
                    bullet: { level: 0 },
                    spacing: { after: 120 },
                })
            );
        } else if (/^\d+\.\s/.test(line)) {
            // Numbered list items (e.g. 1. Item)
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
            // Regular paragraphs
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

// Simple parser for **bold** inline styling
function parseInlineStyles(text: string): TextRun[] {
    const runs: TextRun[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            runs.push(new TextRun({
                text: text.substring(lastIndex, match.index),
                font: "Calibri",
                size: 22, // 11pt
            }));
        }
        // Add bold text
        runs.push(new TextRun({
            text: match[1],
            bold: true,
            font: "Calibri",
            size: 22, // 11pt
            color: "1e3a8a", // Dark blue for highlights
        }));
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        runs.push(new TextRun({
            text: text.substring(lastIndex),
            font: "Calibri",
            size: 22,
        }));
    }

    if (runs.length === 0) {
        runs.push(new TextRun({
            text: text,
            font: "Calibri",
            size: 22,
        }));
    }

    return runs;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;

        // Fetch delivery and pre-revision
        const entrega = await prisma.entrega.findUnique({
            where: { id },
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

        const resObj = entrega.preRevision?.resultado as any;
        const feedbackText = resObj?.borradorCorreo || resObj?.explicacion || "No se ha generado retroalimentación para esta entrega.";
        const programaNombre = entrega.periodoEntrega.programa.nombre;
        const escuelaNombre = entrega.escuela.nombre;
        const cct = entrega.escuela.cct;
        const fecha = new Date(entrega.createdAt).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });

        // 1. Create document
        const doc = new Document({
            title: `Reporte de Evaluación ${programaNombre}`,
            description: `Revisión técnica de ${programaNombre} para el plantel ${escuelaNombre}`,
            sections: [
                {
                    properties: {},
                    children: [
                        // Header info
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({
                                    text: "SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES · ZONA 004\n",
                                    bold: true,
                                    size: 16,
                                    color: "5c768d",
                                }),
                                new TextRun({
                                    text: "ÁREA DE ASESORÍA TÉCNICO PEDAGÓGICA",
                                    size: 14,
                                    color: "7f8c8d",
                                }),
                            ],
                            spacing: { after: 360 },
                        }),

                        // Title
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: [
                                new TextRun({
                                    text: `INFORME DE EVALUACIÓN TÉCNICA: ${programaNombre.toUpperCase()}`,
                                    bold: true,
                                    size: 28, // 14pt
                                    color: "1e3a8a",
                                }),
                            ],
                            spacing: { after: 120 },
                        }),

                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: [
                                new TextRun({
                                    text: `Ciclo Escolar: ${entrega.periodoEntrega.cicloEscolar.nombre} · Evaluación de Cumplimiento`,
                                    italics: true,
                                    size: 20, // 10pt
                                    color: "475569",
                                }),
                            ],
                            spacing: { after: 240 },
                        }),

                        // Metadata Table
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            shading: { fill: "f1f5f9" },
                                            margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                            borders: {
                                                top: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                bottom: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                left: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                right: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                            },
                                            children: [
                                                new Paragraph({
                                                    children: [
                                                        new TextRun({ text: "Plantel / Escuela: ", bold: true, size: 18, color: "1e293b" }),
                                                        new TextRun({ text: escuelaNombre, size: 18, color: "334155" }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                        new TableCell({
                                            shading: { fill: "f1f5f9" },
                                            margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                            borders: {
                                                top: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                bottom: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                left: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                right: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                            },
                                            children: [
                                                new Paragraph({
                                                    children: [
                                                        new TextRun({ text: "CCT: ", bold: true, size: 18, color: "1e293b" }),
                                                        new TextRun({ text: cct, size: 18, color: "334155" }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            shading: { fill: "f8fafc" },
                                            margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                            borders: {
                                                top: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                bottom: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                left: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                right: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                            },
                                            children: [
                                                new Paragraph({
                                                    children: [
                                                        new TextRun({ text: "Evaluador: ", bold: true, size: 18, color: "1e293b" }),
                                                        new TextRun({ text: "Asesor Técnico Pedagógico (Supervisión 004)", size: 18, color: "334155" }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                        new TableCell({
                                            shading: { fill: "f8fafc" },
                                            margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                            borders: {
                                                top: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                bottom: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                left: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                                right: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" },
                                            },
                                            children: [
                                                new Paragraph({
                                                    children: [
                                                        new TextRun({ text: "Fecha: ", bold: true, size: 18, color: "1e293b" }),
                                                        new TextRun({ text: fecha, size: 18, color: "334155" }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),

                        // Divider line
                        new Paragraph({
                            border: {
                                bottom: { style: BorderStyle.SINGLE, size: 6, color: "1e3a8a" },
                            },
                            spacing: { before: 360, after: 240 },
                        }),

                        // Subtitle section
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "DETALLE DE OBSERVACIONES Y RECOMENDACIONES DE LA SUPERVISIÓN",
                                    bold: true,
                                    size: 20,
                                    color: "1e3a8a",
                                }),
                            ],
                            spacing: { after: 180 },
                        }),

                        // Main feedback body parsed from Markdown
                        ...parseMarkdownToParagraphs(feedbackText),

                        // Spacing before signature
                        new Paragraph({ text: "", spacing: { before: 480 } }),

                        // Signature block
                        new Table({
                            alignment: AlignmentType.CENTER,
                            width: { size: 60, type: WidthType.PERCENTAGE },
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            borders: {
                                                top: { style: BorderStyle.SINGLE, size: 8, color: "7f8c8d" },
                                                bottom: { style: BorderStyle.NONE },
                                                left: { style: BorderStyle.NONE },
                                                right: { style: BorderStyle.NONE },
                                            },
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [
                                                        new TextRun({
                                                            text: "\nIng. Samuel Cruz Interial\n",
                                                            bold: true,
                                                            size: 20,
                                                        }),
                                                        new TextRun({
                                                            text: "Asesor Técnico Pedagógico\nSupervisión Escolar Zona 004",
                                                            size: 18,
                                                            color: "5c768d",
                                                        }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                },
            ],
        });

        // 2. Export to buffer
        const buffer = await Packer.toBuffer(doc);

        // Sanitize school name for header
        const cleanSchoolName = escuelaNombre.replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `REVISION_${programaNombre.toUpperCase()}_2025-2026_${cct}_${cleanSchoolName}.docx`;

        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: any) {
        console.error("Export Word error:", error);
        return NextResponse.json({ error: error.message || "Error al exportar reporte en Word" }, { status: 500 });
    }
}
