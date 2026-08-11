"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Power } from "lucide-react";

interface ModuleConfigs {
    sidebarConfig: Record<string, boolean>;
    planeacionesConfig: { activoGlobal: boolean };
}

interface ModSwitch {
    key: string;
    title: string;
    desc: string;
    badge?: string;
    stateKey: string;
}

const MODULES: ModSwitch[] = [
    { key: "showOficios",     title: "Oficios con IA",           desc: "Recepción, semaforización y acuses de oficios",       badge: "ATP-MOD-01", stateKey: "showOficios" },
    { key: "showSparh",       title: "Plantillas SPARH",         desc: "Validación matemática de plantillas de personal",     badge: "ATP-MOD-02", stateKey: "showSparh" },
    { key: "showBecas",       title: "Becas Benito Juárez",      desc: "Convocatorias y guías informativas generales",        badge: "ATP-MOD-05", stateKey: "showBecas" },
    { key: "showEventos",     title: "Eventos Culturales",       desc: "Inscripción de disciplinas y alumnos",                stateKey: "showEventos" },
    { key: "showCircular05",  title: "Circular 05",              desc: "Formato y registro oficial Circular 05",              stateKey: "showCircular05" },
    { key: "showOlimpiada",   title: "Olimpiada Matemáticas",    desc: "Convocatoria e inscripciones olimpiadas",             stateKey: "showOlimpiada" },
    { key: "showPAEC",        title: "Encuentro PAEC",           desc: "Inscripción y evaluación proyectos PAEC",             stateKey: "showPAEC" },
    { key: "showCapems",      title: "Capacitaciones CAPEMS",    desc: "Fichas de registro y capacitación",                  stateKey: "showCapems" },
    { key: "showExpedientes", title: "Expedientes Digitales",    desc: "Expedientes de personal y directivos",               stateKey: "showExpedientes" },
    { key: "showPlaneaciones",title: "Planeaciones con IA",      desc: "Revisión curricular automatizada USICAMM",           stateKey: "showPlaneaciones" },
];

export default function ActivacionModulosPanel() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mensaje, setMensaje] = useState<string | null>(null);

    const [switches, setSwitches] = useState<Record<string, boolean>>({
        showOficios: true, showSparh: true, showBecas: true,
        showEventos: true, showCircular05: true, showOlimpiada: true,
        showPAEC: true, showCapems: true, showExpedientes: true, showPlaneaciones: true,
    });

    useEffect(() => { cargarConfigs(); }, []);

    const cargarConfigs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/modulos-activacion");
            const data: ModuleConfigs = await res.json();
            if (data.sidebarConfig) {
                setSwitches(prev => ({
                    ...prev,
                    ...Object.fromEntries(
                        Object.entries(data.sidebarConfig).filter(([k]) => k in prev)
                    ),
                }));
            }
            if (data.planeacionesConfig?.activoGlobal !== undefined) {
                setSwitches(prev => ({ ...prev, showPlaneaciones: data.planeacionesConfig.activoGlobal }));
            }
        } catch (err) {
            console.error("Error al cargar configuración de módulos:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (key: string) => {
        setSwitches(prev => ({ ...prev, [key]: !prev[key] }));
        setMensaje(null);
    };

    const handleGuardar = async () => {
        setSaving(true);
        setMensaje(null);
        try {
            const { showPlaneaciones, ...sidebarKeys } = switches;
            const res = await fetch("/api/admin/modulos-activacion", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sidebarConfig: sidebarKeys,
                    oficiosConfig: { activo: switches.showOficios, visibleEnDirector: switches.showOficios },
                    sparhConfig:   { activo: switches.showSparh,   visibleEnDirector: switches.showSparh },
                    eventosActivo:    switches.showEventos,
                    circularActivo:   switches.showCircular05,
                    olimpiadaActivo:  switches.showOlimpiada,
                    paecActivo:       switches.showPAEC,
                    planeacionesActivo: showPlaneaciones,
                }),
            });
            const data = await res.json();
            setMensaje(res.ok ? "¡Configuración guardada correctamente!" : `Error: ${data.error || "No se pudo guardar"}`);
        } catch {
            setMensaje("Error de conexión al guardar cambios.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-400">
                <Loader2 size={20} className="inline-block animate-spin text-emerald-500" />
                <p className="mt-2 text-sm">Cargando configuración...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            {/* Encabezado */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Power size={18} className="text-emerald-400" />
                        Interruptores Maestros del Sistema
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Activa o desactiva módulos del sistema completo. Desactivar un módulo lo oculta globalmente en todos los portales.
                        Para permisos de subida por programa, usa la pestaña <strong>Programas Regulares</strong> (edita el programa).
                    </p>
                </div>
                <button
                    onClick={handleGuardar}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow transition-all disabled:opacity-50 shrink-0"
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
            </div>

            {/* Mensaje de feedback */}
            {mensaje && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${mensaje.includes("correctamente") ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-rose-950/40 border-rose-500/30 text-rose-300"}`}>
                    {mensaje}
                </div>
            )}

            {/* Lista de módulos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MODULES.map((mod) => {
                    const isOn = switches[mod.stateKey] ?? true;
                    return (
                        <div
                            key={mod.key}
                            className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 hover:border-slate-700 transition-colors"
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-white truncate">{mod.title}</span>
                                    {mod.badge && (
                                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                            {mod.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 truncate">{mod.desc}</p>
                            </div>
                            {/* Toggle compacto */}
                            <button
                                type="button"
                                onClick={() => handleToggle(mod.stateKey)}
                                aria-pressed={isOn}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isOn ? "bg-emerald-500" : "bg-slate-700"}`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOn ? "translate-x-4" : "translate-x-0"}`}
                                />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Nota aclaratoria */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3 text-xs text-slate-400">
                <strong className="text-slate-300">Nota:</strong> Los permisos de subida de documentos (quién puede subir: director, ATP, supervisor) se configuran individualmente en cada programa desde la pestaña <strong className="text-slate-300">Programas Regulares</strong> → botón Editar.
            </div>
        </div>
    );
}
