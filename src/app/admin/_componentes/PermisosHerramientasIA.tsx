"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";

type Escuela = {
    id: string;
    cct: string;
    nombre: string;
    esSupervision?: boolean;
    permisos?: any;
};

interface ConfigPlaneaciones {
    activoGlobal: boolean;
    requierePaecPec: boolean;
    requiereApiKey: boolean;
    modoSinRestricciones: boolean;
}

interface ConfigHorarios {
    activoGlobalHorarios: boolean;
}

interface PermisosHerramientasIAProps {
    escuelas: Escuela[];
    readOnly?: boolean;
}

export default function PermisosHerramientasIA({ escuelas, readOnly }: PermisosHerramientasIAProps) {
    const [configPlaneaciones, setConfigPlaneaciones] = useState<ConfigPlaneaciones | null>(null);
    const [configHorarios, setConfigHorarios] = useState<ConfigHorarios>({
        activoGlobalHorarios: true,
    });
    const [horarioStats, setHorarioStats] = useState<Record<string, { totalMensajesChat: number; totalUsos: number; ultimoUso: string | null }>>({});
    const [loading, setLoading] = useState(true);
    const [savingPlaneaciones, setSavingPlaneaciones] = useState(false);
    const [savingHorarios, setSavingHorarios] = useState(false);

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const [cfgRes, hCfgRes, statsRes] = await Promise.all([
                fetch("/api/admin/planeaciones-config"),
                fetch("/api/admin/horarios/config"),
                fetch("/api/admin/horarios/reset-stats")
            ]);

            if (cfgRes.ok) setConfigPlaneaciones(await cfgRes.json());

            if (hCfgRes.ok) {
                const hCfg = await hCfgRes.json();
                setConfigHorarios({
                    activoGlobalHorarios: hCfg.activoGlobalHorarios ?? true,
                });
            }

            if (statsRes.ok) {
                const data = await statsRes.json();
                if (data.success && Array.isArray(data.stats)) {
                    const mapa: Record<string, any> = {};
                    data.stats.forEach((s: any) => {
                        mapa[s.escuelaId] = {
                            totalMensajesChat: s.totalMensajesChat,
                            totalUsos: s.totalUsos,
                            ultimoUso: s.ultimoUso
                        };
                    });
                    setHorarioStats(mapa);
                }
            }
        } catch {
            toast.error("Error al cargar configuraciones de IA");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const handlePlaneacionesChange = async (updates: Partial<ConfigPlaneaciones>) => {
        if (!configPlaneaciones || readOnly) return;

        const newConfig = { ...configPlaneaciones, ...updates, modoSinRestricciones: false };
        setConfigPlaneaciones(newConfig);
        setSavingPlaneaciones(true);

        try {
            const res = await fetch("/api/admin/planeaciones-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConfig),
            });
            if (res.ok) {
                toast.success("Configuración de Planeaciones IA guardada");
            } else {
                toast.error("Error al guardar configuración");
                await cargarDatos();
            }
        } catch {
            toast.error("Error de conexión");
            await cargarDatos();
        } finally {
            setSavingPlaneaciones(false);
        }
    };

    const handleHorariosChange = async (updates: Partial<ConfigHorarios>) => {
        if (readOnly) return;
        const newConfig = { ...configHorarios, ...updates };
        setConfigHorarios(newConfig);
        setSavingHorarios(true);

        try {
            const res = await fetch("/api/admin/horarios/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConfig),
            });
            if (res.ok) {
                toast.success("Configuración de Horarios IA guardada");
            } else {
                toast.error("Error al guardar configuración de Horarios");
                await cargarDatos();
            }
        } catch {
            toast.error("Error de conexión");
            await cargarDatos();
        } finally {
            setSavingHorarios(false);
        }
    };

    const handleResetStats = async (escuelaId: string, nombre: string) => {
        if (readOnly) return;
        if (!confirm(`¿Reiniciar el contador de uso de Horarios IA para "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch("/api/admin/horarios/reset-stats", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ escuelaId })
            });
            const data = await res.json();
            if (data.success) {
                setHorarioStats(prev => ({
                    ...prev,
                    [escuelaId]: { totalMensajesChat: 0, totalUsos: 0, ultimoUso: null }
                }));
                toast.success(`Contador reiniciado para ${nombre}`);
            } else {
                toast.error(data.error || "Error al reiniciar contador");
            }
        } catch {
            toast.error("Error de conexión al reiniciar contador");
        }
    };

    if (loading) {
        return (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: "1rem" }} />
                <p>Cargando configuraciones de IA...</p>
            </div>
        );
    }

    const escuelasList = escuelas.filter(e => !e.esSupervision);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

            {/* 📋 Planeaciones Didácticas IA */}
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text)", fontSize: "1.1rem" }}>
                    📋 Planeaciones Didácticas IA
                </h3>
                {configPlaneaciones && (
                    <>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                            Estas opciones controlan el acceso global al módulo. Para activar/desactivar o eximir requisitos por escuela individual, usa la pestaña <strong>"⚙️ Programas y Módulos por Escuela"</strong>.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>

                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)", cursor: readOnly ? "default" : "pointer" }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>🟢 Módulo activo (global)</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Si está desactivado, ninguna escuela puede usar la revisión de planeaciones.</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={configPlaneaciones.activoGlobal}
                                    onChange={e => handlePlaneacionesChange({ activoGlobal: e.target.checked })}
                                    disabled={readOnly || savingPlaneaciones}
                                    style={{ width: "18px", height: "18px", cursor: readOnly ? "default" : "pointer" }}
                                />
                            </label>

                        </div>
                    </>
                )}
            </div>

            {/* 📅 Generador de Horarios IA */}
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text)", fontSize: "1.1rem" }}>
                    📅 Generador de Horarios IA
                </h3>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    Estas opciones controlan el acceso global al módulo. Para activar/desactivar o eximir requisitos por escuela individual, usa la pestaña <strong>"⚙️ Programas y Módulos por Escuela"</strong>.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>

                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)", cursor: readOnly ? "default" : "pointer" }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>🟢 Módulo activo (global)</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Si está desactivado, ninguna escuela puede usar el generador de horarios.</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={configHorarios.activoGlobalHorarios}
                            onChange={e => handleHorariosChange({ activoGlobalHorarios: e.target.checked })}
                            disabled={readOnly || savingHorarios}
                            style={{ width: "18px", height: "18px", cursor: readOnly ? "default" : "pointer" }}
                        />
                    </label>

                </div>
            </div>

            {/* 💬 Uso del chat del Generador de Horarios IA */}
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text)", fontSize: "1.1rem" }}>
                    <MessageCircle size={20} style={{ color: "var(--primary)" }} />
                    Uso del chat del Generador de Horarios IA
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Contadores de uso del asistente virtual por escuela.
                </p>
                <div className="table-responsive" style={{ marginTop: "0.5rem" }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Escuela</th>
                                <th style={{ textAlign: "center" }}>Mensajes Enviados</th>
                                <th style={{ textAlign: "center" }}>Usos del Generador</th>
                                <th>Último Uso</th>
                                {!readOnly && <th style={{ textAlign: "right" }}>Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {escuelasList.map(escuela => {
                                const stats = horarioStats[escuela.id] || { totalMensajesChat: 0, totalUsos: 0, ultimoUso: null };
                                return (
                                    <tr key={escuela.id}>
                                        <td>
                                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{escuela.nombre}</div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{escuela.cct}</div>
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{
                                                background: stats.totalMensajesChat > 0 ? "var(--bg-blue-light)" : "var(--bg-secondary)",
                                                color: stats.totalMensajesChat > 0 ? "var(--primary)" : "var(--text-muted)",
                                                padding: "0.25rem 0.5rem",
                                                borderRadius: "4px",
                                                fontWeight: 700
                                            }}>
                                                {stats.totalMensajesChat}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            <span style={{
                                                background: stats.totalUsos > 0 ? "var(--bg-green-light, #dcfce7)" : "var(--bg-secondary)",
                                                color: stats.totalUsos > 0 ? "var(--text-success, #166534)" : "var(--text-muted)",
                                                padding: "0.25rem 0.5rem",
                                                borderRadius: "4px",
                                                fontWeight: 700
                                            }}>
                                                {stats.totalUsos}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                            {stats.ultimoUso ? new Date(stats.ultimoUso).toLocaleString('es-MX') : "Nunca"}
                                        </td>
                                        {!readOnly && (
                                            <td style={{ textAlign: "right" }}>
                                                <button
                                                    onClick={() => handleResetStats(escuela.id, escuela.nombre)}
                                                    className="btn btn-outline"
                                                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                                                    disabled={stats.totalMensajesChat === 0 && stats.totalUsos === 0}
                                                >
                                                    Reiniciar
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
