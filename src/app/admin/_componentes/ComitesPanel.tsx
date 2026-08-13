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

const ESTADO_INFO: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    ACTIVO:                  { label: "Activo ✓",             bg: "rgba(16, 185, 129, 0.15)", color: "#10b981", icon: <CheckCircle2 size={12}/> },
    PENDIENTE_INTEGRACION:   { label: "Pendiente integración", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", icon: <Clock size={12}/> },
    REQUIERE_ACTUALIZACION:  { label: "Requiere actualización", bg: "rgba(249, 115, 22, 0.15)", color: "#f97316", icon: <AlertTriangle size={12}/> },
    INACTIVO:                { label: "Inactivo",              bg: "rgba(107, 114, 128, 0.15)", color: "#6b7280", icon: <X size={12}/> },
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

    const comiteIds = new Set(comites.map(c => c.escuelaId));
    const escuelasSinComite = escuelas.filter(e => !comiteIds.has(e.id));

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
                        <ShieldCheck style={{ color: "#10b981" }} size={28} />
                        Comités de Convivencia y Seguridad
                    </h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        Directorio zonal de comités escolares — Zona 004
                    </p>
                </div>
                <button className="btn btn-outline" onClick={cargar} style={{ fontSize: "0.8125rem" }}>
                    <RefreshCw size={15} /> Actualizar
                </button>
            </div>

            {error && (
                <div className="alert alert-error">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text)" }}>{total}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Planteles</div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981" }}>{activos}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Comités Activos</div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f59e0b" }}>{pendientes}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Pendientes</div>
                </div>
                <div className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f97316" }}>{reqActualizacion}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Req. Actualización</div>
                </div>
            </div>

            {/* Escuelas sin comité */}
            {escuelasSinComite.length > 0 && !readOnly && (
                <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
                    <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "#f59e0b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <AlertTriangle size={16} /> {escuelasSinComite.length} plantel(es) sin comité registrado
                    </h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {escuelasSinComite.map(esc => (
                            <button
                                key={esc.id}
                                onClick={() => actualizarComite(esc.id, "PENDIENTE_INTEGRACION")}
                                disabled={saving[esc.id]}
                                className="btn btn-outline"
                                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                            >
                                {saving[esc.id] ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
                                Registrar {esc.cct}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista de comités */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {comites.map(comite => {
                    const info = ESTADO_INFO[comite.estado] ?? ESTADO_INFO.PENDIENTE_INTEGRACION;
                    const expand = expandido === comite.id;
                    return (
                        <div key={comite.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                            <div
                                style={{
                                    padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
                                    cursor: "pointer", background: "var(--bg-card)", flexWrap: "wrap", gap: "0.75rem"
                                }}
                                onClick={() => setExpandido(expand ? null : comite.id)}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <div style={{
                                        width: "36px", height: "36px", borderRadius: "8px",
                                        background: "rgba(16, 185, 129, 0.1)", color: "#10b981",
                                        display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>{comite.escuela.nombre}</span>
                                            <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>{comite.escuela.cct}</span>
                                        </div>
                                        {comite.fechaIntegracion && (
                                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                Integrado: {new Date(comite.fechaIntegracion).toLocaleDateString("es-MX")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                    <span style={{
                                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                        padding: "0.25rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600,
                                        background: info.bg, color: info.color
                                    }}>
                                        {info.icon} {info.label}
                                    </span>
                                    {comite.actas.length > 0 && (
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                            <FileText size={12} /> {comite.actas.length} acta(s)
                                        </span>
                                    )}
                                    <span style={{ color: "var(--text-muted)" }}>
                                        {expand ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </span>
                                </div>
                            </div>

                            {expand && !readOnly && (
                                <div style={{ padding: "1.25rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                        <div>
                                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Estado del Comité</label>
                                            <select
                                                className="form-control"
                                                style={{ width: "100%" }}
                                                defaultValue={comite.estado}
                                                onChange={e => actualizarComite(comite.escuelaId, e.target.value, notasEdicion[comite.id] ?? comite.notasAtp ?? "")}
                                            >
                                                <option value="ACTIVO">Activo</option>
                                                <option value="PENDIENTE_INTEGRACION">Pendiente integración</option>
                                                <option value="REQUIERE_ACTUALIZACION">Requiere actualización</option>
                                                <option value="INACTIVO">Inactivo</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Notas del ATP</label>
                                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                                <input
                                                    className="form-control"
                                                    style={{ flex: 1 }}
                                                    value={notasEdicion[comite.id] ?? comite.notasAtp ?? ""}
                                                    onChange={e => setNotasEdicion(prev => ({ ...prev, [comite.id]: e.target.value }))}
                                                    placeholder="Observaciones..."
                                                />
                                                <button
                                                    onClick={() => actualizarComite(comite.escuelaId, comite.estado, notasEdicion[comite.id] ?? "")}
                                                    disabled={saving[comite.escuelaId]}
                                                    className="btn btn-outline"
                                                    style={{ padding: "0.4rem 0.75rem" }}
                                                >
                                                    {saving[comite.escuelaId] ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {comite.actas.length > 0 && (
                                        <div>
                                            <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>Actas registradas:</p>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                                {comite.actas.map(acta => (
                                                    <div key={acta.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                                        <FileText size={12} style={{ color: "var(--text-muted)" }} />
                                                        <span>{acta.nombreArchivo ?? acta.tipoDocumento}</span>
                                                        {acta.fechaDocumento && (
                                                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
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
                <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
                    <Users size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No hay planteles registrados</p>
                </div>
            )}
        </div>
    );
}
