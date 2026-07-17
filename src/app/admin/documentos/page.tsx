"use client";

import { useState } from "react";
import PlantillaUploader from "./_componentes/PlantillaUploader";
import GeneradorConstancia from "./_componentes/GeneradorConstancia";
import AutoridadesConfigPanel from "./_componentes/AutoridadesConfigPanel";

export default function DocumentosAdministrativosPage() {
    const [activeTab, setActiveTab] = useState("generar");

    return (
        <div style={{ padding: "1.5rem" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text)" }}>Documentos Administrativos</h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
                Genera constancias, oficios y reportes utilizando plantillas oficiales y expedientes.
            </p>

            <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", marginBottom: "2rem", paddingBottom: "0" }}>
                <button
                    onClick={() => setActiveTab("generar")}
                    style={{
                        padding: "0.75rem 1.25rem",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        background: activeTab === "generar" ? "var(--bg-secondary, #f8fafc)" : "none",
                        border: "1px solid",
                        borderColor: activeTab === "generar" ? "var(--border) var(--border) transparent" : "transparent",
                        borderRadius: "8px 8px 0 0",
                        marginBottom: "-1px",
                        color: activeTab === "generar" ? "var(--primary)" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    Generar Documento
                </button>
                <button
                    onClick={() => setActiveTab("plantillas")}
                    style={{
                        padding: "0.75rem 1.25rem",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        background: activeTab === "plantillas" ? "var(--bg-secondary, #f8fafc)" : "none",
                        border: "1px solid",
                        borderColor: activeTab === "plantillas" ? "var(--border) var(--border) transparent" : "transparent",
                        borderRadius: "8px 8px 0 0",
                        marginBottom: "-1px",
                        color: activeTab === "plantillas" ? "var(--primary)" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    Gestión de Plantillas
                </button>
                <button
                    onClick={() => setActiveTab("autoridades")}
                    style={{
                        padding: "0.75rem 1.25rem",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        background: activeTab === "autoridades" ? "var(--bg-secondary, #f8fafc)" : "none",
                        border: "1px solid",
                        borderColor: activeTab === "autoridades" ? "var(--border) var(--border) transparent" : "transparent",
                        borderRadius: "8px 8px 0 0",
                        marginBottom: "-1px",
                        color: activeTab === "autoridades" ? "var(--primary)" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    Autoridades Educativas
                </button>
            </div>

            <div className="card fade-in" style={{ minHeight: "60vh" }}>
                {activeTab === "generar" && <GeneradorConstancia />}
                {activeTab === "plantillas" && <PlantillaUploader />}
                {activeTab === "autoridades" && <AutoridadesConfigPanel />}
            </div>
        </div>
    );
}
