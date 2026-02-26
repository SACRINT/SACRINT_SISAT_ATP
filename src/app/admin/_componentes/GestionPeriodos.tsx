"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { MESES } from "@/lib/constants";
import { ProgramaAdmin } from "@/types";

interface GestionPeriodosProps {
    programas: ProgramaAdmin[];
}

export default function GestionPeriodos({ programas }: GestionPeriodosProps) {
    const router = useRouter();
    const [togglingPeriodo, setTogglingPeriodo] = useState<string | null>(null);

    async function handleTogglePeriodo(periodoId: string, activo: boolean) {
        setTogglingPeriodo(periodoId);
        try {
            const res = await fetch(`/api/periodos/${periodoId}/activar`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                console.error("Error al actualizar estado del periodo");
            }
        } catch (error) {
            console.error("Error de conexión", error);
        } finally {
            setTogglingPeriodo(null);
        }
    }

    function getPeriodoLabel(periodo: { mes: number | null; semestre: number | null }): string {
        if (periodo.mes) return MESES[periodo.mes];
        if (periodo.semestre) return `Semestre ${periodo.semestre}`;
        return "Ciclo completo";
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c5a8e" }}>
                    <strong>Gestión de Periodos</strong> — Activa o desactiva los meses en los que requieres entregas.
                    Los periodos desactivados no aparecerán en el portal del director.
                </p>
            </div>

            {programas.map((prog) => (
                <div key={prog.id} className="card" style={{ padding: 0 }}>
                    <div style={{ padding: "1rem", fontWeight: 700 }}>{prog.nombre}</div>
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                        {prog.periodos.map((periodo) => (
                            <div key={periodo.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)",
                            }}>
                                <span style={{ fontWeight: 500 }}>{getPeriodoLabel(periodo)}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        {periodo.entregas.filter((e) => e.estado !== "NO_ENTREGADO").length}/{periodo.entregas.length}
                                    </span>
                                    <button
                                        onClick={() => handleTogglePeriodo(periodo.id, !periodo.activo)}
                                        disabled={togglingPeriodo === periodo.id}
                                        style={{
                                            background: "none", border: "none", cursor: "pointer",
                                            color: periodo.activo ? "var(--success)" : "var(--text-muted)",
                                        }}
                                        title={periodo.activo ? "Desactivar" : "Activar"}
                                    >
                                        {periodo.activo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
