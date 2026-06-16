"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Search, FileText, ChevronUp, ChevronDown, MessageSquare, Download, Mail, Eye } from "lucide-react";
import { MESES, ESTADOS, ESTADO_LABELS } from "@/lib/constants";
import { EscuelaAdmin } from "@/types";
import { getEntregaDownloadUrl } from "@/lib/download-url";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";

interface ListadoEscuelasProps {
    escuelas: EscuelaAdmin[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    onSetCorreccionModal: (modal: { entregaId: string; escuelaNombre: string; history?: any[] } | null) => void;
}

function getEstadoStyles(estado: string) {
    switch (estado) {
        case "APROBADO":
            return {
                color: "var(--success)",
                background: "var(--success-bg)",
                borderColor: "#bbf7d0"
            };
        case "PENDIENTE":
            return {
                color: "var(--warning)",
                background: "var(--warning-bg)",
                borderColor: "#fef08a"
            };
        case "REQUIERE_CORRECCION":
            return {
                color: "#e67e22",
                background: "#fff7ed",
                borderColor: "#ffedd5"
            };
        case "EN_REVISION":
            return {
                color: "var(--primary)",
                background: "var(--primary-bg)",
                borderColor: "#bfdbfe"
            };
        case "NO_APROBADO":
            return {
                color: "var(--danger)",
                background: "var(--danger-bg)",
                borderColor: "#fecaca"
            };
        case "NO_ENTREGADO":
        default:
            return {
                color: "var(--text-secondary)",
                background: "#f1f5f9",
                borderColor: "#cbd5e1"
            };
    }
}

export default function ListadoEscuelas({ escuelas, onSetMessage, onSetCorreccionModal }: ListadoEscuelasProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("TODOS");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [updatingEstado, setUpdatingEstado] = useState<string | null>(null);
    const [sendingReminder, setSendingReminder] = useState<string | null>(null);
    const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; downloadUrl?: string; fileName?: string } | null>(null);

