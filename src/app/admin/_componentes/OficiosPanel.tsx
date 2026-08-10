"use strict";
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    FileText,
    Plus,
    Search,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Clock,
    Upload,
    Bot,
    Eye,
    ChevronLeft,
    ChevronRight,
    Sliders,
    Building2,
    Check,
    XCircle,
    Settings,
    Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

// ── Tipos y Formateadores ───────────────────────────────────────────────────

interface OficioDestinatario {
    id: string;
    escuelaId: string;
    escuelaNombre: string;
    emailDestino: string | null;
    acuseRecibido: boolean;
    fechaAcuse: string | null;
}

interface Oficio {
    id: string;
    numeroOficio: string;
    asunto: string;
    remitenteNombre: string | null;
    remitenteEmail: string | null;
    fechaLimite: string | null;
    criticidad: "ROJO" | "AMARILLO" | "VERDE";
    estado: "RECIBIDO" | "ENVIADO" | "ACUSADO" | "VENCIDO" | "CANCELADO";
    adjuntoOficio: string | null;
    iaProcessed: boolean;
    notas: string | null;
    createdAt: string;
    destinatarios?: OficioDestinatario[];
    _count?: { destinatarios: number };
}

interface OficioConfig {
    umbralRojoHoras: number;
    umbralAmarilloHoras: number;
    recordatorios48h: boolean;
    recordatorios12h: boolean;
    horaIngesta: string | null;
    cuentaRemitente: string | null;
}

