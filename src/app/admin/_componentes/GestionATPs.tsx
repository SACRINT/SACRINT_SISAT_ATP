"use strict";
"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Save, Trash2, X, UserCog, User, ShieldAlert, Key } from "lucide-react";
import { SECCIONES_PERMISOS, DEFAULT_PERMISOS } from "@/lib/constants";

interface AdminUser {
    id: string;
    nombre: string;
    email: string;
    role: string;
    permisos?: any;
}


export default function GestionATPs() {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [formData, setFormData] = useState<{
        nombre: string;
        email: string;
        password?: string;
        role: string;
        permisos: Record<string, string>;
    }>({
        nombre: "",
        email: "",
        password: "",
        role: "ATP_LECTOR",
        permisos: { ...DEFAULT_PERMISOS },
    });

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        try {
            const res = await fetch("/api/atps");
            if (res.ok) {
                const data = await res.json();
                setAdmins(data);
            }
        } catch (error) {
            console.error("Error fetching admins:", error);
        } finally {
            setIsFetching(false);
        }
    };

    const handleOpenModal = (admin?: AdminUser) => {
        setMessage(null);
        if (admin) {
            setEditingId(admin.id);
            setFormData({
                nombre: admin.nombre,
                email: admin.email,
                password: "", // Contraseña vacía al editar, solo se actualiza si escriben
                role: admin.role,
                permisos: { ...DEFAULT_PERMISOS, ...(admin.permisos || {}) },
            });
        } else {
            setEditingId(null);
            setFormData({
                nombre: "",
                email: "",
                password: "",
                role: "ATP_LECTOR",
                permisos: { ...DEFAULT_PERMISOS },
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsLoading(true);

        try {
            const url = editingId ? `/api/atps/${editingId}` : `/api/atps`;
            const method = editingId ? "PUT" : "POST";

            if (!editingId && !formData.password) {
                throw new Error("La contraseña es obligatoria para nuevos usuarios");
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al guardar el administrador");
            }

            const savedAdmin = await res.json();

            if (editingId) {
                setAdmins(prev => prev.map(a => a.id === editingId ? { ...a, ...savedAdmin } : a));
                setMessage({ type: "success", text: "Usuario actualizado exitosamente." });
            } else {
                setAdmins(prev => [...prev, savedAdmin]);
                setMessage({ type: "success", text: "Usuario creado exitosamente." });
            }

            setTimeout(() => {
                handleCloseModal();
                setMessage(null);
            }, 1500);

        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar el usuario ATP "${nombre}" de manera definitiva?`)) return;
        setIsLoading(true);

        try {
            const res = await fetch(`/api/atps/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al eliminar el usuario");
            }

            setAdmins(prev => prev.filter(a => a.id !== id));
            setMessage({ type: "success", text: "Usuario eliminado." });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const getRoleLabel = (role: string) => {
        if (role === "SUPER_ADMIN") return "Super Administrador";
        if (role === "ATP_EDITOR") return "ATP Editor";
        return "ATP Lector";
    };

    const getRoleColor = (role: string) => {
        if (role === "SUPER_ADMIN") return "var(--primary)";
        if (role === "ATP_EDITOR") return "var(--success)";
        return "var(--text-muted)";
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1>Gestión de ATPs (Accesos y Seguridad)</h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Crea cuentas para tu equipo de la zona escolar y asigna permisos específicos.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Plus size={18} /> Nuevo Usuario ATP
                </button>
            </div>

            {message && !isModalOpen && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            {isFetching ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Cargando usuarios...</div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                    {admins.map(admin => (
                        <div key={admin.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                                    <h3 style={{ margin: 0, fontSize: "1.125rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <User size={18} color="var(--primary)" />
                                        {admin.nombre}
                                    </h3>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <button
                                            className="btn-icon"
                                            onClick={() => handleOpenModal(admin)}
                                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem" }}
                                            title="Editar Usuario"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        {admin.role !== "SUPER_ADMIN" && (
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleDelete(admin.id, admin.nombre)}
                                                style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.25rem" }}
                                                title="Eliminar Usuario"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", minHeight: "1.5rem" }}>
                                    {admin.email}
                                </p>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                <span style={{ fontSize: "0.75rem", background: "var(--bg)", padding: "0.25rem 0.5rem", borderRadius: "4px", border: `1px solid ${getRoleColor(admin.role)}`, color: getRoleColor(admin.role), display: "inline-flex", alignItems: "center", gap: "0.25rem", fontWeight: 600 }}>
                                    <ShieldAlert size={12} /> {getRoleLabel(admin.role)}
                                </span>
                            </div>
                        </div>
                    ))}
                    {admins.length === 0 && (
                        <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                            No hay cuentas ATP creadas.
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Crear / Editar */}
            {isModalOpen && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem", zIndex: 1000
                }}>
                    <div className="card fade-in" style={{ width: "100%", maxWidth: "550px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>
                                {editingId ? "Editar Usuario ATP" : "Nuevo Usuario ATP"}
                            </h2>
                            <button onClick={handleCloseModal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>

                        {message && (
                            <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        className="form-control"
                                        value={formData.nombre}
                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        placeholder="Ej. Juan Pérez"
                                        disabled={isLoading}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Correo Electrónico</label>
                                    <input
                                        type="email"
                                        required
                                        className="form-control"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="correo@seppue.gob.mx"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Nivel de Permisos</label>
                                    <select
                                        className="form-control"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        disabled={isLoading || (editingId !== null && formData.role === "SUPER_ADMIN")}
                                    >
                                        <option value="ATP_LECTOR">Lector (Solo ver y descargar)</option>
                                        <option value="ATP_EDITOR">Editor (Modificar estatus y entregas)</option>
                                        <option value="SUPER_ADMIN">Super Admn (Gestionar otros usuarios)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
                                        Contraseña {editingId && <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opcional)</small>}
                                    </label>
                                    <div style={{ position: "relative" }}>
                                        <Key size={16} style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            placeholder={editingId ? "Dejar vacío para no cambiar" : "Contraseña de acceso"}
                                            required={!editingId}
                                            disabled={isLoading}
                                            style={{ paddingLeft: "1.75rem" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {formData.role !== "SUPER_ADMIN" && (
                                <div style={{ marginTop: "0.5rem" }}>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
                                        Configuración de Permisos por Sección
                                    </label>
                                    <div style={{ 
                                        maxHeight: "220px", 
                                        overflowY: "auto", 
                                        border: "1px solid var(--border)", 
                                        borderRadius: "6px",
                                        background: "var(--bg)",
                                        fontSize: "0.8125rem"
                                    }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 1 }}>
                                                    <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600 }}>Sección</th>
                                                    <th style={{ textAlign: "center", padding: "0.5rem 0.25rem", fontWeight: 600, width: "80px" }}>Ninguno</th>
                                                    <th style={{ textAlign: "center", padding: "0.5rem 0.25rem", fontWeight: 600, width: "80px" }}>Lectura</th>
                                                    <th style={{ textAlign: "center", padding: "0.5rem 0.25rem", fontWeight: 600, width: "80px" }}>Escritura</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {SECCIONES_PERMISOS.map((sec) => {
                                                    const currentVal = formData.permisos[sec.key] || "NINGUNO";
                                                    
                                                    const handleParentChange = (newVal: string) => {
                                                        const newPermisos = { ...formData.permisos, [sec.key]: newVal };
                                                        // Update children shortcuts
                                                        if (sec.sub) {
                                                            sec.sub.forEach(subItem => {
                                                                newPermisos[subItem.key] = newVal;
                                                            });
                                                        }
                                                        setFormData(prev => ({ ...prev, permisos: newPermisos }));
                                                    };

                                                    return (
                                                        <React.Fragment key={sec.key}>
                                                            <tr style={{ borderBottom: "1px solid var(--border)", background: sec.sub ? "var(--bg-secondary)" : "transparent" }}>
                                                                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{sec.label}</td>
                                                                <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`permiso-${sec.key}`}
                                                                        checked={currentVal === "NINGUNO"}
                                                                        onChange={() => handleParentChange("NINGUNO")}
                                                                        style={{ cursor: "pointer" }}
                                                                    />
                                                                </td>
                                                                <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`permiso-${sec.key}`}
                                                                        checked={currentVal === "LECTURA"}
                                                                        onChange={() => handleParentChange("LECTURA")}
                                                                        style={{ cursor: "pointer" }}
                                                                    />
                                                                </td>
                                                                <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`permiso-${sec.key}`}
                                                                        checked={currentVal === "ESCRITURA"}
                                                                        onChange={() => handleParentChange("ESCRITURA")}
                                                                        style={{ cursor: "pointer" }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                            {sec.sub && sec.sub.map((subItem) => {
                                                                const subVal = formData.permisos[subItem.key] || "NINGUNO";
                                                                return (
                                                                    <tr key={subItem.key} style={{ borderBottom: "1px solid var(--border)" }}>
                                                                        <td style={{ padding: "0.5rem 0.75rem 0.5rem 2rem", fontSize: "0.75rem" }}>└ {subItem.label}</td>
                                                                        <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                            <input
                                                                                type="radio"
                                                                                name={`permiso-${subItem.key}`}
                                                                                checked={subVal === "NINGUNO"}
                                                                                onChange={() => {
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        permisos: { ...prev.permisos, [subItem.key]: "NINGUNO" }
                                                                                    }));
                                                                                }}
                                                                                style={{ cursor: "pointer" }}
                                                                            />
                                                                        </td>
                                                                        <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                            <input
                                                                                type="radio"
                                                                                name={`permiso-${subItem.key}`}
                                                                                checked={subVal === "LECTURA"}
                                                                                onChange={() => {
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        permisos: { ...prev.permisos, [subItem.key]: "LECTURA" }
                                                                                    }));
                                                                                }}
                                                                                style={{ cursor: "pointer" }}
                                                                            />
                                                                        </td>
                                                                        <td style={{ textAlign: "center", padding: "0.25rem" }}>
                                                                            <input
                                                                                type="radio"
                                                                                name={`permiso-${subItem.key}`}
                                                                                checked={subVal === "ESCRITURA"}
                                                                                onChange={() => {
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        permisos: { ...prev.permisos, [subItem.key]: "ESCRITURA" }
                                                                                    }));
                                                                                }}
                                                                                style={{ cursor: "pointer" }}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                                <button type="button" className="btn btn-outline" onClick={handleCloseModal} disabled={isLoading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Save size={16} /> {isLoading ? "Guardando..." : (editingId ? "Actualizar Usuario" : "Crear Usuario")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
