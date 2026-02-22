"use client";

import { useState } from "react";
import { Upload, X, Trash2, FileText, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export default function GestionRecursos({
    recursos,
    programas,
}: {
    recursos: any[];
    programas: any[];
}) {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [titulo, setTitulo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [programaId, setProgramaId] = useState("");
    const [file, setFile] = useState<File | null>(null);

    // Status
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const openCreateModal = () => {
        setEditingId(null);
        setTitulo("");
        setDescripcion("");
        setProgramaId("");
        setFile(null);
        setIsModalOpen(true);
        setMessage(null);
    };

    const openEditModal = (recurso: any) => {
        setEditingId(recurso.id);
        setTitulo(recurso.titulo);
        setDescripcion(recurso.descripcion || "");
        setProgramaId(recurso.programaId || "");
        setFile(null); // Optional file replace
        setIsModalOpen(true);
        setMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!titulo.trim()) {
            setMessage({ type: "error", text: "El título es obligatorio." });
            return;
        }

        if (!editingId && !file) {
            setMessage({ type: "error", text: "El archivo es obligatorio para crear." });
            return;
        }

        setIsUploading(true);
        setMessage(null);

        try {
            const formData = new FormData();
            if (file) formData.append("file", file);
            formData.append("titulo", titulo);
            formData.append("descripcion", descripcion);
            if (programaId) {
                formData.append("programaId", programaId);
            }

            const url = editingId ? `/api/recursos/${editingId}` : "/api/recursos";
            const method = editingId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Ocurrió un error al procesar el recurso");
            }

            setMessage({ type: "success", text: editingId ? "El recurso se actualizó correctamente." : "El recurso se ha subido correctamente." });
            setIsModalOpen(false);

            // Reset form
            setTitulo("");
            setDescripcion("");
            setProgramaId("");
            setFile(null);
            setEditingId(null);

            // Refresh
            router.refresh();

        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar el recurso "${nombre}" permanentemente?`)) return;

        setDeletingId(id);
        setMessage(null);

        try {
            const res = await fetch(`/api/recursos/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("No se pudo eliminar el recurso");

            setMessage({ type: "success", text: "Recurso eliminado" });
            router.refresh();
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1>Formatos y Plantillas</h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Sube machotes, manuales y plantillas institucionales para que los directores los descarguen.
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={openCreateModal}
                    style={{ whiteSpace: "nowrap" }}
                >
                    <Upload size={18} /> Subir Nuevo Recurso
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            {recursos.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                    <FileText size={48} style={{ opacity: 0.2, marginBottom: "1rem" }} />
                    <p>Aún no has subido ningún formato o plantilla.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                                <tr>
                                    <th style={{ padding: "1rem", fontWeight: 600 }}>Título / Archivo</th>
                                    <th style={{ padding: "1rem", fontWeight: 600 }}>Programa Relacionado</th>
                                    <th style={{ padding: "1rem", fontWeight: 600 }}>Fecha de Carga</th>
                                    <th style={{ padding: "1rem", fontWeight: 600, textAlign: "right" }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recursos.map((recurso) => (
                                    <tr key={recurso.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "1rem" }}>
                                            <div style={{ fontWeight: 500, color: "var(--text)" }}>{recurso.titulo}</div>
                                            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{recurso.archivoNombre}</div>
                                            {recurso.descripcion && (
                                                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem", maxWidth: "300px" }}>
                                                    {recurso.descripcion}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                            {recurso.programa ? (
                                                <span style={{ background: "var(--bg)", padding: "2px 8px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                                    {recurso.programa.nombre}
                                                </span>
                                            ) : (
                                                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Recurso General</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                            {new Date(recurso.createdAt).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: "1rem", textAlign: "right" }}>
                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                                                {recurso.archivoDriveUrl && (
                                                    <a
                                                        href={recurso.archivoDriveUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-outline"
                                                        style={{ padding: "0.3rem 0.6rem" }}
                                                        title="Ver / Descargar"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => openEditModal(recurso)}
                                                    className="btn btn-outline"
                                                    style={{ padding: "0.3rem 0.6rem", color: "var(--primary)", borderColor: "var(--primary)" }}
                                                    title="Editar formato"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(recurso.id, recurso.titulo)}
                                                    disabled={deletingId === recurso.id}
                                                    className="btn btn-outline"
                                                    style={{ padding: "0.3rem 0.6rem", color: "var(--danger)", borderColor: "var(--danger)" }}
                                                    title="Eliminar formato"
                                                >
                                                    {deletingId === recurso.id ? <span className="spin">⌛</span> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal para subir recurso */}
            {isModalOpen && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem", zIndex: 1000,
                }}>
                    <div className="card fade-in" style={{ maxWidth: "500px", width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h3 style={{ margin: 0 }}>{editingId ? "Editar Formato o Plantilla" : "Subir Formato o Plantilla"}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Título del Formato</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Ej: Ficha de Inscripción (Word)"
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    required
                                    rows={2}
                                    style={{ resize: "vertical", fontFamily: "inherit" }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Descripción breve (Opcional)</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Instrucciones sobre cómo llenar el formato..."
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.target.value)}
                                    rows={4}
                                    style={{ resize: "vertical", fontFamily: "inherit" }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Seleccionar Programa (Opcional)</label>
                                <select
                                    className="form-control"
                                    value={programaId}
                                    onChange={(e) => setProgramaId(e.target.value)}
                                >
                                    <option value="">-- Recurso General (Aplica para todo) --</option>
                                    {programas.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                                    Si eliges un programa, este archivo se sugerirá específicamente para esa entrega.
                                </span>
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Archivo (.pdf, .doc, .xls, .xlsx) {editingId && "(Opcional si solo cambias datos)"}</label>
                                <input
                                    type="file"
                                    className="form-control"
                                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                    required={!editingId}
                                    style={{ padding: "0.5rem" }}
                                />
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isUploading}
                                    style={{ flex: 1 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isUploading || !titulo || (!editingId && !file)}
                                    style={{ flex: 1 }}
                                >
                                    {isUploading ? (editingId ? "Guardando..." : "Subiendo...") : (editingId ? "Guardar Cambios" : "Subir Archivo")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
