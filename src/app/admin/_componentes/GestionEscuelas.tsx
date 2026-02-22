"use client";

import { useState } from "react";
import { Edit2, Save, X, Building2, User, Mail, School } from "lucide-react";

type Escuela = {
    id: string;
    cct: string;
    nombre: string;
    director: string | null;
    email: string | null;
};

export default function GestionEscuelas({ inicialEscuelas }: { inicialEscuelas: Escuela[] }) {
    const [escuelas, setEscuelas] = useState<Escuela[]>(inicialEscuelas);
    const [selectedId, setSelectedId] = useState<string>("");
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState<{ nombre: string; director: string; email: string }>({
        nombre: "",
        director: "",
        email: "",
    });

    const selectedEscuela = escuelas.find((e) => e.id === selectedId);

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedId(id);
        setIsEditing(false);
        setMessage(null);

        if (id) {
            const esc = escuelas.find(sc => sc.id === id);
            if (esc) {
                setFormData({
                    nombre: esc.nombre,
                    director: esc.director || "",
                    email: esc.email || "",
                });
            }
        }
    };

    const handleSave = async () => {
        if (!selectedId) return;
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/escuelas/${selectedId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                throw new Error("No se pudo actualizar la escuela");
            }

            const updatedEscuela = await res.json();
            setEscuelas(prev => prev.map(e => e.id === selectedId ? { ...e, ...updatedEscuela } : e));
            setIsEditing(false);
            setMessage({ type: "success", text: "Datos actualizados correctamente." });

            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem" }}>
                <h1>Gestión de Centros de Trabajo</h1>
                <p style={{ color: "var(--text-secondary)" }}>
                    Edita el nombre de la escuela, director o datos de contacto.
                </p>
            </div>

            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            <div className="card" style={{ marginBottom: "2rem" }}>
                <h3 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Building2 size={20} color="var(--primary)" />
                    Seleccionar Escuela (CCT)
                </h3>
                <select
                    className="form-control"
                    value={selectedId}
                    onChange={handleSelectChange}
                    style={{ padding: "0.75rem", fontSize: "1rem", cursor: "pointer" }}
                >
                    <option value="">-- Elige un Centro de Trabajo --</option>
                    {escuelas.map(escuela => (
                        <option key={escuela.id} value={escuela.id}>
                            {escuela.cct} - {escuela.nombre}
                        </option>
                    ))}
                </select>
            </div>

            {selectedEscuela && (
                <div className="card fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>Datos Generales</h3>
                        {!isEditing ? (
                            <button className="btn btn-outline" onClick={() => setIsEditing(true)}>
                                <Edit2 size={16} /> Modificar Datos
                            </button>
                        ) : (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button className="btn btn-outline" onClick={() => {
                                    setIsEditing(false);
                                    setFormData({ nombre: selectedEscuela.nombre, director: selectedEscuela.director || "", email: selectedEscuela.email || "" });
                                }} disabled={saving}>
                                    <X size={16} /> Cancelar
                                </button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    <Save size={16} /> {saving ? "Guardando..." : "Guardar Cambios"}
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<Building2 size={14} />} /> Clave de Centro de Trabajo (CCT)
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={selectedEscuela.cct}
                                disabled
                                style={{ background: "var(--bg)", color: "var(--text-muted)", cursor: "not-allowed" }}
                                title="La CCT no se puede modificar por seguridad de la base de datos."
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<School size={14} />} /> Nombre de la Escuela
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditing ? formData.nombre : selectedEscuela.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                disabled={!isEditing}
                                style={{
                                    ...(!isEditing ? { background: "var(--bg)", border: "1px dashed var(--border)" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<User size={14} />} /> Nombre del Director(a)
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditing ? formData.director : (selectedEscuela.director || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                                disabled={!isEditing}
                                placeholder="Ej: Mtro. Juan Pérez"
                                style={{
                                    ...(!isEditing ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela.director ? "italic" : "normal", color: !selectedEscuela.director ? "var(--text-muted)" : "inherit" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<Mail size={14} />} /> Correo Electrónico (Notificaciones)
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditing ? formData.email : (selectedEscuela.email || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={!isEditing}
                                placeholder="ejemplo@escuela.edu.mx"
                                style={{
                                    ...(!isEditing ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela.email ? "italic" : "normal", color: !selectedEscuela.email ? "var(--text-muted)" : "inherit" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BadgeIcon({ icon }: { icon: React.ReactNode }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", background: "var(--primary-bg)", color: "var(--primary)", borderRadius: "4px", marginRight: "0.5rem", padding: "4px" }}>
            {icon}
        </span>
    );
}
