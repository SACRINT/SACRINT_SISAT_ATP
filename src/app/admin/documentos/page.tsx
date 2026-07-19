"use client";

import { useState, useEffect } from "react";
import PlantillaUploader from "./_componentes/PlantillaUploader";
import GeneradorConstancia from "./_componentes/GeneradorConstancia";
import AutoridadesConfigPanel from "./_componentes/AutoridadesConfigPanel";

interface Props {
    hasAccess?: (seccion: string, tipo?: "read" | "write") => boolean;
}

export default function DocumentosAdministrativosPage({ hasAccess = () => true }: Props) {
    const [activeTab, setActiveTab] = useState("generar");

    useEffect(() => {
        if (activeTab === "generar" && !hasAccess("documentos_generar")) {
            if (hasAccess("documentos_plantillas")) setActiveTab("plantillas");
            else if (hasAccess("documentos_autoridades")) setActiveTab("autoridades");
        } else if (activeTab === "plantillas" && !hasAccess("documentos_plantillas")) {
            if (hasAccess("documentos_generar")) setActiveTab("generar");
            else if (hasAccess("documentos_autoridades")) setActiveTab("autoridades");
        } else if (activeTab === "autoridades" && !hasAccess("documentos_autoridades")) {
            if (hasAccess("documentos_generar")) setActiveTab("generar");
            else if (hasAccess("documentos_plantillas")) setActiveTab("plantillas");
        }
    }, [activeTab, hasAccess]);

    return (
        <div style={{ padding: "1.5rem" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text)" }}>Documentos Administrativos</h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
                Genera constancias, oficios y reportes utilizando plantillas oficiales y expedientes.
            </p>

            <div className="tab-list">
                {hasAccess("documentos_generar") && (
                    <button
                        className={`tab-item ${activeTab === "generar" ? "active" : ""}`}
                        onClick={() => setActiveTab("generar")}
                    >
                        Generar Documento
                    </button>
                )}
                {hasAccess("documentos_plantillas") && (
                    <button
                        className={`tab-item ${activeTab === "plantillas" ? "active" : ""}`}
                        onClick={() => setActiveTab("plantillas")}
                    >
                        Gestión de Plantillas
                    </button>
                )}
                {hasAccess("documentos_autoridades") && (
                    <button
                        className={`tab-item ${activeTab === "autoridades" ? "active" : ""}`}
                        onClick={() => setActiveTab("autoridades")}
                    >
                        Autoridades Educativas
                    </button>
                )}
            </div>

            <div className="card fade-in" style={{ minHeight: "60vh" }}>
                {activeTab === "generar" && hasAccess("documentos_generar") && <GeneradorConstancia />}
                {activeTab === "plantillas" && hasAccess("documentos_plantillas") && <PlantillaUploader />}
                {activeTab === "autoridades" && hasAccess("documentos_autoridades") && <AutoridadesConfigPanel />}
            </div>
        </div>
    );
}
