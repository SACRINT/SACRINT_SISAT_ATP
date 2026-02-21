"use client";

import { useState } from "react";
import { Calendar, PlusCircle, Save, X, RefreshCw } from "lucide-react";

export default function GestionFechas({
    programas,
}: {
    programas: any[];
}) {
    const [fechas, setFechas] = useState<Record<string, string>>({});
    const [savingPeriodoId, setSavingPeriodoId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Modal state for extraordinary task
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskDate, setNewTaskDate] = useState("");
    const [newTaskFiles, setNewTaskFiles] = useState(1);
    const [creatingTask, setCreatingTask] = useState(false);

    const handleDateChange = (periodoId: string, dateStr: string) => {
        setFechas((prev) => ({ ...prev, [periodoId]: dateStr }));
    };

    const handleSaveDate = async (periodoId: string) => {
        const fecha = fechas[periodoId];
        if (!fecha) return;

        setSavingPeriodoId(periodoId);
        setMessage(null);

        try {
            const res = await fetch(`/api/periodos/${periodoId}/fecha`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fechaLimite: fecha }),
            });

            if (!res.ok) throw new Error("No se pudo guardar la fecha");

            setMessage({ type: "success", text: "Fecha límite actualizada guardada" });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSavingPeriodoId(null);
        }
    };

    const handleCreateTask = async () => {
        if (!newTaskName.trim()) {
            setMessage({ type: "error", text: "El nombre es obligatorio" });
            return;
        }

        setCreatingTask(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/programas/extraordinarios`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: newTaskName,
                    descripcion: newTaskDesc,
                    fechaLimite: newTaskDate || null,
                    numArchivos: newTaskFiles
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "No se pudo crear la tarea");
            }

            setMessage({ type: "success", text: "Nueva comisión extraordinaria creada. Actualiza la página para verla." });
            setIsModalOpen(false);
            setNewTaskName("");
            setNewTaskDesc("");
            setNewTaskDate("");
            setNewTaskFiles(1);

            // Reload page to fetch updated db
            setTimeout(() => window.location.reload(), 2000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setCreatingTask(false);
        }
    };

    const getPeriodoLabel = (prog: any, periodo: any) => {
        if (prog.tipo === "MENSUAL") {
            const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            return meses[periodo.mes];
        } else if (prog.tipo === "SEMESTRAL") {
            return `Semestre ${periodo.semestre}`;
        }
        return "Entrega Única / Anual";
    };

    // Format date for inputs (YYYY-MM-DD)
    const formatDateForInput = (isoDate: string | null) => {
        if (!isoDate) return "";
        return new Date(isoDate).toISOString().split('T')[0];
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1>Fechas y Entregas</h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Configura los días límite de entrega y crea comisiones extraordinarias.
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setIsModalOpen(true)}
                    style={{ whiteSpace: "nowrap" }}
                >
                    <PlusCircle size={18} /> Crear Tarea Extraordinaria
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {programas.map((prog) => (
                    <div key={prog.id} className="card" style={{ padding: 0 }}>
                        <div style={{ padding: "1rem", fontWeight: 700, borderBottom: "1px solid var(--border)", background: "var(--bg)", display: "flex", justifyContent: "space-between" }}>
                            <span>{prog.nombre}</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "normal", background: "white", padding: "2px 8px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                {prog.tipo}
                            </span>
                        </div>
                        <div>
                            {prog.periodos.filter((p: any) => p.activo).map((periodo: any) => {
                                const initialVal = formatDateForInput(periodo.fechaLimite);
                                const currentVal = fechas[periodo.id] !== undefined ? fechas[periodo.id] : initialVal;
                                const isDirty = currentVal !== initialVal;

                                return (
                                    <div key={periodo.id} style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "1rem", borderBottom: "1px solid var(--border)",
                                        flexWrap: "wrap", gap: "1rem"
                                    }}>
                                        <div style={{ minWidth: "200px" }}>
                                            <span style={{ fontWeight: 500, display: "block" }}>{getPeriodoLabel(prog, periodo)}</span>
                                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                {periodo.fechaLimite ? `Fijada: ${new Date(periodo.fechaLimite).toLocaleDateString()}` : "Sin fecha límite"}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <Calendar size={16} color="var(--text-muted)" />
                                            <input
                                                type="date"
                                                className="form-control"
                                                style={{ width: "150px" }}
                                                value={currentVal}
                                                onChange={(e) => handleDateChange(periodo.id, e.target.value)}
                                            />
                                            {isDirty && (
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ padding: "0.5rem 0.75rem" }}
                                                    onClick={() => handleSaveDate(periodo.id)}
                                                    disabled={savingPeriodoId === periodo.id}
                                                >
                                                    {savingPeriodoId === periodo.id ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {prog.periodos.filter((p: any) => p.activo).length === 0 && (
                                <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.875rem", fontStyle: "italic" }}>
                                    No hay periodos activos para este programa.
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Crear Tarea */}
            {isModalOpen && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem", zIndex: 1000,
                }}>
                    <div className="card fade-in" style={{ maxWidth: "500px", width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ margin: 0 }}>Nueva Tarea Extraordinaria</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                            Esto creará un nuevo programa de entrega única que aparecerá inmediatamente en el portal de todos los directores.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Nombre de la Tarea</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ej: Registro de Jóvenes Talentosos"
                                    value={newTaskName}
                                    onChange={(e) => setNewTaskName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Descripción o Instrucciones breves</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Del archivo Excel enviado por SEV..."
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Fecha Límite</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={newTaskDate}
                                        onChange={(e) => setNewTaskDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Archivos requeridos</label>
                                    <select
                                        className="form-control"
                                        value={newTaskFiles}
                                        onChange={(e) => setNewTaskFiles(parseInt(e.target.value))}
                                    >
                                        <option value={1}>1 archivo</option>
                                        <option value={2}>2 archivos</option>
                                        <option value={3}>3 archivos</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "2rem" }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setIsModalOpen(false)}
                                disabled={creatingTask}
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateTask}
                                disabled={creatingTask || !newTaskName.trim()}
                                style={{ flex: 1 }}
                            >
                                {creatingTask ? "Creando..." : "Crear y Publicar Tarea"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
