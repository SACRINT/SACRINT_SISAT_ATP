"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ToggleLeft,
    ToggleRight,
    Loader2,
    Lightbulb,
    Users,
    School,
    Trash2,
    RefreshCw,
    Download,
} from "lucide-react";

interface AlumnoPAEC {
    nombre: string;
    grado: string;
    curp: string;
}

interface EscuelaPAEC {
    id: string;
    cct: string;
    nombre: string;
    nombreProyecto: string;
    problematicaEntorno: string;
    alumnos: AlumnoPAEC[];
    fecha: string;
}

export default function GestionEncuentroPAEC() {
    const [loading, setLoading] = useState(true);
    const [activo, setActivo] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [escuelas, setEscuelas] = useState<EscuelaPAEC[]>([]);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const fetchData = useCallback(async () => {
        try {
            const [configRes, inscRes] = await Promise.all([
                fetch("/api/admin/encuentro-paec-config"),
                fetch("/api/admin/encuentro-paec-inscripciones"),
            ]);
            const config = await configRes.json();
            setActivo(config.activo ?? false);

            if (inscRes.ok) {
                const inscData = await inscRes.json();
                setEscuelas(inscData);
            }
        } catch {
            setMessage({ type: "error", text: "Error al cargar datos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleToggle = async () => {
        setToggling(true);
        try {
            const res = await fetch("/api/admin/encuentro-paec-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !activo }),
            });
            if (res.ok) {
                setActivo(!activo);
                setMessage({ type: "success", text: `Encuentro PAEC 2026 ${!activo ? "activado" : "desactivado"}` });
            }
        } catch {
            setMessage({ type: "error", text: "Error al cambiar estado" });
        } finally {
            setToggling(false);
        }
    };

    const handleCancelInscripcion = async (escuelaId: string, nombre: string) => {
        if (!confirm(`¿Cancelar la inscripción de ${nombre}?`)) return;
        try {
            const res = await fetch(`/api/admin/encuentro-paec-inscripciones?escuelaId=${escuelaId}`, { method: "DELETE" });
            if (res.ok) {
                setEscuelas(escuelas.filter(e => e.id !== escuelaId));
                setMessage({ type: "success", text: `Inscripción de ${nombre} cancelada` });
            }
        } catch {
            setMessage({ type: "error", text: "Error al cancelar" });
        }
    };

    const handleExportCSV = async () => {
        try {
            const res = await fetch("/api/admin/encuentro-paec-inscripciones?format=csv");
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "encuentro_paec_2026.csv";
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch {
            setMessage({ type: "error", text: "Error al exportar" });
        }
    };

    const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "3rem" }}>
                <Loader2 size={32} className="spin" style={{ margin: "0 auto" }} />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
                    <Lightbulb size={24} /> Encuentro PAEC 2026
                </h2>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <button className="btn btn-outline" onClick={() => fetchData()} style={{ fontSize: "0.8125rem" }}>
                        <RefreshCw size={16} /> Actualizar
                    </button>
                    <button
                        onClick={handleToggle}
                        disabled={toggling}
                        style={{
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: "1rem", fontWeight: 600,
                            color: activo ? "var(--success)" : "var(--text-muted)",
                        }}
                    >
                        {toggling ? <Loader2 size={24} className="spin" /> : activo ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        {activo ? "Activo" : "Inactivo"}
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Stats */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", gap: "2rem" }}>
                    <div>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>{escuelas.length}</div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Proyectos Registrados</div>
                    </div>
                    <div>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: "#059669" }}>
                            {escuelas.reduce((sum, e) => sum + e.alumnos.length, 0)}
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Total Participantes</div>
                    </div>
                </div>
            </div>

            {escuelas.length > 0 && (
                <button className="btn btn-outline" onClick={handleExportCSV} style={{ marginBottom: "1rem", fontSize: "0.8125rem" }}>
                    <Download size={16} /> Exportar CSV
                </button>
            )}

            {/* Schools List */}
            {escuelas.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    <School size={32} style={{ margin: "0 auto 0.5rem" }} />
                    <p>No hay inscripciones registradas aún</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {escuelas.map((esc) => (
                        <div key={esc.id} className="card" style={{ padding: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ cursor: "pointer", flex: 1 }} onClick={() => toggleExpand(esc.id)}>
                                    <h4 style={{ margin: "0 0 0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <School size={16} /> {esc.nombre}
                                    </h4>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{esc.cct}</span>
                                    <div style={{ marginTop: "0.5rem" }}>
                                        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#059669" }}>
                                            📋 {esc.nombreProyecto}
                                        </div>
                                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                                            <Users size={14} style={{ verticalAlign: "middle" }} /> {esc.alumnos.length} participantes
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCancelInscripcion(esc.id, esc.nombre)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "0.25rem" }}
                                    title="Cancelar inscripción"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {expanded[esc.id] && (
                                <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                                    <div style={{ fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                                        <strong>Problemática del Entorno:</strong>
                                        <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                                            {esc.problematicaEntorno}
                                        </p>
                                    </div>
                                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                                        Equipo:
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                        {esc.alumnos.map((al, i) => (
                                            <div key={i} style={{
                                                fontSize: "0.8125rem", padding: "0.375rem 0.5rem",
                                                background: "var(--bg-secondary)", borderRadius: "6px",
                                                display: "grid", gridTemplateColumns: "1fr 0.3fr 1fr", gap: "0.5rem",
                                            }}>
                                                <span>{al.nombre}</span>
                                                <span style={{ color: "var(--text-muted)" }}>{al.grado}</span>
                                                <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{al.curp}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                                Registrado: {esc.fecha} • Click para {expanded[esc.id] ? "ocultar" : "ver"} detalles
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
