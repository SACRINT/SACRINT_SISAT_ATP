"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, MessageCircle, Brain, Sparkles, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
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

    // Autogestión de IA para Directores
    const [aiActivo, setAiActivo] = useState(false);
    const [aiLimite, setAiLimite] = useState(3);
    const [aiToggling, setAiToggling] = useState(false);
    const [aiSaving, setAiSaving] = useState(false);

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const [cfgRes, hCfgRes, statsRes, aiRes] = await Promise.all([
                fetch("/api/admin/planeaciones-config"),
                fetch("/api/admin/horarios/config"),
                fetch("/api/admin/horarios/reset-stats"),
                fetch("/api/admin/pre-revision-config")
            ]);

            if (cfgRes.ok) setConfigPlaneaciones(await cfgRes.json());

            if (hCfgRes.ok) {
                const hCfg = await hCfgRes.json();
                setConfigHorarios({
                    activoGlobalHorarios: hCfg.activoGlobalHorarios ?? true,
                });
            }

            if (aiRes.ok) {
                const aiData = await aiRes.json();
                setAiActivo(aiData.activoDirectores ?? false);
                setAiLimite(aiData.limiteIntentos ?? 3);
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
                // Si cambió activoGlobal, propagar a todas las escuelas
                if ("activoGlobal" in updates) {
                    const accion = newConfig.activoGlobal ? "ACTIVAR_TODOS" : "DESACTIVAR_TODOS";
                    await fetch("/api/admin/escuelas/masivo-permisos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tipo: "PLANEACIONES_IA", accion }),
                    });
                    toast.success(`Planeaciones IA ${newConfig.activoGlobal ? "activadas" : "desactivadas"} globalmente y para todas las escuelas`);
                } else {
                    toast.success("Configuración de Planeaciones IA guardada");
                }
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
                // Si cambió activoGlobalHorarios, propagar a todas las escuelas
                if ("activoGlobalHorarios" in updates) {
                    const accion = newConfig.activoGlobalHorarios ? "ACTIVAR_TODOS" : "DESACTIVAR_TODOS";
                    await fetch("/api/admin/escuelas/masivo-permisos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tipo: "HORARIOS_IA", accion }),
                    });
                    toast.success(`Horarios IA ${newConfig.activoGlobalHorarios ? "activados" : "desactivados"} globalmente y para todas las escuelas`);
                } else {
                    toast.success("Configuración de Horarios IA guardada");
                }
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

    const handleToggleAI = async () => {
        if (readOnly) return;
        setAiToggling(true);
        try {
            const res = await fetch("/api/admin/pre-revision-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activoDirectores: !aiActivo }),
            });
            if (res.ok) {
                const data = await res.json();
                setAiActivo(data.activoDirectores);
                toast.success(`IA para directores ${data.activoDirectores ? "activada" : "desactivada"}`);
            } else {
                throw new Error();
            }
        } catch {
            toast.error("No se pudo cambiar la configuración de la IA");
        } finally {
            setAiToggling(false);
        }
    };

    const handleSaveAILimite = async () => {
        if (readOnly) return;
        setAiSaving(true);
        try {
            const res = await fetch("/api/admin/pre-revision-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limiteIntentos: aiLimite }),
            });
            if (res.ok) {
                const data = await res.json();
                setAiLimite(data.limiteIntentos);
                toast.success(`Límite de pre-evaluaciones establecido en ${data.limiteIntentos} intentos`);
            } else {
                throw new Error();
            }
        } catch {
            toast.error("No se pudo guardar el límite de intentos");
        } finally {
            setAiSaving(false);
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

                            <div style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "1rem", borderRadius: "8px",
                                border: `1px solid ${configPlaneaciones.activoGlobal ? "#16a34a" : "#dc2626"}`,
                                background: configPlaneaciones.activoGlobal ? "rgba(22,163,74,0.07)" : "rgba(220,38,38,0.07)",
                                transition: "all 0.25s ease",
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>
                                        {configPlaneaciones.activoGlobal ? "🟢" : "🔴"} Módulo activo (global)
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Si está desactivado, ninguna escuela puede usar la revisión de planeaciones.</div>
                                </div>
                                <button
                                    onClick={() => !readOnly && !savingPlaneaciones && handlePlaneacionesChange({ activoGlobal: !configPlaneaciones.activoGlobal })}
                                    disabled={readOnly || savingPlaneaciones}
                                    title={configPlaneaciones.activoGlobal ? "Haz clic para desactivar" : "Haz clic para activar"}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "0.4rem",
                                        padding: "0.45rem 1.1rem", borderRadius: "20px",
                                        border: "none",
                                        cursor: readOnly || savingPlaneaciones ? "default" : "pointer",
                                        fontWeight: 700, fontSize: "0.8rem",
                                        background: configPlaneaciones.activoGlobal ? "#16a34a" : "#dc2626",
                                        color: "#fff",
                                        transition: "background 0.25s ease",
                                        minWidth: "110px", justifyContent: "center",
                                        opacity: readOnly ? 0.6 : 1,
                                    }}
                                >
                                    {savingPlaneaciones
                                        ? <Loader2 size={15} className="spin" />
                                        : configPlaneaciones.activoGlobal
                                            ? <><ToggleRight size={17} /> ACTIVO</>
                                            : <><ToggleLeft size={17} /> INACTIVO</>
                                    }
                                </button>
                            </div>

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

                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "1rem", borderRadius: "8px",
                        border: `1px solid ${configHorarios.activoGlobalHorarios ? "#16a34a" : "#dc2626"}`,
                        background: configHorarios.activoGlobalHorarios ? "rgba(22,163,74,0.07)" : "rgba(220,38,38,0.07)",
                        transition: "all 0.25s ease",
                    }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>
                                {configHorarios.activoGlobalHorarios ? "🟢" : "🔴"} Módulo activo (global)
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Si está desactivado, ninguna escuela puede usar el generador de horarios.</div>
                        </div>
                        <button
                            onClick={() => !readOnly && !savingHorarios && handleHorariosChange({ activoGlobalHorarios: !configHorarios.activoGlobalHorarios })}
                            disabled={readOnly || savingHorarios}
                            title={configHorarios.activoGlobalHorarios ? "Haz clic para desactivar" : "Haz clic para activar"}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.4rem",
                                padding: "0.45rem 1.1rem", borderRadius: "20px",
                                border: "none",
                                cursor: readOnly || savingHorarios ? "default" : "pointer",
                                fontWeight: 700, fontSize: "0.8rem",
                                background: configHorarios.activoGlobalHorarios ? "#16a34a" : "#dc2626",
                                color: "#fff",
                                transition: "background 0.25s ease",
                                minWidth: "110px", justifyContent: "center",
                                opacity: readOnly ? 0.6 : 1,
                            }}
                        >
                            {savingHorarios
                                ? <Loader2 size={15} className="spin" />
                                : configHorarios.activoGlobalHorarios
                                    ? <><ToggleRight size={17} /> ACTIVO</>
                                    : <><ToggleLeft size={17} /> INACTIVO</>
                            }
                        </button>
                    </div>

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

            {/* 🧠 Autogestión de IA para Directores */}
            <div className="card" style={{ borderLeft: `4px solid ${aiActivo ? "var(--primary)" : "var(--border)"}`, transition: "border-color 0.2s ease", display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "700px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                        <div style={{
                            width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                            background: aiActivo ? "rgba(37, 99, 235, 0.1)" : "var(--bg-secondary)",
                            color: aiActivo ? "var(--primary)" : "var(--text-muted)",
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                            <Brain size={22} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                Autogestión de IA para Directores <Sparkles size={14} style={{ color: "#f59e0b" }} />
                            </h3>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                                Permite a los directores obtener pre-dictámenes y observaciones en viñetas de sus documentos cargados de forma autónoma.
                            </p>
                        </div>
                    </div>

                    {/* Toggle */}
                    <button
                        onClick={handleToggleAI}
                        disabled={readOnly || aiToggling}
                        style={{ background: "none", border: "none", cursor: readOnly ? "default" : "pointer", padding: "4px", flexShrink: 0 }}
                        title={aiActivo ? "Desactivar para directores" : "Activar para directores"}
                    >
                        {aiToggling ? (
                            <Loader2 size={30} className="spin" style={{ color: "var(--text-muted)" }} />
                        ) : aiActivo ? (
                            <ToggleRight size={34} style={{ color: "var(--primary)" }} />
                        ) : (
                            <ToggleLeft size={34} style={{ color: "var(--text-muted)" }} />
                        )}
                    </button>
                </div>

                {/* Límite de intentos */}
                <div style={{ padding: "0.75rem 1rem", background: "var(--bg-secondary)", borderRadius: "8px" }}>
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Límite de Intentos de IA
                    </h4>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Número máximo de veces que cada escuela puede auto-evaluar su documento por periodo de entrega (para administrar el consumo de tokens).
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            className="form-control"
                            value={aiLimite}
                            onChange={e => setAiLimite(Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ width: "90px", fontSize: "0.8rem", padding: "0.375rem 0.5rem" }}
                            disabled={readOnly}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleSaveAILimite}
                            disabled={readOnly || aiSaving}
                            style={{ minHeight: "auto", padding: "0.375rem 0.75rem", fontSize: "0.8rem" }}
                        >
                            {aiSaving ? <Loader2 size={14} className="spin" /> : "Establecer Límite"}
                        </button>
                    </div>
                </div>

                {/* Tip */}
                <div style={{
                    padding: "0.5rem 0.75rem", borderRadius: "6px",
                    background: "rgba(37, 99, 235, 0.05)", border: "1px dashed rgba(37, 99, 235, 0.2)",
                    fontSize: "0.725rem", color: "var(--text-secondary)", lineHeight: 1.4
                }}>
                    💡 <strong>Consejo de ATP:</strong> Activar esta autogestión permite a los directores corregir sus propios errores (metas SMART, firmas, sellos) antes de que tú hagas la revisión final.
                </div>
            </div>

        </div>
    );
}
