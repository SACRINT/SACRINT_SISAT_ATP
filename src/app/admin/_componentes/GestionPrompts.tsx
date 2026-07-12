"use client";

import { useState, useEffect } from "react";
import { Save, RotateCcw, Loader2, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

interface PromptTemplate {
    id: string;
    modulo: string;
    nombre: string;
    contenido: string;
    activo: boolean;
}

export default function GestionPrompts({ readOnly = false }: { readOnly?: boolean }) {
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [resettingId, setResettingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"PMC" | "PAEC" | "INFORME_FINAL">("PMC");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Fetch templates on mount
    useEffect(() => {
        fetchTemplates();
    }, []);

    async function fetchTemplates() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/prompts");
            if (!res.ok) throw new Error("Error al obtener las plantillas");
            const data = await res.json();
            setTemplates(data);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error al conectar con el servidor" });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(t: PromptTemplate) {
        setSavingId(t.id);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/prompts/${t.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: t.nombre,
                    contenido: t.contenido,
                    activo: t.activo
                })
            });

            if (!res.ok) throw new Error("Error al guardar cambios");
            setMessage({ type: "success", text: `Plantilla de ${t.modulo} guardada con éxito.` });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error de conexión" });
        } finally {
            setSavingId(null);
        }
    }

    async function handleReset(t: PromptTemplate) {
        if (!confirm("¿Estás seguro de que deseas restablecer esta plantilla al prompt maestro por defecto? Se perderán los cambios personalizados.")) return;
        
        setResettingId(t.id);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/prompts/${t.id}/reset`, {
                method: "POST"
            });

            if (!res.ok) throw new Error("Error al restablecer plantilla");
            const updated = await res.json();
            
            setTemplates(prev => prev.map(p => p.id === t.id ? updated : p));
            setMessage({ type: "success", text: `Plantilla de ${t.modulo} restablecida al valor por defecto.` });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error de conexión" });
        } finally {
            setResettingId(null);
        }
    }

    const currentTemplate = templates.find(t => t.modulo === activeTab);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
                <Loader2 size={36} style={{ animation: "spin 1.5s linear infinite", color: "var(--primary)" }} />
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Rúbricas y Prompts de IA</h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        Configura las instrucciones de evaluación y rúbricas maestras que utiliza la IA para revisar el PMC y el PAEC-PEC.
                    </p>
                </div>
            </div>

            {/* Notification alert */}
            {message && (
                <div className={`alert alert-${message.type}`} style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.75rem 1rem", borderRadius: "8px",
                    background: message.type === "success" ? "#f0fdf4" : "#fdf2f2",
                    border: `1px solid ${message.type === "success" ? "#86efac" : "#f87171"}`,
                    color: message.type === "success" ? "#16a34a" : "#dc2626"
                }}>
                    {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{message.text}</span>
                </div>
            )}

            {/* Custom Tab Selector */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "1.5rem" }}>
                <button
                    onClick={() => setActiveTab("PMC")}
                    style={{
                        padding: "0.75rem 0.5rem", background: "none", border: "none", cursor: "pointer",
                        fontWeight: 600, fontSize: "0.9375rem",
                        color: activeTab === "PMC" ? "var(--primary)" : "var(--text-muted)",
                        borderBottom: activeTab === "PMC" ? "2px solid var(--primary)" : "none",
                        transition: "all 0.2s"
                    }}
                >
                    Plan de Mejora Continua (PMC)
                </button>
                <button
                    onClick={() => setActiveTab("PAEC")}
                    style={{
                        padding: "0.75rem 0.5rem", background: "none", border: "none", cursor: "pointer",
                        fontWeight: 600, fontSize: "0.9375rem",
                        color: activeTab === "PAEC" ? "var(--primary)" : "var(--text-muted)",
                        borderBottom: activeTab === "PAEC" ? "2px solid var(--primary)" : "none",
                        transition: "all 0.2s"
                    }}
                >
                    Programa Aula, Escuela y Comunidad (PAEC)
                </button>
                <button
                    onClick={() => setActiveTab("INFORME_FINAL")}
                    style={{
                        padding: "0.75rem 0.5rem", background: "none", border: "none", cursor: "pointer",
                        fontWeight: 600, fontSize: "0.9375rem",
                        color: activeTab === "INFORME_FINAL" ? "var(--primary)" : "var(--text-muted)",
                        borderBottom: activeTab === "INFORME_FINAL" ? "2px solid var(--primary)" : "none",
                        transition: "all 0.2s"
                    }}
                >
                    Informe Final PMC
                </button>
            </div>

            {/* Main Configuration Card */}
            {currentTemplate ? (
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", padding: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "250px" }}>
                            <label style={{ display: "block", fontSize: "0.8125rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                                Nombre de la Plantilla
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={currentTemplate.nombre}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setTemplates(prev => prev.map(p => p.id === currentTemplate.id ? { ...p, nombre: val } : p));
                                }}
                                style={{ width: "100%", fontWeight: 600 }}
                                disabled={readOnly}
                            />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <label style={{ fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }} htmlFor="toggle-activo">
                                Activar Evaluación Automática:
                            </label>
                            <input
                                id="toggle-activo"
                                type="checkbox"
                                checked={currentTemplate.activo}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setTemplates(prev => prev.map(p => p.id === currentTemplate.id ? { ...p, activo: checked } : p));
                                }}
                                style={{ width: "18px", height: "18px", cursor: "pointer" }}
                                disabled={readOnly}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: "0.8125rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                            Prompt Maestro e Instrucciones de Rúbrica (Editable)
                        </label>
                        <textarea
                            value={currentTemplate.contenido}
                            onChange={(e) => {
                                const val = e.target.value;
                                setTemplates(prev => prev.map(p => p.id === currentTemplate.id ? { ...p, contenido: val } : p));
                            }}
                            placeholder="Introduce el prompt de evaluación completo..."
                            style={{
                                width: "100%", minHeight: "350px", padding: "0.75rem",
                                borderRadius: "8px", border: "1px solid var(--border)",
                                fontFamily: "monospace", fontSize: "0.8125rem", resize: "vertical",
                                background: "var(--bg-secondary)", color: "var(--text)", lineHeight: "1.5"
                            }}
                            disabled={readOnly}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                        {readOnly ? (
                            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                🔒 Modo de sólo lectura. No tienes permisos para modificar las rúbricas o prompts.
                            </span>
                        ) : (
                            <>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => handleReset(currentTemplate)}
                                    disabled={resettingId !== null || savingId !== null}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", borderColor: "#e67e22", color: "#e67e22" }}
                                >
                                    {resettingId === currentTemplate.id ? (
                                        <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Restableciendo...</>
                                    ) : (
                                        <><RotateCcw size={15} /> Restablecer por Defecto</>
                                    )}
                                </button>

                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleSave(currentTemplate)}
                                    disabled={savingId !== null || resettingId !== null}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
                                >
                                    {savingId === currentTemplate.id ? (
                                        <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
                                    ) : (
                                        <><Save size={15} /> Guardar Cambios</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                    No se encontró la plantilla de evaluación para {activeTab}.
                </div>
            )}
        </div>
    );
}
