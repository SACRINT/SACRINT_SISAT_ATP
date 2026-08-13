"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ShieldCheck, Users, RefreshCw, Plus, AlertTriangle, CheckCircle2,
    Clock, Loader2, X, Save, ChevronDown, ChevronUp, FileText,
} from "lucide-react";

interface Escuela {
    id: string;
    cct: string;
    nombre: string;
}

interface Acta {
    id: string;
    tipoDocumento: string;
    nombreArchivo: string | null;
    fechaDocumento: string | null;
    createdAt: string;
}

interface Comite {
    id: string;
    escuelaId: string;
    cicloId: string | null;
    estado: string;
    fechaIntegracion: string | null;
    notasAtp: string | null;
    updatedAt: string;
    escuela: Escuela;
    actas: Acta[];
}

const ESTADO_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    ACTIVO:                  { label: "Activo ✓",            color: "bg-green-900/50 text-green-300",  icon: <CheckCircle2 size={12}/> },
    PENDIENTE_INTEGRACION:   { label: "Pendiente integración",color: "bg-yellow-900/50 text-yellow-300",icon: <Clock size={12}/> },
    REQUIERE_ACTUALIZACION:  { label: "Requiere actualización",color:"bg-orange-900/50 text-orange-300",icon: <AlertTriangle size={12}/> },
    INACTIVO:                { label: "Inactivo",             color: "bg-gray-700/50 text-gray-400",   icon: <X size={12}/> },
};

