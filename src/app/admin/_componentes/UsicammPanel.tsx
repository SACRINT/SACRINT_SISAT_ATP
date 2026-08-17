"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Award, Plus, RefreshCw, Search, ExternalLink, Calendar,
    CheckCircle2, XCircle, Loader2, X, Save, AlertTriangle, Edit2, Sparkles
} from "lucide-react";
import ModuloCopilotDrawer, { AccionSugerida } from "@/components/copilot/ModuloCopilotDrawer";

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

const TIPO_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    CONCURSO:      { label: "Concurso de Oposición", bg: "rgba(124, 58, 237, 0.15)", color: "#7c3aed" },
    PROMOCION:     { label: "Promoción",              bg: "rgba(37, 99, 235, 0.15)", color: "#2563eb" },
    ACTUALIZACION: { label: "Actualización",          bg: "rgba(16, 185, 129, 0.15)", color: "#10b981" },
    OTRO:          { label: "Otro",                   bg: "rgba(107, 114, 128, 0.15)", color: "#6b7280" },
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
    const [copilotOpen, setCopilotOpen] = useState(false);

    const ACCIONES_USICAMM: AccionSugerida[] = [
        {
            id: "requisitos_promocion_horizontal",
            etiqueta: "🏆 Requisitos Promoción Horizontal",
            prompt: "¿Cuáles son los requisitos y etapas para participar en el proceso de Promoción Horizontal por niveles con incentivos de USICAMM?"
        },
        {
            id: "horas_adicionales",
            etiqueta: "⏱️ Proceso de Horas Adicionales",
            prompt: "Explica los lineamientos y criterios para la asignación de horas adicionales a docentes de secundarias técnicas."
        },
        {
            id: "plataforma_venus",
            etiqueta: "🔑 Guía Plataforma Proyecto Venus",
            prompt: "¿Cómo se realiza el registro, generación de cita y subida de documentación en la Ventanilla Única de Servicios (Proyecto Venus)?"
        }
    ];

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px", color: "var(--text-muted)" }}>
            <Loader2 size={36} className="spin" style={{ color: "var(--primary)" }} />
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text)" }}>
                        <Award style={{ color: "#f59e0b" }} size={28} />
                        Convocatorias USICAMM
                    </h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        Difusión de concursos de oposición, promoción y actualización docente
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <button
                        className="btn"
                        onClick={() => setCopilotOpen(true)}
                        style={{
                            fontSize: "0.8125rem",
                            background: "linear-gradient(135deg, #4f46e5, #4338ca)",
                            color: "white",
                            border: "1px solid rgba(99, 102, 241, 0.4)",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            boxShadow: "0 3px 8px rgba(79, 70, 229, 0.3)"
                        }}
                    >
                        <Sparkles size={15} /> ✨ Copiloto USICAMM
                    </button>
                    <button className="btn btn-outline" onClick={cargar} style={{ fontSize: "0.8125rem" }}>
                        <RefreshCw size={15} /> Actualizar
                    </button>
                    {!readOnly && (
                        <button className="btn btn-primary" onClick={abrirNueva} style={{ fontSize: "0.8125rem" }}>
                            <Plus size={15} /> Nueva Convocatoria
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Buscador */}
            <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                    className="form-control"
                    placeholder="Buscar convocatorias por título o descripción..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ paddingLeft: "2.5rem", width: "100%" }}
                />
            </div>

            {/* Modal crear/editar */}
            {showForm && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: "520px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Award size={18} style={{ color: "#f59e0b" }} />
                                {editando ? "Editar Convocatoria" : "Nueva Convocatoria USICAMM"}
                            </h3>
                            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Título *</label>
                                <input className="form-control" value={form.titulo}
                                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                                    placeholder="Concurso de Oposición 2025-2026..." style={{ width: "100%" }} />
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Tipo de Convocatoria</label>
                                <select className="form-control" value={form.tipo}
                                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={{ width: "100%" }}>
                                    <option value="CONCURSO">Concurso de Oposición</option>
                                    <option value="PROMOCION">Promoción</option>
                                    <option value="ACTUALIZACION">Actualización</option>
                                    <option value="OTRO">Otro</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Descripción</label>
                                <textarea className="form-control" rows={3} value={form.descripcion}
                                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Detalles importantes de la convocatoria..." style={{ width: "100%", resize: "vertical" }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Vigencia hasta</label>
                                    <input type="date" className="form-control" value={form.fechaVigencia}
                                        onChange={e => setForm(f => ({ ...f, fechaVigencia: e.target.value }))} style={{ width: "100%" }} />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>URL Convocatoria Oficial</label>
                                    <input type="url" className="form-control" value={form.convocatoriaUrl}
                                        onChange={e => setForm(f => ({ ...f, convocatoriaUrl: e.target.value }))}
                                        placeholder="https://usicamm.gob.mx/..." style={{ width: "100%" }} />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                            <button onClick={() => setShowForm(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={guardar} disabled={saving || !form.titulo}
                                className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                {editando ? "Guardar Cambios" : "Publicar Convocatoria"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Listado */}
            {filtradas.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
                    <Award size={44} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>
                        {busqueda ? "No se encontraron convocatorias" : "No hay convocatorias publicadas"}
                    </p>
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                        {!readOnly && !busqueda && "Publica la primera convocatoria con el botón \"Nueva Convocatoria\""}
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {filtradas.map(c => {
                        const tipo = TIPO_LABELS[c.tipo] ?? TIPO_LABELS.OTRO;
                        const vigente = c.fechaVigencia ? new Date(c.fechaVigencia) > new Date() : true;
                        return (
                            <div key={c.id} className="card" style={{ opacity: c.activo ? 1 : 0.6 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                                    <div style={{ flex: 1, minWidth: "250px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                                            <span style={{
                                                fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px",
                                                background: tipo.bg, color: tipo.color
                                            }}>
                                                {tipo.label}
                                            </span>
                                            {!vigente && (
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px", background: "rgba(220, 38, 38, 0.15)", color: "#ef4444" }}>
                                                    Vencida
                                                </span>
                                            )}
                                            {!c.activo && (
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px", background: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" }}>
                                                    Inactiva
                                                </span>
                                            )}
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{c.titulo}</h3>
                                        {c.descripcion && <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{c.descripcion}</p>}
                                        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <Calendar size={12} /> Publicado: {new Date(c.fechaPublicacion).toLocaleDateString("es-MX")}
                                            </span>
                                            {c.fechaVigencia && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: vigente ? "#10b981" : "#ef4444" }}>
                                                    {vigente ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                    Vigente hasta {new Date(c.fechaVigencia).toLocaleDateString("es-MX")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        {c.convocatoriaUrl && (
                                            <a href={c.convocatoriaUrl} target="_blank" rel="noopener noreferrer"
                                                className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
                                                <ExternalLink size={13} /> Ver
                                            </a>
                                        )}
                                        {!readOnly && (
                                            <>
                                                <button onClick={() => abrirEditar(c)} className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
                                                    <Edit2 size={13} /> Editar
                                                </button>
                                                <button
                                                    onClick={() => toggleActivo(c)}
                                                    className={`btn ${c.activo ? "btn-outline" : "btn-primary"}`}
                                                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderColor: c.activo ? "var(--danger)" : undefined, color: c.activo ? "#ef4444" : undefined }}
                                                >
                                                    {c.activo ? "Desactivar" : "Activar"}
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

            {/* ════════════ COPILOTO IA DE USICAMM ════════════ */}
            <ModuloCopilotDrawer
                modulo="usicamm"
                titulo="Copiloto de Procesos USICAMM"
                subtitulo="Requisitos, etapas, Proyecto Venus y normativas"
                isOpen={copilotOpen}
                onClose={() => setCopilotOpen(false)}
                accionesSugeridas={ACCIONES_USICAMM}
            />
        </div>
    );
}
