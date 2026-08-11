"use client";

import { useEffect, useState } from "react";

interface Programa {
    id: string;
    nombre: string;
    descripcion?: string;
    activo: boolean;
    visibleEnDirector: boolean;
    quienesPuedenSubir: string[];
}

interface ModuleConfigs {
    sidebarConfig: Record<string, boolean>;
    oficiosConfig: { activo: boolean; visibleEnDirector: boolean };
    sparhConfig: { activo: boolean; visibleEnDirector: boolean };
    eventosConfig: { activo: boolean };
    circularConfig: { activo: boolean };
    olimpiadaConfig: { activo: boolean };
    paecConfig: { activo: boolean };
    expedientesConfig: { activo: boolean };
    planeacionesConfig: { activoGlobal: boolean };
    programas: Programa[];
}

export default function ActivacionModulosPanel() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mensaje, setMensaje] = useState<string | null>(null);

    // States
    const [showOficios, setShowOficios] = useState(true);
    const [showSparh, setShowSparh] = useState(true);
    const [showBecas, setShowBecas] = useState(true);
    const [showEventos, setShowEventos] = useState(true);
    const [showCircular05, setShowCircular05] = useState(true);
    const [showOlimpiada, setShowOlimpiada] = useState(true);
    const [showPAEC, setShowPAEC] = useState(true);
    const [showCapems, setShowCapems] = useState(true);
    const [showExpedientes, setShowExpedientes] = useState(true);
    const [showPlaneaciones, setShowPlaneaciones] = useState(true);

    const [programas, setProgramas] = useState<Programa[]>([]);

    useEffect(() => {
        cargarConfigs();
    }, []);

    const cargarConfigs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/modulos-activacion");
            const data: ModuleConfigs = await res.json();

            if (data.sidebarConfig) {
                setShowOficios(data.sidebarConfig.showOficios ?? true);
                setShowSparh(data.sidebarConfig.showSparh ?? true);
                setShowBecas(data.sidebarConfig.showBecas ?? true);
                setShowEventos(data.sidebarConfig.showEventos ?? true);
                setShowCircular05(data.sidebarConfig.showCircular05 ?? true);
                setShowOlimpiada(data.sidebarConfig.showOlimpiada ?? true);
                setShowPAEC(data.sidebarConfig.showPAEC ?? true);
                setShowCapems(data.sidebarConfig.showCapems ?? true);
                setShowExpedientes(data.sidebarConfig.showExpedientes ?? true);
            }
            if (data.planeacionesConfig) {
                setShowPlaneaciones(data.planeacionesConfig.activoGlobal ?? true);
            }
            if (Array.isArray(data.programas)) {
                setProgramas(data.programas);
            }
        } catch (err) {
            console.error("Error al cargar configuración de módulos:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleGuardar = async () => {
        setSaving(true);
        setMensaje(null);
        try {
            const res = await fetch("/api/admin/modulos-activacion", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sidebarConfig: {
                        showOficios,
                        showSparh,
                        showBecas,
                        showEventos,
                        showCircular05,
                        showOlimpiada,
                        showPAEC,
                        showCapems,
                        showExpedientes
                    },
                    oficiosConfig: { activo: showOficios, visibleEnDirector: showOficios },
                    sparhConfig: { activo: showSparh, visibleEnDirector: showSparh },
                    eventosActivo: showEventos,
                    circularActivo: showCircular05,
                    olimpiadaActivo: showOlimpiada,
                    paecActivo: showPAEC,
                    planeacionesActivo: showPlaneaciones,
                    programas
                })
            });

            const data = await res.json();
            if (res.ok) {
                setMensaje("¡Configuración de módulos y permisos guardada con éxito!");
            } else {
                setMensaje(`Error: ${data.error || "No se pudo guardar"}`);
            }
        } catch (err) {
            setMensaje("Error de conexión al guardar cambios.");
        } finally {
            setSaving(false);
        }
    };

    const togglePermisoRol = (programaId: string, rol: string) => {
        setProgramas((prev) =>
            prev.map((p) => {
                if (p.id !== programaId) return p;
                const actuales = p.quienesPuedenSubir || ["director"];
                const existe = actuales.includes(rol);
                const nuevos = existe ? actuales.filter((r) => r !== rol) : [...actuales, rol];
                return { ...p, quienesPuedenSubir: nuevos.length > 0 ? nuevos : ["director"] };
            })
        );
    };

    const toggleProgramaProp = (programaId: string, prop: "activo" | "visibleEnDirector") => {
        setProgramas((prev) =>
            prev.map((p) => (p.id === programaId ? { ...p, [prop]: !p[prop] } : p))
        );
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-400">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                <p className="mt-2 text-sm font-medium">Cargando configuración de módulos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Encabezado Principal */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-5">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Activación de Módulos & Permisos de Subida</h2>
                    <p className="text-sm text-slate-400">
                        Controla los interruptores maestros de la plataforma SISAT-ATP y define qué roles pueden subir documentos por programa.
                    </p>
                </div>
                <button
                    onClick={handleGuardar}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                    {saving ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Guardando...
                        </>
                    ) : (
                        <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Guardar Cambios
                        </>
                    )}
                </button>
            </div>

            {mensaje && (
                <div className={`p-4 rounded-xl text-sm font-medium border transition-all ${mensaje.includes("éxito") ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-rose-950/40 border-rose-500/30 text-rose-300"}`}>
                    {mensaje}
                </div>
            )}

            {/* SECCIÓN 1: INTERRUPTORES MAESTROS DE MÓDULOS DEL SISTEMA */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
                <div className="mb-6 flex items-center gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Interruptores Maestros de Módulos Generales</h3>
                        <p className="text-xs text-slate-400">Módulos sin vigencia o desactivados desaparecerán del dashboard de Directores y Supervisores.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { title: "Oficios con IA", desc: "Recepción, semaforización y acuses de oficios", val: showOficios, setVal: setShowOficios, badge: "ATP-MOD-01" },
                        { title: "Plantillas SPARH / CENSUS", desc: "Validación matemática de plantillas de personal", val: showSparh, setVal: setShowSparh, badge: "ATP-MOD-02" },
                        { title: "Becas Benito Juárez", desc: "Convocatorias y guías informativas generales", val: showBecas, setVal: setShowBecas, badge: "ATP-MOD-05" },
                        { title: "Eventos Culturales", desc: "Inscripción de disciplinas y alumnos", val: showEventos, setVal: setShowEventos },
                        { title: "Circular 05", desc: "Formato y registro oficial Circular 05", val: showCircular05, setVal: setShowCircular05 },
                        { title: "Olimpiada Matemáticas", desc: "Convocatoria e inscripciones olimpiadas", val: showOlimpiada, setVal: setShowOlimpiada },
                        { title: "Encuentro PAEC", desc: "Inscripción y evaluación proyectos PAEC", val: showPAEC, setVal: setShowPAEC },
                        { title: "Capacitaciones CAPEMS", desc: "Fichas de registro y capacitación", val: showCapems, setVal: setShowCapems },
                        { title: "Expedientes Digitales", desc: "Expedientes de personal y directivos", val: showExpedientes, setVal: setShowExpedientes },
                        { title: "Planeaciones con IA", desc: "Revisión curricular automatizada USICAMM", val: showPlaneaciones, setVal: setShowPlaneaciones }
                    ].map((mod, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-all">
                            <div className="pr-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{mod.title}</span>
                                    {mod.badge && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{mod.badge}</span>}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{mod.desc}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => mod.setVal(!mod.val)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${mod.val ? "bg-emerald-500" : "bg-slate-800"}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${mod.val ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECCIÓN 2: ACTIVACIÓN Y PERMISOS DE SUBIDA POR PROGRAMA REGULAR */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
                <div className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Programas Regulares — Estado y Permisos de Subida</h3>
                            <p className="text-xs text-slate-400">Define quién puede subir entregables y guías (Directores, ATPs, Supervisores) por programa.</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="py-3.5 px-4">Programa</th>
                                <th className="py-3.5 px-4 text-center">Activo</th>
                                <th className="py-3.5 px-4 text-center">Visible Director</th>
                                <th className="py-3.5 px-4">Permisos de Subida de Documentos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {programas.map((prog) => {
                                const puedenSubir = prog.quienesPuedenSubir || ["director"];
                                return (
                                    <tr key={prog.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 px-4 font-medium text-white">
                                            <div>{prog.nombre}</div>
                                            {prog.descripcion && <div className="text-xs text-slate-400 font-normal">{prog.descripcion}</div>}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleProgramaProp(prog.id, "activo")}
                                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${prog.activo ? "bg-emerald-500" : "bg-slate-800"}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${prog.activo ? "translate-x-4" : "translate-x-0"}`} />
                                            </button>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleProgramaProp(prog.id, "visibleEnDirector")}
                                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${prog.visibleEnDirector ? "bg-indigo-500" : "bg-slate-800"}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${prog.visibleEnDirector ? "translate-x-4" : "translate-x-0"}`} />
                                            </button>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-4">
                                                {[
                                                    { rol: "director", label: "Director" },
                                                    { rol: "atp", label: "ATP" },
                                                    { rol: "supervisor", label: "Supervisor" }
                                                ].map((r) => {
                                                    const checked = puedenSubir.includes(r.rol);
                                                    return (
                                                        <label key={r.rol} className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => togglePermisoRol(prog.id, r.rol)}
                                                                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                                            />
                                                            {r.label}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </td>
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
