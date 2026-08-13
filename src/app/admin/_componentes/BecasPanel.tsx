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

const NIVEL_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    FEDERAL:   { label: "Federal",   bg: "rgba(124, 58, 237, 0.15)", color: "#7c3aed" },
    ESTATAL:   { label: "Estatal",   bg: "rgba(37, 99, 235, 0.15)", color: "#2563eb" },
    MUNICIPAL: { label: "Municipal", bg: "rgba(16, 185, 129, 0.15)", color: "#10b981" },
    OTRO:      { label: "Otro",      bg: "rgba(107, 114, 128, 0.15)", color: "#6b7280" },
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

    const esVigente = (c: Convocatoria) => {
        if (!c.fechaFin) return true;
        return new Date(c.fechaFin) >= new Date();
    };

    const vigentes = convocatorias.filter(c => c.activo && esVigente(c)).length;
    const vencidas = convocatorias.filter(c => c.activo && !esVigente(c)).length;

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
                        <BookMarked style={{ color: "#ec4899" }} size={28} />
                        Difusión de Becas
                    </h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        Directorio de convocatorias de becas y apoyos educativos (solo metadatos — sin datos nominales)
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
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

            {/* Banner Zero-Payload */}
            <div className="card" style={{ borderLeft: "4px solid var(--primary)", background: "rgba(37, 99, 235, 0.08)", padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <AlertTriangle size={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: "0.1rem" }} />
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.4 }}>
                        <strong style={{ color: "var(--primary)" }}>Política Zero-Payload:</strong> Esta sección almacena únicamente metadatos de convocatorias
                        (nombres, fechas, URLs). Jamás se deben registrar nombres de becarios, CURP, ni datos bancarios en esta plataforma.
                    </p>
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text)" }}>{convocatorias.length}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total convocatorias</div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981" }}>{vigentes}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Vigentes</div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#ef4444" }}>{vencidas}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Vencidas</div>
                </div>
            </div>

            {/* Buscador */}
            <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                    className="form-control"
                    placeholder="Buscar convocatorias de becas..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ paddingLeft: "2.5rem", width: "100%" }}
                />
            </div>

            {/* Modal */}
            {showForm && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: "520px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <BookMarked size={18} style={{ color: "#ec4899" }} />
                                {editando ? "Editar Convocatoria" : "Nueva Convocatoria de Becas"}
                            </h3>
                            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Nombre de la Convocatoria *</label>
                                <input className="form-control" value={form.nombre}
                                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                    placeholder="Beca Benito Juárez 2025-2026..." style={{ width: "100%" }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Nivel</label>
                                    <select className="form-control" value={form.nivel}
                                        onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))} style={{ width: "100%" }}>
                                        <option value="FEDERAL">Federal</option>
                                        <option value="ESTATAL">Estatal</option>
                                        <option value="MUNICIPAL">Municipal</option>
                                        <option value="OTRO">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Modalidad</label>
                                    <input className="form-control" value={form.modalidad}
                                        onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))}
                                        placeholder="Primaria, Secundaria..." style={{ width: "100%" }} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Descripción (metadatos)</label>
                                <textarea className="form-control" rows={3} value={form.descripcion}
                                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Requisitos, detalles relevantes..." style={{ width: "100%", resize: "vertical" }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fecha Inicio</label>
                                    <input type="date" className="form-control" value={form.fechaInicio}
                                        onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} style={{ width: "100%" }} />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fecha Cierre</label>
                                    <input type="date" className="form-control" value={form.fechaFin}
                                        onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} style={{ width: "100%" }} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>URL de la Convocatoria Oficial</label>
                                <input type="url" className="form-control" value={form.convocatoriaUrl}
                                    onChange={e => setForm(f => ({ ...f, convocatoriaUrl: e.target.value }))}
                                    placeholder="https://..." style={{ width: "100%" }} />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                            <button onClick={() => setShowForm(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={guardar} disabled={saving || !form.nombre}
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
                    <BookMarked size={44} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>
                        {busqueda ? "Sin resultados para la búsqueda" : "No hay convocatorias de becas publicadas"}
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {filtradas.map(c => {
                        const nivel = NIVEL_LABELS[c.nivel] ?? NIVEL_LABELS.OTRO;
                        const vigente = esVigente(c);
                        return (
                            <div key={c.id} className="card" style={{ opacity: c.activo ? 1 : 0.6 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                                    <div style={{ flex: 1, minWidth: "250px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                                            <span style={{
                                                fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px",
                                                background: nivel.bg, color: nivel.color
                                            }}>
                                                {nivel.label}
                                            </span>
                                            {c.modalidad && (
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px", background: "rgba(236, 72, 153, 0.15)", color: "#ec4899" }}>
                                                    {c.modalidad}
                                                </span>
                                            )}
                                            {!vigente && (
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px", background: "rgba(220, 38, 38, 0.15)", color: "#ef4444", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                                    <Clock size={10} /> Vencida
                                                </span>
                                            )}
                                            {vigente && c.activo && (
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                                    <CheckCircle2 size={10} /> Vigente
                                                </span>
                                            )}
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>{c.nombre}</h3>
                                        {c.descripcion && <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{c.descripcion}</p>}
                                        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            {c.fechaInicio && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                    <Calendar size={12} /> Inicio: {new Date(c.fechaInicio).toLocaleDateString("es-MX")}
                                                </span>
                                            )}
                                            {c.fechaFin && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: vigente ? "#10b981" : "#ef4444" }}>
                                                    <Clock size={12} /> Cierre: {new Date(c.fechaFin).toLocaleDateString("es-MX")}
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
        </div>
    );
}
