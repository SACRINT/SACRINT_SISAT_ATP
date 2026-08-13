"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users, BookOpen, CheckCircle2, Clock, AlertTriangle,
    ChevronDown, ChevronUp, Plus, Settings, RefreshCw,
    FileText, Calendar, GraduationCap, Loader2, X, Save,
} from "lucide-react";

interface Escuela {
    id: string;
    cct: string;
    nombre: string;
}

interface Producto {
    id: string;
    escuelaId: string;
    estado: string;
    notasAtp: string | null;
    updatedAt: string;
    escuela: Escuela;
}

interface Sesion {
    id: string;
    numero: number;
    fase: "INTENSIVA" | "ORDINARIA";
    descripcion: string | null;
    fechaSesion: string | null;
    fechaLimite: string | null;
    guiaUrl: string | null;
    activo: boolean;
    productos: Producto[];
}

const ESTADO_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PENDIENTE:      { label: "Pendiente",    color: "bg-gray-700 text-gray-200",    icon: <Clock size={12} /> },
    ENTREGADO:      { label: "Entregado",    color: "bg-blue-900 text-blue-200",    icon: <FileText size={12} /> },
    REVISADO:       { label: "Revisado ✓",   color: "bg-green-900 text-green-200",  icon: <CheckCircle2 size={12} /> },
    OBSERVACIONES:  { label: "Observaciones",color: "bg-yellow-900 text-yellow-200",icon: <AlertTriangle size={12} /> },
};

