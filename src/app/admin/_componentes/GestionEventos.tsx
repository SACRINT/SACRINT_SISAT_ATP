"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ToggleLeft,
    ToggleRight,
    Download,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Palette,
    Users,
    Trophy,
    RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────

interface Disciplina {
    id: string;
    nombre: string;
    tipo: string;
    minParticipantes: number;
    maxParticipantes: number;
    grupoExclusion: string | null;
    orden: number;
}

interface Categoria {
    id: string;
    nombre: string;
    color: string;
    orden: number;
    disciplinas: Disciplina[];
}

// ─── Component ───────────────────────────────────

export default function GestionEventos() {
    const [activo, setActivo] = useState(false);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [totalInscripciones, setTotalInscripciones] = useState(0);
    const [totalEscuelas, setTotalEscuelas] = useState(0);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/eventos-config");
            if (!res.ok) throw new Error("Error cargando configuración");
            const data = await res.json();
            setActivo(data.activo);
            setCategorias(data.categorias || []);
            setTotalInscripciones(data.totalInscripciones || 0);
            setTotalEscuelas(data.totalEscuelas || 0);
        } catch {
            setMessage({ type: "error", text: "Error al cargar configuración de eventos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    // ─── Toggle active state ─────────────────────

    async function handleToggle() {
        setToggling(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/eventos-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !activo }),
            });
            if (res.ok) {
                setActivo(!activo);
                setMessage({
                    type: "success",
                    text: !activo
                        ? "✅ Inscripciones a eventos ACTIVADAS. Los directores ya pueden registrar."
                        : "❌ Inscripciones a eventos DESACTIVADAS."
                });
            } else {
                setMessage({ type: "error", text: "Error al cambiar el estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setToggling(false);
        }
    }

    // ─── Download Excel ──────────────────────────

    async function handleDownloadExcel() {
        setDownloading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/exportar-excel-eventos");
            if (!res.ok) throw new Error("Error generando Excel");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Registro_Eventos_2026_${new Date().toISOString().split("T")[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setMessage({ type: "success", text: "Excel descargado exitosamente" });
        } catch {
            setMessage({ type: "error", text: "Error al descargar el Excel" });
        } finally {
            setDownloading(false);
        }
    }

    const totalDisciplinas = categorias.reduce((sum, c) => sum + c.disciplinas.length, 0);
    const pctInscripciones = totalEscuelas > 0
        ? Math.round((totalInscripciones / totalEscuelas) * 100) : 0;

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Trophy size={24} /> Eventos Culturales PAEC 2026
                    </h2>
                    <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                        Gestión de inscripciones a eventos culturales
                    </p>
                </div>
                <button
                    className="btn btn-outline"
                    onClick={() => { setLoading(true); fetchConfig(); }}
                    style={{ fontSize: "0.8125rem", display: "flex", gap: "0.4rem", alignItems: "center" }}
                >
                    <RefreshCw size={16} /> Actualizar
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Toggle + Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                {/* Toggle Card */}
                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                        Estado del Programa
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={toggling}
                        style={{
                            background: "none", border: "none", cursor: toggling ? "wait" : "pointer",
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            transition: "transform 0.2s",
                        }}
                    >
                        {activo ? (
                            <ToggleRight size={48} style={{ color: "var(--success)" }} />
                        ) : (
                            <ToggleLeft size={48} style={{ color: "var(--text-muted)" }} />
                        )}
                    </button>
                    <div style={{
                        marginTop: "0.5rem", fontSize: "0.875rem", fontWeight: 700,
                        color: activo ? "var(--success)" : "var(--text-muted)",
                    }}>
                        {activo ? "ACTIVO" : "INACTIVO"}
                    </div>
                </div>

                {/* Inscriptions Count */}
                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                        Escuelas Inscritas
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>
                        {totalInscripciones}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        de {totalEscuelas} escuelas ({pctInscripciones}%)
                    </div>
                    <div style={{
                        width: "100%", height: "6px", background: "var(--border)", borderRadius: "3px", marginTop: "0.5rem",
                    }}>
                        <div style={{
                            width: `${pctInscripciones}%`, height: "100%", background: "var(--primary)", borderRadius: "3px", transition: "width 0.3s",
                        }} />
                    </div>
                </div>

                {/* Disciplines Count */}
                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                        Catálogo
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>
                        {totalDisciplinas}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        disciplinas en {categorias.length} categorías
                    </div>
                </div>
            </div>

            {/* Download Excel */}
            <div className="card" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Exportar Registro de Eventos</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Descarga el Excel con todas las inscripciones de las escuelas
                        </div>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleDownloadExcel}
                        disabled={downloading}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}
                    >
                        {downloading ? (
                            <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generando...</>
                        ) : (
                            <><Download size={16} /> Descargar Excel</>
                        )}
                    </button>
                </div>
            </div>

            {/* Categories Overview */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{
                    padding: "1rem 1.25rem",
                    background: "linear-gradient(135deg, #1f4e78 0%, #2e75b6 100%)",
                    color: "white",
                }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                        <Palette size={16} style={{ display: "inline", marginRight: "0.4rem", verticalAlign: "text-bottom" }} />
                        Catálogo de Disciplinas
                    </div>
                </div>

                {categorias.map(cat => (
                    <div key={cat.id}>
                        <div style={{
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            padding: "0.75rem 1.25rem",
                            background: `${cat.color}12`,
                            borderBottom: "1px solid var(--border)",
                        }}>
                            <div style={{
                                width: "10px", height: "10px", borderRadius: "50%",
                                background: cat.color, flexShrink: 0,
                            }} />
                            <span style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{cat.nombre}</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                                {cat.disciplinas.length} disciplinas
                            </span>
                        </div>
                        {cat.disciplinas.map(disc => (
                            <div key={disc.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "0.5rem 1.25rem 0.5rem 2.5rem",
                                borderBottom: "1px solid var(--border)",
                                fontSize: "0.8125rem",
                            }}>
                                <span>{disc.nombre}</span>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.75rem" }}>
                                    <span style={{
                                        padding: "0.15rem 0.5rem", borderRadius: "4px",
                                        background: disc.tipo === "simple" ? "#e8f5e9" : disc.tipo === "grupo" ? "#e3f2fd" : disc.tipo === "individual" ? "#fff3e0" : "#fce4ec",
                                        fontSize: "0.6875rem", fontWeight: 600,
                                    }}>
                                        {disc.tipo}
                                    </span>
                                    <span>
                                        <Users size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: "0.2rem" }} />
                                        {disc.minParticipantes === disc.maxParticipantes
                                            ? disc.minParticipantes
                                            : `${disc.minParticipantes}-${disc.maxParticipantes}`
                                        }
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Spin animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
