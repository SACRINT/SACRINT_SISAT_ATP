"use client";

import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Settings2, School, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  Tipos
// ─────────────────────────────────────────────────────────────

interface PlaneacionRow {
    id: string;
    docenteNombre: string;
    asignatura: string;
    semestre: number;
    estado: string;
    nivelCumplimiento: string | null;
    puntajeObtenido: number | null;
    puntajeMaximo: number | null;
    fechaSubida: string;
    fechaRevision: string | null;
    cct: string;
    archivoUrl: string;
    retroalimentacionDocente: string | null;
    escuela?: { nombre: string; cct: string };
}

interface ConfigData {
    activoGlobal: boolean;
    requierePaecPec: boolean;
    requiereApiKey: boolean;
    modoSinRestricciones: boolean;
}

const ESTADO_LABEL: Record<string, string> = {
    EN_REVISION: "En revisión",
    REVISADO: "Revisado",
    PENDIENTE: "Pendiente",
    ERROR: "Error IA",
};

const NIVEL_COLOR: Record<string, string> = {
    COMPLETO: "#16a34a",
    PARCIAL: "#d97706",
    REQUIERE_CORRECCION: "#dc2626",
};

// ─────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────

import GestionPlaneaciones from "@/app/director/_componentes/planeaciones/GestionPlaneaciones";

interface EscuelaAdminOption {
    id: string;
    cct: string;
    nombre: string;
    gruposPrimerAno?: number;
    gruposSegundoAno?: number;
    gruposTercerAno?: number;
}