const CRITICIDAD_STYLES: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
    ROJO: { label: "Urgente (<24h)", bg: "#fef2f2", text: "#991b1b", border: "#fecaca", dot: "#ef4444" },
    AMARILLO: { label: "Próximo (<72h)", bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b" },
    VERDE: { label: "En tiempo", bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", dot: "#10b981" },
};

const ESTADO_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
    RECIBIDO: { label: "Recibido", bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
    ENVIADO: { label: "Enviado", bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    ACUSADO: { label: "Acusado", bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
    VENCIDO: { label: "Vencido", bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
    CANCELADO: { label: "Cancelado", bg: "#f8fafc", text: "#64748b", border: "#cbd5e1" },
};

function diasRestantes(fechaLimite: string | null): string {
    if (!fechaLimite) return "Sin fecha límite";
    const limite = new Date(fechaLimite).getTime();
    const ahora = Date.now();
    const diff = limite - ahora;
    if (diff < 0) return "Vencido";
    const horas = Math.floor(diff / (1000 * 60 * 60));
    if (horas < 24) return `${horas}h restantes`;
    const dias = Math.floor(horas / 24);
    return `${dias} día${dias !== 1 ? "s" : ""}`;
}

// ── Componente Principal ──────────────────────────────────────────────────────

export default function OficiosPanel() {
    const { data: session } = useSession() || {};
    const [tab, setTab] = useState<"lista" | "nuevo" | "config">("lista");
    const [oficios, setOficios] = useState<Oficio[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<OficioConfig | null>(null);

    // Filtros
    const [filtroEstado, setFiltroEstado] = useState("");
    const [filtroCriticidad, setFiltroCriticidad] = useState("");
    const [busqueda, setBusqueda] = useState("");

    // Detalle
    const [detalle, setDetalle] = useState<Oficio | null>(null);

    // Cargar oficios
    const cargarOficios = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "20",
                ...(filtroEstado ? { estado: filtroEstado } : {}),
                ...(filtroCriticidad ? { criticidad: filtroCriticidad } : {}),
                ...(busqueda ? { q: busqueda } : {}),
            });
            const res = await fetch(`/api/admin/oficios?${params}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setOficios(data.oficios || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            if (data.config) setConfig(data.config);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al cargar oficios");
        } finally {
            setLoading(false);
        }
    }, [page, filtroEstado, filtroCriticidad, busqueda]);

    useEffect(() => {
        cargarOficios();
    }, [cargarOficios]);

    const abrirDetalle = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/oficios/${id}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setDetalle(data.oficio);
        } catch {
            toast.error("Error al cargar detalle");
        }
    };

    const registrarAcuse = async (oficioId: string, destinatarioId: string) => {
        try {
            const res = await fetch(`/api/admin/oficios/${oficioId}/acusar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ destinatarioId }),
            });
            if (!res.ok) throw new Error();
            toast.success("Acuse registrado correctamente");
            await abrirDetalle(oficioId);
            cargarOficios();
        } catch {
            toast.error("Error al registrar acuse");
        }
    };

    // Resumen estadístico rápido
    const urgentes = oficios.filter((o) => o.criticidad === "ROJO" && o.estado !== "CANCELADO").length;
    const proximos = oficios.filter((o) => o.criticidad === "AMARILLO" && o.estado !== "CANCELADO").length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="fade-in">
            {/* Header Banner - Estilo Dark Premium Coincidente */}
            <div style={{
                background: "linear-gradient(135deg, #0f172a, #1e293b)",
                borderRadius: "16px",
                padding: "1.5rem 1.75rem",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1.25rem"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
                        flexShrink: 0
                    }}>
                        <FileText size={26} />
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "white", margin: 0 }}>
                                Gestión Central de Oficios, Circulares y Plazos Urgentes
                            </h2>
                            <span style={{
                                fontSize: "0.6875rem",
                                padding: "0.2rem 0.6rem",
                                borderRadius: "20px",
                                background: "rgba(99, 102, 241, 0.2)",
                                color: "#c7d2fe",
                                fontWeight: 700,
                                border: "1px solid rgba(99, 102, 241, 0.3)"
                            }}>
                                ATP-MOD-01
                            </span>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: "0.8125rem", margin: "0.25rem 0 0" }}>
                            Recepción, extracción OCR con IA (Gemini), semaforización de vencimiento y seguimiento automatizado de acuses.
                        </p>
                    </div>
                </div>

                {/* Resumen Semáforo Badge */}
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {urgentes > 0 && (
                        <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.4rem 0.85rem",
                            borderRadius: "20px",
                            background: "rgba(239, 68, 68, 0.2)",
                            color: "#fca5a5",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            border: "1px solid rgba(239, 68, 68, 0.3)"
                        }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                            {urgentes} urgente{urgentes !== 1 ? "s" : ""}
                        </span>
                    )}
                    {proximos > 0 && (
                        <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.4rem 0.85rem",
                            borderRadius: "20px",
                            background: "rgba(245, 158, 11, 0.2)",
                            color: "#fcd34d",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            border: "1px solid rgba(245, 158, 11, 0.3)"
                        }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                            {proximos} próximo{proximos !== 1 ? "s" : ""}
                        </span>
                    )}
                    <span style={{
                        fontSize: "0.8125rem",
                        color: "#94a3b8",
                        fontWeight: 600,
                        background: "rgba(255, 255, 255, 0.05)",
                        padding: "0.4rem 0.85rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.1)"
                    }}>
                        Total: <strong style={{ color: "white" }}>{total}</strong>
                    </span>
                </div>
            </div>

            {/* Tab Navigation Pill Control */}
            <div style={{
                display: "flex",
                gap: "0.375rem",
                background: "#e2e8f0",
                padding: "0.375rem",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                width: "fit-content"
            }}>
                <button
                    onClick={() => setTab("lista")}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1.125rem",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: tab === "lista" ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "transparent",
                        color: tab === "lista" ? "white" : "#475569",
                        boxShadow: tab === "lista" ? "0 3px 8px rgba(37, 99, 235, 0.3)" : "none",
                        transition: "all 0.2s ease"
                    }}
                >
                    <FileText size={15} />
                    <span>Listado de Oficios</span>
                </button>

                <button
                    onClick={() => setTab("nuevo")}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1.125rem",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: tab === "nuevo" ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "transparent",
                        color: tab === "nuevo" ? "white" : "#475569",
                        boxShadow: tab === "nuevo" ? "0 3px 8px rgba(37, 99, 235, 0.3)" : "none",
                        transition: "all 0.2s ease"
                    }}
                >
                    <Plus size={15} />
                    <span>Registrar Oficio</span>
                </button>

                <button
                    onClick={() => setTab("config")}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1.125rem",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: tab === "config" ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "transparent",
                        color: tab === "config" ? "white" : "#475569",
                        boxShadow: tab === "config" ? "0 3px 8px rgba(37, 99, 235, 0.3)" : "none",
                        transition: "all 0.2s ease"
                    }}
                >
                    <Sliders size={15} />
                    <span>Configuración</span>
                </button>
            </div>

            {/* ════════════ TAB 1: LISTADO ════════════ */}
            {tab === "lista" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {/* Controls & Search Filter Bar */}
                    <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        alignItems: "center"
                    }}>
                        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
                            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }} />
                            <input
                                type="text"
                                placeholder="Buscar por número, asunto o remitente..."
                                value={busqueda}
                                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
                                style={{
                                    width: "100%",
                                    padding: "0.625rem 1rem 0.625rem 2.5rem",
                                    borderRadius: "10px",
                                    border: "1px solid #cbd5e1",
                                    background: "white",
                                    fontSize: "0.875rem",
                                    color: "#0f172a",
                                    outline: "none",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                                }}
                            />
                        </div>

                        <select
                            value={filtroEstado}
                            onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}
                            style={{
                                padding: "0.625rem 1rem",
                                borderRadius: "10px",
                                border: "1px solid #cbd5e1",
                                background: "white",
                                fontSize: "0.875rem",
                                color: "#0f172a",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            <option value="">Todos los estados</option>
                            <option value="RECIBIDO">Recibido</option>
                            <option value="ENVIADO">Enviado</option>
                            <option value="ACUSADO">Acusado</option>
                            <option value="VENCIDO">Vencido</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>

                        <select
                            value={filtroCriticidad}
                            onChange={(e) => { setFiltroCriticidad(e.target.value); setPage(1); }}
                            style={{
                                padding: "0.625rem 1rem",
                                borderRadius: "10px",
                                border: "1px solid #cbd5e1",
                                background: "white",
                                fontSize: "0.875rem",
                                color: "#0f172a",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            <option value="">Toda criticidad</option>
                            <option value="ROJO">🔴 Urgente (&lt;24h)</option>
                            <option value="AMARILLO">🟡 Próximo (&lt;72h)</option>
                            <option value="VERDE">🟢 En tiempo</option>
                        </select>

                        <button
                            onClick={cargarOficios}
                            disabled={loading}
                            style={{
                                padding: "0.625rem 0.875rem",
                                borderRadius: "10px",
                                border: "1px solid #cbd5e1",
                                background: "white",
                                color: "#475569",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontSize: "0.8125rem",
                                fontWeight: 600
                            }}
                        >
                            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                            <span>Actualizar</span>
                        </button>
                    </div>

                    {/* Table Container Card */}
                    <div style={{
                        background: "white",
                        borderRadius: "16px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                        overflow: "hidden"
                    }}>
                        {loading ? (
                            <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748b" }}>
                                <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: "#2563eb", margin: "0 auto 1rem" }} />
                                <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1e293b", margin: 0 }}>
                                    Cargando listado de oficios...
                                </p>
                            </div>
                        ) : oficios.length === 0 ? (
                            <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                                <div style={{
                                    width: "64px",
                                    height: "64px",
                                    borderRadius: "50%",
                                    background: "#eff6ff",
                                    color: "#2563eb",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 1.25rem",
                                    border: "1px solid #bfdbfe"
                                }}>
                                    <FileText size={32} />
                                </div>
                                <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.5rem" }}>
                                    No hay oficios registrados
                                </h3>
                                <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.25rem" }}>
                                    Registra el primer oficio escaneado o circular para iniciar el seguimiento.
                                </p>
                                <button
                                    onClick={() => setTab("nuevo")}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        padding: "0.625rem 1.25rem",
                                        borderRadius: "10px",
                                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                                        color: "white",
                                        fontSize: "0.875rem",
                                        fontWeight: 700,
                                        border: "none",
                                        cursor: "pointer",
                                        boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)"
                                    }}
                                >
                                    <Plus size={16} />
                                    <span>Registrar Primer Oficio</span>
                                </button>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                                    <thead>
                                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                            <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Semáforo</th>
                                            <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Número / Asunto</th>
                                            <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Remitente</th>
                                            <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Plazo Límite</th>
                                            <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Estado</th>
                                            <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Escuelas</th>
                                            <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", textAlign: "right" }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {oficios.map((oficio) => {
                                            const crit = CRITICIDAD_STYLES[oficio.criticidad];
                                            const est = ESTADO_STYLES[oficio.estado];
                                            return (
                                                <tr key={oficio.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s ease" }}>
                                                    {/* Semáforo */}
                                                    <td style={{ padding: "1rem 1.25rem" }}>
                                                        <span style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "0.35rem",
                                                            padding: "0.25rem 0.65rem",
                                                            borderRadius: "20px",
                                                            fontSize: "0.75rem",
                                                            fontWeight: 700,
                                                            background: crit.bg,
                                                            color: crit.text,
                                                            border: `1px solid ${crit.border}`
                                                        }}>
                                                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: crit.dot }} />
                                                            {crit.label}
                                                        </span>
                                                    </td>

                                                    {/* Número / Asunto */}
                                                    <td style={{ padding: "1rem 1.25rem" }}>
                                                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.875rem" }}>{oficio.numeroOficio}</div>
                                                        <div style={{ color: "#64748b", fontSize: "0.75rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "260px" }}>
                                                            {oficio.asunto}
                                                        </div>
                                                        {oficio.iaProcessed && (
                                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", color: "#4f46e5", fontWeight: 700, marginTop: "0.2rem" }}>
                                                                <Bot size={12} /> OCR IA
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Remitente */}
                                                    <td style={{ padding: "1rem 1.25rem", color: "#475569", fontSize: "0.75rem" }}>
                                                        {oficio.remitenteNombre || oficio.remitenteEmail || "—"}
                                                    </td>

                                                    {/* Plazo Límite */}
                                                    <td style={{ padding: "1rem 1.25rem" }}>
                                                        {oficio.fechaLimite ? (
                                                            <div>
                                                                <div style={{ color: "#1e293b", fontSize: "0.75rem", fontWeight: 600 }}>
                                                                    {new Date(oficio.fechaLimite).toLocaleDateString("es-MX")}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: "0.75rem",
                                                                    fontWeight: 700,
                                                                    color: oficio.criticidad === "ROJO" ? "#dc2626" : oficio.criticidad === "AMARILLO" ? "#d97706" : "#059669"
                                                                }}>
                                                                    {diasRestantes(oficio.fechaLimite)}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Sin plazo</span>
                                                        )}
                                                    </td>

                                                    {/* Estado */}
                                                    <td style={{ padding: "1rem 1.25rem" }}>
                                                        <span style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "0.35rem",
                                                            padding: "0.25rem 0.65rem",
                                                            borderRadius: "20px",
                                                            fontSize: "0.75rem",
                                                            fontWeight: 700,
                                                            background: est.bg,
                                                            color: est.text,
                                                            border: `1px solid ${est.border}`
                                                        }}>
                                                            {est.label}
                                                        </span>
                                                    </td>

                                                    {/* Destinatarios */}
                                                    <td style={{ padding: "1rem 1.25rem", color: "#64748b", fontSize: "0.75rem" }}>
                                                        {oficio._count?.destinatarios ?? 0} dest.
                                                    </td>

                                                    {/* Botón Ver */}
                                                    <td style={{ padding: "1rem 1.25rem", textAlign: "right" }}>
                                                        <button
                                                            onClick={() => abrirDetalle(oficio.id)}
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "0.35rem",
                                                                background: "#f8fafc",
                                                                color: "#334155",
                                                                border: "1px solid #cbd5e1",
                                                                padding: "0.4rem 0.85rem",
                                                                borderRadius: "8px",
                                                                fontSize: "0.75rem",
                                                                fontWeight: 700,
                                                                cursor: "pointer",
                                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                                            }}
                                                        >
                                                            <Eye size={14} color="#64748b" />
                                                            <span>Ver Detalle</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Paginación */}
                        {totalPages > 1 && (
                            <div style={{
                                padding: "0.875rem 1.25rem",
                                background: "#f8fafc",
                                borderTop: "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifySpaceBetween: "space-between",
                                fontSize: "0.8125rem",
                                color: "#475569",
                                fontWeight: 600
                            }}>
                                <span>Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}</span>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage((p) => p - 1)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.25rem",
                                            padding: "0.4rem 0.85rem",
                                            borderRadius: "8px",
                                            background: "white",
                                            border: "1px solid #cbd5e1",
                                            color: "#334155",
                                            fontWeight: 700,
                                            cursor: page === 1 ? "not-allowed" : "pointer",
                                            opacity: page === 1 ? 0.5 : 1
                                        }}
                                    >
                                        <ChevronLeft size={16} />
                                        Anterior
                                    </button>
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.25rem",
                                            padding: "0.4rem 0.85rem",
                                            borderRadius: "8px",
                                            background: "white",
                                            border: "1px solid #cbd5e1",
                                            color: "#334155",
                                            fontWeight: 700,
                                            cursor: page === totalPages ? "not-allowed" : "pointer",
                                            opacity: page === totalPages ? 0.5 : 1
                                        }}
                                    >
                                        Siguiente
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════ TAB 2: REGISTRAR OFICIO ════════════ */}
            {tab === "nuevo" && (
                <RegistrarOficioPanel onSuccess={() => { setTab("lista"); cargarOficios(); }} />
            )}

            {/* ════════════ TAB 3: CONFIGURACIÓN ════════════ */}
            {tab === "config" && (
                <ConfigOficiosPanel initialConfig={config} onSaved={() => cargarOficios()} />
            )}

            {/* Modal de Detalle */}
            {detalle && (
                <DetalleOficioModal
                    oficio={detalle}
                    onClose={() => setDetalle(null)}
                    onAcuse={registrarAcuse}
                    onRefresh={() => { cargarOficios(); if (detalle) abrirDetalle(detalle.id); }}
                />
            )}
        </div>
    );
}