export default function ComitesPanel({ readOnly = false }: { readOnly?: boolean }) {
    const [comites, setComites] = useState<Comite[]>([]);
    const [escuelas, setEscuelas] = useState<Escuela[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandido, setExpandido] = useState<string | null>(null);
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [notasEdicion, setNotasEdicion] = useState<Record<string, string>>({});

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/comites");
            if (!res.ok) throw new Error("Error al cargar comités");
            const data = await res.json();
            setComites(data.comites ?? []);
            setEscuelas(data.escuelas ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Escuelas SIN comité registrado
    const comiteIds = new Set(comites.map(c => c.escuelaId));
    const escuelasSinComite = escuelas.filter(e => !comiteIds.has(e.id));

    // KPIs globales
    const total = escuelas.length;
    const activos = comites.filter(c => c.estado === "ACTIVO").length;
    const pendientes = comites.filter(c => c.estado === "PENDIENTE_INTEGRACION").length + escuelasSinComite.length;
    const reqActualizacion = comites.filter(c => c.estado === "REQUIERE_ACTUALIZACION").length;

    const actualizarComite = async (escuelaId: string, estado: string, notas?: string) => {
        setSaving(prev => ({ ...prev, [escuelaId]: true }));
        try {
            await fetch("/api/admin/comites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ escuelaId, estado, notasAtp: notas }),
            });
            await cargar();
        } catch { /* silencio */ } finally {
            setSaving(prev => ({ ...prev, [escuelaId]: false }));
        }
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
                        <ShieldCheck className="text-emerald-400" size={28} />
                        Comités de Convivencia y Seguridad
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Directorio zonal de comités escolares — Zona 004
                    </p>
                </div>
                <button onClick={cargar} className="btn-secondary flex items-center gap-2">
                    <RefreshCw size={15} /> Actualizar
                </button>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Total Planteles", value: total, color: "text-white", bg: "bg-gray-800/60" },
                    { label: "Comités Activos", value: activos, color: "text-green-400", bg: "bg-green-900/20 border-green-700/30" },
                    { label: "Pendientes", value: pendientes, color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-700/30" },
                    { label: "Req. Actualización", value: reqActualizacion, color: "text-orange-400", bg: "bg-orange-900/20 border-orange-700/30" },
                ].map(kpi => (
                    <div key={kpi.label} className={`${kpi.bg} border border-gray-700/30 rounded-xl p-4 text-center`}>
                        <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-gray-400 text-xs mt-1">{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Escuelas sin comité */}
            {escuelasSinComite.length > 0 && !readOnly && (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
                    <h3 className="text-yellow-300 font-semibold text-sm flex items-center gap-2 mb-3">
                        <AlertTriangle size={15} /> {escuelasSinComite.length} plantel(es) sin comité registrado
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {escuelasSinComite.map(esc => (
                            <button key={esc.id}
                                onClick={() => actualizarComite(esc.id, "PENDIENTE_INTEGRACION")}
                                disabled={saving[esc.id]}
                                className="text-xs px-3 py-1.5 bg-yellow-900/40 border border-yellow-700/50 text-yellow-300 rounded-lg hover:bg-yellow-900/60 transition-colors flex items-center gap-1">
                                {saving[esc.id] ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                Registrar {esc.cct}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabla de comités */}
            <div className="space-y-2">
                {comites.map(comite => {
                    const info = ESTADO_INFO[comite.estado] ?? ESTADO_INFO.PENDIENTE_INTEGRACION;
                    const expand = expandido === comite.id;
                    return (
                        <div key={comite.id} className="bg-gray-900/60 border border-gray-700/50 rounded-xl overflow-hidden">
                            <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-800/40 transition-colors"
                                onClick={() => setExpandido(expand ? null : comite.id)}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <ShieldCheck size={14} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-white font-medium text-sm">{comite.escuela.nombre}</span>
                                            <span className="text-gray-500 font-mono text-xs">{comite.escuela.cct}</span>
                                        </div>
                                        {comite.fechaIntegracion && (
                                            <span className="text-gray-500 text-xs">
                                                Integrado: {new Date(comite.fechaIntegracion).toLocaleDateString("es-MX")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${info.color}`}>
                                        {info.icon} {info.label}
                                    </span>
                                    {comite.actas.length > 0 && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <FileText size={12} /> {comite.actas.length} acta(s)
                                        </span>
                                    )}
                                    <span className="text-gray-500">
                                        {expand ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </span>
                                </div>
                            </div>

                            {expand && !readOnly && (
                                <div className="p-4 border-t border-gray-700/40 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="form-label">Estado del Comité</label>
                                            <select className="form-input"
                                                defaultValue={comite.estado}
                                                onChange={e => actualizarComite(comite.escuelaId, e.target.value, notasEdicion[comite.id] ?? comite.notasAtp ?? "")}>
                                                <option value="ACTIVO">Activo</option>
                                                <option value="PENDIENTE_INTEGRACION">Pendiente integración</option>
                                                <option value="REQUIERE_ACTUALIZACION">Requiere actualización</option>
                                                <option value="INACTIVO">Inactivo</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Notas del ATP</label>
                                            <div className="flex gap-2">
                                                <input className="form-input"
                                                    value={notasEdicion[comite.id] ?? comite.notasAtp ?? ""}
                                                    onChange={e => setNotasEdicion(prev => ({ ...prev, [comite.id]: e.target.value }))}
                                                    placeholder="Observaciones..." />
                                                <button
                                                    onClick={() => actualizarComite(comite.escuelaId, comite.estado, notasEdicion[comite.id] ?? "")}
                                                    disabled={saving[comite.escuelaId]}
                                                    className="btn-secondary px-3 flex items-center">
                                                    {saving[comite.escuelaId] ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {comite.actas.length > 0 && (
                                        <div>
                                            <p className="text-gray-400 text-xs font-medium mb-2">Actas registradas:</p>
                                            <div className="space-y-1">
                                                {comite.actas.map(acta => (
                                                    <div key={acta.id} className="flex items-center gap-2 text-xs text-gray-300">
                                                        <FileText size={12} className="text-gray-500" />
                                                        <span>{acta.nombreArchivo ?? acta.tipoDocumento}</span>
                                                        {acta.fechaDocumento && (
                                                            <span className="text-gray-500">
                                                                — {new Date(acta.fechaDocumento).toLocaleDateString("es-MX")}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {comites.length === 0 && escuelasSinComite.length === 0 && (
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-12 text-center">
                    <Users className="mx-auto text-gray-600 mb-3" size={40} />
                    <p className="text-gray-400">No hay planteles registrados</p>
                </div>
            )}
        </div>
    );
}
