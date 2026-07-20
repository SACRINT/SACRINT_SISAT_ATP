"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search, Plus, Edit2, Trash2, Save, X, UserPlus, ArrowRightLeft, Loader2, Users,
} from "lucide-react";
import { CARGOS_PERSONAL, GRADOS_ACADEMICOS, SEXOS } from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────

interface EscuelaRef {
    id: string;
    cct: string;
    nombre: string;
}

interface Personal {
    id: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    sexo: string;
    cargo: string;
    curp: string | null;
    rfc: string | null;
    telefono: string | null;
    correoElectronico: string | null;
    gradoAcademico: string | null;
    fechaIngreso: string | null;
    clavePresupuestal: string | null;
    escuelaId: string;
    escuela: EscuelaRef;
}

const EMPTY_FORM = {
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    sexo: "MASCULINO",
    cargo: "DOCENTE",
    curp: "",
    rfc: "",
    telefono: "",
    correoElectronico: "",
    gradoAcademico: "",
    fechaIngreso: "",
    clavePresupuestal: "",
    escuelaId: "",
};

// ─── Helpers ────────────────────────────────────────────

function getCargoLabel(v: string) {
    return CARGOS_PERSONAL.find(c => c.value === v)?.label || v;
}

function fieldStyle(): React.CSSProperties {
    return {
        display: "flex", flexDirection: "column", gap: "0.25rem",
    };
}