// ── Auxiliar: Compresión Imagen Cliente ─────────────────────────────────────

async function comprimirImagenCliente(file: File): Promise<{ file: File; comprimido: boolean; origMb: string; nuevoMb: string }> {
    const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|tiff|heic)$/i.test(file.name);
    const LIMIT_3MB = 3 * 1024 * 1024;

    if (!isImage || file.size <= LIMIT_3MB) {
        return { file, comprimido: false, origMb: "", nuevoMb: "" };
    }

    const origMb = (file.size / (1024 * 1024)).toFixed(2);

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;
                const maxDim = 2048;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
                            return;
                        }
                        const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
                        const compressedFile = new File([blob], newName, {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        });
                        const nuevoMb = (compressedFile.size / (1024 * 1024)).toFixed(2);
                        resolve({ file: compressedFile, comprimido: true, origMb, nuevoMb });
                    },
                    "image/jpeg",
                    0.8
                );
            };
            img.onerror = () => resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
            img.src = e.target?.result as string;
        };
        reader.onerror = () => resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
        reader.readAsDataURL(file);
    });
}

// ── Sub-componente: Registrar Oficio ─────────────────────────────────────────

function RegistrarOficioPanel({ onSuccess }: { onSuccess: () => void }) {
    const [modo, setModo] = useState<"archivo" | "manual">("archivo");
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const [numeroOficio, setNumeroOficio] = useState("");
    const [asunto, setAsunto] = useState("");
    const [fechaLimite, setFechaLimite] = useState("");
    const [remitente, setRemitente] = useState("");
    const [notas, setNotas] = useState("");
    const [usarIA, setUsarIA] = useState(true);
    const [archivo, setArchivo] = useState<File | null>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (modo === "archivo" && !archivo) {
            toast.error("Selecciona un archivo PDF o imagen");
            return;
        }
        if (!numeroOficio.trim()) { toast.error("Número de oficio requerido"); return; }

        setUploading(true);
        try {
            let res: Response;
            if (modo === "archivo" && archivo) {
                let archivoSubir = archivo;
                if (archivo.size > 3 * 1024 * 1024 && (archivo.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|tiff|heic)$/i.test(archivo.name))) {
                    toast(`Optimizando imagen (${(archivo.size / (1024 * 1024)).toFixed(2)} MB)...`);
                    const resComp = await comprimirImagenCliente(archivo);
                    if (resComp.comprimido) {
                        archivoSubir = resComp.file;
                        toast.success(`Imagen comprimida a ${resComp.nuevoMb} MB`);
                    }
                }

                const fd = new FormData();
                fd.append("archivo", archivoSubir);
                fd.append("numeroOficio", numeroOficio.trim());
                if (asunto) fd.append("asunto", asunto);
                if (fechaLimite) fd.append("fechaLimite", fechaLimite);
                fd.append("usarIA", String(usarIA));
                res = await fetch("/api/admin/oficios/upload", { method: "POST", body: fd });
            } else {
                if (!asunto.trim()) { toast.error("Asunto requerido"); setUploading(false); return; }
                res = await fetch("/api/admin/oficios", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        numeroOficio: numeroOficio.trim(),
                        asunto: asunto.trim(),
                        remitenteNombre: remitente.trim() || undefined,
                        fechaLimite: fechaLimite || undefined,
                        notas: notas.trim() || undefined,
                        esRecibido: true,
                    }),
                });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al registrar");

            toast.success(`Oficio ${numeroOficio} registrado correctamente`);
            onSuccess();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al registrar oficio");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{
            background: "white",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "1.75rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            maxWidth: "700px",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem"
        }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Plus size={20} color="#2563eb" />
                Registrar Nuevo Oficio o Circular
            </h3>

            {/* Mode Selection Buttons */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                    type="button"
                    onClick={() => setModo("archivo")}
                    style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "1px solid",
                        cursor: "pointer",
                        background: modo === "archivo" ? "#eff6ff" : "white",
                        borderColor: modo === "archivo" ? "#2563eb" : "#cbd5e1",
                        color: modo === "archivo" ? "#1d4ed8" : "#475569"
                    }}
                >
                    Subir PDF / Imagen (Con OCR IA)
                </button>
                <button
                    type="button"
                    onClick={() => setModo("manual")}
                    style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "1px solid",
                        cursor: "pointer",
                        background: modo === "manual" ? "#eff6ff" : "white",
                        borderColor: modo === "manual" ? "#2563eb" : "#cbd5e1",
                        color: modo === "manual" ? "#1d4ed8" : "#475569"
                    }}
                >
                    Registro Manual
                </button>
            </div>

            <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.35rem" }}>
                        Número de oficio *
                    </label>
                    <input
                        type="text"
                        value={numeroOficio}
                        onChange={(e) => setNumeroOficio(e.target.value)}
                        placeholder="Ej. SEPPUE/DGEMS/ATP/0123/2025"
                        style={{
                            width: "100%",
                            padding: "0.625rem 0.875rem",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.875rem",
                            color: "#0f172a",
                            outline: "none"
                        }}
                        required
                    />
                </div>

                {modo === "archivo" && (
                    <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.35rem" }}>
                            Archivo de Expediente *
                        </label>
                        <div
                            onClick={() => fileRef.current?.click()}
                            style={{
                                border: "2px dashed #94a3b8",
                                borderRadius: "12px",
                                padding: "2rem 1.5rem",
                                background: "#f8fafc",
                                textAlign: "center",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                        >
                            {archivo ? (
                                <p style={{ color: "#059669", fontWeight: 700, fontSize: "0.875rem", margin: 0 }}>
                                    ✓ {archivo.name} ({(archivo.size / (1024 * 1024)).toFixed(2)} MB)
                                </p>
                            ) : (
                                <>
                                    <Upload size={32} color="#94a3b8" style={{ margin: "0 auto 0.5rem" }} />
                                    <p style={{ color: "#1e293b", fontSize: "0.875rem", fontWeight: 600, margin: 0 }}>
                                        Haz clic para seleccionar o arrastra tu archivo aquí
                                    </p>
                                    <p style={{ color: "#64748b", fontSize: "0.75rem", margin: "0.25rem 0 0" }}>
                                        Formatos admitidos: PDF, JPG, PNG, TIFF, HEIC (hasta 25 MB)
                                    </p>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.tiff,.heic"
                            style={{ display: "none" }}
                            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                        />

                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.625rem", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={usarIA}
                                onChange={(e) => setUsarIA(e.target.checked)}
                                style={{ accentColor: "#2563eb", width: "16px", height: "16px" }}
                            />
                            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                <Bot size={14} color="#2563eb" />
                                Extraer metadatos automáticamente con IA Gemini (asunto, remitente y plazos)
                            </span>
                        </label>
                    </div>
                )}

                <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.35rem" }}>
                        Asunto {modo === "manual" ? "*" : "(opcional, IA lo detectará de forma automática)"}
                    </label>
                    <input
                        type="text"
                        value={asunto}
                        onChange={(e) => setAsunto(e.target.value)}
                        placeholder="Asunto principal del documento..."
                        style={{
                            width: "100%",
                            padding: "0.625rem 0.875rem",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.875rem",
                            color: "#0f172a",
                            outline: "none"
                        }}
                        required={modo === "manual"}
                    />
                </div>

                {modo === "manual" && (
                    <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.35rem" }}>
                            Remitente
                        </label>
                        <input
                            type="text"
                            value={remitente}
                            onChange={(e) => setRemitente(e.target.value)}
                            placeholder="Nombre de la dependencia o firmante..."
                            style={{
                                width: "100%",
                                padding: "0.625rem 0.875rem",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.875rem",
                                color: "#0f172a",
                                outline: "none"
                            }}
                        />
                    </div>
                )}

                <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.35rem" }}>
                        Fecha límite (opcional)
                    </label>
                    <input
                        type="date"
                        value={fechaLimite}
                        onChange={(e) => setFechaLimite(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "0.625rem 0.875rem",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.875rem",
                            color: "#0f172a",
                            outline: "none"
                        }}
                    />
                </div>

                <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.35rem" }}>
                        Notas u Observaciones
                    </label>
                    <textarea
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        rows={2}
                        placeholder="Indicaciones para supervisores y directores..."
                        style={{
                            width: "100%",
                            padding: "0.625rem 0.875rem",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.875rem",
                            color: "#0f172a",
                            outline: "none",
                            resize: "none"
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={uploading}
                    style={{
                        padding: "0.75rem 1.5rem",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "white",
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: uploading ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        marginTop: "0.5rem"
                    }}
                >
                    {uploading ? (
                        <>
                            <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                            <span>Procesando OCR e Ingesta...</span>
                        </>
                    ) : (
                        <>
                            <Check size={16} />
                            <span>Registrar y Guardar Oficio</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}

// ── Sub-componente: Detalle Modal ────────────────────────────────────────────

function DetalleOficioModal({
    oficio,
    onClose,
    onAcuse,
}: {
    oficio: Oficio;
    onClose: () => void;
    onAcuse: (oficioId: string, destinatarioId: string) => void;
    onRefresh: () => void;
}) {
    const crit = CRITICIDAD_STYLES[oficio.criticidad];
    const est = ESTADO_STYLES[oficio.estado];

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
        }}>
            <div style={{
                background: "white",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                maxWidth: "750px",
                width: "100%",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                maxHeight: "85vh",
                overflowY: "auto"
            }}>
                {/* Modal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                    <div>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                            {oficio.numeroOficio}
                        </h3>
                        <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0.2rem 0 0" }}>
                            {oficio.asunto}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "#f1f5f9",
                            border: "none",
                            borderRadius: "8px",
                            padding: "0.4rem",
                            cursor: "pointer",
                            color: "#64748b"
                        }}
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                {/* Badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.3rem 0.75rem",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: crit.bg,
                        color: crit.text,
                        border: `1px solid ${crit.border}`
                    }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: crit.dot }} />
                        {crit.label}
                    </span>
                    <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.3rem 0.75rem",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: est.bg,
                        color: est.text,
                        border: `1px solid ${est.border}`
                    }}>
                        {est.label}
                    </span>
                    {oficio.iaProcessed && (
                        <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.3rem 0.75rem",
                            borderRadius: "20px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe"
                        }}>
                            <Bot size={14} /> Metadatos procesados por IA
                        </span>
                    )}
                </div>

                {/* Details Data Box */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                    {oficio.remitenteNombre && (
                        <div style={{ background: "#f8fafc", padding: "0.875rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Remitente</div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a", marginTop: "0.2rem" }}>{oficio.remitenteNombre}</div>
                            {oficio.remitenteEmail && <div style={{ fontSize: "0.75rem", color: "#475569" }}>{oficio.remitenteEmail}</div>}
                        </div>
                    )}
                    {oficio.fechaLimite && (
                        <div style={{ background: "#f8fafc", padding: "0.875rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Fecha límite</div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a", marginTop: "0.2rem" }}>
                                {new Date(oficio.fechaLimite).toLocaleDateString("es-MX", { dateStyle: "long" })}
                            </div>
                            <div style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: oficio.criticidad === "ROJO" ? "#dc2626" : oficio.criticidad === "AMARILLO" ? "#d97706" : "#059669"
                            }}>
                                {diasRestantes(oficio.fechaLimite)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Destinatarios */}
                {oficio.destinatarios && oficio.destinatarios.length > 0 && (
                    <div>
                        <h4 style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Building2 size={16} color="#2563eb" />
                            Escuelas Destinatarias ({oficio.destinatarios.length})
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {oficio.destinatarios.map((dest) => (
                                <div
                                    key={dest.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        background: "#f8fafc",
                                        padding: "0.75rem 1rem",
                                        borderRadius: "10px",
                                        border: "1px solid #e2e8f0"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.875rem" }}>{dest.escuelaNombre}</div>
                                        {dest.emailDestino && <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{dest.emailDestino}</div>}
                                    </div>
                                    <div>
                                        {dest.acuseRecibido ? (
                                            <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <CheckCircle size={14} /> Acusado
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => onAcuse(oficio.id, dest.id)}
                                                style={{
                                                    padding: "0.35rem 0.75rem",
                                                    borderRadius: "6px",
                                                    background: "#ecfdf5",
                                                    color: "#059669",
                                                    border: "1px solid #a7f3d0",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 700,
                                                    cursor: "pointer"
                                                }}
                                            >
                                                Registrar acuse
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: "0.5rem 1.25rem",
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            color: "#334155",
                            background: "#f1f5f9",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer"
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Sub-componente: Configuración ────────────────────────────────────────────

function ConfigOficiosPanel({
    initialConfig,
    onSaved,
}: {
    initialConfig: OficioConfig | null;
    onSaved: () => void;
}) {
    const [config, setConfig] = useState<OficioConfig>(
        initialConfig ?? {
            umbralRojoHoras: 48,
            umbralAmarilloHoras: 120,
            recordatorios48h: true,
            recordatorios12h: true,
            horaIngesta: null,
            cuentaRemitente: null,
        }
    );
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/admin/oficios/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al guardar");
            toast.success("Configuración guardada");
            onSaved();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar config");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            background: "white",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "1.75rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
            maxWidth: "650px",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem"
        }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Settings size={20} color="#2563eb" />
                Configuración del Módulo de Oficios (ATP-MOD-01)
            </h3>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Umbrales */}
                <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <AlertTriangle size={16} color="#f59e0b" />
                        Umbrales del Semáforo
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "0.35rem" }}>
                                🔴 Umbral ROJO (horas)
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={config.umbralRojoHoras}
                                onChange={(e) => setConfig((c) => ({ ...c, umbralRojoHoras: parseInt(e.target.value) || 24 }))}
                                style={{ width: "100%", padding: "0.625rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "0.35rem" }}>
                                🟡 Umbral AMARILLO (horas)
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={config.umbralAmarilloHoras}
                                onChange={(e) => setConfig((c) => ({ ...c, umbralAmarilloHoras: parseInt(e.target.value) || 72 }))}
                                style={{ width: "100%", padding: "0.625rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
                            />
                        </div>
                    </div>
                </div>

                {/* Recordatorios */}
                <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <Clock size={16} color="#2563eb" />
                        Recordatorios Automáticos por Correo
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: "#334155" }}>
                            <input
                                type="checkbox"
                                checked={config.recordatorios48h}
                                onChange={(e) => setConfig((c) => ({ ...c, recordatorios48h: e.target.checked }))}
                                style={{ accentColor: "#2563eb", width: "16px", height: "16px" }}
                            />
                            <span>Enviar recordatorio automático 48 horas antes de la fecha límite</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: "#334155" }}>
                            <input
                                type="checkbox"
                                checked={config.recordatorios12h}
                                onChange={(e) => setConfig((c) => ({ ...c, recordatorios12h: e.target.checked }))}
                                style={{ accentColor: "#2563eb", width: "16px", height: "16px" }}
                            />
                            <span>Enviar recordatorio urgente 12 horas antes de la fecha límite</span>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        padding: "0.75rem 1.5rem",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "white",
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: saving ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem"
                    }}
                >
                    {saving ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />}
                    <span>Guardar Configuración</span>
                </button>
            </form>
        </div>
    );
}
