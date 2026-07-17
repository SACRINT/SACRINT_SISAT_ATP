"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import { FileText, AlertTriangle, Key } from "lucide-react";

type Plantilla = { id: string; nombre: string; estado: string; configuracionCampos: any[] };
type Personal = { id: string; nombre: string; apellidoPaterno: string; apellidoMaterno: string; cargo: string; curp: string; rfc: string; telefono: string; correoElectronico: string; fechaIngreso: string };

export default function DocumentosPanel({ escuela, hasApiKey }: { escuela: any, hasApiKey: boolean }) {
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [personalList, setPersonalList] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);

    const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>("");
    const [personalSeleccionado, setPersonalSeleccionado] = useState<string>("");

    const [datosFormulario, setDatosFormulario] = useState<any>({});
    const [faltantes, setFaltantes] = useState<string[]>([]);
    const [actualizarExpediente, setActualizarExpediente] = useState(false);
    const [generando, setGenerando] = useState(false);

    useEffect(() => {
        if (!hasApiKey) {
            setLoading(false);
            return;
        }

        Promise.all([
            fetch("/api/admin/documentos/plantillas").then(r => r.json()), // The director can read templates from the same endpoint if we allow it, wait, the admin endpoint blocks non-admins!
            // We need a specific endpoint for directors to list templates. I will assume we should create one or just use a generic one. Let's fix that next.
            fetch(`/api/personal?escuelaId=${escuela.id}`).then(r => r.json()) 
        ]).then(([pts, per]) => {
            // Note: We need a public/director-facing endpoint for templates if the admin one blocks.
            // For now, assume we will create `/api/director/documentos/plantillas`
            setPersonalList(per || []);
            setLoading(false);
        }).catch(() => {
            toast.error("Error cargando datos");
            setLoading(false);
        });
    }, [hasApiKey, escuela.id]);

    useEffect(() => {
        if (hasApiKey) {
            fetch("/api/director/documentos/plantillas")
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data)) setPlantillas(data.filter(p => p.estado === "CONFIGURADA"));
                })
                .catch(() => console.error("Error cargando plantillas"));
        }
    }, [hasApiKey]);

    useEffect(() => {
        if (!plantillaSeleccionada || !personalSeleccionado) {
            setDatosFormulario({});
            setFaltantes([]);
            return;
        }

        const plantilla = plantillas.find(p => p.id === plantillaSeleccionada);
        const personal = personalList.find(p => p.id === personalSeleccionado);

        if (!plantilla || !personal) return;

        const nuevosDatos: any = {};
        const nuevosFaltantes: string[] = [];

        plantilla.configuracionCampos.forEach((campo: any) => {
            const key = campo.campoPlantilla;
            const sistema = campo.sugerenciaSistema;

            let valorExtraido = "";

            if (sistema === "NOMBRE_PERSONAL" || sistema === "NOMBRE_DIRECTOR") 
                valorExtraido = `${personal.nombre} ${personal.apellidoPaterno} ${personal.apellidoMaterno}`;
            else if (sistema === "RFC_PERSONAL" || sistema === "RFC_DIRECTOR") valorExtraido = personal.rfc || "";
            else if (sistema === "CURP_PERSONAL" || sistema === "CURP_DIRECTOR") valorExtraido = personal.curp || "";
            else if (sistema === "FECHA_INGRESO_PERSONAL" || sistema === "FECHA_INGRESO_DIRECTOR") 
                valorExtraido = personal.fechaIngreso ? dayjs(personal.fechaIngreso).format("YYYY-MM-DD") : "";
            else if (sistema === "TELEFONO_PERSONAL" || sistema === "TELEFONO_DIRECTOR") valorExtraido = personal.telefono || "";
            else if (sistema === "CORREO_PERSONAL" || sistema === "CORREO_DIRECTOR") valorExtraido = personal.correoElectronico || "";
            else if (sistema === "CARGO_PERSONAL") valorExtraido = personal.cargo || "";
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

    }, [plantillaSeleccionada, personalSeleccionado, plantillas, personalList]);

    const handleGenerar = async () => {
        setGenerando(true);
        try {
            const res = await fetch("/api/director/documentos/generar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plantillaId: plantillaSeleccionada,
                    personalId: personalSeleccionado,
                    datosFinales: datosFormulario,
                    actualizarExpediente
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success("Documento Generado Exitosamente!");
            window.open(data.url, "_blank");
        } catch (e: any) {
            toast.error(e.message || "Error al generar documento");
        }
        setGenerando(false);
    };

    if (!hasApiKey) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="bg-orange-100 p-4 rounded-full mb-4">
                    <Key size={48} className="text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">API Key Requerida</h2>
                <p className="text-gray-600 max-w-md">
                    Para utilizar el generador automático de constancias, debes configurar primero tu <strong>API Key de Gemini</strong> en la pestaña de Ajustes de API.
                </p>
            </div>
        );
    }

    if (loading) return <p>Cargando información del sistema...</p>;

    const plantillaInfo = plantillas.find(p => p.id === plantillaSeleccionada);

    return (
        <div className="max-w-4xl p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-blue-600" /> Generador de Constancias
                </h2>
                <p className="text-gray-600 mt-1">Genera documentos oficiales para tu personal basándote en sus expedientes.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">1. Seleccionar Plantilla</label>
                    <select 
                        className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">2. Seleccionar Personal</label>
                    <select 
                        className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                        value={personalSeleccionado} 
                        onChange={(e) => setPersonalSeleccionado(e.target.value)}
                        disabled={!plantillaSeleccionada}
                    >
                        <option value="">-- Selecciona miembro del personal --</option>
                        {personalList.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre} {p.apellidoPaterno} {p.apellidoMaterno} ({p.cargo})</option>
                        ))}
                    </select>
                </div>
            </div>

            {plantillaSeleccionada && personalSeleccionado && plantillaInfo && (
                <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl mb-8">
                    <h3 className="text-lg font-bold text-blue-900 mb-4">Verificación de Datos</h3>
                    
                    {faltantes.length > 0 && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-lg flex items-start gap-3">
                            <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="font-bold">Expediente incompleto</p>
                                <p className="text-sm mt-1">Faltan los siguientes datos en el expediente de esta persona para generar el documento correctamente:</p>
                                <ul className="list-disc ml-5 mt-2 text-sm font-medium">
                                    {faltantes.map(f => <li key={f}>{f}</li>)}
                                </ul>
                                <p className="mt-2 text-xs opacity-90">Puedes rellenarlos manualmente abajo. Marca la casilla para guardarlos permanentemente.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                        {plantillaInfo.configuracionCampos.map((campo: any, idx: number) => {
                            const key = campo.campoPlantilla;
                            const isMissing = !datosFormulario[key];
                            return (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 truncate" title={campo.sugerenciaSistema}>
                                        {campo.sugerenciaSistema.replace("_DIRECTOR", "").replace("_PERSONAL", "")}
                                    </label>
                                    <input 
                                        type="text" 
                                        className={`w-full border-b-2 bg-transparent p-1 focus:outline-none transition-colors ${isMissing ? 'border-red-400 text-red-900 placeholder-red-300' : 'border-gray-300 focus:border-blue-500'}`}
                                        value={datosFormulario[key] || ""}
                                        onChange={(e) => {
                                            setDatosFormulario({...datosFormulario, [key]: e.target.value});
                                        }}
                                        placeholder={`Falta dato...`}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
                        <input 
                            type="checkbox" 
                            id="actualizarExp" 
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            checked={actualizarExpediente}
                            onChange={(e) => setActualizarExpediente(e.target.checked)}
                        />
                        <label htmlFor="actualizarExp" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                            Guardar los cambios permanentemente en el Expediente de Personal
                        </label>
                    </div>
                </div>
            )}

            {plantillaSeleccionada && personalSeleccionado && (
                <div className="flex justify-end pt-4 border-t">
                    <button 
                        onClick={handleGenerar}
                        disabled={generando}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {generando ? (
                            <>Generando... </>
                        ) : (
                            <>📥 Descargar Documento (Word)</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
