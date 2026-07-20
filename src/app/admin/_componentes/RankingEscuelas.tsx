"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, AlertCircle, Download, Loader2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from "docx";

interface RankingItem {
    id: string;
    cct: string;
    nombre: string;
    zona: string | null;
    totalRequeridas: number;
    aprobadas: number;
    entregadas: number;
    cumplimiento: number;
    entregadasPorcentaje: number;
    medalla: "ORO" | "PLATA" | "BRONCE" | "NINGUNA";
}

interface Props {
    cicloNombre: string;
    isDirector?: boolean;
}

export default function RankingEscuelas({ cicloNombre, isDirector = false }: Props) {
    const [ranking, setRanking] = useState<RankingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/admin/ranking")
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setRanking(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    const getMedalIcon = (medalla: string) => {
        switch (medalla) {
            case "ORO": return <Trophy size={20} color="#fbbf24" style={{ filter: "drop-shadow(0 2px 2px rgba(251,191,36,0.4))" }} />;
            case "PLATA": return <Medal size={20} color="#94a3b8" />;
            case "BRONCE": return <Medal size={20} color="#b45309" />;
            default: return null;
        }
    };

    const getMedalLabel = (medalla: string) => {
        switch (medalla) {
            case "ORO": return "Oro (100% a tiempo)";
            case "PLATA": return "Plata (100% entregado)";
            case "BRONCE": return "Bronce (>= 80%)";
            default: return "Sin medalla";
        }
    };

    const handleDownloadReport = async () => {
        const createCell = (text: string, bold = false) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })], alignment: AlignmentType.CENTER })],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
        });

        const rows = [
            new TableRow({
                children: [
                    createCell("CCT", true),
                    createCell("Nombre de la Escuela", true),
                    createCell("Requeridas", true),
                    createCell("Aprobadas", true),
                    createCell("Cumplimiento", true),
                    createCell("Estatus", true)
                ]
            })
        ];

        ranking.forEach(r => {
            let estatus = "No cumplió";
            if (r.medalla === "ORO") estatus = "Cumplió al 100% en tiempo y forma";
            else if (r.medalla === "PLATA") estatus = "Cumplió fuera de tiempo";
            else if (r.medalla === "BRONCE") estatus = "Cumplimiento Parcial";

            rows.push(new TableRow({
                children: [
                    createCell(r.cct),
                    createCell(r.nombre),
                    createCell(r.totalRequeridas.toString()),
                    createCell(r.aprobadas.toString()),
                    createCell(`${r.cumplimiento.toFixed(1)}%`),
                    createCell(estatus)
                ]
            }));
        });

        const table = new Table({
            rows: rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            }
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: "INFORME FINAL DE CUMPLIMIENTO", bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: `Ciclo Escolar: ${cicloNombre}`, size: 24 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 }
                    }),
                    table,
                    new Paragraph({
                        children: [new TextRun({ text: "", size: 24 })],
                        spacing: { before: 1500, after: 1500 } // Empty space for signatures
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "___________________________", size: 24 })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "Firma del ATP", size: 24, bold: true })], alignment: AlignmentType.CENTER })
                                        ],
                                        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
                                    }),
                                    new TableCell({
                                        children: [
                                            new Paragraph({ children: [new TextRun({ text: "___________________________", size: 24 })], alignment: AlignmentType.CENTER }),
                                            new Paragraph({ children: [new TextRun({ text: "Firma del Supervisor", size: 24, bold: true })], alignment: AlignmentType.CENTER })
                                        ],
                                        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Reporte_Cumplimiento_${cicloNombre.replace(/\//g, "-")}.docx`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 0);
    };

    if (loading) return <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}><Loader2 size={32} className="spin text-primary" /></div>;
    if (error) return <div style={{ padding: "2rem", color: "var(--danger)" }}><AlertCircle /> {error}</div>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Trophy size={24} color="#fbbf24" />
                        Ranking de Cumplimiento
                    </h2>
                    <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 0" }}>
                        Monitorea el desempeño de las escuelas. Las medallas se otorgan por cumplimiento y puntualidad.
                    </p>
                </div>
                {!isDirector && (
                    <button
                        onClick={handleDownloadReport}
                        style={{
                            padding: "0.5rem 1rem",
                            background: "var(--primary)",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem"
                        }}
                    >
                        <Download size={18} /> Descargar Reporte Final (Word)
                    </button>
                )}
            </div>

            <div className="card" style={{ padding: "0" }}>
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Escuela</th>
                                <th>Requeridas</th>
                                <th>Aprobadas</th>
                                <th>Cumplimiento</th>
                                <th>Medalla</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranking.map((r, index) => (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>{index + 1}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>CCT: {r.cct}</div>
                                    </td>
                                    <td>{r.totalRequeridas}</td>
                                    <td>{r.aprobadas}</td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ width: "100%", background: "var(--border)", height: "6px", borderRadius: "3px", overflow: "hidden", minWidth: "100px" }}>
                                                <div style={{
                                                    width: `${r.cumplimiento}%`,
                                                    background: r.cumplimiento === 100 ? "var(--success)" : r.cumplimiento >= 80 ? "var(--warning)" : "var(--danger)",
                                                    height: "100%"
                                                }} />
                                            </div>
                                            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{r.cumplimiento.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
                                            {getMedalIcon(r.medalla)}
                                            {getMedalLabel(r.medalla)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
