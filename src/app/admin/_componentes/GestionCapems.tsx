"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Trash2,
    Edit3,
    Save,
    X,
    Lock,
    Unlock,
    Download,
    FileText,
    ChevronDown,
    ChevronUp,
    ToggleLeft,
    ToggleRight,
    Search,
    Loader2,
} from "lucide-react";
import { getDownloadUrl } from "@/lib/download-url";

interface Ficha {
    id: string;
    nombre: string;
    activo: boolean;
    orden: number;
}

interface Capem {
    id: string;
    nombre: string;
    orden: number;
    activo: boolean;
}

interface Registro {
    id: string;
    escuelaId: string;
    capemId: string;
    fichaId: string;
    archivoNombre: string | null;
    archivoDriveId: string | null;
    archivoDriveUrl: string | null;
    bloqueado: boolean;
    createdAt: string;
    ficha: { id: string; nombre: string };
    capem: { id: string; nombre: string };
    escuela: { id: string; cct: string; nombre: string };
}

type TabSection = "fichas" | "capems" | "resumen";

export default function GestionCapems() {
    const router = useRouter();
    const [section, setSection] = useState<TabSection>("resumen");
    const [fichas, setFichas] = useState<Ficha[]>([]);
    const [capems, setCapems] = useState<Capem[]>([]);
    const [registros, setRegistros] = useState<Registro[]>([]);
    const [loading, setLoading] = useState(true);

    // Fichas state
    const [newFichaName, setNewFichaName] = useState("");
    const [editingFicha, setEditingFicha] = useState<string | null>(null);
    const [editFichaName, setEditFichaName] = useState("");

    // Capems state
    const [newCapemName, setNewCapemName] = useState("");

    // Resumen state
    const [expandedEscuela, setExpandedEscuela] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCapem, setFilterCapem] = useState<string>("");

    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const [capemsActive, setCapemsActive] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [fichasRes, capemsRes, registrosRes, configRes] = await Promise.all([
                fetch("/api/admin/fichas"),
                fetch("/api/admin/capems"),
                fetch("/api/capems/registros"),
                fetch("/api/capems/config"),
            ]);
            if (fichasRes.ok) setFichas(await fichasRes.json());
            if (capemsRes.ok) setCapems(await capemsRes.json());
            if (registrosRes.ok) setRegistros(await registrosRes.json());
            if (configRes.ok) {
                const configData = await configRes.json();
                setCapemsActive(configData.activo ?? false);
            }
        } catch {
            setMessage({ type: "error", text: "Error cargando datos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    async function handleToggleCapemsActive() {
        const newValue = !capemsActive;
        setBusy(true);
        try {
            const res = await fetch("/api/capems/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: newValue }),
            });
            if (res.ok) {
                setCapemsActive(newValue);
                setMessage({ type: "success", text: newValue ? "CAPEMS activado para directores" : "CAPEMS desactivado para directores" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    // ─── Fichas CRUD ───

    async function handleAddFicha() {
        if (!newFichaName.trim()) return;
        setBusy(true);
        try {
            const res = await fetch("/api/admin/fichas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: newFichaName.trim() }),
            });
            if (res.ok) {
                setNewFichaName("");
                setMessage({ type: "success", text: "Ficha creada" });
                fetchData();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error al crear ficha" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    async function handleUpdateFicha(id: string, data: Partial<Ficha>) {
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/fichas/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Ficha actualizada" });
                setEditingFicha(null);
                fetchData();
            } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Error al actualizar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    async function handleDeleteFicha(id: string) {
        if (!confirm("¿Eliminar esta ficha? Solo es posible si no tiene registros asociados.")) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/fichas/${id}`, { method: "DELETE" });
            if (res.ok) {
                setMessage({ type: "success", text: "Ficha eliminada" });
                fetchData();
            } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Error al eliminar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    // ─── CAPEMS ───

    async function handleAddCapem() {
        if (!newCapemName.trim()) return;
        setBusy(true);
        try {
            const res = await fetch("/api/admin/capems", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: newCapemName.trim() }),
            });
            if (res.ok) {
                setNewCapemName("");
                setMessage({ type: "success", text: "CAPEM creado" });
                fetchData();
            } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Error al crear CAPEM" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    // ─── Registros ───

    async function handleToggleBloqueo(registroId: string, bloqueado: boolean) {
        setBusy(true);
        try {
            const res = await fetch(`/api/capems/registros/${registroId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bloqueado }),
            });
            if (res.ok) {
                setRegistros(prev => prev.map(r => r.id === registroId ? { ...r, bloqueado } : r));
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    // ─── Agrupación para resumen ───

    // Agrupar registros por escuela
    const escuelasMap = new Map<string, { cct: string; nombre: string; registros: Registro[] }>();
    registros.forEach(r => {
        if (!escuelasMap.has(r.escuelaId)) {
            escuelasMap.set(r.escuelaId, { cct: r.escuela.cct, nombre: r.escuela.nombre, registros: [] });
        }
        escuelasMap.get(r.escuelaId)!.registros.push(r);
    });

    const escuelasArray = Array.from(escuelasMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .filter(e => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return e.cct.toLowerCase().includes(term) || e.nombre.toLowerCase().includes(term);
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Loader2 className="spin" size={32} />
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Toggle para directores */}
            <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <strong>Módulo CAPEMS para Directores</strong>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        {capemsActive ? "Los directores pueden ver y subir fichas CAPEMS" : "CAPEMS está oculto para los directores"}
                    </p>
                </div>
                <button
                    onClick={handleToggleCapemsActive}
                    disabled={busy}
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: capemsActive ? "var(--success)" : "var(--text-muted)",
                    }}
                    title={capemsActive ? "Desactivar" : "Activar"}
                >
                    {capemsActive ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className={`btn ${section === "resumen" ? "btn-primary" : "btn-outline"}`} onClick={() => setSection("resumen")} style={{ flex: 1 }}>
                    <FileText size={18} /> Resumen Escuelas
                </button>
                <button className={`btn ${section === "fichas" ? "btn-primary" : "btn-outline"}`} onClick={() => setSection("fichas")} style={{ flex: 1 }}>
                    <FileText size={18} /> Gestión de Fichas
                </button>
                <button className={`btn ${section === "capems" ? "btn-primary" : "btn-outline"}`} onClick={() => setSection("capems")} style={{ flex: 1 }}>
                    <FileText size={18} /> Gestión de CAPEMS
                </button>
            </div>

            {/* ════════ FICHAS ════════ */}
            {section === "fichas" && (
                <div className="card">
                    <h3 style={{ marginBottom: "1rem" }}>Catálogo de Fichas ({fichas.length})</h3>

                    {/* Add ficha */}
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Nombre de la nueva ficha..."
                            value={newFichaName}
                            onChange={e => setNewFichaName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddFicha()}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={handleAddFicha} disabled={busy || !newFichaName.trim()}>
                            <Plus size={18} /> Agregar
                        </button>
                    </div>

                    {/* Fichas list */}
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                        {fichas.map((ficha, i) => (
                            <div key={ficha.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "0.625rem 0.5rem",
                                borderBottom: i < fichas.length - 1 ? "1px solid var(--border)" : "none",
                                opacity: ficha.activo ? 1 : 0.5,
                            }}>
                                {editingFicha === ficha.id ? (
                                    <div style={{ display: "flex", gap: "0.5rem", flex: 1 }}>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editFichaName}
                                            onChange={e => setEditFichaName(e.target.value)}
                                            style={{ flex: 1, padding: "0.25rem 0.5rem" }}
                                        />
                                        <button className="btn btn-primary" onClick={() => handleUpdateFicha(ficha.id, { nombre: editFichaName })} disabled={busy} style={{ padding: "0.25rem 0.5rem", minHeight: "auto" }}>
                                            <Save size={14} />
                                        </button>
                                        <button className="btn btn-outline" onClick={() => setEditingFicha(null)} style={{ padding: "0.25rem 0.5rem", minHeight: "auto" }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span style={{ fontSize: "0.875rem" }}>
                                            <span style={{ color: "var(--text-muted)", marginRight: "0.5rem" }}>{ficha.orden}.</span>
                                            {ficha.nombre}
                                        </span>
                                        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                                            <button
                                                onClick={() => handleUpdateFicha(ficha.id, { activo: !ficha.activo })}
                                                style={{ background: "none", border: "none", cursor: "pointer", color: ficha.activo ? "var(--success)" : "var(--text-muted)" }}
                                                title={ficha.activo ? "Desactivar" : "Activar"}
                                            >
                                                {ficha.activo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                            </button>
                                            <button
                                                onClick={() => { setEditingFicha(ficha.id); setEditFichaName(ficha.nombre); }}
                                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)" }}
                                                title="Editar nombre"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFicha(ficha.id)}
                                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ════════ CAPEMS ════════ */}
            {section === "capems" && (
                <div className="card">
                    <h3 style={{ marginBottom: "1rem" }}>CAPEMS del Ciclo ({capems.length})</h3>

                    {/* Add CAPEM */}
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Nombre del CAPEM extra (ej: CAPEM 7)..."
                            value={newCapemName}
                            onChange={e => setNewCapemName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddCapem()}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={handleAddCapem} disabled={busy || !newCapemName.trim()}>
                            <Plus size={18} /> Agregar
                        </button>
                    </div>

                    {/* CAPEMS list */}
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                        {capems.map((capem, i) => (
                            <div key={capem.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "0.75rem 0.5rem",
                                borderBottom: i < capems.length - 1 ? "1px solid var(--border)" : "none",
                            }}>
                                <span style={{ fontWeight: 600 }}>{capem.nombre}</span>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    {registros.filter(r => r.capemId === capem.id).length} registros
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ════════ RESUMEN ESCUELAS ════════ */}
            {section === "resumen" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {/* Filtros */}
                    <div className="card" style={{ padding: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
                                <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Buscar por CCT o nombre..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: "2.25rem" }}
                                />
                            </div>
                            <select
                                className="form-control"
                                value={filterCapem}
                                onChange={e => setFilterCapem(e.target.value)}
                                style={{ width: "200px" }}
                            >
                                <option value="">Todos los CAPEMS</option>
                                {capems.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7", padding: "0.75rem" }}>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c5a8e" }}>
                            <strong>{escuelasArray.length}</strong> escuelas con registros • <strong>{registros.length}</strong> fichas subidas en total
                        </p>
                    </div>

                    {/* Tabla de escuelas */}
                    {escuelasArray.length === 0 ? (
                        <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                            No hay registros aún
                        </div>
                    ) : (
                        escuelasArray.map(escuela => {
                            const isExpanded = expandedEscuela === escuela.id;
                            const escRegs = filterCapem
                                ? escuela.registros.filter(r => r.capemId === filterCapem)
                                : escuela.registros;

                            return (
                                <div key={escuela.id} className="card" style={{ padding: 0 }}>
                                    <button
                                        onClick={() => setExpandedEscuela(isExpanded ? null : escuela.id)}
                                        style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            width: "100%", padding: "0.875rem 1rem",
                                            background: "none", border: "none", cursor: "pointer",
                                            textAlign: "left", fontWeight: 600,
                                        }}
                                    >
                                        <div>
                                            <span style={{ color: "var(--text-muted)", marginRight: "0.5rem", fontSize: "0.8125rem" }}>{escuela.cct}</span>
                                            {escuela.nombre}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            {/* Chips por CAPEM */}
                                            <div style={{ display: "flex", gap: "0.25rem" }}>
                                                {capems.map(c => {
                                                    const count = escuela.registros.filter(r => r.capemId === c.id).length;
                                                    return (
                                                        <span key={c.id} style={{
                                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                            background: count > 0 ? "var(--primary)" : "var(--bg-secondary)",
                                                            color: count > 0 ? "white" : "var(--text-muted)",
                                                            borderRadius: "9999px", padding: "0.125rem 0.5rem",
                                                            fontSize: "0.6875rem", fontWeight: 700, minWidth: "1.5rem",
                                                        }} title={`${c.nombre}: ${count} fichas`}>
                                                            {count}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div style={{ borderTop: "1px solid var(--border)" }}>
                                            {escRegs.length === 0 ? (
                                                <p style={{ padding: "1rem", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                                                    Sin registros {filterCapem ? "para este CAPEM" : ""}
                                                </p>
                                            ) : (
                                                <div style={{ overflowX: "auto" }}>
                                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                                        <thead>
                                                            <tr style={{ background: "var(--bg-secondary)" }}>
                                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>CAPEM</th>
                                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Ficha</th>
                                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Archivo</th>
                                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Acciones</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {escRegs.map(reg => (
                                                                <tr key={reg.id} style={{ borderTop: "1px solid var(--border)" }}>
                                                                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{reg.capem.nombre}</td>
                                                                    <td style={{ padding: "0.5rem 0.75rem" }}>{reg.ficha.nombre}</td>
                                                                    <td style={{ padding: "0.5rem 0.75rem" }}>
                                                                        {reg.archivoDriveUrl ? (
                                                                            <a
                                                                                href={getDownloadUrl(reg.archivoDriveUrl, reg.archivoNombre || "archivo", reg.archivoDriveId) || "#"}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", textDecoration: "none" }}
                                                                            >
                                                                                <Download size={14} /> {reg.archivoNombre || "Descargar"}
                                                                            </a>
                                                                        ) : (
                                                                            <span style={{ color: "var(--text-muted)" }}>Sin archivo</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                                        <button
                                                                            onClick={() => handleToggleBloqueo(reg.id, !reg.bloqueado)}
                                                                            disabled={busy}
                                                                            style={{
                                                                                background: "none", border: "none", cursor: "pointer",
                                                                                color: reg.bloqueado ? "var(--error)" : "var(--success)",
                                                                            }}
                                                                            title={reg.bloqueado ? "Desbloquear" : "Bloquear"}
                                                                        >
                                                                            {reg.bloqueado ? <Lock size={18} /> : <Unlock size={18} />}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
