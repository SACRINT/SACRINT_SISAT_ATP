"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Settings, ToggleLeft, ToggleRight, Download, RefreshCw, Loader2,
    CheckCircle2, XCircle, FileText, School,
} from "lucide-react";

interface DescargaInfo {
    escuelaId: string;
    cct: string;
    nombre: string;
    localidad: string;
    totalDescargas: number;
    ultimaDescarga: string;
}

interface Config {
    id: string;
    activo: boolean;
    destinatario: string;
    cargoDestinatario: string;
    zonaDestinatario: string;
}

export default function GestionCircular05() {
    const [config, setConfig] = useState<Config | null>(null);
    const [descargas, setDescargas] = useState<DescargaInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Editable fields
    const [destinatario, setDestinatario] = useState("");
    const [cargoDestinatario, setCargoDestinatario] = useState("");
    const [zonaDestinatario, setZonaDestinatario] = useState("");

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const [configRes, descargasRes] = await Promise.all([
                fetch("/api/circular05/config"),
                fetch("/api/circular05/descargas"),
            ]);
            const configData = await configRes.json();
            const descargasData = await descargasRes.json();
            setConfig(configData);
            setDestinatario(configData.destinatario || "");
            setCargoDestinatario(configData.cargoDestinatario || "");
            setZonaDestinatario(configData.zonaDestinatario || "");
            setDescargas(Array.isArray(descargasData) ? descargasData : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargarDatos(); }, [cargarDatos]);

    const toggleActivo = async () => {
        if (!config) return;
        setUpdating(true);
        setMessage(null);
        try {
            const res = await fetch("/api/circular05/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !config.activo }),
            });
            const data = await res.json();
            setConfig(data);
            setMessage({ type: "success", text: `Módulo ${data.activo ? "ACTIVADO" : "DESACTIVADO"} correctamente.` });
        } catch {
            setMessage({ type: "error", text: "Error al actualizar la configuración." });
        } finally {
            setUpdating(false);
        }
    };

    const guardarDestinatario = async () => {
        setUpdating(true);
        setMessage(null);
        try {
            const res = await fetch("/api/circular05/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ destinatario, cargoDestinatario, zonaDestinatario }),
            });
            const data = await res.json();
            setConfig(data);
            setMessage({ type: "success", text: "Datos del destinatario actualizados correctamente." });
        } catch {
            setMessage({ type: "error", text: "Error al guardar." });
        } finally {
            setUpdating(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "0.625rem 0.75rem", borderRadius: "8px",
        border: "1px solid var(--border)", fontSize: "0.875rem",
        background: "var(--bg)", color: "var(--text)", fontFamily: "inherit",
    };
    const labelStyle: React.CSSProperties = {
        display: "block", marginBottom: "0.35rem", fontSize: "0.8125rem",
        fontWeight: 600, color: "var(--text)",
    };

    if (loading) {
        return (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "0.75rem" }}>
                <Loader2 size={24} className="spin" /> Cargando configuración...
            </div>
        );
    }

    const totalDescargas = descargas.reduce((sum, d) => sum + d.totalDescargas, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header */}
            <div className="card" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%)", color: "white", border: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <FileText size={28} />
                    <h2 style={{ margin: 0 }}>Gestión Circular 05</h2>
                </div>
                <p style={{ opacity: 0.85, fontSize: "0.875rem", margin: 0 }}>
                    Administra el módulo de generación de expedientes para salidas extraescolares.
                </p>
            </div>

            {/* Messages */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* ═══ Toggle ═══ */}
            <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <h3 style={{ margin: "0 0 0.25rem" }}>Estado del Módulo</h3>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
                            {config?.activo
                                ? "Los directores pueden generar documentos de Circular 05."
                                : "El módulo está desactivado. Los directores no pueden generar documentos."}
                        </p>
                    </div>
                    <button
                        onClick={toggleActivo}
                        disabled={updating}
                        style={{
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            padding: "0.75rem 1.5rem", borderRadius: "10px", border: "none",
                            background: config?.activo ? "var(--success)" : "#ef4444",
                            color: "white", fontWeight: 700, fontSize: "0.9375rem",
                            cursor: updating ? "not-allowed" : "pointer",
                            transition: "all 0.3s",
                        }}
                    >
                        {config?.activo ? (
                            <><ToggleRight size={24} /> Activado</>
                        ) : (
                            <><ToggleLeft size={24} /> Desactivado</>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══ Destinatario ═══ */}
            <div className="card">
                <h3 style={{ margin: "0 0 0.75rem" }}>
                    <Settings size={18} style={{ verticalAlign: "middle", marginRight: "0.5rem" }} />
                    Configuración del Destinatario
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                    Estos datos aparecen en el oficio de solicitud dirigido al supervisor escolar.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
                    <div>
                        <label style={labelStyle}>Nombre del Destinatario</label>
                        <input style={inputStyle} value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Cargo</label>
                        <input style={inputStyle} value={cargoDestinatario} onChange={(e) => setCargoDestinatario(e.target.value)} />
                    </div>
                    <div>
                        <label style={labelStyle}>Zona</label>
                        <input style={inputStyle} value={zonaDestinatario} onChange={(e) => setZonaDestinatario(e.target.value)} />
                    </div>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={guardarDestinatario}
                    disabled={updating}
                    style={{ marginTop: "0.75rem" }}
                >
                    {updating ? "Guardando..." : "💾 Guardar Cambios"}
                </button>
            </div>

            {/* ═══ Estadísticas ═══ */}
            <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3 style={{ margin: 0 }}>
                        <Download size={18} style={{ verticalAlign: "middle", marginRight: "0.5rem" }} />
                        Estadísticas de Descargas
                    </h3>
                    <button className="btn btn-outline" onClick={cargarDatos} style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem" }}>
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>

                {/* Resumen */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                    <div style={{ padding: "1rem", background: "var(--bg-secondary)", borderRadius: "10px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>{descargas.length}</p>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Escuelas que han generado</p>
                    </div>
                    <div style={{ padding: "1rem", background: "var(--bg-secondary)", borderRadius: "10px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "var(--success)" }}>{totalDescargas}</p>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>Total de documentos generados</p>
                    </div>
                </div>

                {/* Tabla */}
                {descargas.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-secondary)" }}>
                                    <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", borderBottom: "2px solid var(--border)" }}>CCT</th>
                                    <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", borderBottom: "2px solid var(--border)" }}>Escuela</th>
                                    <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", borderBottom: "2px solid var(--border)" }}>Localidad</th>
                                    <th style={{ padding: "0.625rem 0.75rem", textAlign: "center", borderBottom: "2px solid var(--border)" }}>Descargas</th>
                                    <th style={{ padding: "0.625rem 0.75rem", textAlign: "left", borderBottom: "2px solid var(--border)" }}>Última Descarga</th>
                                </tr>
                            </thead>
                            <tbody>
                                {descargas.map((d) => (
                                    <tr key={d.escuelaId} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontWeight: 600 }}>{d.cct}</td>
                                        <td style={{ padding: "0.5rem 0.75rem" }}>{d.nombre}</td>
                                        <td style={{ padding: "0.5rem 0.75rem" }}>{d.localidad}</td>
                                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                            <span style={{
                                                background: "var(--primary)", color: "white",
                                                padding: "0.2rem 0.6rem", borderRadius: "12px",
                                                fontWeight: 700, fontSize: "0.8125rem",
                                            }}>
                                                {d.totalDescargas}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            {new Date(d.ultimaDescarga).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                        <School size={40} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
                        <p>Aún no hay descargas registradas.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
