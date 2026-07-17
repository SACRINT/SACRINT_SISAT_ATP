"use client";

import { useState, useEffect } from "react";
import { Save, UserCheck, ChevronDown, ChevronUp } from "lucide-react";

// Inlined BadgeIcon to avoid import errors
const BadgeIcon = ({ icon }: { icon: React.ReactNode }) => (
    <span style={{ display: "inline-flex", padding: "0.25rem", borderRadius: "4px", background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", marginRight: "0.5rem", verticalAlign: "middle" }}>
        {icon}
    </span>
);

export default function AutoridadesConfigPanel() {
    const [config, setConfig] = useState({
        supervisor: "",
        supervisorRFC: "",
        supervisorFecha: "",
        supervisorClave: "",
        coordinadorRegional: "",
        directorNivel: "",
        atp1Nombre: "",
        atp1RFC: "",
        atp1Fecha: "",
        atp1Clave: "",
        atp2Nombre: "",
        atp2RFC: "",
        atp2Fecha: "",
        atp2Clave: "",
        atp3Nombre: "",
        atp3RFC: "",
        atp3Fecha: "",
        atp3Clave: "",
        atp4Nombre: "",
        atp4RFC: "",
        atp4Fecha: "",
        atp4Clave: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Accordion states
    const [openSections, setOpenSections] = useState({
        supervisor: true,
        atp1: false,
        atp2: false,
        atp3: false,
        atp4: false,
        otros: true
    });

    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    useEffect(() => {
        fetch("/api/admin/autoridades-config")
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setConfig({
                        supervisor: data.supervisor || "",
                        supervisorRFC: data.supervisorRFC || "",
                        supervisorFecha: data.supervisorFecha || "",
                        supervisorClave: data.supervisorClave || "",
                        coordinadorRegional: data.coordinadorRegional || "",
                        directorNivel: data.directorNivel || "",
                        atp1Nombre: data.atp1Nombre || "",
                        atp1RFC: data.atp1RFC || "",
                        atp1Fecha: data.atp1Fecha || "",
                        atp1Clave: data.atp1Clave || "",
                        atp2Nombre: data.atp2Nombre || "",
                        atp2RFC: data.atp2RFC || "",
                        atp2Fecha: data.atp2Fecha || "",
                        atp2Clave: data.atp2Clave || "",
                        atp3Nombre: data.atp3Nombre || "",
                        atp3RFC: data.atp3RFC || "",
                        atp3Fecha: data.atp3Fecha || "",
                        atp3Clave: data.atp3Clave || "",
                        atp4Nombre: data.atp4Nombre || "",
                        atp4RFC: data.atp4RFC || "",
                        atp4Fecha: data.atp4Fecha || "",
                        atp4Clave: data.atp4Clave || "",
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

    const renderAccordionHeader = (title: string, sectionKey: keyof typeof openSections) => (
        <div 
            onClick={() => toggleSection(sectionKey)}
            style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                padding: "1rem", 
                background: "var(--bg)", 
                border: "1px solid var(--border)", 
                borderRadius: "8px", 
                cursor: "pointer",
                marginBottom: openSections[sectionKey] ? "1rem" : "1.5rem"
            }}
        >
            <h3 style={{ margin: 0, fontSize: "1rem" }}>{title}</h3>
            {openSections[sectionKey] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
    );

    return (
        <div className="card fade-in">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <UserCheck size={24} color="var(--primary)" />
                Autoridades Educativas
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
                Configura los nombres de las autoridades educativas y sus datos adicionales. Estos datos se utilizarán para autocompletar las plantillas de documentos usando las variables correspondientes como <code>{`{SUPERVISOR}`}</code>, <code>{`{ATP1_NOMBRE}`}</code>, <code>{`{SUPERVISOR_RFC}`}</code>, etc.
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

            {/* Supervisor Section */}
            {renderAccordionHeader("Supervisor(a) Escolar", "supervisor")}
            {openSections.supervisor && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem", padding: "0 1rem" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Nombre Completo ( Etiqueta: {'{SUPERVISOR}'} )</label>
                        <input type="text" className="form-control" value={config.supervisor} onChange={(e) => setConfig({ ...config, supervisor: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>RFC ( Etiqueta: {'{SUPERVISOR_RFC}'} )</label>
                        <input type="text" className="form-control" value={config.supervisorRFC} onChange={(e) => setConfig({ ...config, supervisorRFC: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Fecha de Ingreso ( Etiqueta: {'{SUPERVISOR_FECHA}'} )</label>
                        <input type="text" className="form-control" value={config.supervisorFecha} onChange={(e) => setConfig({ ...config, supervisorFecha: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Clave Presupuestal ( Etiqueta: {'{SUPERVISOR_CLAVE}'} )</label>
                        <input type="text" className="form-control" value={config.supervisorClave} onChange={(e) => setConfig({ ...config, supervisorClave: e.target.value })} />
                    </div>
                </div>
            )}

            {/* ATP 1 */}
            {renderAccordionHeader("Asesor Técnico Pedagógico 1", "atp1")}
            {openSections.atp1 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem", padding: "0 1rem" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Nombre Completo ( Etiqueta: {'{ATP1_NOMBRE}'} )</label>
                        <input type="text" className="form-control" value={config.atp1Nombre} onChange={(e) => setConfig({ ...config, atp1Nombre: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>RFC ( Etiqueta: {'{ATP1_RFC}'} )</label>
                        <input type="text" className="form-control" value={config.atp1RFC} onChange={(e) => setConfig({ ...config, atp1RFC: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Fecha de Ingreso ( Etiqueta: {'{ATP1_FECHA}'} )</label>
                        <input type="text" className="form-control" value={config.atp1Fecha} onChange={(e) => setConfig({ ...config, atp1Fecha: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Clave Presupuestal ( Etiqueta: {'{ATP1_CLAVE}'} )</label>
                        <input type="text" className="form-control" value={config.atp1Clave} onChange={(e) => setConfig({ ...config, atp1Clave: e.target.value })} />
                    </div>
                </div>
            )}

            {/* ATP 2 */}
            {renderAccordionHeader("Asesor Técnico Pedagógico 2", "atp2")}
            {openSections.atp2 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem", padding: "0 1rem" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Nombre Completo ( Etiqueta: {'{ATP2_NOMBRE}'} )</label>
                        <input type="text" className="form-control" value={config.atp2Nombre} onChange={(e) => setConfig({ ...config, atp2Nombre: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>RFC ( Etiqueta: {'{ATP2_RFC}'} )</label>
                        <input type="text" className="form-control" value={config.atp2RFC} onChange={(e) => setConfig({ ...config, atp2RFC: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Fecha de Ingreso ( Etiqueta: {'{ATP2_FECHA}'} )</label>
                        <input type="text" className="form-control" value={config.atp2Fecha} onChange={(e) => setConfig({ ...config, atp2Fecha: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Clave Presupuestal ( Etiqueta: {'{ATP2_CLAVE}'} )</label>
                        <input type="text" className="form-control" value={config.atp2Clave} onChange={(e) => setConfig({ ...config, atp2Clave: e.target.value })} />
                    </div>
                </div>
            )}

            {/* ATP 3 */}
            {renderAccordionHeader("Asesor Técnico Pedagógico 3", "atp3")}
            {openSections.atp3 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem", padding: "0 1rem" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Nombre Completo ( Etiqueta: {'{ATP3_NOMBRE}'} )</label>
                        <input type="text" className="form-control" value={config.atp3Nombre} onChange={(e) => setConfig({ ...config, atp3Nombre: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>RFC ( Etiqueta: {'{ATP3_RFC}'} )</label>
                        <input type="text" className="form-control" value={config.atp3RFC} onChange={(e) => setConfig({ ...config, atp3RFC: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Fecha de Ingreso ( Etiqueta: {'{ATP3_FECHA}'} )</label>
                        <input type="text" className="form-control" value={config.atp3Fecha} onChange={(e) => setConfig({ ...config, atp3Fecha: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Clave Presupuestal ( Etiqueta: {'{ATP3_CLAVE}'} )</label>
                        <input type="text" className="form-control" value={config.atp3Clave} onChange={(e) => setConfig({ ...config, atp3Clave: e.target.value })} />
                    </div>
                </div>
            )}

            {/* ATP 4 */}
            {renderAccordionHeader("Asesor Técnico Pedagógico 4", "atp4")}
            {openSections.atp4 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem", padding: "0 1rem" }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Nombre Completo ( Etiqueta: {'{ATP4_NOMBRE}'} )</label>
                        <input type="text" className="form-control" value={config.atp4Nombre} onChange={(e) => setConfig({ ...config, atp4Nombre: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>RFC ( Etiqueta: {'{ATP4_RFC}'} )</label>
                        <input type="text" className="form-control" value={config.atp4RFC} onChange={(e) => setConfig({ ...config, atp4RFC: e.target.value })} />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Fecha de Ingreso ( Etiqueta: {'{ATP4_FECHA}'} )</label>
                        <input type="text" className="form-control" value={config.atp4Fecha} onChange={(e) => setConfig({ ...config, atp4Fecha: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Clave Presupuestal ( Etiqueta: {'{ATP4_CLAVE}'} )</label>
                        <input type="text" className="form-control" value={config.atp4Clave} onChange={(e) => setConfig({ ...config, atp4Clave: e.target.value })} />
                    </div>
                </div>
            )}

            {/* Otras Autoridades */}
            {renderAccordionHeader("Otras Autoridades", "otros")}
            {openSections.otros && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem", marginBottom: "2rem", padding: "0 1rem" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Nombre del Coordinador(a) Regional ( Etiqueta: {'{COORDINADOR_REGIONAL}'} )
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
                            Nombre del Director(a) del Nivel ( Etiqueta: {'{DIRECTOR_NIVEL}'} )
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            value={config.directorNivel}
                            onChange={(e) => setConfig({ ...config, directorNivel: e.target.value })}
                            placeholder="Ej: Lic. Carlos Ruiz"
                        />
                    </div>
                </div>
            )}

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
