"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ToggleLeft,
    ToggleRight,
    Download,
    Loader2,
    Palette,
    Users,
    Trophy,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Trash2,
    School,
    Pencil,
    Plus,
    Check,
    X,
    Save,
} from "lucide-react";

// ─── Types ───────────────────────────────────────

interface Disciplina {
    id: string;
    nombre: string;
    tipo: string;
    minParticipantes: number;
    maxParticipantes: number;
    grupoExclusion: string | null;
    orden: number;
}

interface Categoria {
    id: string;
    nombre: string;
    color: string;
    orden: number;
    disciplinas: Disciplina[];
}

interface EscuelaEvento {
    id: string;
    cct: string;
    nombre: string;
    email: string;
    inscrita: boolean;
    disciplinasActivas: number;
    totalParticipantes: number;
    fechaInscripcion: string | null;
    inscripcionId: string | null;
}

// ─── Component ───────────────────────────────────

export default function GestionEventos() {
    const [activo, setActivo] = useState(false);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [escuelas, setEscuelas] = useState<EscuelaEvento[]>([]);
    const [totalInscripciones, setTotalInscripciones] = useState(0);
    const [totalEscuelas, setTotalEscuelas] = useState(0);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [filtroEscuelas, setFiltroEscuelas] = useState<"todas" | "inscritas" | "pendientes">("todas");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // ─── CRUD state ──────────────────────────────
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editCatNombre, setEditCatNombre] = useState("");
    const [editCatColor, setEditCatColor] = useState("");
    const [editingDiscId, setEditingDiscId] = useState<string | null>(null);
    const [editDisc, setEditDisc] = useState({ nombre: "", tipo: "simple", min: 1, max: 1, grupo: "" });
    const [addingCat, setAddingCat] = useState(false);
    const [newCatNombre, setNewCatNombre] = useState("");
    const [newCatColor, setNewCatColor] = useState("#2e75b6");
    const [addingDiscToCat, setAddingDiscToCat] = useState<string | null>(null);
    const [newDisc, setNewDisc] = useState({ nombre: "", tipo: "simple", min: 1, max: 1, grupo: "" });
    const [savingCrud, setSavingCrud] = useState(false);

    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/eventos-config");
            if (!res.ok) throw new Error("Error cargando configuración");
            const data = await res.json();
            setActivo(data.activo);
            setCategorias(data.categorias || []);
            setTotalInscripciones(data.totalInscripciones || 0);
            setTotalEscuelas(data.totalEscuelas || 0);
            setEscuelas(data.escuelas || []);
        } catch {
            setMessage({ type: "error", text: "Error al cargar configuración de eventos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    // ─── Toggle active state ─────────────────────

    async function handleToggle() {
        setToggling(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/eventos-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !activo }),
            });
            if (res.ok) {
                setActivo(!activo);
                setMessage({
                    type: "success",
                    text: !activo
                        ? "✅ Inscripciones a eventos ACTIVADAS. Los directores ya pueden registrar."
                        : "❌ Inscripciones a eventos DESACTIVADAS."
                });
            } else {
                setMessage({ type: "error", text: "Error al cambiar el estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setToggling(false);
        }
    }

    // ─── Download Excel ──────────────────────────

    async function handleDownloadExcel() {
        setDownloading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/exportar-excel-eventos");
            if (!res.ok) throw new Error("Error generando Excel");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Registro_Eventos_2026_${new Date().toISOString().split("T")[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setMessage({ type: "success", text: "Excel descargado exitosamente" });
        } catch {
            setMessage({ type: "error", text: "Error al descargar el Excel" });
        } finally {
            setDownloading(false);
        }
    }

    // ─── Cancel inscription ──────────────────────

    async function handleCancelInscripcion(escuelaId: string, nombre: string) {
        if (!confirm(`¿Estás seguro de CANCELAR la inscripción de "${nombre}"?\n\nEsta acción eliminará todos sus datos de participación y no se puede deshacer.`)) return;
        setCancellingId(escuelaId);
        try {
            const res = await fetch(`/api/admin/eventos-config?escuelaId=${escuelaId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error al cancelar inscripción");
            setMessage({ type: "success", text: `Inscripción de "${nombre}" cancelada exitosamente.` });
            // Refresh data
            setLoading(true);
            await fetchConfig();
        } catch {
            setMessage({ type: "error", text: "Error al cancelar la inscripción" });
        } finally {
            setCancellingId(null);
        }
    }

    // ─── CRUD handlers ──────────────────────────

    async function handleSaveCategoria(id: string) {
        setSavingCrud(true);
        try {
            const res = await fetch("/api/admin/eventos-disciplinas", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "editarCategoria", id, nombre: editCatNombre, color: editCatColor }),
            });
            if (!res.ok) throw new Error();
            setEditingCatId(null);
            setMessage({ type: "success", text: "Categoría actualizada" });
            setLoading(true); await fetchConfig();
        } catch { setMessage({ type: "error", text: "Error al guardar categoría" }); }
        finally { setSavingCrud(false); }
    }

    async function handleDeleteCategoria(id: string, nombre: string) {
        if (!confirm(`¿Eliminar la categoría "${nombre}" y TODAS sus disciplinas?\n\nEsta acción no se puede deshacer.`)) return;
        setSavingCrud(true);
        try {
            const res = await fetch(`/api/admin/eventos-disciplinas?tipo=categoria&id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            setMessage({ type: "success", text: `Categoría "${nombre}" eliminada` });
            setLoading(true); await fetchConfig();
        } catch { setMessage({ type: "error", text: "Error al eliminar categoría" }); }
        finally { setSavingCrud(false); }
    }

    async function handleAddCategoria() {
        if (!newCatNombre.trim()) return;
        setSavingCrud(true);
        try {
            const res = await fetch("/api/admin/eventos-disciplinas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "crearCategoria", nombre: newCatNombre.trim(), color: newCatColor }),
            });
            if (!res.ok) throw new Error();
            setNewCatNombre(""); setNewCatColor("#2e75b6"); setAddingCat(false);
            setMessage({ type: "success", text: "Categoría creada" });
            setLoading(true); await fetchConfig();
        } catch { setMessage({ type: "error", text: "Error al crear categoría" }); }
        finally { setSavingCrud(false); }
    }

    async function handleSaveDisciplina(id: string) {
        setSavingCrud(true);
        try {
            const res = await fetch("/api/admin/eventos-disciplinas", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "editarDisciplina", id,
                    nombre: editDisc.nombre, tipo: editDisc.tipo,
                    minParticipantes: editDisc.min, maxParticipantes: editDisc.max,
                    grupoExclusion: editDisc.grupo,
                }),
            });
            if (!res.ok) throw new Error();
            setEditingDiscId(null);
            setMessage({ type: "success", text: "Disciplina actualizada" });
            setLoading(true); await fetchConfig();
        } catch { setMessage({ type: "error", text: "Error al guardar disciplina" }); }
        finally { setSavingCrud(false); }
    }

    async function handleDeleteDisciplina(id: string, nombre: string) {
        if (!confirm(`¿Eliminar la disciplina "${nombre}"?`)) return;
        setSavingCrud(true);
        try {
            const res = await fetch(`/api/admin/eventos-disciplinas?tipo=disciplina&id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            setMessage({ type: "success", text: `Disciplina "${nombre}" eliminada` });
            setLoading(true); await fetchConfig();
        } catch { setMessage({ type: "error", text: "Error al eliminar disciplina" }); }
        finally { setSavingCrud(false); }
    }

    async function handleAddDisciplina(categoriaId: string) {
        if (!newDisc.nombre.trim()) return;
        setSavingCrud(true);
        try {
            const res = await fetch("/api/admin/eventos-disciplinas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "crearDisciplina", categoriaId,
                    nombre: newDisc.nombre.trim(), tipo: newDisc.tipo,
                    minParticipantes: newDisc.min, maxParticipantes: newDisc.max,
                    grupoExclusion: newDisc.grupo,
                }),
            });
            if (!res.ok) throw new Error();
            setNewDisc({ nombre: "", tipo: "simple", min: 1, max: 1, grupo: "" }); setAddingDiscToCat(null);
            setMessage({ type: "success", text: "Disciplina creada" });
            setLoading(true); await fetchConfig();
        } catch { setMessage({ type: "error", text: "Error al crear disciplina" }); }
        finally { setSavingCrud(false); }
    }

    // ─── Computed values ─────────────────────

    // Calculate real max disciplines (considering mutual exclusions)
    const maxDisciplinasPosibles = (() => {
        let total = 0;
        for (const cat of categorias) {
            const exclusionGroups = new Map<string, number>();
            for (const disc of cat.disciplinas) {
                if (disc.grupoExclusion) {
                    // Only count 1 per exclusion group
                    if (!exclusionGroups.has(disc.grupoExclusion)) {
                        exclusionGroups.set(disc.grupoExclusion, 1);
                        total++;
                    }
                } else {
                    total++;
                }
            }
        }
        return total;
    })();

    const escuelasInscritas = escuelas.filter(e => e.inscrita);
    const escuelasPendientes = escuelas.filter(e => !e.inscrita);

    const escuelasFiltradas = filtroEscuelas === "inscritas"
        ? escuelasInscritas
        : filtroEscuelas === "pendientes"
            ? escuelasPendientes
            : escuelas;

    const pctInscripciones = totalEscuelas > 0
        ? Math.round((totalInscripciones / totalEscuelas) * 100) : 0;

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Trophy size={24} /> Eventos Culturales 2026
                    </h2>
                    <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                        Gestión de inscripciones a eventos culturales
                    </p>
                </div>
                <button
                    className="btn btn-outline"
                    onClick={() => { setLoading(true); fetchConfig(); }}
                    style={{ fontSize: "0.8125rem", display: "flex", gap: "0.4rem", alignItems: "center" }}
                >
                    <RefreshCw size={16} /> Actualizar
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Toggle + Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                {/* Toggle Card */}
                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                        Estado del Programa
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={toggling}
                        style={{
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            padding: "0.75rem 1.5rem", borderRadius: "10px", border: "none",
                            background: activo ? "var(--success)" : "#ef4444",
                            color: "white", fontWeight: 700, fontSize: "0.9375rem",
                            cursor: toggling ? "wait" : "pointer",
                            transition: "all 0.3s",
                        }}
                    >
                        {activo ? (
                            <><ToggleRight size={24} /> Activado</>
                        ) : (
                            <><ToggleLeft size={24} /> Desactivado</>
                        )}
                    </button>
                </div>

                {/* Inscriptions Count */}
                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                        Escuelas Inscritas
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>
                        {totalInscripciones}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        de {totalEscuelas} escuelas ({pctInscripciones}%)
                    </div>
                    <div style={{
                        width: "100%", height: "6px", background: "var(--border)", borderRadius: "3px", marginTop: "0.5rem",
                    }}>
                        <div style={{
                            width: `${pctInscripciones}%`, height: "100%", background: "var(--primary)", borderRadius: "3px", transition: "width 0.3s",
                        }} />
                    </div>
                </div>

                {/* Max Disciplines */}
                <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                        Catálogo
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>
                        {maxDisciplinasPosibles}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        disciplinas máx. por escuela
                    </div>
                </div>
            </div>

            {/* Download Excel */}
            <div className="card" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Exportar Registro de Eventos</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Descarga el Excel con todas las inscripciones de las escuelas
                        </div>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleDownloadExcel}
                        disabled={downloading}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}
                    >
                        {downloading ? (
                            <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generando...</>
                        ) : (
                            <><Download size={16} /> Descargar Excel</>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══════ Schools List ═══════ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{
                    padding: "1rem 1.25rem",
                    background: "linear-gradient(135deg, #1f4e78 0%, #2e75b6 100%)",
                    color: "white",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                        <School size={16} style={{ display: "inline", marginRight: "0.4rem", verticalAlign: "text-bottom" }} />
                        Listado de Escuelas
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {(["todas", "inscritas", "pendientes"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFiltroEscuelas(f)}
                                style={{
                                    padding: "0.25rem 0.65rem",
                                    borderRadius: "12px",
                                    border: "1px solid rgba(255,255,255,0.4)",
                                    background: filtroEscuelas === f ? "white" : "transparent",
                                    color: filtroEscuelas === f ? "#1f4e78" : "white",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                            >
                                {f === "todas" ? `Todas (${escuelas.length})` : f === "inscritas" ? `Inscritas (${escuelasInscritas.length})` : `Pendientes (${escuelasPendientes.length})`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table header */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.6fr",
                    padding: "0.6rem 1.25rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    borderBottom: "2px solid var(--border)",
                    background: "var(--bg)",
                }}>
                    <span>Escuela</span>
                    <span>Correo</span>
                    <span style={{ textAlign: "center" }}>Disciplinas</span>
                    <span style={{ textAlign: "center" }}>Participantes</span>
                    <span style={{ textAlign: "center" }}>Estado</span>
                </div>

                {/* School rows */}
                {escuelasFiltradas.map(esc => (
                    <div key={esc.id} style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.6fr",
                        padding: "0.6rem 1.25rem",
                        borderBottom: "1px solid var(--border)",
                        fontSize: "0.8125rem",
                        alignItems: "center",
                        background: esc.inscrita ? "#f0fdf4" : "transparent",
                    }}>
                        <div>
                            <div style={{ fontWeight: 600 }}>{esc.nombre}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{esc.cct}</div>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{esc.email}</div>
                        <div style={{ textAlign: "center", fontWeight: 700 }}>
                            {esc.inscrita ? esc.disciplinasActivas : "—"}
                        </div>
                        <div style={{ textAlign: "center", fontWeight: 700 }}>
                            {esc.inscrita ? esc.totalParticipantes : "—"}
                        </div>
                        <div style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                            {esc.inscrita ? (
                                <>
                                    <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
                                    <button
                                        onClick={() => handleCancelInscripcion(esc.id, esc.nombre)}
                                        disabled={cancellingId === esc.id}
                                        title="Cancelar inscripción"
                                        style={{
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "var(--danger)", padding: "0.15rem",
                                        }}
                                    >
                                        {cancellingId === esc.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />}
                                    </button>
                                </>
                            ) : (
                                <XCircle size={16} style={{ color: "var(--text-muted)" }} />
                            )}
                        </div>
                    </div>
                ))}

                {escuelasFiltradas.length === 0 && (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                        No hay escuelas en este filtro.
                    </div>
                )}
            </div>

            {/* Categories Overview */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{
                    padding: "1rem 1.25rem",
                    background: "linear-gradient(135deg, #1f4e78 0%, #2e75b6 100%)",
                    color: "white",
                }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                        <Palette size={16} style={{ display: "inline", marginRight: "0.4rem", verticalAlign: "text-bottom" }} />
                        Catálogo de Disciplinas
                    </div>
                </div>

                {categorias.map(cat => (
                    <div key={cat.id}>
                        {/* ── Category header ── */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            padding: "0.75rem 1.25rem",
                            background: `${cat.color}12`,
                            borderBottom: "1px solid var(--border)",
                        }}>
                            {editingCatId === cat.id ? (
                                /* inline edit */
                                <>
                                    <input type="color" value={editCatColor}
                                        onChange={e => setEditCatColor(e.target.value)}
                                        style={{ width: 24, height: 24, border: "none", padding: 0, cursor: "pointer" }} />
                                    <input value={editCatNombre}
                                        onChange={e => setEditCatNombre(e.target.value)}
                                        style={{ flex: 1, fontWeight: 700, fontSize: "0.8125rem", border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.5rem" }} />
                                    <button onClick={() => handleSaveCategoria(cat.id)} disabled={savingCrud}
                                        title="Guardar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)" }}>
                                        <Check size={16} />
                                    </button>
                                    <button onClick={() => setEditingCatId(null)}
                                        title="Cancelar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                        <X size={16} />
                                    </button>
                                </>
                            ) : (
                                /* normal view */
                                <>
                                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                                    <span style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{cat.nombre}</span>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                                        {cat.disciplinas.length} disciplinas
                                    </span>
                                    <button onClick={() => { setEditingCatId(cat.id); setEditCatNombre(cat.nombre); setEditCatColor(cat.color); }}
                                        title="Editar categoría" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.15rem" }}>
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteCategoria(cat.id, cat.nombre)}
                                        title="Eliminar categoría" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "0.15rem" }}>
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* ── Discipline rows ── */}
                        {cat.disciplinas.map(disc => (
                            <div key={disc.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "0.5rem 1.25rem 0.5rem 2.5rem",
                                borderBottom: "1px solid var(--border)",
                                fontSize: "0.8125rem", gap: "0.5rem",
                            }}>
                                {editingDiscId === disc.id ? (
                                    /* inline edit discipline */
                                    <>
                                        <input value={editDisc.nombre} onChange={e => setEditDisc(p => ({ ...p, nombre: e.target.value }))}
                                            placeholder="Nombre" style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem 0.4rem", fontSize: "0.8rem" }} />
                                        <select value={editDisc.tipo} onChange={e => setEditDisc(p => ({ ...p, tipo: e.target.value }))}
                                            style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem", fontSize: "0.75rem" }}>
                                            <option value="simple">simple</option>
                                            <option value="individual">individual</option>
                                            <option value="equipo">equipo</option>
                                            <option value="grupo">grupo</option>
                                        </select>
                                        <input type="number" value={editDisc.min} onChange={e => setEditDisc(p => ({ ...p, min: +e.target.value }))} min={1}
                                            style={{ width: 45, textAlign: "center", border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem", fontSize: "0.75rem" }}
                                            title="Mín participantes" />
                                        <span style={{ fontSize: "0.7rem" }}>-</span>
                                        <input type="number" value={editDisc.max} onChange={e => setEditDisc(p => ({ ...p, max: +e.target.value }))} min={1}
                                            style={{ width: 45, textAlign: "center", border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem", fontSize: "0.75rem" }}
                                            title="Máx participantes" />
                                        <button onClick={() => handleSaveDisciplina(disc.id)} disabled={savingCrud}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)" }}><Check size={14} /></button>
                                        <button onClick={() => setEditingDiscId(null)}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
                                    </>
                                ) : (
                                    /* normal view discipline */
                                    <>
                                        <span style={{ flex: 1 }}>{disc.nombre}</span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                                            <span style={{
                                                padding: "0.15rem 0.5rem", borderRadius: "4px",
                                                background: disc.tipo === "simple" ? "#e8f5e9" : disc.tipo === "grupo" ? "#e3f2fd" : disc.tipo === "individual" ? "#fff3e0" : "#fce4ec",
                                                fontSize: "0.6875rem", fontWeight: 600,
                                            }}>{disc.tipo}</span>
                                            <span>
                                                <Users size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: "0.2rem" }} />
                                                {disc.minParticipantes === disc.maxParticipantes ? disc.minParticipantes : `${disc.minParticipantes}-${disc.maxParticipantes}`}
                                            </span>
                                            <button onClick={() => {
                                                setEditingDiscId(disc.id);
                                                setEditDisc({ nombre: disc.nombre, tipo: disc.tipo, min: disc.minParticipantes, max: disc.maxParticipantes, grupo: disc.grupoExclusion || "" });
                                            }} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.1rem" }}>
                                                <Pencil size={13} />
                                            </button>
                                            <button onClick={() => handleDeleteDisciplina(disc.id, disc.nombre)}
                                                title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "0.1rem" }}>
                                                <Trash2 size={13} />
                                            </button>
                                        </span>
                                    </>
                                )}
                            </div>
                        ))}

                        {/* ── Add discipline to this category ── */}
                        {addingDiscToCat === cat.id ? (
                            <div style={{ display: "flex", gap: "0.4rem", padding: "0.5rem 1.25rem 0.5rem 2.5rem", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                                <input value={newDisc.nombre} onChange={e => setNewDisc(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="Nombre disciplina" style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "0.25rem 0.5rem", fontSize: "0.8rem" }} />
                                <select value={newDisc.tipo} onChange={e => setNewDisc(p => ({ ...p, tipo: e.target.value }))}
                                    style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem", fontSize: "0.75rem" }}>
                                    <option value="simple">simple</option>
                                    <option value="individual">individual</option>
                                    <option value="equipo">equipo</option>
                                    <option value="grupo">grupo</option>
                                </select>
                                <input type="number" value={newDisc.min} onChange={e => setNewDisc(p => ({ ...p, min: +e.target.value }))} min={1}
                                    style={{ width: 45, textAlign: "center", border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem", fontSize: "0.75rem" }}
                                    title="Mín" />
                                <span style={{ fontSize: "0.7rem" }}>-</span>
                                <input type="number" value={newDisc.max} onChange={e => setNewDisc(p => ({ ...p, max: +e.target.value }))} min={1}
                                    style={{ width: 45, textAlign: "center", border: "1px solid var(--border)", borderRadius: 4, padding: "0.2rem", fontSize: "0.75rem" }}
                                    title="Máx" />
                                <button onClick={() => handleAddDisciplina(cat.id)} disabled={savingCrud || !newDisc.nombre.trim()}
                                    style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 4, padding: "0.25rem 0.6rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <Save size={12} /> Guardar
                                </button>
                                <button onClick={() => { setAddingDiscToCat(null); setNewDisc({ nombre: "", tipo: "simple", min: 1, max: 1, grupo: "" }); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <div style={{ padding: "0.4rem 1.25rem 0.4rem 2.5rem", borderBottom: "1px solid var(--border)" }}>
                                <button onClick={() => { setAddingDiscToCat(cat.id); setNewDisc({ nombre: "", tipo: "simple", min: 1, max: 1, grupo: "" }); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <Plus size={13} /> Agregar disciplina
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {/* ── Add category ── */}
                {addingCat ? (
                    <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1.25rem", alignItems: "center", borderTop: "2px solid var(--border)" }}>
                        <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                            style={{ width: 28, height: 28, border: "none", padding: 0, cursor: "pointer" }} />
                        <input value={newCatNombre} onChange={e => setNewCatNombre(e.target.value)}
                            placeholder="Nombre de nueva categoría" style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: "0.3rem 0.6rem", fontSize: "0.8125rem" }} />
                        <button onClick={handleAddCategoria} disabled={savingCrud || !newCatNombre.trim()}
                            style={{ background: "var(--success)", color: "white", border: "none", borderRadius: 6, padding: "0.4rem 1rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <Save size={14} /> Guardar
                        </button>
                        <button onClick={() => { setAddingCat(false); setNewCatNombre(""); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div style={{ padding: "0.75rem 1.25rem", borderTop: "2px solid var(--border)" }}>
                        <button onClick={() => setAddingCat(true)}
                            style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", color: "var(--primary)", fontWeight: 600, fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.3rem", width: "100%", justifyContent: "center" }}>
                            <Plus size={16} /> Agregar nueva categoría
                        </button>
                    </div>
                )}
            </div>

            {/* Spin animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
