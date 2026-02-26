"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Search, FileText, ChevronUp, ChevronDown, MessageSquare } from "lucide-react";
import { MESES, ESTADOS, ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants";
import { EscuelaAdmin } from "@/types";

interface ListadoEscuelasProps {
    escuelas: EscuelaAdmin[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    onSetCorreccionModal: (modal: { entregaId: string; escuelaNombre: string; history?: any[] } | null) => void;
}

export default function ListadoEscuelas({ escuelas, onSetMessage, onSetCorreccionModal }: ListadoEscuelasProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("TODOS");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [updatingEstado, setUpdatingEstado] = useState<string | null>(null);

    async function handleEstadoChange(entregaId: string, nuevoEstado: string) {
        setUpdatingEstado(entregaId);
        try {
            const res = await fetch(`/api/entregas/${entregaId}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                const data = await res.json();
                onSetMessage({ type: "error", text: data.error || "Error" });
            }
        } catch {
            onSetMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setUpdatingEstado(null);
        }
    }

    const exportEscuelaPDF = (esc: EscuelaAdmin) => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("Acuse de Recepción SISAT", 14, 20);

            doc.setFontSize(11);
            doc.text(`CCT: ${esc.cct}`, 14, 30);
            doc.text(`Escuela: ${esc.nombre}`, 14, 36);
            doc.text(`Director: ${esc.director || "No especificado"}`, 14, 42);
            doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString("es-MX")}`, 14, 48);

            const tableData = esc.entregas.map(ent => {
                const progName = ent.periodoEntrega?.programa?.nombre || "N/A";
                let perName = "Anual";
                if (ent.periodoEntrega?.mes) perName = MESES[ent.periodoEntrega.mes];
                else if (ent.periodoEntrega?.semestre) perName = `Semestre ${ent.periodoEntrega.semestre}`;

                return [
                    progName,
                    perName,
                    ESTADO_LABELS[ent.estado] || ent.estado,
                    ent.archivos.length.toString(),
                    ent.archivos?.[0]?.createdAt ? new Date(ent.archivos[0].createdAt).toLocaleDateString("es-MX") : "N/A"
                ];
            });

            autoTable(doc, {
                startY: 55,
                head: [['Programa', 'Periodo', 'Estado', 'Archivos', 'Fecha Subida']],
                body: tableData,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [12, 90, 142] }
            });

            const finalY = (doc as any).lastAutoTable.finalY || 60;
            doc.text("___________________________", 14, finalY + 30);
            doc.text("Sello / Firma Supervisión", 14, finalY + 36);

            doc.save(`Acuse_${esc.cct}_${new Date().toISOString().split("T")[0]}.pdf`);
            onSetMessage({ type: "success", text: "Acuse PDF generado exitosamente." });
        } catch (error) {
            console.error("Error generating PDF:", error);
            onSetMessage({ type: "error", text: "Error al generar el PDF." });
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ marginBottom: "0.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
                    <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                    <input
                        type="text"
                        placeholder="Buscar por CCT o nombre de escuela..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control"
                        style={{ paddingLeft: "2.5rem" }}
                    />
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {["TODOS", ...ESTADOS].map((st) => {
                        const color = st === "TODOS" ? "var(--text-muted)" : ESTADO_COLORS[st] || "var(--text-muted)";
                        const isActive = statusFilter === st;
                        return (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                style={{
                                    padding: "0.4rem 0.75rem",
                                    borderRadius: "20px",
                                    border: `1px solid ${color}`,
                                    background: isActive ? color : "transparent",
                                    color: isActive ? "#fff" : color,
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                {st === "TODOS" ? "Mostrar Todos" : ESTADO_LABELS[st]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {escuelas.filter(esc => {
                const matchesSearch = esc.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || esc.cct.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = statusFilter === "TODOS" || esc.entregas.some(ent => ent.estado === statusFilter);
                return matchesSearch && matchesStatus;
            }).map((esc) => {
                const entregadosEsc = esc.entregas.filter((e) => e.estado !== "NO_ENTREGADO").length;
                const totalEsc = esc.entregas.length;
                const porcEsc = totalEsc > 0 ? Math.round((entregadosEsc / totalEsc) * 100) : 0;
                const isExpanded = expanded === esc.id;

                let borderColor = "var(--danger)";
                if (porcEsc === 100) borderColor = "var(--success)";
                else if (porcEsc > 0) borderColor = "var(--warning)";

                return (
                    <div key={esc.id} className="card" style={{ borderLeft: `4px solid ${borderColor}`, padding: 0 }}>
                        <button onClick={() => setExpanded(isExpanded ? null : esc.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{esc.nombre}</div>
                                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                        {esc.cct} • {esc.localidad} • {esc.total} alumnos
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span style={{ fontWeight: 700, color: borderColor }}>{porcEsc}%</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); exportEscuelaPDF(esc); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", display: "flex", alignItems: "center" }}
                                        title="Descargar Acuse PDF"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </div>
                            <div className="progress-bar" style={{ marginTop: "0.5rem", height: "6px" }}>
                                <div className="progress-fill" style={{ width: `${porcEsc}%`, background: borderColor }} />
                            </div>
                        </button>

                        {isExpanded && (
                            <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" }}>
                                {esc.entregas.map((ent) => {
                                    const color = ESTADO_COLORS[ent.estado] || "var(--text-muted)";
                                    const periodoLabel = ent.periodoEntrega.mes
                                        ? `${MESES[ent.periodoEntrega.mes]}`
                                        : ent.periodoEntrega.semestre
                                            ? `Semestre ${ent.periodoEntrega.semestre}`
                                            : "";

                                    return (
                                        <div key={ent.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <div style={{ fontSize: "0.875rem", minWidth: "140px" }}>
                                                <span style={{ fontWeight: 500 }}>{ent.periodoEntrega.programa.nombre}</span>
                                                {periodoLabel && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}> ({periodoLabel})</span>}
                                                {ent.archivos.length > 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}> • {ent.archivos.length} archivo(s)</span>}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <select
                                                    value={ent.estado}
                                                    onChange={(e) => handleEstadoChange(ent.id, e.target.value)}
                                                    disabled={updatingEstado === ent.id}
                                                    style={{
                                                        padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                        border: `1px solid ${color}`, background: `${color}15`,
                                                        color, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                                                    }}
                                                >
                                                    {ESTADOS.map((e) => (
                                                        <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => onSetCorreccionModal({ entregaId: ent.id, escuelaNombre: esc.nombre, history: ent.correcciones })}
                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#e67e22", padding: "0.25rem" }}
                                                    title="Enviar corrección / Ver historial"
                                                >
                                                    <MessageSquare size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
