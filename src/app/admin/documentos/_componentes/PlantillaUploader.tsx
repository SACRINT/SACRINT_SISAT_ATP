"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

type Plantilla = {
    id: string;
    nombre: string;
    archivoNombre: string;
    estado: string;
    configuracionCampos: any;
    createdAt: string;
};

export default function PlantillaUploader() {
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const [file, setFile] = useState<File | null>(null);
    const [nombre, setNombre] = useState("");
    
    // Modal para confirmación de IA
    const [plantillaRevisar, setPlantillaRevisar] = useState<Plantilla | null>(null);
    const [camposMapeados, setCamposMapeados] = useState<any[]>([]);

    useEffect(() => {
        cargarPlantillas();
    }, []);

    const cargarPlantillas = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/documentos/plantillas");
            const data = await res.json();
            setPlantillas(data);
        } catch (e) {
            toast.error("Error cargando plantillas");
        }
        setLoading(false);
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !nombre) {
            toast.error("Selecciona un archivo y ponle nombre");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("nombre", nombre);

        try {
            const res = await fetch("/api/admin/documentos/plantillas", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);

            if (data.message) {
                toast.success(data.message);
            } else {
                toast.success("Plantilla subida y analizada.");
            }

            // Si hay campos para revisar
            if (data.plantilla && data.plantilla.estado === "NUEVA" && data.plantilla.configuracionCampos?.length > 0) {
                setPlantillaRevisar(data.plantilla);
                setCamposMapeados(data.plantilla.configuracionCampos);
            }

            setFile(null);
            setNombre("");
            cargarPlantillas();
        } catch (e: any) {
            toast.error(e.message || "Error al subir");
        }
        setUploading(false);
    };

    const confirmarMapeo = async () => {
        if (!plantillaRevisar) return;
        
        try {
            const res = await fetch(`/api/admin/documentos/plantillas/${plantillaRevisar.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ configuracionCampos: camposMapeados, estado: "CONFIGURADA" })
            });

            if (!res.ok) throw new Error("Error guardando configuración");
            
            toast.success("Plantilla configurada correctamente");
            setPlantillaRevisar(null);
            cargarPlantillas();
        } catch (e) {
            toast.error("Ocurrió un error");
        }
    };

    const eliminarPlantilla = async (id: string) => {
        if (!confirm("¿Seguro que deseas eliminar esta plantilla?")) return;
        try {
            const res = await fetch(`/api/admin/documentos/plantillas/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error borrando");
            toast.success("Eliminada");
            cargarPlantillas();
        } catch (e) {
            toast.error("Ocurrió un error");
        }
    };

    const OpcionesCampos = [
        "NOMBRE_DIRECTOR", "RFC_DIRECTOR", "CURP_DIRECTOR", "FECHA_INGRESO_DIRECTOR",
        "CLAVE_PRESUPUESTAL_DIRECTOR", "TELEFONO_DIRECTOR", "CORREO_DIRECTOR",
        "NOMBRE_ESCUELA", "CCT_ESCUELA", "LOCALIDAD_ESCUELA", "MUNICIPIO_ESCUELA", "ZONA_ESCOLAR",
        "FECHA_ACTUAL", "OTRO"
    ];

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Subir Nueva Plantilla</h2>
            <form onSubmit={handleUpload} className="bg-gray-50 p-4 rounded-lg flex flex-col md:flex-row gap-4 mb-8">
                <input 
                    type="text" 
                    placeholder="Nombre (ej. Constancia No Adeudo)" 
                    className="border p-2 rounded flex-1"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                />
                <input 
                    type="file" 
                    accept=".docx" 
                    className="border p-2 rounded flex-1 bg-white"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button 
                    type="submit" 
                    disabled={uploading}
                    className="bg-blue-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-50"
                >
                    {uploading ? "Subiendo e IA Analizando..." : "Subir Plantilla"}
                </button>
            </form>

            <h2 className="text-xl font-bold mb-4">Plantillas Disponibles</h2>
            {loading ? <p>Cargando...</p> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border p-2 text-left">Nombre</th>
                                <th className="border p-2 text-left">Archivo</th>
                                <th className="border p-2 text-left">Estado</th>
                                <th className="border p-2 text-left">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plantillas.map(p => (
                                <tr key={p.id}>
                                    <td className="border p-2">{p.nombre}</td>
                                    <td className="border p-2 text-sm text-gray-500">{p.archivoNombre}</td>
                                    <td className="border p-2">
                                        <span className={`px-2 py-1 text-xs rounded-full ${p.estado === 'CONFIGURADA' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {p.estado}
                                        </span>
                                    </td>
                                    <td className="border p-2">
                                        {p.estado === 'NUEVA' && (
                                            <button 
                                                onClick={() => {
                                                    setPlantillaRevisar(p);
                                                    setCamposMapeados(p.configuracionCampos || []);
                                                }}
                                                className="text-blue-600 hover:underline mr-4"
                                            >
                                                Revisar Mapeo
                                            </button>
                                        )}
                                        <button onClick={() => eliminarPlantilla(p.id)} className="text-red-600 hover:underline">Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {plantillaRevisar && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold mb-2">Revisión de Campos por IA</h3>
                        <p className="text-gray-600 mb-6">La IA detectó las siguientes variables en la plantilla. Confirma o corrige el mapeo.</p>
                        
                        <div className="space-y-4 mb-6">
                            {camposMapeados.map((campo, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 border rounded bg-gray-50 items-center">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 uppercase">Texto en Documento</label>
                                        <p className="font-mono text-sm bg-gray-200 p-1 rounded inline-block">{campo.campoPlantilla}</p>
                                        <p className="text-xs text-gray-400 mt-1">{campo.explicacion}</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl">➔</p>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 uppercase">Campo del Sistema</label>
                                        <select 
                                            value={campo.sugerenciaSistema}
                                            onChange={(e) => {
                                                const newCampos = [...camposMapeados];
                                                newCampos[idx].sugerenciaSistema = e.target.value;
                                                setCamposMapeados(newCampos);
                                            }}
                                            className="w-full border p-2 rounded"
                                        >
                                            {OpcionesCampos.map(opc => (
                                                <option key={opc} value={opc}>{opc}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-4">
                            <button onClick={() => setPlantillaRevisar(null)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancelar</button>
                            <button onClick={confirmarMapeo} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Guardar y Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
