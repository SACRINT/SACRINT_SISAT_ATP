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
            const key = campo.campoPlantilla; // Ej: {NOMBRE_DIRECTOR}
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
        <div className="max-w-4xl">
            <h2 className="text-xl font-bold mb-6">Generador de Documentos</h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="block text-sm font-semibold mb-2">Seleccionar Documento (Plantilla)</label>
                    <select 
                        className="w-full border p-2 rounded" 
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
                    <label className="block text-sm font-semibold mb-2">Seleccionar Escuela / Director</label>
                    <select 
                        className="w-full border p-2 rounded" 
                        value={escuelaSeleccionada} 
                        onChange={(e) => setEscuelaSeleccionada(e.target.value)}
                        disabled={!plantillaSeleccionada}
                    >
                        <option value="">-- Selecciona --</option>
                        {escuelas.map(e => (
                            <option key={e.id} value={e.id}>{e.cct} - {e.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            {plantillaSeleccionada && escuelaSeleccionada && plantillaInfo && (
                <div className="bg-gray-50 border p-6 rounded-lg mb-8">
                    <h3 className="text-lg font-bold mb-4">Datos a insertar en: {plantillaInfo.nombre}</h3>
                    
                    {faltantes.length > 0 && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
                            <p className="font-bold">⚠️ El expediente está incompleto.</p>
                            <p>Faltan los siguientes datos en el sistema para esta escuela/director:</p>
                            <ul className="list-disc ml-5 mt-2">
                                {faltantes.map(f => <li key={f}>{f}</li>)}
                            </ul>
                            <p className="mt-2 text-sm italic">Puedes llenarlos manualmente a continuación. Si marcas la casilla de abajo, se guardarán permanentemente en su expediente.</p>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                        {plantillaInfo.configuracionCampos.map((campo: any, idx: number) => {
                            const key = campo.campoPlantilla;
                            const isMissing = !datosFormulario[key];
                            return (
                                <div key={idx} className="mb-2">
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        {campo.sugerenciaSistema} 
                                        <span className="text-gray-400 font-normal ml-2 lowercase">({key})</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        className={`w-full border p-2 rounded focus:outline-none focus:ring-2 ${isMissing ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
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

                    <div className="mt-6 flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="actualizarExp" 
                            className="w-4 h-4 text-blue-600"
                            checked={actualizarExpediente}
                            onChange={(e) => setActualizarExpediente(e.target.checked)}
                        />
                        <label htmlFor="actualizarExp" className="text-sm font-semibold text-gray-700 cursor-pointer">
                            Actualizar expediente permanentemente con estos datos
                        </label>
                    </div>
                </div>
            )}

            {plantillaSeleccionada && escuelaSeleccionada && (
                <div className="flex justify-end border-t pt-6">
                    <button 
                        onClick={handleGenerar}
                        disabled={generando}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-colors disabled:opacity-50"
                    >
                        {generando ? "Generando Documento..." : "📥 Generar y Descargar Constancia (Word)"}
                    </button>
                </div>
            )}
        </div>
    );
}
