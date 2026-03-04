"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Save,
    Loader2,
    Plus,
    Trash2,
    Download,
    Users,
    GraduationCap,
    AlertTriangle,
} from "lucide-react";

interface Alumno {
    nombre: string;
    grado: string;
    curp: string;
}

export default function OlimpiadaMatematicas() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [convocatoriaUrl, setConvocatoriaUrl] = useState<string | null>(null);
    const [alumnos, setAlumnos] = useState<Alumno[]>([{ nombre: "", grado: "", curp: "" }]);
    const [hasInscripcion, setHasInscripcion] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/olimpiada");
            if (!res.ok) throw new Error();
            const data = await res.json();
            setConvocatoriaUrl(data.config?.convocatoriaUrl || null);
            if (data.inscripcion) {
                setAlumnos(data.inscripcion.alumnos || [{ nombre: "", grado: "", curp: "" }]);
                setHasInscripcion(true);
            }
        } catch {
            setMessage({ type: "error", text: "Error al cargar datos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const addAlumno = () => {
        setAlumnos([...alumnos, { nombre: "", grado: "", curp: "" }]);
    };

    const removeAlumno = (index: number) => {
        if (alumnos.length <= 1) return;
        setAlumnos(alumnos.filter((_, i) => i !== index));
    };

    const updateAlumno = (index: number, field: keyof Alumno, value: string) => {
        const updated = [...alumnos];
        updated[index] = { ...updated[index], [field]: value };
        setAlumnos(updated);
    };

    const handleSave = async () => {
        // Validate
        const valid = alumnos.every(a => a.nombre.trim() && a.grado.trim() && a.curp.trim());
        if (!valid) {
            setMessage({ type: "error", text: "Todos los campos de cada alumno son obligatorios" });
            return;
        }

        // Validate CURP format (18 chars)
        const invalidCurp = alumnos.find(a => a.curp.trim().length !== 18);
        if (invalidCurp) {
            setMessage({ type: "error", text: "La CURP debe tener exactamente 18 caracteres" });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch("/api/olimpiada", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ datos: { alumnos: alumnos.map(a => ({ ...a, curp: a.curp.toUpperCase() })) } }),
            });

            if (res.ok) {
                setMessage({ type: "success", text: "✅ Inscripción guardada correctamente" });
                setHasInscripcion(true);
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error al guardar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setSaving(false);
        }
    };

    const handleCancelar = async () => {
        if (!confirm("¿Estás seguro de cancelar tu inscripción a la Olimpiada de Matemáticas?")) return;
        setCancelling(true);
        try {
            const res = await fetch("/api/olimpiada", { method: "DELETE" });
            if (res.ok) {
                setAlumnos([{ nombre: "", grado: "", curp: "" }]);
                setHasInscripcion(false);
                setMessage({ type: "success", text: "Inscripción cancelada" });
            }
        } catch {
            setMessage({ type: "error", text: "Error al cancelar" });
        } finally {
            setCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                <Loader2 size={32} className="spin" style={{ margin: "0 auto" }} />
                <p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>Cargando...</p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header */}
            <div className="card" style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                color: "white", border: "none"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <GraduationCap size={28} />
                    <h2 style={{ margin: 0 }}>Olimpiada de Matemáticas 2026</h2>
                </div>
                <p style={{ opacity: 0.85, fontSize: "0.875rem", margin: 0 }}>
                    Registra a los alumnos participantes de tu plantel educativo.
                </p>
                {convocatoriaUrl && (
                    <a
                        href={convocatoriaUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: "inline-flex", alignItems: "center", gap: "0.375rem",
                            marginTop: "0.75rem", color: "white", textDecoration: "none",
                            background: "rgba(255,255,255,0.2)", padding: "0.5rem 1rem",
                            borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600,
                        }}
                    >
                        <Download size={16} /> Descargar Convocatoria
                    </a>
                )}
            </div>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                </div>
            )}

            {/* Status badge */}
            {hasInscripcion && (
                <div style={{
                    background: "#dcfce7", border: "1px solid #86efac", borderRadius: "8px",
                    padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#166534",
                    fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem",
                }}>
                    ✅ Tu escuela ya tiene una inscripción registrada. Puedes modificarla o cancelarla.
                </div>
            )}

            {/* Alumnos Form */}
            <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Users size={20} /> Alumnos Participantes
                    </h3>
                    <button className="btn btn-outline" onClick={addAlumno} style={{ fontSize: "0.8125rem" }}>
                        <Plus size={16} /> Agregar Alumno
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {alumnos.map((alumno, i) => (
                        <div key={i} style={{
                            display: "grid", gridTemplateColumns: "1fr 0.5fr 1fr auto",
                            gap: "0.5rem", padding: "0.75rem",
                            background: "var(--bg-secondary)", borderRadius: "8px",
                            border: "1px solid var(--border)",
                        }}>
                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                                    Nombre Completo
                                </label>
                                <input
                                    className="form-control"
                                    placeholder="Nombre del alumno(a)"
                                    value={alumno.nombre}
                                    onChange={(e) => updateAlumno(i, "nombre", e.target.value)}
                                    style={{ fontSize: "0.875rem" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                                    Grado
                                </label>
                                <select
                                    className="form-control"
                                    value={alumno.grado}
                                    onChange={(e) => updateAlumno(i, "grado", e.target.value)}
                                    style={{ fontSize: "0.875rem" }}
                                >
                                    <option value="">Seleccionar</option>
                                    <option value="1°">1°</option>
                                    <option value="2°">2°</option>
                                    <option value="3°">3°</option>
                                    <option value="4°">4°</option>
                                    <option value="5°">5°</option>
                                    <option value="6°">6°</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                                    CURP
                                </label>
                                <input
                                    className="form-control"
                                    placeholder="18 caracteres"
                                    value={alumno.curp}
                                    onChange={(e) => updateAlumno(i, "curp", e.target.value.toUpperCase())}
                                    maxLength={18}
                                    style={{ fontSize: "0.875rem", textTransform: "uppercase" }}
                                />
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                                {alumnos.length > 1 && (
                                    <button
                                        onClick={() => removeAlumno(i)}
                                        style={{
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "var(--danger)", padding: "0.5rem",
                                        }}
                                        title="Eliminar alumno"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", gap: "0.75rem" }}>
                    {hasInscripcion && (
                        <button
                            className="btn btn-outline"
                            onClick={handleCancelar}
                            disabled={cancelling}
                            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                        >
                            {cancelling ? <Loader2 size={16} className="spin" /> : <AlertTriangle size={16} />}
                            {cancelling ? "Cancelando..." : "Cancelar Inscripción"}
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}
                    >
                        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        {saving ? "Guardando..." : hasInscripcion ? "Actualizar Inscripción" : "Guardar Inscripción"}
                    </button>
                </div>
            </div>
        </div>
    );
}
