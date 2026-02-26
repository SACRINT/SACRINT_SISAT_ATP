"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Save, X, Building2, User, Mail, School, Lock, Clock, Plus, Trash2, MapPin, FileDigit } from "lucide-react";
import { ProgramaAdmin } from "@/types";

type Escuela = {
    id: string;
    cct: string;
    nombre: string;
    localidad?: string | null;
    director: string | null;
    email: string | null;
    ultimoIngreso?: Date | string | null;
};

export default function GestionEscuelas({ inicialEscuelas, programas }: { inicialEscuelas: Escuela[], programas: ProgramaAdmin[] }) {
    const [escuelas, setEscuelas] = useState<Escuela[]>(inicialEscuelas);
    const [selectedId, setSelectedId] = useState<string>("");
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const router = useRouter();

    // Form state
    const [formData, setFormData] = useState<{ cct: string; nombre: string; localidad: string; director: string; email: string; password?: string }>({
        cct: "",
        nombre: "",
        localidad: "",
        director: "",
        email: "",
        password: "",
    });

    const selectedEscuela = escuelas.find((e) => e.id === selectedId);

    // Custom configuration state
    const [configuraciones, setConfiguraciones] = useState<Record<string, number>>({});
    const [loadingConfig, setLoadingConfig] = useState(false);

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedId(id);
        setIsEditing(false);
        setIsCreating(false);
        setMessage(null);

        if (id) {
            const esc = escuelas.find(sc => sc.id === id);
            if (esc) {
                setFormData({
                    cct: esc.cct,
                    nombre: esc.nombre,
                    localidad: esc.localidad || "",
                    director: esc.director || "",
                    email: esc.email || "",
                    password: "",
                });

                // Fetch configuraciones
                setLoadingConfig(true);
                fetch(`/api/escuelas/${id}/configuracion`)
                    .then(res => res.json())
                    .then(data => {
                        const map: Record<string, number> = {};
                        if (Array.isArray(data)) {
                            data.forEach((c: any) => map[c.programaId] = c.numArchivos);
                        }
                        setConfiguraciones(map);
                    })
                    .catch(e => console.error("Error al obtener configuracion:", e))
                    .finally(() => setLoadingConfig(false));
            }
        } else {
            setConfiguraciones({});
        }
    };

    const startCreating = () => {
        setSelectedId("");
        setIsCreating(true);
        setIsEditing(false);
        setMessage(null);
        setFormData({ cct: "", nombre: "", localidad: "", director: "", email: "", password: "" });
        setConfiguraciones({});
    };

    const handleSave = async () => {
        if (!isCreating && !selectedId) return;
        setSaving(true);
        setMessage(null);

        try {
            const url = isCreating ? `/api/escuelas` : `/api/escuelas/${selectedId}`;
            const method = isCreating ? "POST" : "PUT";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "No se pudo guardar la escuela");
            }

            const savedEscuela = await res.json();

            if (isCreating) {
                setEscuelas([...escuelas, savedEscuela]);
                setSelectedId(savedEscuela.id);
                setIsCreating(false);
            } else {
                setEscuelas(prev => prev.map(e => e.id === selectedId ? { ...e, ...savedEscuela } : e));
                setIsEditing(false);
            }

            // Save configuraciones
            const schoolId = isCreating ? savedEscuela.id : selectedId;
            const configData = Object.keys(configuraciones).map(progId => ({ programaId: progId, numArchivos: configuraciones[progId] }));

            await fetch(`/api/escuelas/${schoolId}/configuracion`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ configuraciones: configData })
            });

            setMessage({ type: "success", text: isCreating ? "Nueva escuela agregada correctamente." : "Datos actualizados correctamente." });


            router.refresh();
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedId || !selectedEscuela) return;
        if (!confirm(`¿Estás SEGURO de eliminar la escuela ${selectedEscuela.nombre} (${selectedEscuela.cct})? Esta acción eliminará TAMBIÉN todas sus entregas, archivos y correcciones, y NO se puede deshacer.`)) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/escuelas/${selectedId}`, { method: "DELETE" });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "No se pudo eliminar");
            }

            setEscuelas(prev => prev.filter(e => e.id !== selectedId));
            setSelectedId("");
            setMessage({ type: "success", text: "Escuela eliminada correctamente." });
            router.refresh();
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const showForm = isCreating || selectedEscuela;
    const isEditingMode = isCreating || isEditing;

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Gestión de Centros de Trabajo</h1>
                    <p style={{ color: "var(--text-secondary)", margin: 0, marginTop: "0.25rem" }}>
                        Agrega nuevas escuelas, dale de baja o edita sus datos.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={startCreating}>
                    <Plus size={18} /> Agregar Escuela
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            {!isCreating && (
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
            )}

            {showForm && (
                <div className="card fade-in">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: "1rem" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>{isCreating ? "Nueva Escuela" : "Datos Generales"}</h3>
                        {!isEditingMode && selectedEscuela ? (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button className="btn btn-outline" onClick={() => setIsEditing(true)}>
                                    <Edit2 size={16} /> Modificar Datos
                                </button>
                                <button className="btn btn-outline" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={handleDelete} disabled={saving}>
                                    <Trash2 size={16} /> Eliminar Escuela
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button className="btn btn-outline" onClick={() => {
                                    if (isCreating) {
                                        setIsCreating(false);
                                    } else {
                                        setIsEditing(false);
                                        if (selectedEscuela) {
                                            setFormData({ cct: selectedEscuela.cct, nombre: selectedEscuela.nombre, localidad: selectedEscuela.localidad || "", director: selectedEscuela.director || "", email: selectedEscuela.email || "", password: "" });
                                        }
                                    }
                                }} disabled={saving}>
                                    <X size={16} /> Cancelar
                                </button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    <Save size={16} /> {saving ? "Guardando..." : "Guardar"}
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
                                value={isEditingMode ? formData.cct : selectedEscuela?.cct}
                                onChange={(e) => setFormData({ ...formData, cct: e.target.value })}
                                disabled={!isCreating}
                                placeholder="Ej: 21EBH0000Z"
                                style={{
                                    ...(!isCreating && !isEditingMode ? { background: "var(--bg)", color: "var(--text-muted)", cursor: "not-allowed" } : {}),
                                    ...(!isCreating && isEditingMode ? { background: "var(--bg)", color: "var(--text-muted)", cursor: "not-allowed" } : {}),
                                    ...(isCreating ? { border: "1px dashed var(--border)" } : {})
                                }}
                                title={!isCreating ? "La CCT no se puede modificar una vez creada." : ""}
                            />
                        </div>

                        {!isCreating && selectedEscuela && (
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                    <BadgeIcon icon={<Clock size={14} />} /> Último Acceso
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={selectedEscuela.ultimoIngreso ? new Date(selectedEscuela.ultimoIngreso).toLocaleString("es-MX") : "Nunca"}
                                    disabled
                                    style={{ background: "var(--bg)", color: "var(--text-muted)", cursor: "not-allowed" }}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<School size={14} />} /> Nombre de la Escuela
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditingMode ? formData.nombre : selectedEscuela?.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                disabled={!isEditingMode}
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<MapPin size={14} />} /> Localidad
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={isEditingMode ? formData.localidad : (selectedEscuela?.localidad || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: Puebla, Pue."
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela?.localidad ? "italic" : "normal", color: !selectedEscuela?.localidad ? "var(--text-muted)" : "inherit" } : {}),
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
                                value={isEditingMode ? formData.director : (selectedEscuela?.director || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="Ej: Mtro. Juan Pérez"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela?.director ? "italic" : "normal", color: !selectedEscuela?.director ? "var(--text-muted)" : "inherit" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<Mail size={14} />} /> Correo Electrónico (Notificaciones y Acceso)
                            </label>
                            <textarea
                                className="form-control"
                                rows={2}
                                value={isEditingMode ? formData.email : (selectedEscuela?.email || "No especificado")}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder="ejemplo@escuela.edu.mx"
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", fontStyle: !selectedEscuela?.email ? "italic" : "normal", color: !selectedEscuela?.email ? "var(--text-muted)" : "inherit" } : {}),
                                    resize: "vertical", fontFamily: "inherit"
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <BadgeIcon icon={<Lock size={14} />} /> {isCreating ? "Contraseña de Acceso Inicial" : "Cambiar Contraseña de Acceso"}
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.password || ""}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                disabled={!isEditingMode}
                                placeholder={isCreating ? "Contraseña obligatoria" : isEditingMode ? "Escribe la nueva contraseña aquí..." : "********"}
                                style={{
                                    ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-muted)", fontStyle: "italic" } : {}),
                                }}
                            />
                            {isEditing && !isCreating && (
                                <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    Deja este campo en blanco si no deseas cambiar la contraseña actual del director.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="card fade-in" style={{ marginTop: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                        <h3 style={{ margin: 0, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FileDigit size={20} color="var(--primary)" /> Configuración de Entregas (Archivos)
                        </h3>
                    </div>
                    {loadingConfig ? (
                        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Cargando configuración...</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: "0 0 0.5rem 0" }}>
                                Ajusta cuántos archivos debe subir esta escuela para cada programa específico.
                                Si lo dejas vacío, se usará el valor por defecto del programa.
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                                {programas.map(prog => {
                                    const value = configuraciones[prog.id];
                                    return (
                                        <div key={prog.id} style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                            <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem", color: "var(--text)" }}>
                                                {prog.nombre}
                                            </div>
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                                                Por defecto: {prog.numArchivos} archivo(s)
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    className="form-control"
                                                    disabled={!isEditingMode}
                                                    value={value !== undefined ? value : ""}
                                                    onChange={(e) => {
                                                        const num = parseInt(e.target.value);
                                                        setConfiguraciones(prev => {
                                                            const next = { ...prev };
                                                            if (isNaN(num)) {
                                                                delete next[prog.id];
                                                            } else {
                                                                next[prog.id] = num;
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    placeholder={`Usar defecto (${prog.numArchivos})`}
                                                    style={{
                                                        padding: "0.375rem 0.5rem", width: "100%",
                                                        ...(!isEditingMode ? { background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-muted)" } : {})
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