    async function handleSendReminder(entregaId: string, escuelaNombre: string) {
        if (!confirm(`¿Seguro que deseas enviar un recordatorio por correo a ${escuelaNombre} para esta entrega?`)) return;
        setSendingReminder(entregaId);
        try {
            const res = await fetch(`/api/recordatorios/individual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entregaId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al enviar");
            onSetMessage({ type: "success", text: data.message });
        } catch (e: any) {
            onSetMessage({ type: "error", text: e.message });
        } finally {
            setSendingReminder(null);
        }
    }

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
                        const styles = st === "TODOS" 
                            ? { color: "var(--text-secondary)", background: "#f1f5f9", borderColor: "var(--border)" }
                            : getEstadoStyles(st);
                        const isActive = statusFilter === st;
                        return (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                style={{
                                    padding: "0.4rem 0.75rem",
                                    borderRadius: "20px",
                                    border: `1px solid ${isActive ? styles.color : styles.borderColor}`,
                                    background: isActive ? styles.background : "transparent",
                                    color: isActive ? styles.color : "var(--text-secondary)",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    boxShadow: isActive ? "inset 0 0 0 1px " + styles.color : "none"
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

                let progressColor = "var(--danger)";
                let cardBgGradient = "linear-gradient(to right, var(--danger-bg) 0%, var(--surface) 150px)";
                if (porcEsc === 100) {
                    progressColor = "var(--success)";
                    cardBgGradient = "linear-gradient(to right, var(--success-bg) 0%, var(--surface) 150px)";
                } else if (porcEsc > 0) {
                    progressColor = "var(--warning)";
                    cardBgGradient = "linear-gradient(to right, var(--warning-bg) 0%, var(--surface) 150px)";
                }

                return (
                    <div key={esc.id} className="card" style={{ borderLeft: `5px solid ${progressColor}`, background: cardBgGradient, padding: 0 }}>
                        <button onClick={() => setExpanded(isExpanded ? null : esc.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{esc.nombre}</div>
                                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                        {esc.cct} • {esc.localidad} • {esc.total} alumnos
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span style={{ fontWeight: 700, color: progressColor }}>{porcEsc}%</span>
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
                                <div className="progress-fill" style={{ width: `${porcEsc}%`, background: progressColor }} />
                            </div>
                        </button>

                        {isExpanded && (
                            <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" }}>
                                {esc.entregas.map((ent) => {
                                    const styles = getEstadoStyles(ent.estado);
                                    const periodoLabel = ent.periodoEntrega.mes
                                        ? `${MESES[ent.periodoEntrega.mes]}`
                                        : ent.periodoEntrega.semestre
                                            ? `Semestre ${ent.periodoEntrega.semestre}`
                                            : "";

                                    return (
                                        <div key={ent.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <div style={{ fontSize: "0.875rem", minWidth: "140px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                <div>
                                                    <span style={{ fontWeight: 500 }}>{ent.periodoEntrega.programa.nombre}</span>
                                                    {periodoLabel && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}> ({periodoLabel})</span>}
                                                </div>
                                                {ent.archivos.length > 0 && (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                        {ent.archivos.map((arch, index) => {
                                                            const fileUrl = getEntregaDownloadUrl({
                                                                url: arch.driveUrl,
                                                                publicId: arch.driveId,
                                                                cct: esc.cct,
                                                                programa: ent.periodoEntrega.programa.nombre,
                                                                periodo: ent.periodoEntrega.mes
                                                                    ? (MESES[ent.periodoEntrega.mes] ?? "")
                                                                    : ent.periodoEntrega.semestre
                                                                        ? `Semestre_${ent.periodoEntrega.semestre}`
                                                                        : "Anual",
                                                                etiqueta: arch.etiqueta,
                                                                nombreOriginal: arch.nombre,
                                                            });

                                                            const archLabel = arch.etiqueta || `Archivo ${index + 1}`;
                                                            const archTitle = `${esc.cct} — ${ent.periodoEntrega.programa.nombre} — ${archLabel}`;
                                                            return (
                                                                <span key={arch.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.125rem", background: "var(--bg)", border: "1px solid var(--border)", padding: "0.15rem 0.35rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                                                                    <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }} title={archLabel}>{archLabel}</span>
                                                                    {/* Eye: open viewer */}
                                                                    {arch.driveUrl && (
                                                                        <button
                                                                            onClick={() => setViewingPdf({
                                                                                url: arch.driveUrl!,
                                                                                title: archTitle,
                                                                                downloadUrl: fileUrl || undefined,
                                                                                fileName: arch.nombre || undefined,
                                                                            })}
                                                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "1px", display: "inline-flex", alignItems: "center" }}
                                                                            title={`Ver ${archLabel}`}
                                                                        >
                                                                            <Eye size={12} />
                                                                        </button>
                                                                    )}
                                                                    {/* Download */}
                                                                    <a
                                                                        href={fileUrl || "#"}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", padding: "1px" }}
                                                                        title={`Descargar ${archLabel}`}
                                                                    >
                                                                        <Download size={12} />
                                                                    </a>
                                                                </span>
                                                            );
                                                        })}
                                                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "flex", alignItems: "center" }}>
                                                            • Subido: {new Date(ent.archivos[0].createdAt!).toLocaleDateString("es-MX")}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                {ent.estado !== "APROBADO" && (
                                                    <button
                                                        onClick={() => handleSendReminder(ent.id, esc.nombre)}
                                                        disabled={sendingReminder === ent.id}
                                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", opacity: sendingReminder === ent.id ? 0.5 : 1 }}
                                                        title="Enviar Recordatorio Individual"
                                                    >
                                                        <Mail size={16} />
                                                    </button>
                                                )}
                                                <select
                                                    value={ent.estado}
                                                    onChange={(e) => handleEstadoChange(ent.id, e.target.value)}
                                                    disabled={updatingEstado === ent.id}
                                                    style={{
                                                        padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                        border: `1px solid ${styles.borderColor}`, background: styles.background,
                                                        color: styles.color, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                                                        outline: "none", transition: "all 0.2s ease"
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
            <PdfViewerModal
                isOpen={!!viewingPdf}
                onClose={() => setViewingPdf(null)}
                url={viewingPdf?.url || ""}
                title={viewingPdf?.title || ""}
                downloadUrl={viewingPdf?.downloadUrl}
                fileName={viewingPdf?.fileName}
            />
        </div>
    );
}
