"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

type Plantilla = { id: string; nombre: string; estado: string; configuracionCampos: any[] };
type Escuela = { id: string; cct: string; nombre: string; localidad: string; municipio: string; directorTexto: string; expediente: any };

export default function GeneradorConstancia() {
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [escuelas, setEscuelas] = useState<Escuela[]>([]);
    const [loading, setLoading] = useState(true);

    const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>("");
    const [escuelaSeleccionada, setEscuelaSeleccionada] = useState<string>("");

    const [datosFormulario, setDatosFormulario] = useState<any>({});
    const [faltantes, setFaltantes] = useState<string[]>([]);
    const [actualizarExpediente, setActualizarExpediente] = useState(false);
    const [generando, setGenerando] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch("/api/admin/documentos/plantillas").then(r => r.json()),
            fetch("/api/admin/directores").then(r => r.json())
        ]).then(([pts, escs]) => {
            setPlantillas(pts.filter((p: any) => p.estado === "CONFIGURADA"));
            setEscuelas(escs);
            setLoading(false);
        }).catch(() => {
            toast.error("Error cargando datos");
            setLoading(false);
        });
    }, []);

    // Re-evaluar campos al cambiar escuela o plantilla
    useEffect(() => {
        if (!plantillaSeleccionada || !escuelaSeleccionada) {
            setDatosFormulario({});
            setFaltantes([]);
            return;
        }

        const plantilla = plantillas.find(p => p.id === plantillaSeleccionada);
        const escuela = escuelas.find(e => e.id === escuelaSeleccionada);

        if (!plantilla || !escuela) return;

        const nuevosDatos: any = {};
        const nuevosFaltantes: string[] = [];

        plantilla.configuracionCampos.forEach((campo: any) => {
            const rawKey = campo.campoPlantilla || ""; // Ej: {NOMBRE_DIRECTOR}
            const key = rawKey.replace(/[{}]/g, '').trim(); // docxtemplater busca la llave sin los corchetes
            const sistema = campo.sugerenciaSistema;

            let valorExtraido = "";

            // Lógica de mapeo manual
            if (sistema === "NOMBRE_DIRECTOR") valorExtraido = escuela.expediente?.nombreCompleto || escuela.directorTexto || "";
            else if (sistema === "RFC_DIRECTOR") valorExtraido = escuela.expediente?.rfc || "";
            else if (sistema === "CURP_DIRECTOR") valorExtraido = escuela.expediente?.curp || "";
            else if (sistema === "FECHA_INGRESO_DIRECTOR") valorExtraido = escuela.expediente?.fechaIngreso ? dayjs(escuela.expediente.fechaIngreso).format("YYYY-MM-DD") : "";
            else if (sistema === "CLAVE_PRESUPUESTAL_DIRECTOR") valorExtraido = escuela.expediente?.clavePresupuestal || "";
            else if (sistema === "TELEFONO_DIRECTOR") valorExtraido = escuela.expediente?.telefono || "";
            else if (sistema === "CORREO_DIRECTOR") valorExtraido = escuela.expediente?.correo || "";
            else if (sistema === "NOMBRE_ESCUELA") valorExtraido = escuela.nombre || "";
            else if (sistema === "CCT_ESCUELA") valorExtraido = escuela.cct || "";
            else if (sistema === "LOCALIDAD_ESCUELA") valorExtraido = escuela.localidad || "";
            else if (sistema === "MUNICIPIO_ESCUELA") valorExtraido = escuela.municipio || "";
            else if (sistema === "FECHA_ACTUAL") valorExtraido = dayjs().format("DD/MM/YYYY");

            if (!valorExtraido && sistema !== "OTRO") {
                nuevosFaltantes.push(sistema);
            }

            nuevosDatos[key] = valorExtraido;
        });

        setDatosFormulario(nuevosDatos);
        setFaltantes(nuevosFaltantes);

    }, [plantillaSeleccionada, escuelaSeleccionada, plantillas, escuelas]);

    const handleGenerar = async () => {
        setGenerando(true);
        const escuela = escuelas.find(e => e.id === escuelaSeleccionada);

        try {
            const res = await fetch("/api/admin/documentos/generar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plantillaId: plantillaSeleccionada,
                    escuelaId: escuelaSeleccionada,
                    directorId: escuela?.expediente?.id || null, // Pasamos el expediente si existe
                    datosFinales: datosFormulario,
                    actualizarExpediente
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success("Documento Generado Exitosamente!");
            
            // Forzar descarga abriendo en nueva pestaña
            window.open(data.url, "_blank");

        } catch (e: any) {
            toast.error(e.message || "Error al generar documento");
        }
        setGenerando(false);
    };

    if (loading) return <p>Cargando información del sistema...</p>;

    const plantillaInfo = plantillas.find(p => p.id === plantillaSeleccionada);

    return (
        <div style={{ maxWidth: "800px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--text)" }}>Generador de Documentos</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
                <div>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                        Seleccionar Documento (Plantilla)
                    </label>
                    <select 
                        className="form-control"
                        value={plantillaSeleccionada} 
                        onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                    >
                        <option value="">-- Selecciona --</option>
                        {plantillas.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                        Seleccionar Escuela / Director
                    </label>
                    <select 
                        className="form-control"
                        value={escuelaSeleccionada} 
                        onChange={(e) => setEscuelaSeleccionada(e.target.value)}
                        disabled={!plantillaSeleccionada}
                    >
                        <option value="">-- Selecciona --</option>
                        {escuelas.map(e => (
                            <option key={e.id} value={e.id}>{e.cct} - {e.nombre} - Director: {e.directorTexto || "No especificado"}</option>
                        ))}
                    </select>
                </div>
            </div>

            {plantillaSeleccionada && escuelaSeleccionada && plantillaInfo && (
                <div style={{ background: "var(--bg-secondary, #f8fafc)", border: "1px solid var(--border)", padding: "1.5rem", borderRadius: "var(--radius)", marginBottom: "2rem" }}>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text)" }}>
                        Datos a insertar en: {plantillaInfo.nombre}
                    </h3>
                    
                    {faltantes.length > 0 && (
                        <div style={{ background: "var(--danger-bg, #fef2f2)", borderLeft: "4px solid var(--danger, #dc2626)", padding: "1rem", marginBottom: "1.5rem", color: "var(--danger, #dc2626)", borderRadius: "0 8px 8px 0" }}>
                            <p style={{ fontWeight: "bold", margin: "0 0 0.5rem 0" }}>⚠️ El expediente está incompleto.</p>
                            <p style={{ margin: 0 }}>Faltan los siguientes datos en el sistema para esta escuela/director:</p>
                            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem", marginBottom: "0.5rem" }}>
                                {faltantes.map(f => <li key={f}>{f}</li>)}
                            </ul>
                            <p style={{ margin: 0, fontSize: "0.875rem", fontStyle: "italic" }}>Puedes llenarlos manualmente a continuación. Si marcas la casilla de abajo, se guardarán permanentemente en su expediente.</p>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                        {plantillaInfo.configuracionCampos.map((campo: any, idx: number) => {
                            const key = campo.campoPlantilla;
                            const isMissing = !datosFormulario[key];
                            return (
                                <div key={idx} style={{ marginBottom: "0.5rem" }}>
                                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                                        {campo.sugerenciaSistema} 
                                        <span style={{ color: "var(--text-muted)", fontWeight: "normal", marginLeft: "0.5rem", textTransform: "lowercase" }}>({key})</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        className="form-control"
                                        style={{ borderColor: isMissing ? "var(--danger, #dc2626)" : "var(--border)", backgroundColor: isMissing ? "var(--danger-bg, #fef2f2)" : "var(--bg)" }}
                                        value={datosFormulario[key] || ""}
                                        onChange={(e) => {
                                            setDatosFormulario({...datosFormulario, [key]: e.target.value});
                                        }}
                                        placeholder={`Ingresa ${campo.sugerenciaSistema}...`}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input 
                            type="checkbox" 
                            id="actualizarExp" 
                            style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                            checked={actualizarExpediente}
                            onChange={(e) => setActualizarExpediente(e.target.checked)}
                        />
                        <label htmlFor="actualizarExp" style={{ fontSize: "0.875rem", color: "var(--text)", cursor: "pointer" }}>
                            Guardar estos datos en el expediente de la escuela y director de forma permanente
                        </label>
                    </div>

                    <button 
                        className="btn-primary"
                        onClick={handleGenerar}
                        disabled={generando}
                        style={{ marginTop: "1.5rem", width: "100%", padding: "0.75rem", fontWeight: "bold", opacity: generando ? 0.7 : 1 }}
                    >
                        {generando ? "Generando documento, por favor espera..." : "Generar y Descargar Constancia"}
                    </button>
                </div>
            )}
        </div>
    );
}