export default function CteSesionesPanel({ readOnly = false }: { readOnly?: boolean }) {
    const [sesiones, setSesiones] = useState<Sesion[]>([]);
    const [escuelas, setEscuelas] = useState<Escuela[]>([]);
    const [loading, setLoading] = useState(true);
    const [sesionExpandida, setSesionExpandida] = useState<string | null>(null);
    const [showFormSesion, setShowFormSesion] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Formulario nueva sesión
    const [formSesion, setFormSesion] = useState({
        numero: "",
        fase: "ORDINARIA",
        descripcion: "",
        fechaSesion: "",
        fechaLimite: "",
        guiaUrl: "",
    });

    // Notas inline
    const [notasEdicion, setNotasEdicion] = useState<Record<string, string>>({});
    const [savingNotas, setSavingNotas] = useState<Record<string, boolean>>({});

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/cte");
            if (!res.ok) throw new Error("Error al cargar datos de CTE");
            const data = await res.json();
            setSesiones(data.sesiones ?? []);
            setEscuelas(data.escuelas ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const crearSesion = async () => {
        if (!formSesion.numero || !formSesion.fase) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/cte", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    numero: Number(formSesion.numero),
                    fase: formSesion.fase,
                    descripcion: formSesion.descripcion || null,
                    fechaSesion: formSesion.fechaSesion || null,
                    fechaLimite: formSesion.fechaLimite || null,
                    guiaUrl: formSesion.guiaUrl || null,
                }),
            });
            if (!res.ok) throw new Error("Error al crear sesión");
            setShowFormSesion(false);
            setFormSesion({ numero: "", fase: "ORDINARIA", descripcion: "", fechaSesion: "", fechaLimite: "", guiaUrl: "" });
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al crear sesión");
        } finally {
            setSaving(false);
        }
    };

    const actualizarEstado = async (productoId: string, estado: string) => {
        try {
            await fetch(`/api/admin/cte/${productoId}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado }),
            });
            await cargar();
        } catch { /* silencio */ }
    };

    const guardarNotas = async (productoId: string) => {
        setSavingNotas(prev => ({ ...prev, [productoId]: true }));
        try {
            await fetch(`/api/admin/cte/${productoId}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notasAtp: notasEdicion[productoId] ?? "" }),
            });
            await cargar();
        } catch { /* silencio */ } finally {
            setSavingNotas(prev => ({ ...prev, [productoId]: false }));
        }
    };

    const resumenSesion = (sesion: Sesion) => {
        const total = escuelas.length;
        const entregados = sesion.productos.filter(p => p.estado !== "PENDIENTE").length;
        const revisados = sesion.productos.filter(p => p.estado === "REVISADO").length;
        const conObs = sesion.productos.filter(p => p.estado === "OBSERVACIONES").length;
        return { total, entregados, revisados, conObs, pendientes: total - entregados };
    };

    const escuelasEnSesion = (sesion: Sesion) => {
        const productosMap = new Map(sesion.productos.map(p => [p.escuelaId, p]));
        return escuelas.map(esc => ({
            escuela: esc,
            producto: productosMap.get(esc.id) ?? null,
        }));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-indigo-400" size={36} />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <GraduationCap className="text-indigo-400" size={28} />
                        Acompañamiento CTE
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Repositorio de productos de Consejos Técnicos Escolares — Zona 004
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={cargar} className="btn-secondary flex items-center gap-2">
                        <RefreshCw size={15} /> Actualizar
                    </button>
                    {!readOnly && (
                        <button onClick={() => setShowFormSesion(true)} className="btn-primary flex items-center gap-2">
                            <Plus size={15} /> Nueva Sesión
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Modal nueva sesión */}
            {showFormSesion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                                <Settings size={18} className="text-indigo-400" /> Configurar Sesión CTE
                            </h3>
                            <button onClick={() => setShowFormSesion(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label">Número de Sesión *</label>
                                    <input type="number" min="1" className="form-input" value={formSesion.numero}
                                        onChange={e => setFormSesion(f => ({ ...f, numero: e.target.value }))} placeholder="1" />
                                </div>
                                <div>
                                    <label className="form-label">Fase *</label>
                                    <select className="form-input" value={formSesion.fase}
                                        onChange={e => setFormSesion(f => ({ ...f, fase: e.target.value }))}>
                                        <option value="ORDINARIA">Ordinaria</option>
                                        <option value="INTENSIVA">Intensiva</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Descripción / Tema</label>
                                <input className="form-input" value={formSesion.descripcion}
                                    onChange={e => setFormSesion(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Ruta de mejora, Plan anual..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label">Fecha de Sesión</label>
                                    <input type="date" className="form-input" value={formSesion.fechaSesion}
                                        onChange={e => setFormSesion(f => ({ ...f, fechaSesion: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="form-label">Fecha Límite Entrega</label>
                                    <input type="date" className="form-input" value={formSesion.fechaLimite}
                                        onChange={e => setFormSesion(f => ({ ...f, fechaLimite: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">URL Guía Oficial</label>
                                <input type="url" className="form-input" value={formSesion.guiaUrl}
                                    onChange={e => setFormSesion(f => ({ ...f, guiaUrl: e.target.value }))}
                                    placeholder="https://..." />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowFormSesion(false)} className="btn-secondary flex-1">Cancelar</button>
                            <button onClick={crearSesion} disabled={saving || !formSesion.numero}
                                className="btn-primary flex-1 flex items-center justify-center gap-2">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                Guardar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tarjetas de sesiones */}
            {sesiones.length === 0 ? (
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-12 text-center">
                    <GraduationCap className="mx-auto text-gray-600 mb-3" size={40} />
                    <p className="text-gray-400 font-medium">No hay sesiones de CTE configuradas</p>
                    <p className="text-gray-500 text-sm mt-1">Crea la primera sesión con el botón "Nueva Sesión"</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sesiones.map(sesion => {
                        const res = resumenSesion(sesion);
                        const expandida = sesionExpandida === sesion.id;
                        const pct = res.total > 0 ? Math.round((res.entregados / res.total) * 100) : 0;
                        return (
                            <div key={sesion.id} className="bg-gray-900/60 border border-gray-700/50 rounded-xl overflow-hidden">
                                {/* Cabecera de sesión */}
                                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/40 transition-colors"
                                    onClick={() => setSesionExpandida(expandida ? null : sesion.id)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                            <span className="text-indigo-300 font-bold text-sm">{sesion.numero}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-semibold">
                                                    Sesión {sesion.numero} — {sesion.fase === "INTENSIVA" ? "Fase Intensiva" : "Fase Ordinaria"}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${sesion.fase === "INTENSIVA" ? "bg-purple-900/50 text-purple-300" : "bg-blue-900/50 text-blue-300"}`}>
                                                    {sesion.fase}
                                                </span>
                                            </div>
                                            {sesion.descripcion && <p className="text-gray-400 text-sm mt-0.5">{sesion.descripcion}</p>}
                                            <div className="flex items-center gap-4 mt-1">
                                                {sesion.fechaSesion && (
                                                    <span className="text-gray-500 text-xs flex items-center gap-1">
                                                        <Calendar size={11} /> {new Date(sesion.fechaSesion).toLocaleDateString("es-MX")}
                                                    </span>
                                                )}
                                                {sesion.fechaLimite && (
                                                    <span className="text-gray-500 text-xs flex items-center gap-1">
                                                        <Clock size={11} /> Límite: {new Date(sesion.fechaLimite).toLocaleDateString("es-MX")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        {/* KPIs compactos */}
                                        <div className="hidden md:flex items-center gap-4">
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-white">{pct}%</div>
                                                <div className="text-xs text-gray-400">Entregados</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-green-400">{res.revisados}</div>
                                                <div className="text-xs text-gray-400">Revisados</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-yellow-400">{res.conObs}</div>
                                                <div className="text-xs text-gray-400">Obs.</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-gray-400">{res.pendientes}</div>
                                                <div className="text-xs text-gray-400">Pendientes</div>
                                            </div>
                                        </div>
                                        <div className="text-gray-400">
                                            {expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Barra de progreso */}
                                <div className="h-1 bg-gray-800">
                                    <div className={`h-full transition-all duration-500 ${pct === 100 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-yellow-500"}`}
                                        style={{ width: `${pct}%` }} />
                                </div>

                                {/* Tabla de escuelas — expandible */}
                                {expandida && (
                                    <div className="p-4">
                                        {sesion.guiaUrl && (
                                            <a href={sesion.guiaUrl} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm mb-4">
                                                <BookOpen size={14} /> Ver Guía Oficial de Trabajo
                                            </a>
                                        )}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-gray-400 border-b border-gray-700/50">
                                                        <th className="text-left py-2 px-3 font-medium">CCT</th>
                                                        <th className="text-left py-2 px-3 font-medium">Plantel</th>
                                                        <th className="text-center py-2 px-3 font-medium">Estado</th>
                                                        {!readOnly && <th className="text-left py-2 px-3 font-medium">Notas ATP</th>}
                                                        {!readOnly && <th className="text-center py-2 px-3 font-medium">Acción</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700/30">
                                                    {escuelasEnSesion(sesion).map(({ escuela, producto }) => {
                                                        const est = producto?.estado ?? "PENDIENTE";
                                                        const badge = ESTADO_LABELS[est] ?? ESTADO_LABELS.PENDIENTE;
                                                        return (
                                                            <tr key={escuela.id} className="hover:bg-gray-800/30 transition-colors">
                                                                <td className="py-2 px-3 text-gray-300 font-mono text-xs">{escuela.cct}</td>
                                                                <td className="py-2 px-3 text-white">{escuela.nombre}</td>
                                                                <td className="py-2 px-3 text-center">
                                                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                                                                        {badge.icon} {badge.label}
                                                                    </span>
                                                                </td>
                                                                {!readOnly && (
                                                                    <td className="py-2 px-3">
                                                                        {producto && (
                                                                            <div className="flex gap-1">
                                                                                <input
                                                                                    className="form-input text-xs py-1 px-2"
                                                                                    placeholder="Notas..."
                                                                                    value={notasEdicion[producto.id] ?? producto.notasAtp ?? ""}
                                                                                    onChange={e => setNotasEdicion(prev => ({ ...prev, [producto.id]: e.target.value }))}
                                                                                />
                                                                                <button
                                                                                    onClick={() => guardarNotas(producto.id)}
                                                                                    disabled={savingNotas[producto.id]}
                                                                                    className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                                                                                >
                                                                                    {savingNotas[producto.id] ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                )}
                                                                {!readOnly && (
                                                                    <td className="py-2 px-3 text-center">
                                                                        {producto && (
                                                                            <select
                                                                                className="form-input text-xs py-1 px-2"
                                                                                value={est}
                                                                                onChange={e => actualizarEstado(producto.id, e.target.value)}
                                                                            >
                                                                                <option value="PENDIENTE">Pendiente</option>
                                                                                <option value="ENTREGADO">Entregado</option>
                                                                                <option value="REVISADO">Revisado</option>
                                                                                <option value="OBSERVACIONES">Con Observaciones</option>
                                                                            </select>
                                                                        )}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><Users size={12} />{escuelas.length} planteles</span>
                                            <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={12} />{res.revisados} revisados</span>
                                            <span className="flex items-center gap-1 text-yellow-400"><AlertTriangle size={12} />{res.conObs} con observaciones</span>
                                            <span className="flex items-center gap-1 text-gray-400"><Clock size={12} />{res.pendientes} pendientes</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
