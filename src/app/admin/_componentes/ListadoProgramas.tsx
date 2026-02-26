"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, MessageSquare } from "lucide-react";
import { MESES, ESTADOS, ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";

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
                                                            <div style={{ fontSize: "0.875rem" }}>
                                                                <div style={{ fontWeight: 500 }}>{ent.escuela.nombre}</div>
                                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                                    {ent.escuela.cct} • {ent.archivos.length} archivo(s)
                                                                </div>
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