export default function PlaneacionesAdminPanel() {
    const [config, setConfig] = useState<ConfigData | null>(null);
    const [planeaciones, setPlaneaciones] = useState<PlaneacionRow[]>([]);
    const [escuelasList, setEscuelasList] = useState<EscuelaAdminOption[]>([]);
    const [selectedEscuelaId, setSelectedEscuelaId] = useState<string>("TODAS");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [configOpen, setConfigOpen] = useState(true);
    const [search, setSearch] = useState("");
    const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

    // ── Cargar datos ──────────────────────────────────────────
    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const [cfgRes, listRes, escuelasRes] = await Promise.all([
                fetch("/api/admin/planeaciones-config"),
                fetch("/api/admin/planeaciones"),
                fetch("/api/admin/escuelas"),
            ]);
            if (cfgRes.ok) setConfig(await cfgRes.json());
            if (listRes.ok) {
                const data = await listRes.json();
                setPlaneaciones(data.planeaciones || (Array.isArray(data) ? data : []));
            }
            if (escuelasRes.ok) {
                const escData = await escuelasRes.json();
                setEscuelasList(Array.isArray(escData) ? escData : []);
            }
        } catch {
            setMsg({ type: "error", text: "Error al cargar datos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // ── Guardar configuración de Planeaciones ─────────────────
    const guardarConfig = async () => {
        if (!config) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/planeaciones-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (res.ok) {
                setMsg({ type: "success", text: "Configuración de Planeaciones guardada correctamente" });
            } else {
                setMsg({ type: "error", text: "Error al guardar configuración" });
            }
        } catch {
            setMsg({ type: "error", text: "Error de conexión" });
        } finally {
            setSaving(false);
        }
    };

    // ── Filtros ───────────────────────────────────────────────
    const filtradas = planeaciones.filter(p => {
        const matchSearch =
            p.docenteNombre.toLowerCase().includes(search.toLowerCase()) ||
            p.asignatura.toLowerCase().includes(search.toLowerCase()) ||
            p.cct.toLowerCase().includes(search.toLowerCase()) ||
            (p.escuela?.nombre || "").toLowerCase().includes(search.toLowerCase());
        const matchEstado = filtroEstado === "TODOS" || p.estado === filtroEstado;
        return matchSearch && matchEstado;
    });

    // ── Estadísticas rápidas ──────────────────────────────────
    const total = planeaciones.length;
    const revisadas = planeaciones.filter(p => p.estado === "REVISADO").length;
    const enRevision = planeaciones.filter(p => p.estado === "EN_REVISION").length;
    const conError = planeaciones.filter(p => p.estado === "ERROR").length;
    const promedioGlobal = revisadas > 0
        ? Math.round(planeaciones.filter(p => p.puntajeObtenido != null)
            .reduce((acc, p) => acc + ((p.puntajeObtenido! / (p.puntajeMaximo || 300)) * 100), 0) / revisadas)
        : 0;

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: "1rem" }} />
                <p>Cargando planeaciones...</p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* ── Encabezado ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <GraduationCap size={22} style={{ color: "var(--primary)" }} />
                        Planeaciones Didácticas IA
                    </h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        Revisión automática de planeaciones y secuencias didácticas con Inteligencia Artificial (Anexo 12 USICAMM)
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <select
                        className="form-control"
                        value={selectedEscuelaId}
                        onChange={(e) => setSelectedEscuelaId(e.target.value)}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", fontWeight: 700, minWidth: "250px", cursor: "pointer" }}
                    >
                        <option value="TODAS">🏫 Ver todas las escuelas de la zona</option>
                        {escuelasList.map(e => (
                            <option key={e.id} value={e.id}>
                                {e.cct} - {e.nombre}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={cargar}
                        className="btn btn-outline"
                        style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem" }}
                    >
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>
            </div>

            {/* ── Si hay una escuela seleccionada de la zona, mostrar el módulo completo interactivo de esa escuela ── */}
            {selectedEscuelaId !== "TODAS" ? (() => {
                const targetEsc = escuelasList.find(e => e.id === selectedEscuelaId);
                if (!targetEsc) return null;
                return (
                    <div style={{ marginTop: "0.5rem" }}>
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.75rem 1rem", borderRadius: "10px", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>
                                🛠️ Panel de Control de Administración para: {targetEsc.nombre} ({targetEsc.cct})
                            </span>
                            <button className="btn btn-outline" onClick={() => setSelectedEscuelaId("TODAS")} style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
                                ✕ Volver a resumen zona
                            </button>
                        </div>
                        <GestionPlaneaciones escuela={targetEsc} readOnly={false} isAdmin={true} />


                    </div>
                );
            })() : null}

            {/* ── Mensaje de estado ── */}
            {msg && (
                <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}
                    style={{ padding: "0.6rem 1rem", fontSize: "0.8125rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{msg.text}</span>
                    <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem" }}>×</button>
                </div>
            )}


            {/* ── Tarjetas de estadísticas ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem" }}>
                {[
                    { label: "Total subidas", value: total, icon: <GraduationCap size={18} />, color: "#2563eb" },
                    { label: "Revisadas IA", value: revisadas, icon: <CheckCircle2 size={18} />, color: "#16a34a" },
                    { label: "En revisión", value: enRevision, icon: <Clock size={18} />, color: "#d97706" },
                    { label: "Con error", value: conError, icon: <XCircle size={18} />, color: "#dc2626" },
                    { label: "Promedio zona", value: `${promedioGlobal}%`, icon: <AlertTriangle size={18} />, color: "#7c3aed" },
                ].map(stat => (
                    <div key={stat.label} className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <div style={{ color: stat.color }}>{stat.icon}</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>{stat.value}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Panel de Configuración ── */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <button
                    onClick={() => setConfigOpen(o => !o)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.9375rem", color: "var(--text)" }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Settings2 size={18} style={{ color: "var(--primary)" }} />
                        Configuración Global del Módulo
                    </span>
                    {configOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {configOpen && config && (
                    <div style={{ padding: "0 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                            Estas opciones controlan el acceso global al módulo. Para activar/desactivar por escuela individual, usa la sección <strong>Escuelas → Programas y Módulos</strong>.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {/* Toggle: Activo Global */}
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer" }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>🟢 Módulo activo (global)</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Si está desactivado, ninguna escuela puede usar la revisión de planeaciones</div>
                                </div>
                                <input type="checkbox" checked={config.activoGlobal} onChange={e => setConfig({ ...config, activoGlobal: e.target.checked })} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                            </label>

                            {/* Toggle: Requiere PAEC-PEC */}
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer" }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>🔒 Requiere PAEC-PEC</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Los directores deben haber subido su PAEC-PEC antes de poder usar este módulo</div>
                                </div>
                                <input type="checkbox" checked={config.requierePaecPec} onChange={e => setConfig({ ...config, requierePaecPec: e.target.checked })} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                            </label>

                            {/* Toggle: Requiere API Key */}
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer" }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>🔑 Requiere API Key propia</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Si está activo, la escuela debe tener su API Key de Gemini configurada (además del pool del sistema)</div>
                                </div>
                                <input type="checkbox" checked={config.requiereApiKey} onChange={e => setConfig({ ...config, requiereApiKey: e.target.checked })} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                            </label>
                        </div>

                        <button
                            onClick={guardarConfig}
                            disabled={saving}
                            className="btn btn-primary"
                            style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "0.375rem" }}
                        >
                            {saving ? <RefreshCw size={14} className="spin" /> : <Settings2 size={14} />}
                            {saving ? "Guardando..." : "Guardar configuración"}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Listado de Planeaciones ── */}
            <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <School size={17} style={{ color: "var(--primary)" }} />
                        Planeaciones subidas por los directores ({filtradas.length})
                    </h3>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <input
                            type="text"
                            placeholder="Buscar docente, asignatura, CCT..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "0.8125rem", outline: "none", minWidth: "220px" }}
                        />
                        <select
                            value={filtroEstado}
                            onChange={e => setFiltroEstado(e.target.value)}
                            style={{ padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "0.8125rem", outline: "none", cursor: "pointer" }}
                        >
                            <option value="TODOS">Todos los estados</option>
                            <option value="REVISADO">Revisado</option>
                            <option value="EN_REVISION">En revisión</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="ERROR">Error IA</option>
                        </select>
                    </div>
                </div>

                {filtradas.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
                        <GraduationCap size={40} style={{ marginBottom: "0.75rem", opacity: 0.35 }} />
                        <p style={{ margin: 0 }}>
                            {planeaciones.length === 0
                                ? "Ninguna escuela ha subido planeaciones todavía."
                                : "No hay planeaciones que coincidan con el filtro."}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Escuela / CCT</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Docente</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Asignatura</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Sem.</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Estado</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Nivel</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Puntaje</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Fecha</th>
                                    <th style={{ padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Archivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtradas.map(p => (
                                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary, #f8fafc)")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                        <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600 }}>
                                            <div>{p.escuela?.nombre || "—"}</div>
                                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{p.cct}</div>
                                        </td>
                                        <td style={{ padding: "0.6rem 0.75rem" }}>{p.docenteNombre}</td>
                                        <td style={{ padding: "0.6rem 0.75rem" }}>{p.asignatura}</td>
                                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>{p.semestre}°</td>
                                        <td style={{ padding: "0.6rem 0.75rem" }}>
                                            <span style={{
                                                padding: "2px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: 600,
                                                background: p.estado === "REVISADO" ? "#dcfce7" : p.estado === "EN_REVISION" ? "#fef9c3" : p.estado === "ERROR" ? "#fee2e2" : "#f1f5f9",
                                                color: p.estado === "REVISADO" ? "#16a34a" : p.estado === "EN_REVISION" ? "#b45309" : p.estado === "ERROR" ? "#dc2626" : "#64748b",
                                            }}>
                                                {ESTADO_LABEL[p.estado] || p.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.6rem 0.75rem" }}>
                                            {p.nivelCumplimiento ? (
                                                <span style={{ color: NIVEL_COLOR[p.nivelCumplimiento] || "#64748b", fontWeight: 600, fontSize: "0.75rem" }}>
                                                    {p.nivelCumplimiento.replace(/_/g, " ")}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                                            {p.puntajeObtenido != null
                                                ? `${p.puntajeObtenido}/${p.puntajeMaximo ?? 300}`
                                                : "—"}
                                        </td>
                                        <td style={{ padding: "0.6rem 0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            {new Date(p.fechaSubida).toLocaleDateString("es-MX")}
                                        </td>
                                        <td style={{ padding: "0.6rem 0.75rem" }}>
                                            <a href={p.archivoUrl} target="_blank" rel="noreferrer"
                                                style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none" }}>
                                                Ver PDF
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
