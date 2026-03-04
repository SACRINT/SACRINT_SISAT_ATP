"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    ToggleLeft,
    ToggleRight,
    Loader2,
    GraduationCap,
    Users,
    School,
    Trash2,
    RefreshCw,
    Download,
    Upload,
    FileText,
    ExternalLink,
    CheckCircle2,
} from "lucide-react";

interface EscuelaOlimpiada {
    id: string;
    cct: string;
    nombre: string;
    alumnos: { nombre: string; grado: string; curp: string }[];
    fecha: string;
}

export default function GestionOlimpiada() {
    const [loading, setLoading] = useState(true);
    const [activo, setActivo] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [convocatoriaUrl, setConvocatoriaUrl] = useState<string | null>(null);
    const [escuelas, setEscuelas] = useState<EscuelaOlimpiada[]>([]);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        try {
            const [configRes, inscRes] = await Promise.all([
                fetch("/api/admin/olimpiada-config"),
                fetch("/api/admin/olimpiada-inscripciones"),
            ]);
            const config = await configRes.json();
            setActivo(config.activo ?? false);
            setConvocatoriaUrl(config.convocatoriaUrl ?? null);

            if (inscRes.ok) {
                const inscData = await inscRes.json();
                setEscuelas(inscData);
            }
        } catch {
            setMessage({ type: "error", text: "Error al cargar datos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleToggle = async () => {
        setToggling(true);
        try {
            const res = await fetch("/api/admin/olimpiada-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: !activo }),
            });
            if (res.ok) {
                setActivo(!activo);
                setMessage({ type: "success", text: `Olimpiada de Matemáticas ${!activo ? "activada" : "desactivada"}` });
            }
        } catch {
            setMessage({ type: "error", text: "Error al cambiar estado" });
        } finally {
            setToggling(false);
        }
    };

    const handleUploadConvocatoria = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("field", "convocatoria");
            const res = await fetch("/api/admin/olimpiada-config", { method: "POST", body: formData });
            if (res.ok) {
                const config = await res.json();
                setConvocatoriaUrl(config.convocatoriaUrl);
                setMessage({ type: "success", text: "Convocatoria subida correctamente" });
            } else {
                throw new Error("Error al subir");
            }
        } catch {
            setMessage({ type: "error", text: "Error al subir la convocatoria" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleCancelInscripcion = async (escuelaId: string, nombre: string) => {
        if (!confirm(`¿Cancelar la inscripción de ${nombre}?`)) return;
        try {
            const res = await fetch(`/api/admin/olimpiada-inscripciones?escuelaId=${escuelaId}`, { method: "DELETE" });
            if (res.ok) {
                setEscuelas(escuelas.filter(e => e.id !== escuelaId));
                setMessage({ type: "success", text: `Inscripción de ${nombre} cancelada` });
            }
        } catch {
            setMessage({ type: "error", text: "Error al cancelar" });
        }
    };

    const handleExportExcel = async () => {
        try {
            const res = await fetch("/api/admin/olimpiada-inscripciones?format=csv");
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "olimpiada_matematicas_2026.csv";
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch {
            setMessage({ type: "error", text: "Error al exportar" });
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "3rem" }}>
                <Loader2 size={32} className="spin" style={{ margin: "0 auto" }} />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
                    <GraduationCap size={24} /> Olimpiada de Matemáticas 2026
                </h2>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <button className="btn btn-outline" onClick={() => fetchData()} style={{ fontSize: "0.8125rem" }}>
                        <RefreshCw size={16} /> Actualizar
                    </button>
                    <button
                        onClick={handleToggle}
                        disabled={toggling}
                        style={{
                            display: "flex", alignItems: "center", gap: "0.5rem",
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: "1rem", fontWeight: 600,
                            color: activo ? "var(--success)" : "var(--text-muted)",
                        }}
                    >
                        {toggling ? <Loader2 size={24} className="spin" /> : activo ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        {activo ? "Activo" : "Inactivo"}
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Convocatoria Upload */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FileText size={18} /> Convocatoria
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    {convocatoriaUrl ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                            <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Documento cargado</span>
                            <a
                                href={convocatoriaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline"
                                style={{ fontSize: "0.8125rem", padding: "0.3rem 0.75rem" }}
                            >
                                <ExternalLink size={14} /> Ver
                            </a>
                        </div>
                    ) : (
                        <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", flex: 1 }}>
                            No se ha subido la convocatoria aún
                        </span>
                    )}
                    <label
                        className="btn btn-primary"
                        style={{ fontSize: "0.8125rem", cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.7 : 1 }}
                    >
                        {uploading ? <><Loader2 size={16} className="spin" /> Subiendo...</> : <><Upload size={16} /> {convocatoriaUrl ? "Reemplazar" : "Subir Convocatoria"}</>}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleUploadConvocatoria}
                            disabled={uploading}
                            style={{ display: "none" }}
                        />
                    </label>
                </div>
            </div>

            {/* Stats */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", gap: "2rem" }}>
                    <div>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>{escuelas.length}</div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Escuelas Inscritas</div>
                    </div>
                    <div>
                        <div style={{ fontSize: "2rem", fontWeight: 800, color: "#7c3aed" }}>
                            {escuelas.reduce((sum, e) => sum + e.alumnos.length, 0)}
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Total Alumnos</div>
                    </div>
                </div>
            </div>

            {/* Export button */}
            {escuelas.length > 0 && (
                <button className="btn btn-outline" onClick={handleExportExcel} style={{ marginBottom: "1rem", fontSize: "0.8125rem" }}>
                    <Download size={16} /> Exportar CSV
                </button>
            )}

            {/* Schools List */}
            {escuelas.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    <School size={32} style={{ margin: "0 auto 0.5rem" }} />
                    <p>No hay inscripciones registradas aún</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {escuelas.map((esc) => (
                        <div key={esc.id} className="card" style={{ padding: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <h4 style={{ margin: "0 0 0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <School size={16} /> {esc.nombre}
                                    </h4>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{esc.cct}</span>
                                </div>
                                <button
                                    onClick={() => handleCancelInscripcion(esc.id, esc.nombre)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "0.25rem" }}
                                    title="Cancelar inscripción"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div style={{ marginTop: "0.75rem" }}>
                                <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                    <Users size={14} /> {esc.alumnos.length} Alumno(s)
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                    {esc.alumnos.map((al, i) => (
                                        <div key={i} style={{
                                            fontSize: "0.8125rem", padding: "0.375rem 0.5rem",
                                            background: "var(--bg-secondary)", borderRadius: "6px",
                                            display: "grid", gridTemplateColumns: "1fr 0.3fr 1fr", gap: "0.5rem",
                                        }}>
                                            <span>{al.nombre}</span>
                                            <span style={{ color: "var(--text-muted)" }}>{al.grado}</span>
                                            <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{al.curp}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                                Registrado: {esc.fecha}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
