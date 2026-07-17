"use client";

import { useState } from "react";
import PlantillaUploader from "./_componentes/PlantillaUploader";
import GeneradorConstancia from "./_componentes/GeneradorConstancia";

export default function DocumentosAdministrativosPage() {
    const [activeTab, setActiveTab] = useState("generar");

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Documentos Administrativos</h1>
            <p className="text-gray-600 mb-8">
                Genera constancias, oficios y reportes utilizando plantillas oficiales y expedientes.
            </p>

            <div className="flex border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab("generar")}
                    className={`py-2 px-4 font-semibold text-sm transition-colors ${
                        activeTab === "generar"
                            ? "border-b-2 border-blue-600 text-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    Generar Documento
                </button>
                <button
                    onClick={() => setActiveTab("plantillas")}
                    className={`py-2 px-4 font-semibold text-sm transition-colors ${
                        activeTab === "plantillas"
                            ? "border-b-2 border-blue-600 text-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    Gestión de Plantillas
                </button>
            </div>

            <div className="bg-white rounded-xl shadow p-6">
                {activeTab === "generar" && <GeneradorConstancia />}
                {activeTab === "plantillas" && <PlantillaUploader />}
            </div>
        </div>
    );
}