function labelStyle(): React.CSSProperties {
    return { fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" };
}

// ─── Component ──────────────────────────────────────────

export default function GestionPersonal({ escuelas }: { escuelas: EscuelaRef[] }) {
    const router = useRouter();
    const [personalList, setPersonalList] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterCargo, setFilterCargo] = useState("");
    const [filterEscuela, setFilterEscuela] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [saving, setSaving] = useState(false);

    // Modal de crear / editar
    const [modal, setModal] = useState<"create" | "edit" | "transfer" | null>(null);
    const [editTarget, setEditTarget] = useState<Personal | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/expedientes/personal?todas=true");
            if (res.ok) setPersonalList(await res.json());
        } catch {
            setMessage({ type: "error", text: "Error cargando datos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Filtrado ─────────────────────────────────────────

    const filtered = personalList.filter(p => {
        const term = search.toLowerCase();
        const matchSearch = !term ||
            p.nombre.toLowerCase().includes(term) ||
            p.apellidoPaterno.toLowerCase().includes(term) ||
            p.apellidoMaterno.toLowerCase().includes(term) ||
            (p.curp || "").toLowerCase().includes(term) ||
            (p.rfc || "").toLowerCase().includes(term) ||
            p.escuela.cct.toLowerCase().includes(term) ||
            p.escuela.nombre.toLowerCase().includes(term);
        const matchCargo = !filterCargo || p.cargo === filterCargo;
        const matchEscuela = !filterEscuela || p.escuelaId === filterEscuela;
        return matchSearch && matchCargo && matchEscuela;
    });

    // ─── Crear / Editar ───────────────────────────────────

    function openCreate() {
        setForm({ ...EMPTY_FORM, escuelaId: escuelas[0]?.id || "" });
        setEditTarget(null);
        setModal("create");
    }

    function openEdit(p: Personal) {
        setForm({
            nombre: p.nombre,
            apellidoPaterno: p.apellidoPaterno,
            apellidoMaterno: p.apellidoMaterno,
            sexo: p.sexo,
            cargo: p.cargo,
            curp: p.curp || "",
            rfc: p.rfc || "",
            telefono: p.telefono || "",
            correoElectronico: p.correoElectronico || "",
            gradoAcademico: p.gradoAcademico || "",
            fechaIngreso: p.fechaIngreso ? p.fechaIngreso.substring(0, 10) : "",
            clavePresupuestal: p.clavePresupuestal || "",
            escuelaId: p.escuelaId,
        });
        setEditTarget(p);
        setModal("edit");
    }

    function openTransfer(p: Personal) {
        setForm({ ...EMPTY_FORM, escuelaId: p.escuelaId });
        setEditTarget(p);
        setModal("transfer");
    }

    async function handleSave() {
        setSaving(true);
        setMessage(null);
        try {
            const isEdit = modal === "edit";
            const isTransfer = modal === "transfer";
            let res: Response;

            if (isTransfer && editTarget) {
                res = await fetch(`/api/expedientes/personal/${editTarget.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ escuelaId: form.escuelaId }),
                });
            } else if (isEdit && editTarget) {
                res = await fetch(`/api/expedientes/personal/${editTarget.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nombre: form.nombre,
                        apellidoPaterno: form.apellidoPaterno,
                        apellidoMaterno: form.apellidoMaterno,
                        sexo: form.sexo,
                        cargo: form.cargo,
                        curp: form.curp || null,
                        rfc: form.rfc || null,
                        telefono: form.telefono || null,
                        correoElectronico: form.correoElectronico || null,
                        gradoAcademico: form.gradoAcademico || null,
                        fechaIngreso: form.fechaIngreso || null,
                        clavePresupuestal: form.clavePresupuestal || null,
                        escuelaId: form.escuelaId,
                    }),
                });
            } else {
                res = await fetch("/api/expedientes/personal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nombre: form.nombre,
                        apellidoPaterno: form.apellidoPaterno,
                        apellidoMaterno: form.apellidoMaterno,
                        sexo: form.sexo,
                        cargo: form.cargo,
                        curp: form.curp || null,
                        rfc: form.rfc || null,
                        telefono: form.telefono || null,
                        correoElectronico: form.correoElectronico || null,
                        gradoAcademico: form.gradoAcademico || null,
                        fechaIngreso: form.fechaIngreso || null,
                        clavePresupuestal: form.clavePresupuestal || null,
                        escuelaId: form.escuelaId,
                    }),
                });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al guardar");

            setMessage({ type: "success", text: isTransfer ? "✅ Personal trasladado exitosamente." : isEdit ? "✅ Datos actualizados." : "✅ Personal creado correctamente." });
            setModal(null);
            await fetchData();
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Error de conexión" });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(p: Personal) {
        if (!confirm(`¿Eliminar el registro de "${p.apellidoPaterno} ${p.apellidoMaterno} ${p.nombre}"? Se eliminarán todos sus documentos del expediente. Esta acción no se puede deshacer.`)) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/expedientes/personal/${p.id}`, { method: "DELETE" });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Error al eliminar");
            }
            setMessage({ type: "success", text: "✅ Registro eliminado correctamente." });
            await fetchData();
        } catch (err: any) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setSaving(false);
        }
    }

    // ─── Render ────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Loader2 className="spin" size={32} />
            </div>
        );
    }

    // Sort escuelas: supervision first, then alphabetically
    const sortedEscuelas = [...escuelas].sort((a, b) => a.nombre.localeCompare(b.nombre));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Header bar */}
            <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Users size={20} style={{ color: "var(--primary)" }} />
                    <div>
                        <strong>Gestión de Personal</strong>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Crear, editar, trasladar o eliminar cualquier registro de personal de la zona.
                        </p>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: "0.375rem", minHeight: "auto", padding: "0.5rem 1rem" }}>
                    <UserPlus size={16} /> Nuevo Personal
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 2, minWidth: "200px", position: "relative" }}>
                        <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                        <input
                            className="form-control"
                            placeholder="Buscar por nombre, CURP, RFC, escuela..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: "2.25rem" }}
                        />
                    </div>
                    <select className="form-control" value={filterCargo} onChange={e => setFilterCargo(e.target.value)} style={{ flex: 1, minWidth: "160px" }}>
                        <option value="">Todos los cargos</option>
                        {CARGOS_PERSONAL.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <select className="form-control" value={filterEscuela} onChange={e => setFilterEscuela(e.target.value)} style={{ flex: 1, minWidth: "180px" }}>
                        <option value="">Todas las escuelas</option>
                        {sortedEscuelas.map(e => <option key={e.id} value={e.id}>{e.cct} – {e.nombre}</option>)}
                    </select>
                </div>
            </div>

            {/* Summary */}
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0 0.25rem" }}>
                Mostrando <strong>{filtered.length}</strong> de <strong>{personalList.length}</strong> registros
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                        No se encontraron registros con los filtros actuales.
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-secondary)", borderBottom: "2px solid var(--border)" }}>
                                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600 }}>Nombre</th>
                                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600 }}>Cargo</th>
                                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600 }}>Escuela / CCT</th>
                                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600 }}>CURP / RFC</th>
                                    <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600 }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p, idx) => (
                                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "var(--bg-secondary, #f9fafb)" }}>
                                        <td style={{ padding: "0.6rem 1rem" }}>
                                            <div style={{ fontWeight: 500 }}>{p.apellidoPaterno} {p.apellidoMaterno}</div>
                                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{p.nombre}</div>
                                        </td>
                                        <td style={{ padding: "0.6rem 1rem" }}>
                                            <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", borderRadius: "4px", background: "var(--primary-bg)", color: "var(--primary)", fontWeight: 600 }}>
                                                {getCargoLabel(p.cargo)}
                                            </span>
                                        </td>
                                        <td style={{ padding: "0.6rem 1rem" }}>
                                            <div style={{ fontWeight: 500, fontSize: "0.8rem" }}>{p.escuela.cct}</div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.escuela.nombre}</div>
                                        </td>
                                        <td style={{ padding: "0.6rem 1rem", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                            {p.curp && <div>{p.curp}</div>}
                                            {p.rfc && <div style={{ color: "var(--text-muted)" }}>{p.rfc}</div>}
                                            {!p.curp && !p.rfc && <span style={{ color: "var(--text-muted)" }}>—</span>}
                                        </td>
                                        <td style={{ padding: "0.6rem 1rem" }}>
                                            <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem" }}>
                                                <button
                                                    title="Editar datos"
                                                    onClick={() => openEdit(p)}
                                                    style={{ background: "var(--primary-bg)", border: "none", borderRadius: "6px", padding: "0.35rem 0.5rem", cursor: "pointer", color: "var(--primary)", display: "flex", alignItems: "center" }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    title="Trasladar a otra escuela"
                                                    onClick={() => openTransfer(p)}
                                                    style={{ background: "#f0fdf4", border: "none", borderRadius: "6px", padding: "0.35rem 0.5rem", cursor: "pointer", color: "#16a34a", display: "flex", alignItems: "center" }}
                                                >
                                                    <ArrowRightLeft size={14} />
                                                </button>
                                                <button
                                                    title="Eliminar registro"
                                                    onClick={() => handleDelete(p)}
                                                    disabled={saving}
                                                    style={{ background: "var(--danger-bg)", border: "none", borderRadius: "6px", padding: "0.35rem 0.5rem", cursor: "pointer", color: "var(--danger)", display: "flex", alignItems: "center" }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modal ───────────────────────────────────────── */}
            {modal && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
                }}>
                    <div style={{
                        background: "var(--surface)", borderRadius: "12px", padding: "1.5rem",
                        width: "100%", maxWidth: modal === "transfer" ? "440px" : "680px",
                        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                            <h3 style={{ margin: 0, fontSize: "1.125rem" }}>
                                {modal === "create" && "Nuevo Registro de Personal"}
                                {modal === "edit" && "Editar Registro de Personal"}
                                {modal === "transfer" && `Trasladar: ${editTarget?.apellidoPaterno} ${editTarget?.apellidoMaterno} ${editTarget?.nombre}`}
                            </h3>
                            <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Transfer form (simplified) */}
                        {modal === "transfer" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "8px", fontSize: "0.875rem" }}>
                                    <strong>Escuela actual:</strong> {editTarget?.escuela.cct} – {editTarget?.escuela.nombre}
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Nueva Escuela / Supervisión de Destino *</label>
                                    <select className="form-control" value={form.escuelaId} onChange={e => setForm(f => ({ ...f, escuelaId: e.target.value }))}>
                                        {sortedEscuelas.filter(e => e.id !== editTarget?.escuelaId).map(e => (
                                            <option key={e.id} value={e.id}>{e.cct} – {e.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    ⚠️ Los documentos de su expediente se moverán junto con el personal a la nueva escuela.
                                </p>
                            </div>
                        )}

                        {/* Create / Edit full form */}
                        {(modal === "create" || modal === "edit") && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div style={{ ...fieldStyle(), gridColumn: "1 / -1" }}>
                                    <label style={labelStyle()}>Escuela / Supervisión *</label>
                                    <select className="form-control" value={form.escuelaId} onChange={e => setForm(f => ({ ...f, escuelaId: e.target.value }))}>
                                        {sortedEscuelas.map(e => <option key={e.id} value={e.id}>{e.cct} – {e.nombre}</option>)}
                                    </select>
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Apellido Paterno *</label>
                                    <input className="form-control" value={form.apellidoPaterno} onChange={e => setForm(f => ({ ...f, apellidoPaterno: e.target.value }))} />
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Apellido Materno *</label>
                                    <input className="form-control" value={form.apellidoMaterno} onChange={e => setForm(f => ({ ...f, apellidoMaterno: e.target.value }))} />
                                </div>
                                <div style={{ ...fieldStyle(), gridColumn: "1 / -1" }}>
                                    <label style={labelStyle()}>Nombre(s) *</label>
                                    <input className="form-control" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Sexo *</label>
                                    <select className="form-control" value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                                        {SEXOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Cargo *</label>
                                    <select className="form-control" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}>
                                        {CARGOS_PERSONAL.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>CURP</label>
                                    <input className="form-control" value={form.curp} onChange={e => setForm(f => ({ ...f, curp: e.target.value.toUpperCase() }))} maxLength={18} style={{ fontFamily: "monospace" }} />
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>RFC</label>
                                    <input className="form-control" value={form.rfc} onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))} maxLength={13} style={{ fontFamily: "monospace" }} />
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Clave Presupuestal</label>
                                    <input className="form-control" value={form.clavePresupuestal} onChange={e => setForm(f => ({ ...f, clavePresupuestal: e.target.value }))} />
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Grado Académico</label>
                                    <select className="form-control" value={form.gradoAcademico} onChange={e => setForm(f => ({ ...f, gradoAcademico: e.target.value }))}>
                                        <option value="">Sin especificar</option>
                                        {GRADOS_ACADEMICOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                    </select>
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Fecha de Ingreso</label>
                                    <input type="date" className="form-control" value={form.fechaIngreso} onChange={e => setForm(f => ({ ...f, fechaIngreso: e.target.value }))} />
                                </div>
                                <div style={fieldStyle()}>
                                    <label style={labelStyle()}>Teléfono</label>
                                    <input className="form-control" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                                </div>
                                <div style={{ ...fieldStyle(), gridColumn: "1 / -1" }}>
                                    <label style={labelStyle()}>Correo Electrónico</label>
                                    <input type="email" className="form-control" value={form.correoElectronico} onChange={e => setForm(f => ({ ...f, correoElectronico: e.target.value }))} />
                                </div>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                            <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={saving}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                                {modal === "transfer" ? "Confirmar Traslado" : modal === "edit" ? "Guardar Cambios" : "Crear Registro"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
