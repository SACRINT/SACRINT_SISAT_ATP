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
    Filter,
    Server,
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
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="relative bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-start sm:items-center gap-4 relative z-10">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-red-500/10 to-rose-500/20 border border-red-200 text-red-600 shadow-sm shrink-0">
                        <AlertTriangle className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                                Registro de Errores del Servidor
                            </h2>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                Log en vivo
                            </span>
                        </div>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                            Monitoreo y bitácora centralizada de excepciones de backend en tiempo real
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10 shrink-0">
                    <button
                        onClick={() => cargarErrores(page)}
                        disabled={loading}
                        className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 active:scale-95 border border-slate-300 rounded-xl transition-all duration-200 shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
                        Actualizar
                    </button>
                    <button
                        onClick={handleLimpiar}
                        disabled={limpiando || errores.length === 0}
                        className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed rounded-xl transition-all duration-200 shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                        <Trash2 className="w-4 h-4" />
                        {limpiando ? "Limpiando..." : "Limpiar Errores"}
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {mensajeFeedback && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 shadow-xs animate-in fade-in duration-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium">{mensajeFeedback}</span>
                </div>
            )}

            {/* Summary Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                    <Server className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-700">Estado del Sistema:</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        Total capturado: <strong className="text-slate-900">{total}</strong>
                    </span>
                </div>

                <div className="flex items-center gap-2 text-slate-500">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Límite por página: 20 registros</span>
                </div>
            </div>

            {/* Main Content Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                {loading && errores.length === 0 ? (
                    <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-sm font-medium text-slate-700">Cargando bitácora de excepciones...</p>
                    </div>
                ) : errores.length === 0 ? (
                    <div className="p-16 text-center text-slate-500 space-y-3">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">
                            Sin excepciones en el servidor
                        </h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            No se han registrado fallos ni excepciones no capturadas. Las rutas y APIs operan normalmente.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3.5">Fecha y Hora</th>
                                    <th className="px-6 py-3.5">Método y Ruta</th>
                                    <th className="px-6 py-3.5">Mensaje del Error</th>
                                    <th className="px-6 py-3.5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {errores.map((err) => (
                                    <tr key={err.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 text-xs whitespace-nowrap text-slate-500 font-mono">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{new Date(err.createdAt).toLocaleString("es-MX")}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2.5 font-mono text-xs">
                                                <span
                                                    className={`px-2 py-0.5 rounded-md font-bold border ${
                                                        err.metodo === "DELETE"
                                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                                            : err.metodo === "POST" || err.metodo === "PATCH" || err.metodo === "PUT"
                                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                                            : "bg-blue-50 text-blue-700 border-blue-200"
                                                    }`}
                                                >
                                                    {err.metodo}
                                                </span>
                                                <span className="font-semibold text-slate-800">{err.ruta}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-md">
                                            <div className="p-2 rounded-lg bg-red-50/70 border border-red-100 text-red-700 font-mono text-xs truncate inline-block max-w-full">
                                                {err.mensaje}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => setErrorSeleccionado(err)}
                                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 active:scale-95 rounded-lg transition-all border border-slate-300 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                                Ver Detalle
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
                    <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
                        <span>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => cargarErrores(page - 1)}
                                disabled={page === 1}
                                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Anterior
                            </button>
                            <button
                                onClick={() => cargarErrores(page + 1)}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                                Siguiente
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Stack Trace */}
            {errorSeleccionado && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100">
                                    <Code className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Detalle de la Excepción
                                    </h3>
                                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                                        <span className="font-bold text-slate-700">[{errorSeleccionado.metodo}]</span> {errorSeleccionado.ruta}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setErrorSeleccionado(null)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Mensaje de Error:</span>
                                <div className="p-3.5 bg-red-50/80 border border-red-200/80 rounded-xl text-red-900 font-mono text-xs mt-1.5 shadow-2xs font-semibold">
                                    {errorSeleccionado.mensaje}
                                </div>
                            </div>

                            {errorSeleccionado.stack && (
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stack Trace:</span>
                                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs mt-1.5 overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto shadow-inner leading-relaxed border border-slate-800">
                                        {errorSeleccionado.stack}
                                    </pre>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-3 border-t border-slate-100 font-mono bg-slate-50 p-3 rounded-xl">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <strong className="text-slate-700">Fecha:</strong> {new Date(errorSeleccionado.createdAt).toLocaleString("es-MX")}
                                </span>
                                {errorSeleccionado.userId && (
                                    <span className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <strong className="text-slate-700">Usuario ID:</strong> {errorSeleccionado.userId}
                                    </span>
                                )}
                                {errorSeleccionado.tenantId && (
                                    <span className="flex items-center gap-1.5">
                                        <Server className="w-3.5 h-3.5 text-slate-400" />
                                        <strong className="text-slate-700">Tenant:</strong> {errorSeleccionado.tenantId}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setErrorSeleccionado(null)}
                                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
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
