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
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text)" }}>Subir Nueva Plantilla</h2>
            <form onSubmit={handleUpload} style={{ background: "var(--bg-secondary, #f8fafc)", padding: "1.5rem", borderRadius: "var(--radius)", display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem", border: "1px solid var(--border)" }}>
                <input 
                    type="text" 
                    placeholder="Nombre (ej. Constancia No Adeudo)" 
                    className="form-control"
                    style={{ flex: "1 1 200px" }}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                />
                <input 
                    type="file" 
                    accept=".docx" 
                    className="form-control"
                    style={{ flex: "1 1 200px", background: "var(--surface)" }}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <button 
                    type="submit" 
                    disabled={uploading}
                    className="btn-primary"
                    style={{ flex: "0 1 auto", padding: "0.75rem 1.5rem", fontWeight: "bold", opacity: uploading ? 0.7 : 1 }}
                >
                    {uploading ? "Subiendo e IA Analizando..." : "Subir Plantilla"}
                </button>
            </form>

            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text)" }}>Plantillas Disponibles</h2>
            {loading ? <p style={{ color: "var(--text-muted)" }}>Cargando...</p> : (
                <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface)" }}>
                        <thead style={{ background: "var(--bg-secondary, #f8fafc)", borderBottom: "1px solid var(--border)" }}>
                            <tr>
                                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", color: "var(--text-secondary)" }}>Nombre</th>
                                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", color: "var(--text-secondary)" }}>Archivo</th>
                                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", color: "var(--text-secondary)" }}>Estado</th>
                                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", color: "var(--text-secondary)" }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plantillas.map(p => (
                                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "0.75rem", fontSize: "0.875rem", fontWeight: 500 }}>{p.nombre}</td>
                                    <td style={{ padding: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.archivoNombre}</td>
                                    <td style={{ padding: "0.75rem" }}>
                                        <span style={{ 
                                            padding: "0.25rem 0.75rem", 
                                            borderRadius: "9999px", 
                                            fontSize: "0.75rem", 
                                            fontWeight: 600,
                                            background: p.estado === 'CONFIGURADA' ? "var(--success-bg, #f0fdf4)" : "var(--warning-bg, #fffbeb)",
                                            color: p.estado === 'CONFIGURADA' ? "var(--success, #16a34a)" : "var(--warning, #d97706)"
                                        }}>
                                            {p.estado}
                                        </span>
                                    </td>
                                    <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>
                                        <button 
                                            onClick={() => {
                                                setPlantillaRevisar(p);
                                                setCamposMapeados(p.configuracionCampos || []);
                                            }}
                                            style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", marginRight: "1rem", fontWeight: 500, textDecoration: "underline" }}
                                        >
                                            {p.estado === 'NUEVA' ? 'Configurar Mapeo' : 'Editar Mapeo'}
                                        </button>
                                        <button onClick={() => eliminarPlantilla(p.id)} style={{ color: "var(--danger, #dc2626)", background: "none", border: "none", cursor: "pointer", fontWeight: 500, textDecoration: "underline" }}>Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {plantillaRevisar && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
                    <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: "2rem", width: "100%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" }}>
                        <h3 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text)" }}>Revisión de Campos por IA</h3>
                        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                            {camposMapeados.length > 0 
                                ? "La IA detectó las siguientes variables en la plantilla. Confirma o corrige el mapeo." 
                                : "No se detectaron variables automáticamente. Puedes agregarlas manualmente a continuación."}
                        </p>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
                            {camposMapeados.length === 0 && (
                                <div style={{ padding: "1.5rem", textAlign: "center", background: "var(--bg-secondary)", borderRadius: "8px", color: "var(--text-muted)" }}>
                                    No hay campos mapeados actualmente. Utiliza el botón de abajo para agregar las etiquetas que pusiste en tu documento (ej. {"{NOMBRE_DIRECTOR}"}).
                                </div>
                            )}
                            {camposMapeados.map((campo, idx) => (
                                <div key={idx} style={{ display: "flex", gap: "1rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg-secondary, #f8fafc)", alignItems: "center", flexWrap: "wrap", position: "relative" }}>
                                    <button 
                                        onClick={() => setCamposMapeados(camposMapeados.filter((_, i) => i !== idx))}
                                        style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1 }}
                                        title="Eliminar mapeo"
                                    >×</button>
                                    <div style={{ flex: "1 1 200px" }}>
                                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Texto en Documento</label>
                                        <input 
                                            type="text" 
                                            value={campo.campoPlantilla} 
                                            onChange={(e) => {
                                                const newCampos = [...camposMapeados];
                                                newCampos[idx].campoPlantilla = e.target.value;
                                                setCamposMapeados(newCampos);
                                            }}
                                            style={{ width: "100%", padding: "0.375rem 0.5rem", fontFamily: "monospace", fontSize: "0.875rem", border: "1px solid var(--border)", borderRadius: "4px" }}
                                            placeholder="Ej: {NOMBRE_DIRECTOR}"
                                        />
                                        {campo.explicacion && <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", margin: 0 }}>{campo.explicacion}</p>}
                                    </div>
                                    <div style={{ fontSize: "1.5rem", color: "var(--text-muted)", padding: "0 0.5rem" }}>➔</div>
                                    <div style={{ flex: "1 1 200px" }}>
                                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Campo del Sistema</label>
                                        <select 
                                            value={campo.sugerenciaSistema}
                                            onChange={(e) => {
                                                const newCampos = [...camposMapeados];
                                                newCampos[idx].sugerenciaSistema = e.target.value;
                                                setCamposMapeados(newCampos);
                                            }}
                                            className="form-control"
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {OpcionesCampos.map(opc => (
                                                <option key={opc} value={opc}>{opc}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                            <button 
                                onClick={() => setCamposMapeados([...camposMapeados, { campoPlantilla: "{NUEVO_CAMPO}", sugerenciaSistema: OpcionesCampos[0], explicacion: "Campo manual" }])}
                                style={{ padding: "0.5rem 1rem", border: "1px dashed var(--primary)", color: "var(--primary)", background: "transparent", borderRadius: "8px", cursor: "pointer", fontWeight: 600, alignSelf: "flex-start", marginTop: "0.5rem" }}
                            >
                                + Agregar Mapeo Manual
                            </button>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                            <button onClick={() => setPlantillaRevisar(null)} style={{ padding: "0.5rem 1rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                            <button onClick={confirmarMapeo} style={{ padding: "0.5rem 1rem", background: "var(--success, #16a34a)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600 }}>Guardar y Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
