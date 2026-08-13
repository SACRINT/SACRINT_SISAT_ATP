"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BookOpen, CheckCircle2, Clock, AlertTriangle,
    ChevronDown, ChevronUp, Plus, Settings, RefreshCw,
    FileText, Calendar, GraduationCap, Loader2, X, Save,
    Users,
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

const ESTADO_LABELS: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    PENDIENTE:      { label: "Pendiente",     bg: "rgba(107, 114, 128, 0.15)", color: "#9ca3af", icon: <Clock size={12} /> },
    ENTREGADO:      { label: "Entregado",     bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", icon: <FileText size={12} /> },
    REVISADO:       { label: "Revisado ✓",    bg: "rgba(16, 185, 129, 0.15)", color: "#10b981", icon: <CheckCircle2 size={12} /> },
    OBSERVACIONES:  { label: "Observaciones", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", icon: <AlertTriangle size={12} /> },
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
        const notas = notasEdicion[productoId];
        if (notas === undefined) return;
        setSavingNotas(prev => ({ ...prev, [productoId]: true }));
        try {
            await fetch(`/api/admin/cte/${productoId}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notasAtp: notas }),
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
                        <GraduationCap style={{ color: "var(--primary)" }} size={28} />
                        Acompañamiento CTE
                    </h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        Repositorio de productos de Consejos Técnicos Escolares — Zona 004
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button className="btn btn-outline" onClick={cargar} style={{ fontSize: "0.8125rem" }}>
                        <RefreshCw size={15} /> Actualizar
                    </button>
                    {!readOnly && (
                        <button className="btn btn-primary" onClick={() => setShowFormSesion(true)} style={{ fontSize: "0.8125rem" }}>
                            <Plus size={15} /> Nueva Sesión
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Modal nueva sesión */}
            {showFormSesion && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: "520px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Settings size={18} style={{ color: "var(--primary)" }} /> Configurar Sesión CTE
                            </h3>
                            <button onClick={() => setShowFormSesion(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Número de Sesión *</label>
                                    <input type="number" min="1" className="form-control" value={formSesion.numero}
                                        onChange={e => setFormSesion(f => ({ ...f, numero: e.target.value }))} placeholder="1" style={{ width: "100%" }} />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fase *</label>
                                    <select className="form-control" value={formSesion.fase}
                                        onChange={e => setFormSesion(f => ({ ...f, fase: e.target.value as any }))} style={{ width: "100%" }}>
                                        <option value="ORDINARIA">Ordinaria</option>
                                        <option value="INTENSIVA">Intensiva</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Descripción / Tema</label>
                                <input className="form-control" value={formSesion.descripcion}
                                    onChange={e => setFormSesion(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Ruta de mejora, Plan anual..." style={{ width: "100%" }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fecha de Sesión</label>
                                    <input type="date" className="form-control" value={formSesion.fechaSesion}
                                        onChange={e => setFormSesion(f => ({ ...f, fechaSesion: e.target.value }))} style={{ width: "100%" }} />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fecha Límite Entrega</label>
                                    <input type="date" className="form-control" value={formSesion.fechaLimite}
                                        onChange={e => setFormSesion(f => ({ ...f, fechaLimite: e.target.value }))} style={{ width: "100%" }} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>URL Guía Oficial</label>
                                <input type="url" className="form-control" value={formSesion.guiaUrl}
                                    onChange={e => setFormSesion(f => ({ ...f, guiaUrl: e.target.value }))}
                                    placeholder="https://..." style={{ width: "100%" }} />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                            <button onClick={() => setShowFormSesion(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={crearSesion} disabled={saving || !formSesion.numero}
                                className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                Guardar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tarjetas de sesiones */}
            {sesiones.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
                    <GraduationCap size={44} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>No hay sesiones de CTE configuradas</p>
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>Crea la primera sesión con el botón "Nueva Sesión"</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {sesiones.map(sesion => {
                        const res = resumenSesion(sesion);
                        const expandida = sesionExpandida === sesion.id;
                        const pct = res.total > 0 ? Math.round((res.entregados / res.total) * 100) : 0;
                        return (
                            <div key={sesion.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                                {/* Cabecera de sesión */}
                                <div
                                    style={{
                                        padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
                                        cursor: "pointer", background: "var(--bg-card)", transition: "background 0.2s ease"
                                    }}
                                    onClick={() => setSesionExpandida(expandida ? null : sesion.id)}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                        <div style={{
                                            width: "42px", height: "42px", borderRadius: "10px",
                                            background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontWeight: 800, fontSize: "1rem"
                                        }}>
                                            {sesion.numero}
                                        </div>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>
                                                    Sesión {sesion.numero} — {sesion.fase === "INTENSIVA" ? "Fase Intensiva" : "Fase Ordinaria"}
                                                </span>
                                                <span style={{
                                                    fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px",
                                                    background: sesion.fase === "INTENSIVA" ? "rgba(124, 58, 237, 0.15)" : "rgba(37, 99, 235, 0.15)",
                                                    color: sesion.fase === "INTENSIVA" ? "#7c3aed" : "var(--primary)",
                                                    textTransform: "uppercase"
                                                }}>
                                                    {sesion.fase}
                                                </span>
                                            </div>
                                            {sesion.descripcion && <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>{sesion.descripcion}</p>}
                                            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.35rem" }}>
                                                {sesion.fechaSesion && (
                                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                        <Calendar size={12} /> {new Date(sesion.fechaSesion).toLocaleDateString("es-MX")}
                                                    </span>
                                                )}
                                                {sesion.fechaLimite && (
                                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                        <Clock size={12} /> Límite: {new Date(sesion.fechaLimite).toLocaleDateString("es-MX")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                                        {/* KPIs compactos */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{pct}%</div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Entregados</div>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981" }}>{res.revisados}</div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Revisados</div>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f59e0b" }}>{res.conObs}</div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Obs.</div>
                                            </div>
                                            <div style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-muted)" }}>{res.pendientes}</div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Pendientes</div>
                                            </div>
                                        </div>
                                        <div style={{ color: "var(--text-muted)" }}>
                                            {expandida ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Barra de progreso */}
                                <div style={{ height: "4px", background: "var(--border)" }}>
                                    <div style={{
                                        height: "100%", transition: "width 0.4s ease",
                                        background: pct === 100 ? "#10b981" : pct > 50 ? "#3b82f6" : "#f59e0b",
                                        width: `${pct}%`
                                    }} />
                                </div>

                                {/* Tabla de escuelas — expandible */}
                                {expandida && (
                                    <div style={{ padding: "1.25rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
                                        {sesion.guiaUrl && (
                                            <a href={sesion.guiaUrl} target="_blank" rel="noopener noreferrer"
                                                className="btn btn-outline"
                                                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem", marginBottom: "1rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                                                <BookOpen size={14} /> Ver Guía Oficial de Trabajo
                                            </a>
                                        )}
                                        <div style={{ overflowX: "auto" }}>
                                            <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
                                                <thead>
                                                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                                                        <th style={{ textAlign: "left", padding: "0.6rem 0.75rem" }}>CCT</th>
                                                        <th style={{ textAlign: "left", padding: "0.6rem 0.75rem" }}>Plantel</th>
                                                        <th style={{ textAlign: "center", padding: "0.6rem 0.75rem" }}>Estado</th>
                                                        {!readOnly && <th style={{ textAlign: "left", padding: "0.6rem 0.75rem" }}>Notas ATP</th>}
                                                        {!readOnly && <th style={{ textAlign: "center", padding: "0.6rem 0.75rem" }}>Acción</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {escuelasEnSesion(sesion).map(({ escuela, producto }) => {
                                                        const est = producto?.estado ?? "PENDIENTE";
                                                        const badge = ESTADO_LABELS[est] ?? ESTADO_LABELS.PENDIENTE;
                                                        return (
                                                            <tr key={escuela.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                                                <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{escuela.cct}</td>
                                                                <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "var(--text)" }}>{escuela.nombre}</td>
                                                                <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                                                                    <span style={{
                                                                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                                                        padding: "0.25rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600,
                                                                        background: badge.bg, color: badge.color
                                                                    }}>
                                                                        {badge.icon} {badge.label}
                                                                    </span>
                                                                </td>
                                                                {!readOnly && (
                                                                    <td style={{ padding: "0.6rem 0.75rem" }}>
                                                                        {producto && (
                                                                            <div style={{ display: "flex", gap: "0.4rem" }}>
                                                                                <input
                                                                                    className="form-control"
                                                                                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                                                                                    placeholder="Notas..."
                                                                                    value={notasEdicion[producto.id] ?? producto.notasAtp ?? ""}
                                                                                    onChange={e => setNotasEdicion(prev => ({ ...prev, [producto.id]: e.target.value }))}
                                                                                />
                                                                                <button
                                                                                    onClick={() => guardarNotas(producto.id)}
                                                                                    disabled={savingNotas[producto.id]}
                                                                                    className="btn btn-outline"
                                                                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                                                                >
                                                                                    {savingNotas[producto.id] ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                )}
                                                                {!readOnly && (
                                                                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                                                                        {producto && (
                                                                            <select
                                                                                className="form-control"
                                                                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
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
                                        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Users size={12} />{escuelas.length} planteles</span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#10b981" }}><CheckCircle2 size={12} />{res.revisados} revisados</span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#f59e0b" }}><AlertTriangle size={12} />{res.conObs} con observaciones</span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Clock size={12} />{res.pendientes} pendientes</span>
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
