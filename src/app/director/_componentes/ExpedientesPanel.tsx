"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Trash2,
    Upload,
    FileText,
    ChevronDown,
    ChevronUp,
    Lock,
    Loader2,
    Download,
    X,
    Save,
    Edit3,
    Users,
    UserPlus,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { getDownloadUrl, getExpedienteDownloadUrl } from "@/lib/download-url";
import { DOCUMENTOS_PREDETERMINADOS, CARGOS_PERSONAL, GRADOS_ACADEMICOS, SEXOS } from "@/lib/constants";

interface Documento {
    id: string;
    personalId: string;
    tipoDocumento: string;
    etiqueta: string | null;
    archivoNombre: string | null;
    archivoDriveId: string | null;
    archivoDriveUrl: string | null;
    bloqueado: boolean;
    orden: number;
}

interface PersonalRecord {
    id: string;
    escuelaId: string;
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
    documentos: Documento[];
}

interface Props {
    escuela: { id: string; cct: string; nombre: string };
}

const EMPTY_FORM = {
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    sexo: "",
    cargo: "",
    curp: "",
    rfc: "",
    telefono: "",
    correoElectronico: "",
    gradoAcademico: "",
    fechaIngreso: "",
};

export default function ExpedientesPanel({ escuela }: Props) {
    const [personal, setPersonal] = useState<PersonalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null); // docType+personalId
    const [editingPerson, setEditingPerson] = useState<string | null>(null);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [customDocName, setCustomDocName] = useState<Record<string, string>>({});
    const [downloadingPersonZip, setDownloadingPersonZip] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/expedientes/personal");
            if (res.ok) {
                setPersonal(await res.json());
            }
        } catch {
            setMessage({ type: "error", text: "Error cargando expedientes" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Descarga ZIP de persona ───
    async function handleDownloadPersonZip(personalId: string) {
        setDownloadingPersonZip(personalId);
        try {
            const res = await fetch(`/api/expedientes/descargar?personalId=${personalId}`);
            if (!res.ok) {
                const d = await res.json().catch(() => ({ error: "Sin archivos subidos" }));
                setMessage({ type: "error", text: d.error || "Error al descargar" });
                return;
            }
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const disposition = res.headers.get("content-disposition");
            const nameMatch = disposition?.match(/filename="(.+)"/);
            a.download = nameMatch?.[1] || "Expediente.zip";
            a.click();
            URL.revokeObjectURL(a.href);
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setDownloadingPersonZip(null);
        }
    }

    // ─── Crear personal ───
    async function handleCreate() {
        if (!form.nombre.trim() || !form.apellidoPaterno.trim() || !form.apellidoMaterno.trim() || !form.sexo || !form.cargo) {
            setMessage({ type: "error", text: "Nombre, apellidos, sexo y cargo son obligatorios" });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/expedientes/personal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Personal registrado correctamente" });
                setForm(EMPTY_FORM);
                setShowForm(false);
                fetchData();
            } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Error al registrar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setSaving(false);
        }
    }

    // ─── Editar personal ───
    async function handleUpdate(id: string) {
        setSaving(true);
        try {
            const res = await fetch(`/api/expedientes/personal/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Datos actualizados" });
                setEditingPerson(null);
                fetchData();
            } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Error al actualizar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setSaving(false);
        }
    }

    // ─── Eliminar personal ───
    async function handleDelete(id: string) {
        if (!confirm("¿Eliminar este registro de personal y todos sus documentos? Esta acción no se puede deshacer.")) return;
        try {
            const res = await fetch(`/api/expedientes/personal/${id}`, { method: "DELETE" });
            if (res.ok) {
                setMessage({ type: "success", text: "Personal eliminado" });
                if (expandedPerson === id) setExpandedPerson(null);
                fetchData();
            } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Error al eliminar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        }
    }

    // ─── Subir documento ───
    async function handleUploadDoc(personId: string, tipoDocumento: string, file: File, etiqueta?: string) {
        const uploadKey = `${personId}-${tipoDocumento}-${Date.now()}`;
        setUploadingDoc(uploadKey);

        try {
            // 1. Get Cloudinary signature
            const person = personal.find(p => p.id === personId);
            const personName = person ? `${person.apellidoPaterno}_${person.apellidoMaterno}_${person.nombre}` : "Personal";

            const signRes = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    programa: "Expedientes",
                    cct: escuela.cct,
                    escuelaNombre: escuela.nombre,
                    subfolder: personName.replace(/\s+/g, "_"),
                    originalFilename: file.name,
                }),
            });

            if (!signRes.ok) throw new Error("Error obteniendo firma");
            const { signature, timestamp, folder, apiKey, cloudName, publicId } = await signRes.json();

            // 2. Upload to Cloudinary
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", apiKey);
            formData.append("timestamp", timestamp.toString());
            formData.append("signature", signature);
            formData.append("folder", folder);
            if (publicId) formData.append("public_id", publicId);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) throw new Error("Error subiendo archivo");
            const uploadData = await uploadRes.json();

            // 3. Create document record
            const res = await fetch("/api/expedientes/documentos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    personalId: personId,
                    tipoDocumento,
                    etiqueta: etiqueta || null,
                    archivoNombre: file.name,
                    archivoDriveId: uploadData.public_id,
                    archivoDriveUrl: uploadData.secure_url,
                }),
            });

            if (!res.ok) throw new Error("Error guardando documento");

            setMessage({ type: "success", text: "Documento subido correctamente" });
            fetchData();
        } catch {
            setMessage({ type: "error", text: "Error al subir el documento" });
        } finally {
            setUploadingDoc(null);
        }
    }

    // ─── Eliminar documento ───
    async function handleDeleteDoc(docId: string) {
        if (!confirm("¿Eliminar este documento?")) return;
        try {
            const res = await fetch(`/api/expedientes/documentos/${docId}`, { method: "DELETE" });
            if (res.ok) {
                setMessage({ type: "success", text: "Documento eliminado" });
                fetchData();
            } else {
                const d = await res.json();
                setMessage({ type: "error", text: d.error || "Error al eliminar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        }
    }

    // ─── Helpers ───
    function getDocsForType(personDocs: Documento[], tipo: string): Documento[] {
        return personDocs.filter(d => d.tipoDocumento === tipo);
    }

    function getCustomDocs(personDocs: Documento[]): Documento[] {
        const predefinedTypes: string[] = DOCUMENTOS_PREDETERMINADOS.map(d => d.tipo);
        return personDocs.filter(d => !predefinedTypes.includes(d.tipoDocumento));
    }

    function getCompleteness(personDocs: Documento[]): { uploaded: number; total: number } {
        let uploaded = 0;
        for (const docType of DOCUMENTOS_PREDETERMINADOS) {
            const docs = getDocsForType(personDocs, docType.tipo);
            if (docs.some(d => d.archivoDriveUrl)) uploaded++;
        }
        return { uploaded, total: DOCUMENTOS_PREDETERMINADOS.length };
    }

    function getCargoLabel(cargo: string) {
        return CARGOS_PERSONAL.find(c => c.value === cargo)?.label || cargo;
    }

    function getGradoLabel(grado: string | null) {
        if (!grado) return "—";
        return GRADOS_ACADEMICOS.find(g => g.value === grado)?.label || grado;
    }

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

            {/* Header info */}
            <div className="card" style={{ background: "linear-gradient(135deg, #1a4d2e 0%, #2d8659 100%)", color: "white", border: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Users size={22} /> Expedientes de Personal
                        </h3>
                        <p style={{ margin: "0.25rem 0 0", opacity: 0.85, fontSize: "0.875rem" }}>
                            Registra y sube los documentos de todo el personal de tu escuela.
                        </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ background: "rgba(255,255,255,0.2)", padding: "0.375rem 0.75rem", borderRadius: "9999px", fontWeight: 700, fontSize: "0.875rem" }}>
                            {personal.length} {personal.length === 1 ? "empleado" : "empleados"}
                        </span>
                        <button
                            className="btn"
                            onClick={() => { setShowForm(!showForm); if (showForm) setForm(EMPTY_FORM); }}
                            style={{ background: "white", color: "#1a4d2e", fontWeight: 700, padding: "0.5rem 1rem", minHeight: "auto" }}
                        >
                            {showForm ? <><X size={18} /> Cancelar</> : <><UserPlus size={18} /> Nuevo Personal</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Formulario nuevo personal ─── */}
            {showForm && (
                <div className="card" style={{ border: "2px solid var(--primary)" }}>
                    <h4 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <UserPlus size={20} /> Registrar Nuevo Personal
                    </h4>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Nombre(s) *</label>
                            <input className="form-control" placeholder="Nombre(s)" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Apellido Paterno *</label>
                            <input className="form-control" placeholder="Apellido Paterno" value={form.apellidoPaterno} onChange={e => setForm({ ...form, apellidoPaterno: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Apellido Materno *</label>
                            <input className="form-control" placeholder="Apellido Materno" value={form.apellidoMaterno} onChange={e => setForm({ ...form, apellidoMaterno: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Sexo *</label>
                            <select className="form-control" value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {SEXOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Cargo *</label>
                            <select className="form-control" value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {CARGOS_PERSONAL.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Grado Académico</label>
                            <select className="form-control" value={form.gradoAcademico} onChange={e => setForm({ ...form, gradoAcademico: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {GRADOS_ACADEMICOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>CURP</label>
                            <input className="form-control" placeholder="CURP" value={form.curp} onChange={e => setForm({ ...form, curp: e.target.value.toUpperCase() })} maxLength={18} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>RFC</label>
                            <input className="form-control" placeholder="RFC" value={form.rfc} onChange={e => setForm({ ...form, rfc: e.target.value.toUpperCase() })} maxLength={13} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Teléfono</label>
                            <input className="form-control" placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Correo Electrónico</label>
                            <input className="form-control" placeholder="correo@ejemplo.com" value={form.correoElectronico} onChange={e => setForm({ ...form, correoElectronico: e.target.value })} />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>Fecha de Ingreso</label>
                            <input className="form-control" type="date" value={form.fechaIngreso} onChange={e => setForm({ ...form, fechaIngreso: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem", gap: "0.5rem" }}>
                        <button className="btn btn-outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{ minHeight: "auto", padding: "0.5rem 1rem" }}>
                            Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={saving} style={{ minHeight: "auto", padding: "0.5rem 1rem" }}>
                            {saving ? <><Loader2 size={16} className="spin" /> Guardando...</> : <><Save size={16} /> Guardar</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Lista de personal ─── */}
            {personal.length === 0 && !showForm ? (
                <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
                    <Users size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: "1rem" }}>No hay personal registrado aún.</p>
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>Haz clic en <strong>&quot;Nuevo Personal&quot;</strong> para comenzar.</p>
                </div>
            ) : (
                personal.map(person => {
                    const isExpanded = expandedPerson === person.id;
                    const isEditing = editingPerson === person.id;
                    const { uploaded, total } = getCompleteness(person.documentos);
                    const completePct = Math.round((uploaded / total) * 100);
                    const completionColor = uploaded === total ? "var(--success)" : uploaded >= 5 ? "#e6a817" : "var(--error)";

                    return (
                        <div key={person.id} className="card" style={{ padding: 0 }}>
                            {/* Header */}
                            <button
                                onClick={() => setExpandedPerson(isExpanded ? null : person.id)}
                                style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    width: "100%", padding: "0.875rem 1rem",
                                    background: "none", border: "none", cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <div style={{
                                        width: "40px", height: "40px", borderRadius: "50%",
                                        background: person.sexo === "FEMENINO" ? "#fce4ec" : "#e3f2fd",
                                        color: person.sexo === "FEMENINO" ? "#c62828" : "#1565c0",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontWeight: 800, fontSize: "0.875rem", flexShrink: 0,
                                    }}>
                                        {person.apellidoPaterno[0]}{person.nombre[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                                            {person.apellidoPaterno} {person.apellidoMaterno} {person.nombre}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <span style={{
                                                background: "var(--bg-secondary)", padding: "0.125rem 0.5rem",
                                                borderRadius: "4px", fontWeight: 600,
                                            }}>
                                                {getCargoLabel(person.cargo)}
                                            </span>
                                            <span>{person.sexo === "FEMENINO" ? "Femenino" : "Masculino"}</span>
                                            {person.curp && <span>CURP: {person.curp}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: completionColor }}>
                                            {uploaded}/{total} documentos
                                        </div>
                                        <div style={{ width: "80px", height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", marginTop: "2px" }}>
                                            <div style={{ width: `${completePct}%`, height: "100%", background: completionColor, borderRadius: "2px", transition: "width 0.3s" }} />
                                        </div>
                                    </div>
                                    {/* ZIP download button — only if files exist */}
                                    {person.documentos.some(d => d.archivoDriveUrl) && (
                                        <button
                                            onClick={e => { e.stopPropagation(); handleDownloadPersonZip(person.id); }}
                                            disabled={downloadingPersonZip === person.id}
                                            style={{
                                                background: "var(--bg-secondary)",
                                                border: "1px solid var(--border)",
                                                borderRadius: "6px", cursor: "pointer",
                                                color: "var(--primary)", padding: "0.25rem 0.625rem",
                                                display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                                            }}
                                            title="Descargar expediente completo (ZIP)"
                                        >
                                            {downloadingPersonZip === person.id
                                                ? <Loader2 size={13} className="spin" />
                                                : <Download size={13} />}
                                            ZIP
                                        </button>
                                    )}
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div style={{ borderTop: "1px solid var(--border)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    {/* Person info / Edit */}
                                    {isEditing ? (
                                        <div className="card" style={{ background: "var(--bg-secondary)", border: "1px solid var(--primary)" }}>
                                            <h4 style={{ marginBottom: "0.75rem", fontSize: "0.875rem" }}>Editar Datos</h4>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                                                <input className="form-control" placeholder="Nombre(s)" value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} style={{ padding: "0.375rem 0.5rem" }} />
                                                <input className="form-control" placeholder="Apellido Paterno" value={editForm.apellidoPaterno} onChange={e => setEditForm({ ...editForm, apellidoPaterno: e.target.value })} style={{ padding: "0.375rem 0.5rem" }} />
                                                <input className="form-control" placeholder="Apellido Materno" value={editForm.apellidoMaterno} onChange={e => setEditForm({ ...editForm, apellidoMaterno: e.target.value })} style={{ padding: "0.375rem 0.5rem" }} />
                                                <select className="form-control" value={editForm.sexo} onChange={e => setEditForm({ ...editForm, sexo: e.target.value })} style={{ padding: "0.375rem 0.5rem" }}>
                                                    {SEXOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                </select>
                                                <select className="form-control" value={editForm.cargo} onChange={e => setEditForm({ ...editForm, cargo: e.target.value })} style={{ padding: "0.375rem 0.5rem" }}>
                                                    {CARGOS_PERSONAL.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                </select>
                                                <select className="form-control" value={editForm.gradoAcademico} onChange={e => setEditForm({ ...editForm, gradoAcademico: e.target.value })} style={{ padding: "0.375rem 0.5rem" }}>
                                                    <option value="">Grado Académico...</option>
                                                    {GRADOS_ACADEMICOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                                </select>
                                                <input className="form-control" placeholder="CURP" value={editForm.curp} onChange={e => setEditForm({ ...editForm, curp: e.target.value.toUpperCase() })} maxLength={18} style={{ padding: "0.375rem 0.5rem" }} />
                                                <input className="form-control" placeholder="RFC" value={editForm.rfc} onChange={e => setEditForm({ ...editForm, rfc: e.target.value.toUpperCase() })} maxLength={13} style={{ padding: "0.375rem 0.5rem" }} />
                                                <input className="form-control" placeholder="Teléfono" value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} style={{ padding: "0.375rem 0.5rem" }} />
                                                <input className="form-control" placeholder="Correo Electrónico" value={editForm.correoElectronico} onChange={e => setEditForm({ ...editForm, correoElectronico: e.target.value })} style={{ padding: "0.375rem 0.5rem" }} />
                                                <input className="form-control" type="date" value={editForm.fechaIngreso} onChange={e => setEditForm({ ...editForm, fechaIngreso: e.target.value })} style={{ padding: "0.375rem 0.5rem" }} />
                                            </div>
                                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", justifyContent: "flex-end" }}>
                                                <button className="btn btn-outline" onClick={() => setEditingPerson(null)} style={{ minHeight: "auto", padding: "0.375rem 0.75rem" }}>
                                                    <X size={14} /> Cancelar
                                                </button>
                                                <button className="btn btn-primary" onClick={() => handleUpdate(person.id)} disabled={saving} style={{ minHeight: "auto", padding: "0.375rem 0.75rem" }}>
                                                    {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Guardar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                                            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                                {person.rfc && <span><strong>RFC:</strong> {person.rfc}</span>}
                                                {person.telefono && <span><strong>Tel:</strong> {person.telefono}</span>}
                                                {person.correoElectronico && <span><strong>Email:</strong> {person.correoElectronico}</span>}
                                                {person.gradoAcademico && <span><strong>Grado:</strong> {getGradoLabel(person.gradoAcademico)}</span>}
                                                {person.fechaIngreso && <span><strong>Ingreso:</strong> {new Date(person.fechaIngreso).toLocaleDateString("es-MX")}</span>}
                                            </div>
                                            <div style={{ display: "flex", gap: "0.25rem" }}>
                                                <button
                                                    onClick={() => {
                                                        setEditingPerson(person.id);
                                                        setEditForm({
                                                            nombre: person.nombre,
                                                            apellidoPaterno: person.apellidoPaterno,
                                                            apellidoMaterno: person.apellidoMaterno,
                                                            sexo: person.sexo,
                                                            cargo: person.cargo,
                                                            curp: person.curp || "",
                                                            rfc: person.rfc || "",
                                                            telefono: person.telefono || "",
                                                            correoElectronico: person.correoElectronico || "",
                                                            gradoAcademico: person.gradoAcademico || "",
                                                            fechaIngreso: person.fechaIngreso ? person.fechaIngreso.split("T")[0] : "",
                                                        });
                                                    }}
                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem" }}
                                                    title="Editar datos"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(person.id)}
                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", padding: "0.25rem" }}
                                                    title="Eliminar personal"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Completeness indicator */}
                                    <div style={{
                                        display: "flex", alignItems: "center", gap: "0.5rem",
                                        padding: "0.5rem 0.75rem", borderRadius: "6px",
                                        background: uploaded === total ? "#e6f4ea" : "#fef7e0",
                                        color: uploaded === total ? "#1e8e3e" : "#b06000",
                                        fontSize: "0.875rem", fontWeight: 600,
                                        border: `1px solid ${uploaded === total ? "#ceead6" : "#fde293"}`,
                                    }}>
                                        {uploaded === total ? (
                                            <><CheckCircle2 size={16} /> Expediente completo — todos los documentos requeridos han sido subidos.</>
                                        ) : (
                                            <><AlertCircle size={16} /> Faltan {total - uploaded} de {total} documentos requeridos por subir.</>
                                        )}
                                    </div>

                                    {/* ─── Document rows ─── */}
                                    <div style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden" }}>
                                        {DOCUMENTOS_PREDETERMINADOS.map((docType, idx) => {
                                            const docs = getDocsForType(person.documentos, docType.tipo);
                                            const hasFile = docs.some(d => d.archivoDriveUrl);

                                            return (
                                                <div key={docType.tipo}>
                                                    {/* Main row */}
                                                    <div style={{
                                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                                        padding: "0.625rem 0.75rem", gap: "0.5rem",
                                                        background: idx % 2 === 0 ? "white" : "var(--bg-secondary)",
                                                        borderBottom: idx < DOCUMENTOS_PREDETERMINADOS.length - 1 ? "1px solid var(--border)" : "none",
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                                                            <span style={{ fontSize: "1rem" }}>{hasFile ? "✅" : "❌"}</span>
                                                            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                                                                {idx + 1}. {docType.label}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
                                                            {/* Show uploaded files */}
                                                            {docs.filter(d => d.archivoDriveUrl).map(d => (
                                                                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                                    <a
                                                                        href={getExpedienteDownloadUrl({
                                                                            url: d.archivoDriveUrl,
                                                                            publicId: d.archivoDriveId,
                                                                            cct: escuela.cct,
                                                                            apellidoPaterno: person.apellidoPaterno,
                                                                            apellidoMaterno: person.apellidoMaterno,
                                                                            nombre: person.nombre,
                                                                            tipoDocumento: docType.tipo,
                                                                            etiqueta: null,
                                                                            nombreOriginal: d.archivoNombre || "archivo",
                                                                        }) || "#"}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{ display: "inline-flex", alignItems: "center", gap: "0.125rem", color: "var(--primary)", textDecoration: "none", fontSize: "0.75rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                                                        title={`${docType.label} · ${person.apellidoPaterno} ${person.apellidoMaterno}`}
                                                                    >
                                                                        <Download size={12} /> {docType.label}
                                                                    </a>
                                                                    {!d.bloqueado && (
                                                                        <button
                                                                            onClick={() => handleDeleteDoc(d.id)}
                                                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", padding: "0" }}
                                                                            title="Eliminar"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    )}
                                                                    {d.bloqueado && <Lock size={12} style={{ color: "var(--error)" }} />}
                                                                </div>
                                                            ))}

                                                            {/* Upload button */}
                                                            {(!hasFile || docType.multiple) && (
                                                                <label className="btn btn-primary" style={{
                                                                    cursor: uploadingDoc ? "not-allowed" : "pointer",
                                                                    opacity: uploadingDoc ? 0.6 : 1,
                                                                    minHeight: "auto", padding: "0.25rem 0.5rem", fontSize: "0.75rem",
                                                                }}>
                                                                    {uploadingDoc ? <Loader2 size={12} className="spin" /> : <Upload size={12} />}
                                                                    {" "}{docs.length > 0 && docType.multiple ? "+" : "Subir"}
                                                                    <input
                                                                        type="file"
                                                                        style={{ display: "none" }}
                                                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                                                        disabled={!!uploadingDoc}
                                                                        onChange={e => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleUploadDoc(person.id, docType.tipo, file);
                                                                            e.target.value = "";
                                                                        }}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Custom documents */}
                                    {getCustomDocs(person.documentos).length > 0 && (
                                        <div style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden" }}>
                                            <div style={{ background: "var(--bg-secondary)", padding: "0.5rem 0.75rem", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                                                Documentos Adicionales
                                            </div>
                                            {getCustomDocs(person.documentos).map((d, idx) => (
                                                <div key={d.id} style={{
                                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                                    padding: "0.625rem 0.75rem",
                                                    borderBottom: idx < getCustomDocs(person.documentos).length - 1 ? "1px solid var(--border)" : "none",
                                                }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        <FileText size={14} style={{ color: "var(--primary)" }} />
                                                        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{d.etiqueta || d.tipoDocumento}</span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                        {d.archivoDriveUrl ? (
                                                            <a
                                                                href={getExpedienteDownloadUrl({
                                                                    url: d.archivoDriveUrl,
                                                                    publicId: d.archivoDriveId,
                                                                    cct: escuela.cct,
                                                                    apellidoPaterno: person.apellidoPaterno,
                                                                    apellidoMaterno: person.apellidoMaterno,
                                                                    nombre: person.nombre,
                                                                    tipoDocumento: "CUSTOM",
                                                                    etiqueta: d.etiqueta,
                                                                    nombreOriginal: d.archivoNombre || "archivo",
                                                                }) || "#"}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", textDecoration: "none", fontSize: "0.8125rem" }}
                                                            >
                                                                <Download size={14} /> {d.etiqueta || d.archivoNombre || "Descargar"}
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>Sin archivo</span>
                                                        )}
                                                        {!d.bloqueado && (
                                                            <button onClick={() => handleDeleteDoc(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", padding: "2px" }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                        {d.bloqueado && <Lock size={12} style={{ color: "var(--error)" }} />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add custom document */}
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                        <input
                                            className="form-control"
                                            placeholder="Nombre del documento adicional..."
                                            value={customDocName[person.id] || ""}
                                            onChange={e => setCustomDocName(prev => ({ ...prev, [person.id]: e.target.value }))}
                                            style={{ flex: 1, padding: "0.375rem 0.5rem", fontSize: "0.8125rem" }}
                                        />
                                        <label className="btn btn-outline" style={{
                                            cursor: !customDocName[person.id]?.trim() || !!uploadingDoc ? "not-allowed" : "pointer",
                                            opacity: !customDocName[person.id]?.trim() || !!uploadingDoc ? 0.5 : 1,
                                            minHeight: "auto", padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                                        }}>
                                            <Plus size={14} /> Agregar documento
                                            <input
                                                type="file"
                                                style={{ display: "none" }}
                                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                                disabled={!customDocName[person.id]?.trim() || !!uploadingDoc}
                                                onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    const name = customDocName[person.id]?.trim();
                                                    if (file && name) {
                                                        handleUploadDoc(person.id, "CUSTOM", file, name);
                                                        setCustomDocName(prev => ({ ...prev, [person.id]: "" }));
                                                    }
                                                    e.target.value = "";
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
