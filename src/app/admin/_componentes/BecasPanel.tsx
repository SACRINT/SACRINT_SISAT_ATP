"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BookMarked, Plus, RefreshCw, ExternalLink, Calendar, AlertTriangle,
    CheckCircle2, Loader2, X, Save, Clock, Search, Edit2,
} from "lucide-react";

interface Convocatoria {
    id: string;
    nombre: string;
    descripcion: string | null;
    nivel: string;
    modalidad: string | null;
    fechaInicio: string | null;
    fechaFin: string | null;
    convocatoriaUrl: string | null;
    activo: boolean;
}

const NIVEL_LABELS: Record<string, { label: string; color: string }> = {
    FEDERAL:   { label: "Federal",   color: "bg-indigo-900/60 text-indigo-300" },
    ESTATAL:   { label: "Estatal",   color: "bg-blue-900/60 text-blue-300" },
    MUNICIPAL: { label: "Municipal", color: "bg-teal-900/60 text-teal-300" },
    OTRO:      { label: "Otro",      color: "bg-gray-700/60 text-gray-300" },
};

const FORM_VACIO = {
    nombre: "", descripcion: "", nivel: "FEDERAL", modalidad: "",
    fechaInicio: "", fechaFin: "", convocatoriaUrl: "",
};

export default function BecasPanel({ readOnly = false }: { readOnly?: boolean }) {
    const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editando, setEditando] = useState<Convocatoria | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(FORM_VACIO);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/becas");
            if (!res.ok) throw new Error("Error al cargar convocatorias de becas");
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
            nombre: c.nombre,
            descripcion: c.descripcion ?? "",
            nivel: c.nivel,
            modalidad: c.modalidad ?? "",
            fechaInicio: c.fechaInicio ? c.fechaInicio.slice(0, 10) : "",
            fechaFin: c.fechaFin ? c.fechaFin.slice(0, 10) : "",
            convocatoriaUrl: c.convocatoriaUrl ?? "",
        });
        setShowForm(true);
    };

    const guardar = async () => {
        if (!form.nombre) return;
        setSaving(true);
        try {
            const body = {
                nombre: form.nombre,
                descripcion: form.descripcion || null,
                nivel: form.nivel,
                modalidad: form.modalidad || null,
                fechaInicio: form.fechaInicio || null,
                fechaFin: form.fechaFin || null,
                convocatoriaUrl: form.convocatoriaUrl || null,
            };
            const url = editando ? `/api/admin/becas/${editando.id}` : "/api/admin/becas";
            const method = editando ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("Error al guardar");
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
            await fetch(`/api/admin/becas/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !c.activo }),
            });
            await cargar();
        } catch { /* silencio */ }
    };

    const filtradas = convocatorias.filter(c =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    );

    // Calcular si está vigente
    const esVigente = (c: Convocatoria) => {
        if (!c.fechaFin) return true;
        return new Date(c.fechaFin) >= new Date();
    };

    // KPIs rápidos
    const vigentes = convocatorias.filter(c => c.activo && esVigente(c)).length;
    const vencidas = convocatorias.filter(c => c.activo && !esVigente(c)).length;

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
                        <BookMarked className="text-pink-400" size={28} />
                        Difusión de Becas
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Directorio de convocatorias de becas y apoyos educativos (solo metadatos — sin datos nominales)
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

            {/* Banner Zero-Payload */}
            <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-indigo-300 text-sm">
                    <span className="font-semibold">Política Zero-Payload:</span> Esta sección almacena únicamente metadatos de convocatorias
                    (nombres, fechas, URLs). Jamás se deben registrar nombres de becarios, CURP, ni datos bancarios en esta plataforma.
                </p>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/60 border border-gray-700/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-white">{convocatorias.length}</div>
                    <div className="text-gray-400 text-xs mt-1">Total convocatorias</div>
                </div>
                <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">{vigentes}</div>
                    <div className="text-gray-400 text-xs mt-1">Vigentes</div>
                </div>
                <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-400">{vencidas}</div>
                    <div className="text-gray-400 text-xs mt-1">Vencidas</div>
                </div>
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="form-input pl-9" placeholder="Buscar convocatorias de becas..." value={busqueda}
                    onChange={e => setBusqueda(e.target.value)} />
            </div>

            {/* Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                                <BookMarked size={18} className="text-pink-400" />
                                {editando ? "Editar Convocatoria" : "Nueva Convocatoria de Becas"}
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="form-label">Nombre de la Convocatoria *</label>
                                <input className="form-input" value={form.nombre}
                                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                    placeholder="Beca Benito Juárez 2025-2026..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label">Nivel</label>
                                    <select className="form-input" value={form.nivel}
                                        onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}>
                                        <option value="FEDERAL">Federal</option>
                                        <option value="ESTATAL">Estatal</option>
                                        <option value="MUNICIPAL">Municipal</option>
                                        <option value="OTRO">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Modalidad</label>
                                    <input className="form-input" value={form.modalidad}
                                        onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))}
                                        placeholder="Primaria, Secundaria..." />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Descripción (metadatos)</label>
                                <textarea className="form-input min-h-[80px]" value={form.descripcion}
                                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Requisitos, detalles relevantes..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label">Fecha Inicio</label>
                                    <input type="date" className="form-input" value={form.fechaInicio}
                                        onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="form-label">Fecha Cierre</label>
                                    <input type="date" className="form-input" value={form.fechaFin}
                                        onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">URL de la Convocatoria Oficial</label>
                                <input type="url" className="form-input" value={form.convocatoriaUrl}
                                    onChange={e => setForm(f => ({ ...f, convocatoriaUrl: e.target.value }))}
                                    placeholder="https://..." />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                            <button onClick={guardar} disabled={saving || !form.nombre}
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
                    <BookMarked className="mx-auto text-gray-600 mb-3" size={40} />
                    <p className="text-gray-400 font-medium">
                        {busqueda ? "Sin resultados para la búsqueda" : "No hay convocatorias de becas publicadas"}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtradas.map(c => {
                        const nivel = NIVEL_LABELS[c.nivel] ?? NIVEL_LABELS.OTRO;
                        const vigente = esVigente(c);
                        return (
                            <div key={c.id}
                                className={`bg-gray-900/60 border rounded-xl p-4 transition-all ${c.activo ? "border-gray-700/50" : "border-gray-800/30 opacity-60"}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${nivel.color}`}>{nivel.label}</span>
                                            {c.modalidad && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-900/40 text-pink-300">{c.modalidad}</span>
                                            )}
                                            {!vigente && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 flex items-center gap-1">
                                                    <Clock size={10} /> Vencida
                                                </span>
                                            )}
                                            {vigente && c.activo && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> Vigente
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-white font-semibold">{c.nombre}</h3>
                                        {c.descripcion && <p className="text-gray-400 text-sm mt-1 line-clamp-2">{c.descripcion}</p>}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            {c.fechaInicio && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={11} /> Inicio: {new Date(c.fechaInicio).toLocaleDateString("es-MX")}
                                                </span>
                                            )}
                                            {c.fechaFin && (
                                                <span className={`flex items-center gap-1 ${vigente ? "text-green-400" : "text-red-400"}`}>
                                                    <Clock size={11} /> Cierre: {new Date(c.fechaFin).toLocaleDateString("es-MX")}
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
                                                    {c.activo ? <X size={13} /> : <CheckCircle2 size={13} />}
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
