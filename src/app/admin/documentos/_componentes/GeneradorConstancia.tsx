"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";

type Plantilla = { id: string; nombre: string; estado: string; configuracionCampos: any[]; tiposDestinatario: string[] };
type Escuela = { id: string; cct: string; nombre: string; localidad: string; municipio: string; zonaEscolar?: string; directorTexto: string; directorExpediente: any; personal?: any[]; esSupervision?: boolean };

export default function GeneradorConstancia() {
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [escuelas, setEscuelas] = useState<Escuela[]>([]);
    const [autoridades, setAutoridades] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>("");
    const [tipoDestinatario, setTipoDestinatario] = useState<"DIRECTOR" | "PERSONAL" | "ATP">("DIRECTOR");
    const [escuelaSeleccionada, setEscuelaSeleccionada] = useState<string>("");
    const [personalSeleccionado, setPersonalSeleccionado] = useState<string>("");
    const [atpSeleccionado, setAtpSeleccionado] = useState<string>("");

    const [datosFormulario, setDatosFormulario] = useState<any>({});
    const [faltantes, setFaltantes] = useState<string[]>([]);
    const [actualizarExpediente, setActualizarExpediente] = useState(false);
    const [generando, setGenerando] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch("/api/admin/documentos/plantillas").then(r => r.json()),
            fetch("/api/admin/directores").then(r => r.json()),
            fetch("/api/admin/autoridades-config").then(r => r.json())
        ]).then(([pts, escs, auts]) => {
            setPlantillas(pts.filter((p: any) => p.estado === "CONFIGURADA"));
            setEscuelas(escs);
            setAutoridades(auts);
            setLoading(false);
        }).catch(() => {
            toast.error("Error cargando datos");
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (!plantillaSeleccionada) {
            setDatosFormulario({});
            setFaltantes([]);
            return;
        }

        if ((tipoDestinatario === "DIRECTOR" || tipoDestinatario === "PERSONAL") && !escuelaSeleccionada) {
             setDatosFormulario({});
             setFaltantes([]);
             return;
        }

        if (tipoDestinatario === "PERSONAL" && !personalSeleccionado) {
             setDatosFormulario({});
             setFaltantes([]);
             return;
        }
        
        if (tipoDestinatario === "ATP" && !atpSeleccionado) {
             setDatosFormulario({});
             setFaltantes([]);
             return;
        }

        const plantilla = plantillas.find(p => p.id === plantillaSeleccionada);
        if (!plantilla) return;

        let escuela = escuelas.find(e => e.id === escuelaSeleccionada);
        if (tipoDestinatario === "ATP") {
            escuela = escuelas.find(e => e.esSupervision);
        }
        const nuevosDatos: any = {};
        const nuevosFaltantes: string[] = [];

        // Determinar qué persona usar
        let personData: any = null;
        if (tipoDestinatario === "DIRECTOR" && escuela) {
            personData = escuela.directorExpediente || { nombreCompleto: escuela.directorTexto };
        } else if (tipoDestinatario === "PERSONAL" && escuela) {
            const p = escuela.personal?.find(x => x.id === personalSeleccionado);
            if (p) {
                personData = {
                    id: p.id,
                    nombreCompleto: `${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno}`.trim(),
                    rfc: p.rfc,
                    curp: p.curp,
                    fechaIngreso: p.fechaIngreso,
                    telefono: p.telefono,
                    correo: p.correoElectronico,
                    clavePresupuestal: p.clavePresupuestal
                };
            }
        } else if (tipoDestinatario === "ATP" && autoridades) {
            if (atpSeleccionado === "atp1") {
                 personData = { nombreCompleto: autoridades.atp1Nombre, rfc: autoridades.atp1RFC, fechaIngreso: autoridades.atp1Fecha, clavePresupuestal: autoridades.atp1Clave };
            } else if (atpSeleccionado === "atp2") {
                 personData = { nombreCompleto: autoridades.atp2Nombre, rfc: autoridades.atp2RFC, fechaIngreso: autoridades.atp2Fecha, clavePresupuestal: autoridades.atp2Clave };
            } else if (atpSeleccionado === "atp3") {
                 personData = { nombreCompleto: autoridades.atp3Nombre, rfc: autoridades.atp3RFC, fechaIngreso: autoridades.atp3Fecha, clavePresupuestal: autoridades.atp3Clave };
            } else if (atpSeleccionado === "atp4") {
                 personData = { nombreCompleto: autoridades.atp4Nombre, rfc: autoridades.atp4RFC, fechaIngreso: autoridades.atp4Fecha, clavePresupuestal: autoridades.atp4Clave };
            }
        }

        plantilla.configuracionCampos.forEach((campo: any) => {
            const rawKey = campo.campoPlantilla || ""; 
            const key = rawKey.replace(/[{}]/g, '').trim();
            const sistema = campo.sugerenciaSistema;

            let valorExtraido = "";

            if (sistema === "NOMBRE_DIRECTOR") valorExtraido = personData?.nombreCompleto || "";
            else if (sistema === "RFC_DIRECTOR") valorExtraido = personData?.rfc || "";
            else if (sistema === "CURP_DIRECTOR") valorExtraido = personData?.curp || "";
            else if (sistema === "FECHA_INGRESO_DIRECTOR") valorExtraido = personData?.fechaIngreso ? dayjs(personData.fechaIngreso).format("YYYY-MM-DD") : "";
            else if (sistema === "CLAVE_PRESUPUESTAL_DIRECTOR") valorExtraido = personData?.clavePresupuestal || "";
            else if (sistema === "TELEFONO_DIRECTOR") valorExtraido = personData?.telefono || "";
            else if (sistema === "CORREO_DIRECTOR") valorExtraido = personData?.correo || "";
            else if (sistema === "NOMBRE_ESCUELA") valorExtraido = escuela?.nombre || "";
            else if (sistema === "CCT_ESCUELA") valorExtraido = escuela?.cct || "";
            else if (sistema === "LOCALIDAD_ESCUELA") valorExtraido = escuela?.localidad || "";
            else if (sistema === "MUNICIPIO_ESCUELA") valorExtraido = escuela?.municipio || "";
            else if (sistema === "ZONA_ESCOLAR") valorExtraido = escuela?.zonaEscolar || "";
            else if (sistema === "FECHA_ACTUAL") valorExtraido = dayjs().format("DD/MM/YYYY");

            if (!valorExtraido && sistema !== "OTRO") {
                nuevosFaltantes.push(sistema);
            }

            nuevosDatos[key] = (typeof valorExtraido === "string") ? valorExtraido.toUpperCase() : valorExtraido;
        });

        setDatosFormulario(nuevosDatos);
        setFaltantes(nuevosFaltantes);

    }, [plantillaSeleccionada, escuelaSeleccionada, plantillas, escuelas, personalSeleccionado, atpSeleccionado, tipoDestinatario, autoridades]);

    const handleGenerar = async () => {
        setGenerando(true);
        const escuela = escuelas.find(e => e.id === escuelaSeleccionada);

        try {
            const res = await fetch("/api/admin/documentos/generar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plantillaId: plantillaSeleccionada,
                    escuelaId: escuelaSeleccionada || escuela?.id || null, // Pasamos id de supervision si es ATP
                    directorId: escuela?.directorExpediente?.id || null, // Pasamos el expediente si existe
                    datosFinales: datosFormulario,
                    actualizarExpediente
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success("Documento Generado Exitosamente!");

            // Descargar el archivo con el nombre correcto (incluyendo .docx)
            const nombreArchivo = data.fileName || `${data.historial?.id || "constancia"}.docx`;
            const resp = await fetch(data.url);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = nombreArchivo.endsWith(".docx") ? nombreArchivo : `${nombreArchivo}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

        } catch (e: any) {
            toast.error(e.message || "Error al generar documento");
        }
        setGenerando(false);
    };

    if (loading) return <p>Cargando información del sistema...</p>;

    const plantillaInfo = plantillas.find(p => p.id === plantillaSeleccionada);

    // Filtrar plantillas según el tipo de destinatario seleccionado
    const plantillasFiltradas = plantillas.filter(p =>
        !p.tiposDestinatario || p.tiposDestinatario.length === 0 || p.tiposDestinatario.includes(tipoDestinatario)
    );

    return (
        <div style={{ maxWidth: "800px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--text)" }}>Generador de Documentos</h2>

            {/* ── Paso 1: Tipo de Destinatario ── */}
            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "var(--bg-secondary, #f8fafc)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Paso 1 — ¿Para quién es la constancia?
                </label>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {[
                        { valor: "DIRECTOR", etiqueta: "👤 Director(a) de Escuela" },
                        { valor: "PERSONAL", etiqueta: "📋 Personal de Escuela" },
                        { valor: "ATP",      etiqueta: "🧑‍🏫 ATP (Zona)" },
                    ].map(({ valor, etiqueta }) => {
                        const activo = tipoDestinatario === valor;
                        return (
                            <button
                                key={valor}
                                type="button"
                                onClick={() => {
                                    setTipoDestinatario(valor as any);
                                    setPlantillaSeleccionada("");
                                    setEscuelaSeleccionada("");
                                    setPersonalSeleccionado("");
                                    setAtpSeleccionado("");
                                }}
                                style={{
                                    padding: "0.625rem 1.125rem",
                                    border: `2px solid ${activo ? "var(--primary)" : "var(--border)"}`,
                                    borderRadius: "8px", cursor: "pointer",
                                    background: activo ? "var(--primary)" : "var(--surface)",
                                    color: activo ? "white" : "var(--text-secondary)",
                                    fontWeight: activo ? 700 : 400,
                                    fontSize: "0.875rem",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {etiqueta}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
                {/* ── Paso 2: Plantilla (filtrada por tipo) ── */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                        Paso 2 — Seleccionar Documento (Plantilla)
                    </label>
                    {plantillasFiltradas.length === 0 ? (
                        <div style={{ padding: "0.75rem", background: "var(--warning-bg, #fffbeb)", border: "1px solid var(--warning, #f59e0b)", borderRadius: "8px", color: "var(--warning-text, #b45309)", fontSize: "0.875rem" }}>
                            ⚠️ No hay plantillas configuradas para <strong>{tipoDestinatario}</strong>. Sube una en la pestaña <strong>Gestión de Plantillas</strong> y asígnale este tipo.
                        </div>
                    ) : (
                        <select
                            className="form-control"
                            value={plantillaSeleccionada}
                            onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                        >
                            <option value="">-- Selecciona una plantilla --</option>
                            {plantillasFiltradas.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* ── Paso 3: Selección de persona ── */}
                {(tipoDestinatario === "DIRECTOR" || tipoDestinatario === "PERSONAL") && (
                    <div>
                        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                            Paso 3 — Seleccionar Escuela / Centro de Trabajo
                        </label>
                        <select
                            className="form-control"
                            value={escuelaSeleccionada}
                            onChange={(e) => {
                                setEscuelaSeleccionada(e.target.value);
                                setPersonalSeleccionado("");
                            }}
                            disabled={!plantillaSeleccionada}
                        >
                            <option value="">-- Selecciona --</option>
                            {escuelas.map(e => (
                                <option key={e.id} value={e.id}>{e.cct} - {e.nombre}</option>
                            ))}
                        </select>
                    </div>
                )}

                {tipoDestinatario === "PERSONAL" && escuelaSeleccionada && (
                    <div>
                        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                            Seleccionar Personal
                        </label>
                        <select
                            className="form-control"
                            value={personalSeleccionado}
                            onChange={(e) => setPersonalSeleccionado(e.target.value)}
                        >
                            <option value="">-- Selecciona --</option>
                            {escuelas.find(e => e.id === escuelaSeleccionada)?.personal?.map(p => (
                                <option key={p.id} value={p.id}>{p.cargo}: {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}</option>
                            ))}
                        </select>
                    </div>
                )}

                {tipoDestinatario === "ATP" && (
                    <div>
                        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                            Seleccionar ATP
                        </label>
                        <select
                            className="form-control"
                            value={atpSeleccionado}
                            onChange={(e) => setAtpSeleccionado(e.target.value)}
                            disabled={!plantillaSeleccionada || !autoridades}
                        >
                            <option value="">-- Selecciona --</option>
                            {autoridades?.atp1Nombre && <option value="atp1">{autoridades.atp1Nombre}</option>}
                            {autoridades?.atp2Nombre && <option value="atp2">{autoridades.atp2Nombre}</option>}
                            {autoridades?.atp3Nombre && <option value="atp3">{autoridades.atp3Nombre}</option>}
                            {autoridades?.atp4Nombre && <option value="atp4">{autoridades.atp4Nombre}</option>}
                        </select>
                    </div>
                )}
            </div>

            {(
                plantillaSeleccionada && plantillaInfo &&
                ((tipoDestinatario === "DIRECTOR" && escuelaSeleccionada) || 
                 (tipoDestinatario === "PERSONAL" && escuelaSeleccionada && personalSeleccionado) || 
                 (tipoDestinatario === "ATP" && atpSeleccionado))
            ) && (
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

                    {plantillaInfo.configuracionCampos.length === 0 ? (
                        <div style={{ background: "var(--warning-bg, #fffbeb)", borderLeft: "4px solid var(--warning, #f59e0b)", padding: "1rem", marginBottom: "1.5rem", color: "var(--warning-text, #b45309)", borderRadius: "0 8px 8px 0" }}>
                            <p style={{ fontWeight: "bold", margin: "0 0 0.5rem 0" }}>⚠️ Plantilla sin configurar</p>
                            <p style={{ margin: 0 }}>Esta plantilla no tiene campos mapeados. Ve a la pestaña <b>Gestión de Plantillas</b>, haz clic en <b>Editar Mapeo</b> y agrega las etiquetas manualmente para que aparezcan aquí.</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                            {plantillaInfo.configuracionCampos.map((campo: any, idx: number) => {
                                const rawKey = campo.campoPlantilla || "";
                                const key = rawKey.replace(/[{}]/g, '').trim(); // Coincide con la llave sin llaves en datosFormulario
                                const isMissing = !datosFormulario[key];
                                return (
                                    <div key={idx} style={{ marginBottom: "0.5rem" }}>
                                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                                            {tipoDestinatario === "ATP" && campo.sugerenciaSistema === "NOMBRE_DIRECTOR" ? "NOMBRE_ATP" : campo.sugerenciaSistema}
                                            <span style={{ color: "var(--text-muted)", fontWeight: "normal", marginLeft: "0.5rem", textTransform: "lowercase" }}>({rawKey})</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            className="form-control"
                                            style={{ borderColor: isMissing ? "var(--danger, #dc2626)" : "var(--border)", backgroundColor: isMissing ? "var(--danger-bg, #fef2f2)" : "var(--bg)" }}
                                            value={datosFormulario[key] || ""}
                                            onChange={(e) => {
                                                setDatosFormulario({...datosFormulario, [key]: e.target.value.toUpperCase()});
                                            }}
                                            placeholder={`Ingresa ${campo.sugerenciaSistema}...`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

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
