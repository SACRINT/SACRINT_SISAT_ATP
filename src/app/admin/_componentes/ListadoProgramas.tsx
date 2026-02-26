"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, MessageSquare, Download } from "lucide-react";
import JSZip from "jszip";
import { MESES, ESTADOS, ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";
import { getDownloadUrl } from "@/lib/download-url";

interface ListadoProgramasProps {
    programas: ProgramaAdmin[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
    onSetCorreccionModal: (modal: { entregaId: string; escuelaNombre: string; history?: any[] } | null) => void;
}

export default function ListadoProgramas({ programas, onSetMessage, onSetCorreccionModal }: ListadoProgramasProps) {
    const router = useRouter();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [expandedPeriodo, setExpandedPeriodo] = useState<string | null>(null);
    const [updatingEstado, setUpdatingEstado] = useState<string | null>(null);
    const [downloadingZip, setDownloadingZip] = useState<string | null>(null);

    async function handleDownloadZip(prog: ProgramaAdmin) {
        setDownloadingZip(prog.id);
        onSetMessage({ type: "success", text: "Preparando descarga masiva, por favor espera..." });
        try {
            const zip = new JSZip();
            let fileCount = 0;

            for (const p of prog.periodos.filter(per => per.activo)) {
                const periodLabel = getPeriodoLabel(p).replace(/[/\\?%*:|"<>]/g, '-');
                for (const ent of p.entregas) {
                    if (ent.archivos && ent.archivos.length > 0) {
                        const schoolName = ent.escuela.nombre.replace(/[/\\?%*:|"<>]/g, '-');
                        for (let i = 0; i < ent.archivos.length; i++) {
                            const arch = ent.archivos[i];
                            if (arch.driveUrl) {
                                try {
                                    const downloadUrl = getDownloadUrl(arch.driveUrl, arch.nombre, arch.driveId) || arch.driveUrl;
                                    const response = await fetch(downloadUrl);
                                    if (!response.ok) throw new Error("HTTP error");
                                    const blob = await response.blob();
                                    const ext = arch.nombre.split('.').pop() || 'pdf';
                                    const fileName = `${arch.etiqueta || `Archivo_${i + 1}`}.${ext}`;
                                    zip.file(`${schoolName}/${periodLabel}/${fileName}`, blob);
                                    fileCount++;
                                } catch (e) {
                                    console.error(`Error descargando ${arch.nombre}`, e);
                                }
                            }
                        }
                    }
                }
            }

            if (fileCount === 0) throw new Error("No se encontraron archivos válidos para descargar.");

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${prog.nombre.replace(/[/\\?%*:|"<>]/g, '-')}.zip`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
            onSetMessage({ type: "success", text: "Descarga completada." });
        } catch (e: any) {
            onSetMessage({ type: "error", text: e.message });
        } finally {
            setDownloadingZip(null);
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

    function getPeriodoLabel(periodo: { mes: number | null; semestre: number | null }): string {
        if (periodo.mes) return MESES[periodo.mes];
        if (periodo.semestre) return `Semestre ${periodo.semestre}`;
        return "Ciclo completo";
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {programas.map((prog) => {
                const activeEntregas = prog.periodos.filter((p) => p.activo).flatMap((p) => p.entregas);
                const entregadosProg = activeEntregas.filter((e) => e.estado !== "NO_ENTREGADO").length;
                const totalProg = activeEntregas.length;
                const porc = totalProg > 0 ? Math.round((entregadosProg / totalProg) * 100) : 0;
                const isExpanded = expanded === prog.id;

                return (
                    <div key={prog.id} className="card" style={{ padding: 0 }}>
                        <button onClick={() => setExpanded(isExpanded ? null : prog.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{prog.nombre}</div>
                                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                        {entregadosProg}/{totalProg} recibidas • {prog.periodos.filter((p) => p.activo).length} periodo(s) activo(s)
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span style={{ fontWeight: 700, color: "var(--primary)" }}>{porc}%</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDownloadZip(prog); }}
                                        disabled={downloadingZip === prog.id}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", display: "flex", alignItems: "center", opacity: downloadingZip === prog.id ? 0.5 : 1 }}
                                        title="Descargar todos los archivos generados en este programa en formato ZIP"
                                    >
                                        <Download size={18} />
                                    </button>
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </div>
                            <div className="progress-bar" style={{ marginTop: "0.5rem" }}>
                                <div className="progress-fill" style={{ width: `${porc}%` }} />
                            </div>
                        </button>

                        {isExpanded && (
                            <div style={{ borderTop: "1px solid var(--border)" }}>
                                {prog.periodos.filter((p) => p.activo).map((periodo) => (
                                    <div key={periodo.id}>
                                        {prog.tipo !== "ANUAL" && (
                                            <div style={{ padding: "0.5rem 1rem", background: "var(--bg-secondary)", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
                                                onClick={() => setExpandedPeriodo(expandedPeriodo === periodo.id ? null : periodo.id)}
                                            >
                                                {getPeriodoLabel(periodo)} ({periodo.entregas.filter((e) => e.estado !== "NO_ENTREGADO").length}/{periodo.entregas.length} recibidas)
                                            </div>
                                        )}

                                        {(prog.tipo === "ANUAL" || expandedPeriodo === periodo.id) && (
                                            <div style={{ padding: "0 1rem 0.5rem" }}>
                                                {periodo.entregas.map((ent) => {
                                                    const color = ESTADO_COLORS[ent.estado] || "var(--text-muted)";
                                                    return (
                                                        <div key={ent.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", gap: "0.5rem", flexWrap: "wrap" }}>
                                                            <div style={{ fontSize: "0.875rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                                <div style={{ fontWeight: 500 }}>{ent.escuela.nombre}</div>
                                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                                    {ent.escuela.cct}
                                                                </div>
                                                                {ent.archivos.length > 0 && (
                                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                                        {ent.archivos.map((arch, index) => (
                                                                            <a
                                                                                key={arch.id}
                                                                                href={getDownloadUrl(arch.driveUrl, arch.nombre, arch.driveId) || "#"}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", padding: "0.15rem 0.4rem", borderRadius: "4px", color: "var(--text)", textDecoration: "none" }}
                                                                                title={`Descargar ${arch.nombre}`}
                                                                            >
                                                                                <Download size={12} /> {arch.etiqueta || `Archivo ${index + 1}`}
                                                                            </a>
                                                                        ))}
                                                                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "flex", alignItems: "center" }}>
                                                                            • Subido: {new Date(ent.archivos[0].createdAt!).toLocaleDateString("es-MX")}
                                                                        </span>
                                                                    </div>
                                                                )}
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
                                                                    onClick={() => onSetCorreccionModal({ entregaId: ent.id, escuelaNombre: ent.escuela.nombre, history: ent.correcciones })}
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
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
