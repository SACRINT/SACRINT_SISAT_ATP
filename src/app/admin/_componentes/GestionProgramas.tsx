"use strict";
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Save, Trash2, X, FileText, Settings, AlignLeft, Layers, Bell, ToggleLeft, ToggleRight, Send, Loader2, CheckCircle2, Clock, Eye, EyeOff } from "lucide-react";

interface PeriodoAdmin {
    id: string;
}

interface ProgramaAdmin {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: string;
    numArchivos: number;
    orden: number;
    etiquetasArchivos?: string[];
    esParaSupervision?: boolean;
    activo?: boolean;
    visibleEnDirector?: boolean;
    quienesPuedenSubir?: string[];
    recordatorioAuto?: boolean;
    periodos: PeriodoAdmin[];
}

export default function GestionProgramas({ inicialProgramas, readOnly = false, onGoToPermisosIA }: { inicialProgramas: ProgramaAdmin[]; readOnly?: boolean; onGoToPermisosIA?: () => void }) {
    const [programas, setProgramas] = useState<ProgramaAdmin[]>(inicialProgramas);

    useEffect(() => {
        setProgramas(inicialProgramas);
    }, [inicialProgramas]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const router = useRouter();

    // Modal de Recordatorios
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [sendModalProg, setSendModalProg] = useState<{ id: string, nombre: string } | null>(null);
    const [sendStatuses, setSendStatuses] = useState<string[]>(["NO_ENTREGADO", "REQUIERE_CORRECCION"]);

    const [formData, setFormData] = useState({
        nombre: "",
        descripcion: "",
        tipo: "ANUAL",
        numArchivos: 1,
        orden: 0,
        etiquetasArchivos: [] as string[],
        esParaSupervision: false,
        activo: true,
        visibleEnDirector: true,
        quienesPuedenSubir: ["director"] as string[],
    });

    const handleOpenModal = (prog?: ProgramaAdmin) => {
        setMessage(null);
        if (prog) {
            setEditingId(prog.id);
            setFormData({
                nombre: prog.nombre,
                descripcion: prog.descripcion || "",
                tipo: prog.tipo,
                numArchivos: prog.numArchivos,
                orden: prog.orden,
                etiquetasArchivos: prog.etiquetasArchivos || [],
                esParaSupervision: prog.esParaSupervision || false,
                activo: prog.activo ?? true,
                visibleEnDirector: prog.visibleEnDirector ?? true,
                quienesPuedenSubir: prog.quienesPuedenSubir || ["director"],
            });
        } else {
            setEditingId(null);
            setFormData({
                nombre: "",
                descripcion: "",
                tipo: "ANUAL",
                numArchivos: 1,
                orden: 0,
                etiquetasArchivos: [],
                esParaSupervision: false,
                activo: true,
                visibleEnDirector: true,
                quienesPuedenSubir: ["director"],
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
            const url = editingId ? `/api/programas/${editingId}` : `/api/programas`;
            const method = editingId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al guardar el programa");
            }

            const savedPrograma = await res.json();

            if (editingId) {
                // Check if tipo changed - this means periods were recreated
                const originalProg = programas.find(p => p.id === editingId);
                const tipoChanged = originalProg && originalProg.tipo !== formData.tipo;

                setProgramas(prev => prev.map(p => p.id === editingId ? savedPrograma : p));
                setMessage({ type: "success", text: "Programa actualizado exitosamente." });
                handleCloseModal();

                if (tipoChanged) {
                    // Force hard reload when tipo changes to ensure ALL sections get fresh data
                    setTimeout(() => window.location.reload(), 500);
                } else {
                    router.refresh();
                    setTimeout(() => setMessage(null), 3000);
                }
            } else {
                setProgramas(prev => [...prev, savedPrograma]);
                setMessage({ type: "success", text: "Programa creado exitosamente." });
                handleCloseModal();
                router.refresh();
                setTimeout(() => setMessage(null), 3000);
            }

        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, periodosCount: number) => {
        const msg = periodosCount > 0
            ? `Este programa tiene ${periodosCount} periodo(s) asignado(s) con entregas asociadas. Al eliminarlo se borrarán también todos los periodos y entregas.\n\n¿Estás seguro de eliminar este programa de manera DEFINITIVA?`
            : "¿Estás seguro de eliminar este programa de manera definitiva?";

        if (!confirm(msg)) return;
        setIsLoading(true);

        try {
            const res = await fetch(`/api/programas/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al eliminar el programa");
            }

            setProgramas(prev => prev.filter(p => p.id !== id));
            setMessage({ type: "success", text: "Programa eliminado." });
            setTimeout(() => {
                setMessage(null);
                router.refresh(); // Sync state with parent components
            }, 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleAuto = async (id: string, currentVal: boolean) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/programas/${id}/toggle-recordatorio`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recordatorioAuto: !currentVal })
            });
            if (!res.ok) throw new Error("Error al cambiar estado de recordatorio automático");
            const updated = await res.json();
            setProgramas(prev => prev.map(p => p.id === id ? { ...p, recordatorioAuto: updated.recordatorioAuto } : p));
            setMessage({ type: "success", text: "Configuración de recordatorios actualizada." });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleActivo = async (id: string, currentVal: boolean) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/programas/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !currentVal })
            });
            if (!res.ok) throw new Error("Error al cambiar estado del programa");
            const updated = await res.json();
            setProgramas(prev => prev.map(p => p.id === id ? { ...p, activo: updated.activo } : p));
            setMessage({ type: "success", text: `Programa ${updated.activo ? "activado" : "desactivado"}.` });
            setTimeout(() => setMessage(null), 3000);
            router.refresh();
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenSendModal = (progId: string, progNombre: string) => {
        setSendModalProg({ id: progId, nombre: progNombre });
        setSendStatuses(["NO_ENTREGADO", "REQUIERE_CORRECCION"]);
        setIsSendModalOpen(true);
    };

    const handleCloseSendModal = () => {
        setIsSendModalOpen(false);
        setSendModalProg(null);
    };

    const toggleSendStatus = (status: string) => {
        setSendStatuses(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const handleSendManual = async () => {
        if (!sendModalProg) return;
        if (sendStatuses.length === 0) {
            setMessage({ type: "error", text: "Debes seleccionar al menos un estado para enviar notificaciones." });
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`/api/recordatorios`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    programaId: sendModalProg.id,
                    estados: sendStatuses
                })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al enviar recordatorios");
            }
            const data = await res.json();
            setMessage({ type: "success", text: `¡Notificaciones enviadas! Se mandaron ${data.enviados || 0} correos a los directores.` });
            handleCloseSendModal();
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1>Gestión de Programas</h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Crea o edita los programas operativos, la periodicidad de entregas y el total de formatos o evidencias que la escuela te debe enviar en cada entrega.
                    </p>
                </div>
                {!readOnly && (
                    <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Plus size={18} /> Nuevo Programa
                    </button>
                )}
            </div>

            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "0.85rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: "0.875rem", color: "#1d4ed8", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Settings size={18} /> Control Global de Programas
                    </div>
                    <div style={{ fontSize: "0.78125rem", color: "#1e40af", marginTop: "0.25rem" }}>
                        El toggle de esta pantalla activa o desactiva un programa <strong>para todas las escuelas a la vez</strong>.
                        Para desactivar un programa solo en una escuela específica, usa la pestaña <strong>"⚙️ Programas y Módulos por Escuela"</strong>.
                        Para permisos de IA, ve a <strong>"🤖 Permisos de Herramientas de IA"</strong>.
                    </div>
                </div>
                {onGoToPermisosIA && (
                    <button className="btn btn-primary btn-sm" onClick={onGoToPermisosIA} style={{ background: "#1d4ed8", borderColor: "#1d4ed8", fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}>
                        Ir a Permisos de IA
                    </button>
                )}
            </div>

            {message && !isModalOpen && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {programas.sort((a, b) => a.orden - b.orden).map(prog => {
                    const activo = prog.activo !== false;
                    const visible = prog.visibleEnDirector !== false;
                    return (
                    <div key={prog.id} className="card" style={{
                        padding: 0, overflow: "hidden",
                        borderLeft: `4px solid ${activo ? "#10b981" : "var(--border)"}`,
                        opacity: activo ? 1 : 0.75,
                        transition: "opacity 0.2s ease, border-color 0.2s ease",
                    }}>
                        <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                                    {/* Icon */}
                                    <div style={{
                                        width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                                        background: activo ? "rgba(16,185,129,0.1)" : "var(--bg-secondary)",
                                        color: activo ? "#10b981" : "var(--text-muted)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        transition: "background 0.2s, color 0.2s",
                                    }}>
                                        <FileText size={22} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.9375rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prog.nombre}</div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {prog.descripcion || "Sin descripción"}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                                    {!readOnly && (
                                        <>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleOpenModal(prog)}
                                                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
                                                title="Editar Programa"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleDelete(prog.id, prog.periodos?.length || 0)}
                                                style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "4px" }}
                                                title="Eliminar Programa"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                    {/* Toggle activo */}
                                    <button
                                        onClick={() => handleToggleActivo(prog.id, activo)}
                                        disabled={readOnly || isLoading}
                                        style={{ background: "none", border: "none", cursor: readOnly ? "default" : "pointer", padding: "4px" }}
                                        title={activo ? "Desactivar programa" : "Activar programa"}
                                    >
                                        {isLoading
                                            ? <Loader2 size={30} className="spin" style={{ color: "var(--text-muted)" }} />
                                            : activo
                                                ? <ToggleRight size={34} style={{ color: "#10b981" }} />
                                                : <ToggleLeft size={34} style={{ color: "var(--text-muted)" }} />}
                                    </button>
                                </div>
                            </div>

                            {/* Status chips */}
                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                                <span style={{
                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                    fontSize: "0.7rem", fontWeight: 700, padding: "0.125rem 0.5rem",
                                    borderRadius: "9999px",
                                    background: activo ? "rgba(16,185,129,0.1)" : "var(--bg-secondary)",
                                    color: activo ? "#10b981" : "var(--text-muted)",
                                }}>
                                    {activo ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                                    {activo ? "Activo" : "Inactivo"}
                                </span>
                                <span style={{
                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                    fontSize: "0.7rem", fontWeight: 600, padding: "0.125rem 0.5rem",
                                    borderRadius: "9999px",
                                    background: visible ? "rgba(99,102,241,0.1)" : "var(--bg-secondary)",
                                    color: visible ? "#6366f1" : "var(--text-muted)",
                                }}>
                                    {visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                    {visible ? "Visible Director" : "Oculto Director"}
                                </span>
                                <span style={{
                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                    fontSize: "0.7rem", fontWeight: 600, padding: "0.125rem 0.5rem",
                                    borderRadius: "9999px", background: "var(--bg-secondary)",
                                    color: "var(--text-muted)",
                                }}>
                                    <AlignLeft size={11} /> {prog.tipo}
                                </span>
                                <span style={{
                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                    fontSize: "0.7rem", fontWeight: 600, padding: "0.125rem 0.5rem",
                                    borderRadius: "9999px", background: "var(--bg-secondary)",
                                    color: "var(--text-muted)",
                                }}>
                                    <Layers size={11} /> {prog.numArchivos} doc(s) req.
                                </span>
                                <span style={{
                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                    fontSize: "0.7rem", fontWeight: 600, padding: "0.125rem 0.5rem",
                                    borderRadius: "9999px", background: "var(--bg-secondary)",
                                    color: "var(--text-muted)",
                                }}>
                                    Suben: {(prog.quienesPuedenSubir || ["director"]).join(", ")}
                                </span>
                                {prog.esParaSupervision && (
                                    <span style={{
                                        display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                        fontSize: "0.7rem", fontWeight: 700, padding: "0.125rem 0.5rem",
                                        borderRadius: "9999px",
                                        background: "#fef3c7", color: "#d97706",
                                    }}>
                                        Supervisión
                                    </span>
                                )}
                            </div>
                        </div>

                        {!readOnly && (
                            <div style={{ padding: "0.75rem 1rem", background: "var(--bg-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                <button
                                    onClick={() => handleToggleAuto(prog.id, prog.recordatorioAuto || false)}
                                    disabled={isLoading}
                                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem", color: prog.recordatorioAuto ? "var(--primary)" : "var(--text-muted)", fontSize: "0.75rem" }}
                                    title="Activar o desactivar recordatorios diarios a las 8AM"
                                >
                                    {prog.recordatorioAuto ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                    <span style={{ fontWeight: prog.recordatorioAuto ? 600 : 400 }}>Auto-Reminders</span>
                                </button>
                                <button
                                    className="btn btn-outline"
                                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", display: "flex", alignItems: "center", gap: "0.25rem", borderColor: "var(--primary)", color: "var(--primary)" }}
                                    onClick={() => handleOpenSendModal(prog.id, prog.nombre)}
                                    disabled={isLoading}
                                    title="Disparar correos manualmente eligiendo estados"
                                >
                                    <Send size={12} /> Recordatorio Manual
                                </button>
                            </div>
                        )}
                    </div>
                );})}
                {programas.length === 0 && (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                        No hay programas agregados. Crea tu primer programa para comenzar.
                    </div>
                )}
            </div>

            {/* Modal de Crear / Editar */}
            {isModalOpen && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem", zIndex: 1000
                }}>
                    <div className="card fade-in" style={{ width: "100%", maxWidth: "500px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>
                                {editingId ? "Editar Programa" : "Nuevo Programa"}
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
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Nombre del Programa</label>
                                <input
                                    type="text"
                                    required
                                    className="form-control"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    placeholder="Ej. Rendición de Cuentas"
                                    disabled={isLoading}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Descripción (Opcional)</label>
                                <textarea
                                    className="form-control"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    rows={2}
                                    placeholder="Agrega notas o instrucciones breves."
                                    disabled={isLoading}
                                    style={{ resize: "vertical" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Tipo de Periodicidad</label>
                                    <select
                                        className="form-control"
                                        value={formData.tipo}
                                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                                        disabled={isLoading}
                                    >
                                        <option value="ANUAL">ANUAL</option>
                                        <option value="SEMESTRAL">SEMESTRAL</option>
                                        <option value="MENSUAL">MENSUAL</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Documentos Requeridos</label>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        className="form-control"
                                        value={formData.numArchivos}
                                        onChange={(e) => {
                                            const newNum = parseInt(e.target.value) || 1;
                                            const newLabels = [...formData.etiquetasArchivos];
                                            // Trim if reducing, pad if increasing
                                            while (newLabels.length > newNum) newLabels.pop();
                                            setFormData({ ...formData, numArchivos: newNum, etiquetasArchivos: newLabels });
                                        }}
                                        disabled={isLoading}
                                    />
                                    <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>¿Cúantos PDFs deben adjuntar en la entrega?</small>
                                </div>
                            </div>

                            {formData.numArchivos > 1 && (
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Etiquetas de Archivos</label>
                                    <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block", marginBottom: "0.5rem" }}>
                                        Nombra cada archivo para que los directores sepan qué subir (ej. &quot;Registro&quot;, &quot;Evidencias&quot;).
                                    </small>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                        {Array.from({ length: formData.numArchivos }).map((_, i) => (
                                            <input
                                                key={i}
                                                type="text"
                                                className="form-control"
                                                placeholder={`Archivo ${i + 1}`}
                                                value={formData.etiquetasArchivos[i] || ""}
                                                onChange={(e) => {
                                                    const newLabels = [...formData.etiquetasArchivos];
                                                    // Ensure array is long enough
                                                    while (newLabels.length <= i) newLabels.push("");
                                                    newLabels[i] = e.target.value;
                                                    setFormData({ ...formData, etiquetasArchivos: newLabels });
                                                }}
                                                disabled={isLoading}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "8px" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.activo}
                                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                        disabled={isLoading}
                                    />
                                    Programa Activo
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.visibleEnDirector}
                                        onChange={(e) => setFormData({ ...formData, visibleEnDirector: e.target.checked })}
                                        disabled={isLoading}
                                    />
                                    Visible en Director
                                </label>
                            </div>

                            <div style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "8px" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8125rem", fontWeight: 600 }}>Permisos de Subida de Documentos</label>
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                    {[
                                        { rol: "director", label: "Director" },
                                        { rol: "atp", label: "ATP" },
                                        { rol: "supervisor", label: "Supervisor" }
                                    ].map((r) => {
                                        const checked = formData.quienesPuedenSubir.includes(r.rol);
                                        return (
                                            <label key={r.rol} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        const existe = formData.quienesPuedenSubir.includes(r.rol);
                                                        const nuevos = existe
                                                            ? formData.quienesPuedenSubir.filter(x => x !== r.rol)
                                                            : [...formData.quienesPuedenSubir, r.rol];
                                                        setFormData({ ...formData, quienesPuedenSubir: nuevos.length > 0 ? nuevos : ["director"] });
                                                    }}
                                                    disabled={isLoading}
                                                />
                                                {r.label}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.esParaSupervision}
                                        onChange={(e) => setFormData({ ...formData, esParaSupervision: e.target.checked })}
                                        disabled={isLoading}
                                    />
                                    Exclusivo para Supervisión
                                </label>
                                <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", display: "block", marginLeft: "1.5rem" }}>
                                    Si se marca, este programa sólo será visible y aplicable a la Supervisión, no a las escuelas regulares.
                                </small>
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Orden de Aparición</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={formData.orden}
                                    onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
                                    disabled={isLoading}
                                />
                                <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>Número menor aparecerá primero en la lista.</small>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                                <button type="button" className="btn btn-outline" onClick={handleCloseModal} disabled={isLoading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Save size={16} /> {isLoading ? "Guardando..." : "Guardar Programa"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal de Recordatorios Manuales */}
            {isSendModalOpen && sendModalProg && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem", zIndex: 1000
                }}>
                    <div className="card fade-in" style={{ width: "100%", maxWidth: "450px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>
                                Enviar Recordatorios: {sendModalProg.nombre}
                            </h2>
                            <button onClick={handleCloseSendModal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                            Selecciona a qué escuelas notificar, según el estado actual de su entrega.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem", border: "1px solid var(--border)", padding: "1rem", borderRadius: "8px", background: "var(--bg)" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={sendStatuses.includes("NO_ENTREGADO")}
                                    onChange={() => toggleSendStatus("NO_ENTREGADO")}
                                />
                                No Entregado (No han subido nada)
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={sendStatuses.includes("REQUIERE_CORRECCION")}
                                    onChange={() => toggleSendStatus("REQUIERE_CORRECCION")}
                                />
                                Requiere Corrección (Archivos rebotados)
                            </label>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                            <button type="button" className="btn btn-outline" onClick={handleCloseSendModal} disabled={isLoading}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleSendManual} disabled={isLoading || sendStatuses.length === 0} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Send size={16} /> {isLoading ? "Enviando..." : "Enviar Correos"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
