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

            <div className="tab-list">
                <button
                    className={`tab-item ${activeTab === "generar" ? "active" : ""}`}
                    onClick={() => setActiveTab("generar")}
                >
                    Generar Documento
                </button>
                <button
                    className={`tab-item ${activeTab === "plantillas" ? "active" : ""}`}
                    onClick={() => setActiveTab("plantillas")}
                >
                    Gestión de Plantillas
                </button>
                <button
                    className={`tab-item ${activeTab === "autoridades" ? "active" : ""}`}
                    onClick={() => setActiveTab("autoridades")}
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
