"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Award, Plus, RefreshCw, Search, ExternalLink, Calendar,
    CheckCircle2, XCircle, Loader2, X, Save, AlertTriangle, Edit2,
} from "lucide-react";

interface Convocatoria {
    id: string;
    titulo: string;
    descripcion: string | null;
    tipo: string;
    archivoNombre: string | null;
    archivoUrl: string | null;
    fechaPublicacion: string;
    fechaVigencia: string | null;
    convocatoriaUrl: string | null;
    activo: boolean;
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
    CONCURSO:      { label: "Concurso de Oposición", color: "bg-purple-900/60 text-purple-300" },
    PROMOCION:     { label: "Promoción",              color: "bg-blue-900/60 text-blue-300" },
    ACTUALIZACION: { label: "Actualización",          color: "bg-teal-900/60 text-teal-300" },
    OTRO:          { label: "Otro",                   color: "bg-gray-700/60 text-gray-300" },
};

const FORM_VACIO = { titulo: "", descripcion: "", tipo: "CONCURSO", fechaVigencia: "", convocatoriaUrl: "" };

export default function UsicammPanel({ readOnly = false }: { readOnly?: boolean }) {
    const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editando, setEditando] = useState<Convocatoria | null>(null);
    const [form, setForm] = useState(FORM_VACIO);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/usicamm");
            if (!res.ok) throw new Error("Error al cargar convocatorias USICAMM");
            setConvocatorias(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirNueva = () => {
        setEditando(null);
        setForm(FORM_VACIO);
        setShowForm(true);
    };

    const abrirEditar = (c: Convocatoria) => {
        setEditando(c);
        setForm({
            titulo: c.titulo,
            descripcion: c.descripcion ?? "",
            tipo: c.tipo,
            fechaVigencia: c.fechaVigencia ? c.fechaVigencia.slice(0, 10) : "",
            convocatoriaUrl: c.convocatoriaUrl ?? "",
        });
        setShowForm(true);
    };

    const guardar = async () => {
        if (!form.titulo) return;
        setSaving(true);
        try {
            const body = {
                titulo: form.titulo,
                descripcion: form.descripcion || null,
                tipo: form.tipo,
                fechaVigencia: form.fechaVigencia || null,
                convocatoriaUrl: form.convocatoriaUrl || null,
            };
            if (editando) {
                await fetch(`/api/admin/usicamm/${editando.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            } else {
                await fetch("/api/admin/usicamm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            }
            setShowForm(false);
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const toggleActivo = async (c: Convocatoria) => {
        try {
            await fetch(`/api/admin/usicamm/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !c.activo }),
            });
            await cargar();
        } catch { /* silencio */ }
    };

    const filtradas = convocatorias.filter(c =>
        c.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    );

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
                        <Award className="text-yellow-400" size={28} />
                        Convocatorias USICAMM
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Difusión de concursos de oposición, promoción y actualización docente
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={cargar} className="btn-secondary flex items-center gap-2">
                        <RefreshCw size={15} /> Actualizar
                    </button>
                    {!readOnly && (
                        <button onClick={abrirNueva} className="btn-primary flex items-center gap-2">
                            <Plus size={15} /> Nueva Convocatoria
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Buscador */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="form-input pl-9" placeholder="Buscar convocatorias..." value={busqueda}
                    onChange={e => setBusqueda(e.target.value)} />
            </div>

            {/* Modal crear/editar */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                                <Award size={18} className="text-yellow-400" />
                                {editando ? "Editar Convocatoria" : "Nueva Convocatoria USICAMM"}
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="form-label">Título *</label>
                                <input className="form-input" value={form.titulo}
                                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                                    placeholder="Concurso de Oposición 2025-2026..." />
                            </div>
                            <div>
                                <label className="form-label">Tipo de Convocatoria</label>
                                <select className="form-input" value={form.tipo}
                                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                                    <option value="CONCURSO">Concurso de Oposición</option>
                                    <option value="PROMOCION">Promoción</option>
                                    <option value="ACTUALIZACION">Actualización</option>
                                    <option value="OTRO">Otro</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Descripción</label>
                                <textarea className="form-input min-h-[80px]" value={form.descripcion}
                                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Detalles importantes de la convocatoria..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label">Vigencia hasta</label>
                                    <input type="date" className="form-input" value={form.fechaVigencia}
                                        onChange={e => setForm(f => ({ ...f, fechaVigencia: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="form-label">URL Convocatoria Oficial</label>
                                    <input type="url" className="form-input" value={form.convocatoriaUrl}
                                        onChange={e => setForm(f => ({ ...f, convocatoriaUrl: e.target.value }))}
                                        placeholder="https://usicamm.gob.mx/..." />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                            <button onClick={guardar} disabled={saving || !form.titulo}
                                className="btn-primary flex-1 flex items-center justify-center gap-2">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                {editando ? "Guardar Cambios" : "Publicar Convocatoria"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Listado */}
            {filtradas.length === 0 ? (
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-12 text-center">
                    <Award className="mx-auto text-gray-600 mb-3" size={40} />
                    <p className="text-gray-400 font-medium">
                        {busqueda ? "No se encontraron convocatorias" : "No hay convocatorias publicadas"}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                        {!readOnly && !busqueda && "Publica la primera convocatoria con el botón \"Nueva Convocatoria\""}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtradas.map(c => {
                        const tipo = TIPO_LABELS[c.tipo] ?? TIPO_LABELS.OTRO;
                        const vigente = c.fechaVigencia ? new Date(c.fechaVigencia) > new Date() : true;
                        return (
                            <div key={c.id}
                                className={`bg-gray-900/60 border rounded-xl p-4 transition-all ${c.activo ? "border-gray-700/50" : "border-gray-800/30 opacity-60"}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${tipo.color}`}>{tipo.label}</span>
                                            {!vigente && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300">Vencida</span>
                                            )}
                                            {!c.activo && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400">Inactiva</span>
                                            )}
                                        </div>
                                        <h3 className="text-white font-semibold">{c.titulo}</h3>
                                        {c.descripcion && <p className="text-gray-400 text-sm mt-1 line-clamp-2">{c.descripcion}</p>}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} /> {new Date(c.fechaPublicacion).toLocaleDateString("es-MX")}
                                            </span>
                                            {c.fechaVigencia && (
                                                <span className={`flex items-center gap-1 ${vigente ? "text-green-400" : "text-red-400"}`}>
                                                    {vigente ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                    Vigente hasta {new Date(c.fechaVigencia).toLocaleDateString("es-MX")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {c.convocatoriaUrl && (
                                            <a href={c.convocatoriaUrl} target="_blank" rel="noopener noreferrer"
                                                className="btn-secondary text-xs py-1 px-3 flex items-center gap-1">
                                                <ExternalLink size={13} /> Ver
                                            </a>
                                        )}
                                        {!readOnly && (
                                            <>
                                                <button onClick={() => abrirEditar(c)}
                                                    className="btn-secondary text-xs py-1 px-3 flex items-center gap-1">
                                                    <Edit2 size={13} />
                                                </button>
                                                <button onClick={() => toggleActivo(c)}
                                                    className={`text-xs py-1 px-3 rounded-lg border transition-colors ${c.activo ? "border-red-700/50 text-red-400 hover:bg-red-900/30" : "border-green-700/50 text-green-400 hover:bg-green-900/30"}`}>
                                                    {c.activo ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
