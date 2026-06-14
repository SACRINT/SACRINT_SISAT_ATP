"use client";

import { useState } from "react";
import { Calendar, PlusCircle, CheckCircle2, AlertTriangle, Play } from "lucide-react";

type Ciclo = {
    id: string;
    nombre: string;
    activo: boolean;
    inicio: string;
    fin: string;
};

export default function GestionCiclos({
    todosCiclos: inicialCiclos,
    onSetMessage,
}: {
    todosCiclos: Ciclo[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
    const [ciclos, setCiclos] = useState<Ciclo[]>(inicialCiclos);
    const [nombre, setNombre] = useState("");
    const [inicio, setInicio] = useState("");
    const [fin, setFin] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [activatingId, setActivatingId] = useState<string | null>(null);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!nombre || !inicio || !fin) {
            onSetMessage({ type: "error", text: "Por favor, completa todos los campos." });
            return;
        }

        setSubmitting(true);
        onSetMessage(null);

        try {
            const res = await fetch("/api/admin/ciclos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, inicio, fin }),
            });

            const data = await res.json();

            if (res.ok) {
                onSetMessage({ type: "success", text: `Ciclo escolar "${nombre}" creado con éxito.` });
                setCiclos((prev) => [data.ciclo, ...prev]);
                setNombre("");
                setInicio("");
                setFin("");
                // Reload after a delay to sync the sidebar dropdown
                setTimeout(() => window.location.reload(), 2000);
            } else {
                onSetMessage({ type: "error", text: data.error || "Error al crear el ciclo escolar." });
            }
        } catch (error) {
            console.error("Error creating cycle:", error);
            onSetMessage({ type: "error", text: "Error de conexión con el servidor." });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleActivar(id: string, nombreCiclo: string) {
        if (!confirm(`¿Estás seguro de activar el ciclo escolar "${nombreCiclo}"? Esto desactivará el ciclo actual.`)) {
            return;
        }

        setActivatingId(id);
        onSetMessage(null);

        try {
            const res = await fetch("/api/admin/ciclos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            const data = await res.json();

            if (res.ok) {
                onSetMessage({ type: "success", text: `Ciclo escolar "${nombreCiclo}" activado con éxito. Recargando plataforma...` });
                // Update local state
                setCiclos((prev) =>
                    prev.map((c) => ({
                        ...c,
                        activo: c.id === id,
                    }))
                );
                // Reload to reset the whole app state to the new active cycle
                setTimeout(() => window.location.reload(), 1500);
            } else {
                onSetMessage({ type: "error", text: data.error || "Error al activar el ciclo escolar." });
            }
        } catch (error) {
            console.error("Error activating cycle:", error);
            onSetMessage({ type: "error", text: "Error de conexión con el servidor." });
        } finally {
            setActivatingId(null);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem" }}>
                <h1>Ciclos Escolares</h1>
                <p style={{ color: "var(--text-secondary)" }}>
                    Administra los periodos anuales de trabajo de la supervisión. Crear un nuevo ciclo te permitirá iniciar entregas limpias preservando el historial del ciclo anterior.
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", alignItems: "start" }}>
                
                {/* FORMULARIO DE CREACIÓN */}
                <div className="card">
                    <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <PlusCircle size={18} color="var(--primary)" />
                        <span>Crear Nuevo Ciclo Escolar</span>
                    </div>

                    <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                                Nombre del Ciclo
                            </label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Ej: 2026-2027"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                required
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                                Fecha de Inicio
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={inicio}
                                onChange={(e) => setInicio(e.target.value)}
                                required
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                                Fecha de Fin
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={fin}
                                onChange={(e) => setFin(e.target.value)}
                                required
                                style={{ width: "100%" }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                            style={{ marginTop: "0.5rem", width: "100%" }}
                        >
                            {submitting ? "Creando..." : "Crear Ciclo Escolar"}
                        </button>
                    </form>
                </div>

                {/* LISTADO DE CICLOS */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem", padding: "1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={18} color="var(--primary)" />
                        <span>Historial de Ciclos Escolares</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {ciclos.map((c) => {
                            const dateInicio = new Date(c.inicio).toLocaleDateString("es-MX", { day: '2-digit', month: 'short', year: 'numeric' });
                            const dateFin = new Date(c.fin).toLocaleDateString("es-MX", { day: '2-digit', month: 'short', year: 'numeric' });

                            return (
                                <div
                                    key={c.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "1rem",
                                        borderBottom: "1px solid var(--border)",
                                        background: c.activo ? "var(--primary-bg, #eff6ff)" : "transparent",
                                    }}
                                >
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <strong style={{ fontSize: "0.9375rem", color: "var(--text)" }}>{c.nombre}</strong>
                                            {c.activo ? (
                                                <span style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.25rem",
                                                    fontSize: "0.65rem",
                                                    fontWeight: 700,
                                                    color: "var(--success, #16a34a)",
                                                    background: "var(--success-bg, #dcfce7)",
                                                    padding: "2px 8px",
                                                    borderRadius: "12px"
                                                }}>
                                                    <CheckCircle2 size={10} /> ACTIVO
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.25rem",
                                                    fontSize: "0.65rem",
                                                    fontWeight: 700,
                                                    color: "var(--text-muted, #64748b)",
                                                    background: "var(--bg-secondary, #f1f5f9)",
                                                    padding: "2px 8px",
                                                    borderRadius: "12px"
                                                }}>
                                                    INACTIVO (Lectura)
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginTop: "0.25rem" }}>
                                            Rango: {dateInicio} - {dateFin}
                                        </span>
                                    </div>

                                    {!c.activo && (
                                        <button
                                            onClick={() => handleActivar(c.id, c.nombre)}
                                            disabled={activatingId !== null}
                                            className="btn btn-outline"
                                            style={{
                                                padding: "0.375rem 0.75rem",
                                                fontSize: "0.75rem",
                                                minHeight: "auto",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.25rem"
                                            }}
                                        >
                                            <Play size={12} /> Activar
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* AVISO IMPORTANTE */}
            <div className="card" style={{ marginTop: "1.5rem", background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                        <strong style={{ fontSize: "0.9375rem", display: "block", marginBottom: "0.25rem" }}>Notas sobre el funcionamiento multiciclo:</strong>
                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", lineHeight: 1.5 }}>
                            <li>Al activar un nuevo ciclo, el avance escolar por escuela e inscripción en programas se iniciará vacío.</li>
                            <li>Tanto supervisores como directores de escuela podrán alternar entre ciclos pasados mediante el menú lateral para consultar, revisar o descargar archivos históricos.</li>
                            <li>Los expedientes de docentes y personal no se reinician, ya que son datos del centro de trabajo que permanecen vigentes.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
