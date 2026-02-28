"use strict";
"use client";

import { useState } from "react";
import { Plus, Edit2, Save, Trash2, X, FileText, Settings, AlignLeft, Layers, Bell, ToggleLeft, ToggleRight, Send } from "lucide-react";

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
    recordatorioAuto?: boolean;
    periodos: PeriodoAdmin[];
}

export default function GestionProgramas({ inicialProgramas }: { inicialProgramas: ProgramaAdmin[] }) {
    const [programas, setProgramas] = useState<ProgramaAdmin[]>(inicialProgramas);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Modal de Recordatorios
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [sendModalProg, setSendModalProg] = useState<{ id: string, nombre: string } | null>(null);
    const [sendStatuses, setSendStatuses] = useState<string[]>(["NO_ENTREGADO", "REQUIERE_CORRECCION"]);

    const [formData, setFormData] = useState<{
        nombre: string;
        descripcion: string;
        tipo: string;
        numArchivos: number;
        orden: number;
    }>({
        nombre: "",
        descripcion: "",
        tipo: "ANUAL",
        numArchivos: 1,
        orden: 0,
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
            });
        } else {
            setEditingId(null);
            setFormData({
                nombre: "",
                descripcion: "",
                tipo: "ANUAL",
                numArchivos: 1,
                orden: 0,
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
                setProgramas(prev => prev.map(p => p.id === editingId ? { ...p, ...savedPrograma } : p));
                setMessage({ type: "success", text: "Programa actualizado exitosamente." });
            } else {
                setProgramas(prev => [...prev, { ...savedPrograma, periodos: [] }]);
                setMessage({ type: "success", text: "Programa creado exitosamente." });
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
            setTimeout(() => setMessage(null), 3000);
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
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1>Gestión de Programas</h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Crea o edita los programas operativos, la periodicidad de entregas y el total de formatos o evidencias que la escuela te debe enviar en cada entrega.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Plus size={18} /> Nuevo Programa
                </button>
            </div>

            {message && !isModalOpen && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {programas.sort((a, b) => a.orden - b.orden).map(prog => (
                    <div key={prog.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                                <h3 style={{ margin: 0, fontSize: "1.125rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FileText size={18} color="var(--primary)" />
                                    {prog.nombre}
                                </h3>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleOpenModal(prog)}
                                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem" }}
                                        title="Editar Programa"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleDelete(prog.id, prog.periodos?.length || 0)}
                                        style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.25rem" }}
                                        title="Eliminar Programa"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", minHeight: "2.5rem" }}>
                                {prog.descripcion || <em style={{ color: "var(--border)" }}>Sin descripción</em>}
                            </p>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.75rem", background: "var(--bg)", padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <AlignLeft size={12} /> {prog.tipo}
                            </span>
                            <span style={{ fontSize: "0.75rem", background: "var(--bg)", padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <Layers size={12} /> {prog.numArchivos} Documento(s) req.
                            </span>

                            <div style={{ width: "100%", marginTop: "0.5rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <button
                                        onClick={() => handleToggleAuto(prog.id, prog.recordatorioAuto || false)}
                                        disabled={isLoading}
                                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", color: prog.recordatorioAuto ? "var(--primary)" : "var(--text-muted)" }}
                                        title="Activar o desactivar recordatorios diarios a las 8AM"
                                    >
                                        {prog.recordatorioAuto ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        <span style={{ fontSize: "0.75rem", fontWeight: prog.recordatorioAuto ? 600 : 400 }}>Auto-Reminders</span>
                                    </button>
                                </div>
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
                        </div>
                    </div>
                ))}
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
                                        onChange={(e) => setFormData({ ...formData, numArchivos: parseInt(e.target.value) || 1 })}
                                        disabled={isLoading}
                                    />
                                    <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>¿Cúantos PDFs deben adjuntar en la entrega?</small>
                                </div>
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
