"use client";

import { useState, useEffect, useCallback } from "react";
import {
    AlertTriangle,
    Trash2,
    RefreshCw,
    ShieldAlert,
    Clock,
    User,
    Code,
    CheckCircle2,
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
        if (!confirm("¿Estás seguro de que deseas borrar todos los registros de errores?")) return;
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-100">
                                Registro de Errores del Servidor
                            </h2>
                            <p className="text-sm text-slate-400">
                                Monitoreo y bitácora de excepciones en tiempo real
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => cargarErrores(page)}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700 flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Actualizar
                    </button>
                    <button
                        onClick={handleLimpiar}
                        disabled={limpiando || errores.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        {limpiando ? "Limpiando..." : "Limpiar Errores"}
                    </button>
                </div>
            </div>

            {mensajeFeedback && (
                <div className="p-4 rounded-xl bg-slate-800/80 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{mensajeFeedback}</span>
                </div>
            )}

            {/* Total Badge */}
            <div className="flex items-center justify-between px-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Registrados: <strong className="text-slate-200">{total}</strong>
                </span>
            </div>

            {/* Content Table */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                {loading && errores.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Cargando errores...
                    </div>
                ) : errores.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 space-y-2">
                        <ShieldAlert className="w-10 h-10 mx-auto text-emerald-500/50" />
                        <p className="text-base font-medium text-slate-300">
                            No hay errores registrados
                        </p>
                        <p className="text-xs text-slate-500">
                            El sistema funciona correctamente sin excepciones capturadas.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Fecha / Hora</th>
                                    <th className="px-6 py-4">Método / Ruta</th>
                                    <th className="px-6 py-4">Mensaje de Error</th>
                                    <th className="px-6 py-4 text-right">Detalles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {errores.map((err) => (
                                    <tr key={err.id} className="hover:bg-slate-800/30 transition">
                                        <td className="px-6 py-4 text-xs whitespace-nowrap text-slate-400 font-mono">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                {new Date(err.createdAt).toLocaleString("es-MX")}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 font-mono text-xs">
                                                <span
                                                    className={`px-2 py-0.5 rounded font-bold ${
                                                        err.metodo === "DELETE"
                                                            ? "bg-red-500/20 text-red-400"
                                                            : err.metodo === "POST" || err.metodo === "PATCH"
                                                            ? "bg-amber-500/20 text-amber-400"
                                                            : "bg-sky-500/20 text-sky-400"
                                                    }`}
                                                >
                                                    {err.metodo}
                                                </span>
                                                <span className="text-slate-200">{err.ruta}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-red-300 max-w-md truncate">
                                            {err.mensaje}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => setErrorSeleccionado(err)}
                                                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition border border-slate-700"
                                            >
                                                Ver Stack
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>Página {page} de {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => cargarErrores(page - 1)}
                                disabled={page === 1}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded transition"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => cargarErrores(page + 1)}
                                disabled={page === totalPages}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded transition"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Stack Trace */}
            {errorSeleccionado && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                                    <Code className="w-5 h-5 text-red-400" />
                                    Detalle del Error
                                </h3>
                                <p className="text-xs text-slate-400 font-mono mt-1">
                                    [{errorSeleccionado.metodo}] {errorSeleccionado.ruta}
                                </p>
                            </div>
                            <button
                                onClick={() => setErrorSeleccionado(null)}
                                className="text-slate-400 hover:text-slate-200 text-sm px-2 py-1 bg-slate-800 rounded"
                            >
                                ✕ Cerrar
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <span className="text-xs font-semibold text-slate-400">Mensaje:</span>
                                <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-red-300 font-mono text-xs mt-1">
                                    {errorSeleccionado.mensaje}
                                </div>
                            </div>

                            {errorSeleccionado.stack && (
                                <div>
                                    <span className="text-xs font-semibold text-slate-400">Stack Trace:</span>
                                    <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono text-xs mt-1 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                                        {errorSeleccionado.stack}
                                    </pre>
                                </div>
                            )}

                            <div className="flex gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800 font-mono">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {new Date(errorSeleccionado.createdAt).toLocaleString("es-MX")}
                                </span>
                                {errorSeleccionado.userId && (
                                    <span className="flex items-center gap-1">
                                        <User className="w-3.5 h-3.5" />
                                        User: {errorSeleccionado.userId}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
