"use client";

import { useState, useEffect } from "react";
import { Save, UserCheck } from "lucide-react";
import { BadgeIcon } from "@/components/BadgeIcon";

export default function AutoridadesConfigPanel() {
    const [config, setConfig] = useState({
        supervisor: "",
        coordinadorRegional: "",
        directorNivel: "",
        atp: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        fetch("/api/admin/autoridades-config")
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setConfig({
                        supervisor: data.supervisor || "",
                        coordinadorRegional: data.coordinadorRegional || "",
                        directorNivel: data.directorNivel || "",
                        atp: data.atp || "",
                    });
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/autoridades-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });

            if (!res.ok) throw new Error("Error al guardar la configuración");

            setMessage({ type: "success", text: "Configuración guardada correctamente." });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}>Cargando configuración...</div>;

    return (
        <div className="card fade-in">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <UserCheck size={24} color="var(--primary)" />
                Autoridades Educativas
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
                Configura los nombres de las autoridades educativas. Estos datos se utilizarán para autocompletar las plantillas de documentos usando las variables correspondientes como <code>{`{SUPERVISOR}`}</code>, <code>{`{COORDINADOR_REGIONAL}`}</code>, <code>{`{DIRECTOR_NIVEL}`}</code> y <code>{`{ATP}`}</code>.
            </p>

            {message && (
                <div style={{
                    padding: "1rem",
                    marginBottom: "1.5rem",
                    borderRadius: "8px",
                    background: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    color: message.type === "success" ? "var(--success)" : "var(--danger)",
                    border: `1px solid ${message.type === "success" ? "var(--success)" : "var(--danger)"}`
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
                <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        Nombre del Supervisor(a) Escolar
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        value={config.supervisor}
                        onChange={(e) => setConfig({ ...config, supervisor: e.target.value })}
                        placeholder="Ej: Mtro. Juan Pérez"
                    />
                </div>

                <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        Nombre del Coordinador(a) Regional
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        value={config.coordinadorRegional}
                        onChange={(e) => setConfig({ ...config, coordinadorRegional: e.target.value })}
                        placeholder="Ej: Ing. María Gómez"
                    />
                </div>

                <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        Nombre del Director(a) del Nivel
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        value={config.directorNivel}
                        onChange={(e) => setConfig({ ...config, directorNivel: e.target.value })}
                        placeholder="Ej: Lic. Carlos Ruiz"
                    />
                </div>

                <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        Nombre del Asesor(a) Técnico Pedagógico (ATP)
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        value={config.atp}
                        onChange={(e) => setConfig({ ...config, atp: e.target.value })}
                        placeholder="Ej: Mtra. Ana Silva"
                    />
                </div>
            </div>

            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button 
                    className="btn btn-primary" 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                    <Save size={18} />
                    {saving ? "Guardando..." : "Guardar Configuración"}
                </button>
            </div>
        </div>
    );
}
