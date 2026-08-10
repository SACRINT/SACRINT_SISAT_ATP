"use client";

import { useState, useEffect, useCallback } from "react";
import {
    AlertTriangle,
    Trash2,
    RefreshCw,
    ShieldCheck,
    Clock,
    User,
    Code,
    CheckCircle2,
    FileText,
    ChevronLeft,
    ChevronRight,
    X,
    Server,
    Activity,
    Database,
} from "lucide-react";

interface ErrorItem {
    id: string;
    tenantId: string | null;
    ruta: string;
    metodo: string;
    mensaje: string;
    stack: string | null;
    userId: string | null;
    createdAt: string;
}

export default function ErroresServidorPanel() {
    const [errores, setErrores] = useState<ErrorItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [limpiando, setLimpiando] = useState(false);
    const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);
    const [errorSeleccionado, setErrorSeleccionado] = useState<ErrorItem | null>(null);

    const cargarErrores = useCallback(async (p = page) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/errores?page=${p}&limit=20`);
            if (!res.ok) throw new Error("Error al cargar logs");
            const data = await res.json();
            setErrores(data.errores || []);
            setTotal(data.total || 0);
            setPage(data.page || 1);
            setTotalPages(data.totalPages || 1);
        } catch (err: unknown) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        cargarErrores(1);
    }, [cargarErrores]);

    const handleLimpiar = async () => {
        if (!confirm("¿Estás seguro de que deseas borrar todos los registros de errores del servidor?")) return;
        setLimpiando(true);
        try {
            const res = await fetch("/api/admin/errores", { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                setMensajeFeedback(`Limpieza exitosa: ${data.mensaje}`);
                setErrores([]);
                setTotal(0);
                setTotalPages(1);
            } else {
                setMensajeFeedback(`Error: ${data.error}`);
            }
        } catch (err: unknown) {
            setMensajeFeedback("Error al conectar con el servidor.");
        } finally {
            setLimpiando(false);
            setTimeout(() => setMensajeFeedback(null), 4000);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="fade-in">
            {/* Header Banner - Estilo Premium Coincidente */}
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
                        background: "linear-gradient(135deg, #ef4444, #dc2626)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
                        flexShrink: 0
                    }}>
                        <AlertTriangle size={26} />
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "white", margin: 0 }}>
                                Registro de Errores del Servidor
                            </h2>
                            <span style={{
                                fontSize: "0.6875rem",
                                padding: "0.2rem 0.6rem",
                                borderRadius: "20px",
                                background: "rgba(239, 68, 68, 0.2)",
                                color: "#fca5a5",
                                fontWeight: 700,
                                border: "1px solid rgba(239, 68, 68, 0.3)"
                            }}>
                                Log en vivo
                            </span>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: "0.8125rem", margin: "0.25rem 0 0" }}>
                            Monitoreo y bitácora de excepciones en tiempo real para mantenimiento proactivo de la plataforma.
                        </p>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <button
                        onClick={() => cargarErrores(page)}
                        disabled={loading}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            background: "rgba(255, 255, 255, 0.1)",
                            color: "white",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            padding: "0.625rem 1.125rem",
                            borderRadius: "10px",
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            cursor: loading ? "not-allowed" : "pointer",
                            transition: "all 0.2s ease"
                        }}
                    >
                        <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                        <span>Actualizar</span>
                    </button>

                    <button
                        onClick={handleLimpiar}
                        disabled={limpiando || errores.length === 0}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            background: errores.length === 0 || limpiando
                                ? "rgba(239, 68, 68, 0.3)"
                                : "linear-gradient(135deg, #ef4444, #dc2626)",
                            color: "white",
                            border: "none",
                            padding: "0.625rem 1.125rem",
                            borderRadius: "10px",
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            cursor: errores.length === 0 || limpiando ? "not-allowed" : "pointer",
                            boxShadow: errores.length === 0 ? "none" : "0 4px 12px rgba(239, 68, 68, 0.3)",
                            opacity: errores.length === 0 ? 0.6 : 1,
                            transition: "all 0.2s ease"
                        }}
                    >
                        <Trash2 size={15} />
                        <span>{limpiando ? "Limpiando..." : "Limpiar Errores"}</span>
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {mensajeFeedback && (
                <div style={{
                    padding: "0.875rem 1.25rem",
                    borderRadius: "12px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#065f46",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 600
                }}>
                    <CheckCircle2 size={18} color="#059669" />
                    <span>{mensajeFeedback}</span>
                </div>
            )}

            {/* Metrics KPI Cards Grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1rem"
            }}>
                <div style={{
                    background: "white",
                    borderRadius: "14px",
                    padding: "1.125rem 1.25rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem"
                }}>
                    <div style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        background: "#fef2f2",
                        color: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #fee2e2"
                    }}>
                        <Server size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                            Total Capturados
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                            {total}
                        </div>
                    </div>
                </div>

                <div style={{
                    background: "white",
                    borderRadius: "14px",
                    padding: "1.125rem 1.25rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem"
                }}>
                    <div style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        background: "#ecfdf5",
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #a7f3d0"
                    }}>
                        <Activity size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                            Estado de Captura
                        </div>
                        <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#059669", lineHeight: 1.2, marginTop: "0.2rem" }}>
                            {total === 0 ? "100% Operativo Sin Excepciones" : "Capturando Excepciones"}
                        </div>
                    </div>
                </div>

                <div style={{
                    background: "white",
                    borderRadius: "14px",
                    padding: "1.125rem 1.25rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem"
                }}>
                    <div style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        background: "#eff6ff",
                        color: "#3b82f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #bfdbfe"
                    }}>
                        <Database size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                            Límite de Bitácora
                        </div>
                        <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.2, marginTop: "0.2rem" }}>
                            20 registros por página
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Table Card */}
            <div style={{
                background: "white",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
                overflow: "hidden"
            }}>
                {loading && errores.length === 0 ? (
                    <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748b" }}>
                        <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: "#2563eb", margin: "0 auto 1rem" }} />
                        <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1e293b", margin: 0 }}>
                            Cargando bitácora de excepciones del servidor...
                        </p>
                    </div>
                ) : errores.length === 0 ? (
                    <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                        <div style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "50%",
                            background: "#ecfdf5",
                            color: "#059669",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 1.25rem",
                            border: "1px solid #a7f3d0"
                        }}>
                            <ShieldCheck size={32} />
                        </div>
                        <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.5rem" }}>
                            Sin excepciones registradas en el servidor
                        </h3>
                        <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0, maxWidth: "480px", marginInline: "auto" }}>
                            El sistema se encuentra operando correctamente sin excepciones no capturadas.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                            <thead>
                                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                    <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Fecha / Hora
                                    </th>
                                    <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Método / Ruta
                                    </th>
                                    <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Mensaje de Error
                                    </th>
                                    <th style={{ padding: "0.875rem 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>
                                        Acción
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {errores.map((err) => (
                                    <tr key={err.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s ease" }}>
                                        <td style={{ padding: "1rem 1.25rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                <Clock size={14} color="#94a3b8" />
                                                <span>{new Date(err.createdAt).toLocaleString("es-MX")}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "1rem 1.25rem", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <span style={{
                                                    fontSize: "0.6875rem",
                                                    fontWeight: 800,
                                                    fontFamily: "monospace",
                                                    padding: "0.2rem 0.5rem",
                                                    borderRadius: "6px",
                                                    background: err.metodo === "DELETE" ? "#fef2f2" : err.metodo === "POST" || err.metodo === "PATCH" || err.metodo === "PUT" ? "#fffbeb" : "#eff6ff",
                                                    color: err.metodo === "DELETE" ? "#b91c1c" : err.metodo === "POST" || err.metodo === "PATCH" || err.metodo === "PUT" ? "#b45309" : "#1d4ed8",
                                                    border: `1px solid ${err.metodo === "DELETE" ? "#fecaca" : err.metodo === "POST" || err.metodo === "PATCH" || err.metodo === "PUT" ? "#fde68a" : "#bfdbfe"}`
                                                }}>
                                                    {err.metodo}
                                                </span>
                                                <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 700, color: "#1e293b" }}>
                                                    {err.ruta}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "1rem 1.25rem", maxWidth: "380px" }}>
                                            <div style={{
                                                background: "#fef2f2",
                                                color: "#991b1b",
                                                border: "1px solid #fee2e2",
                                                padding: "0.4rem 0.75rem",
                                                borderRadius: "8px",
                                                fontFamily: "monospace",
                                                fontSize: "0.75rem",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis"
                                            }}>
                                                {err.mensaje}
                                            </div>
                                        </td>
                                        <td style={{ padding: "1rem 1.25rem", textAlign: "right", whiteSpace: "nowrap" }}>
                                            <button
                                                onClick={() => setErrorSeleccionado(err)}
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.4rem",
                                                    background: "#f8fafc",
                                                    color: "#334155",
                                                    border: "1px solid #cbd5e1",
                                                    padding: "0.4rem 0.85rem",
                                                    borderRadius: "8px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                                    transition: "all 0.15s ease"
                                                }}
                                            >
                                                <FileText size={14} color="#64748b" />
                                                <span>Ver Stack</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{
                        padding: "0.875rem 1.25rem",
                        background: "#f8fafc",
                        borderTop: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.8125rem",
                        color: "#475569",
                        fontWeight: 600
                    }}>
                        <span>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                onClick={() => cargarErrores(page - 1)}
                                disabled={page === 1}
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
                                onClick={() => cargarErrores(page + 1)}
                                disabled={page === totalPages}
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

            {/* Modal de Stack Trace - Modern Dialog */}
            {errorSeleccionado && (
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
                        padding: "1.5rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.25rem",
                        maxHeight: "85vh",
                        overflowY: "auto"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "10px",
                                    background: "#fef2f2",
                                    color: "#ef4444",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "1px solid #fee2e2"
                                }}>
                                    <Code size={22} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                                        Detalle de la Excepción
                                    </h3>
                                    <p style={{ fontSize: "0.8125rem", fontFamily: "monospace", color: "#64748b", margin: "0.2rem 0 0" }}>
                                        <strong>[{errorSeleccionado.metodo}]</strong> {errorSeleccionado.ruta}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setErrorSeleccionado(null)}
                                style={{
                                    background: "#f1f5f9",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "0.4rem",
                                    cursor: "pointer",
                                    color: "#64748b",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Mensaje de Error:
                                </span>
                                <div style={{
                                    padding: "0.875rem",
                                    background: "#fef2f2",
                                    border: "1px solid #fee2e2",
                                    borderRadius: "10px",
                                    color: "#991b1b",
                                    fontFamily: "monospace",
                                    fontSize: "0.8125rem",
                                    marginTop: "0.4rem",
                                    fontWeight: 700
                                }}>
                                    {errorSeleccionado.mensaje}
                                </div>
                            </div>

                            {errorSeleccionado.stack && (
                                <div>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Stack Trace:
                                    </span>
                                    <pre style={{
                                        padding: "1rem",
                                        background: "#0f172a",
                                        color: "#e2e8f0",
                                        borderRadius: "10px",
                                        fontFamily: "monospace",
                                        fontSize: "0.75rem",
                                        marginTop: "0.4rem",
                                        overflowX: "auto",
                                        whiteSpace: "pre-wrap",
                                        maxHeight: "260px",
                                        overflowY: "auto",
                                        lineHeight: 1.5
                                    }}>
                                        {errorSeleccionado.stack}
                                    </pre>
                                </div>
                            )}

                            <div style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "1rem",
                                fontSize: "0.75rem",
                                color: "#475569",
                                fontFamily: "monospace",
                                background: "#f8fafc",
                                padding: "0.75rem 1rem",
                                borderRadius: "10px",
                                border: "1px solid #e2e8f0"
                            }}>
                                <span><strong>Fecha:</strong> {new Date(errorSeleccionado.createdAt).toLocaleString("es-MX")}</span>
                                {errorSeleccionado.userId && <span><strong>Usuario ID:</strong> {errorSeleccionado.userId}</span>}
                                {errorSeleccionado.tenantId && <span><strong>Tenant:</strong> {errorSeleccionado.tenantId}</span>}
                            </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
                            <button
                                onClick={() => setErrorSeleccionado(null)}
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
            )}
        </div>
    );
}
