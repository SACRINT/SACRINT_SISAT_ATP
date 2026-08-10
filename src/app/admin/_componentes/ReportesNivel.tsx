"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Copy,
    Check,
    FileText,
    Mail,
    Loader2,
    Calendar,
    Send,
} from "lucide-react";

import { INSTITUCION_FALLBACK } from "@/lib/institucion-constantes";

interface Escuela {
    id: string;
    nombre: string;
    cct: string;
    municipio: string | null;
}

const MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
];

const ANIOS = ["2025", "2026", "2027"];

export default function ReportesNivel() {
    const [programa, setPrograma] = useState<"BANAVIM" | "CEDAVIM" | "DIA_NARANJA">("BANAVIM");
    const [mes, setMes] = useState("Julio");
    const [anio, setAnio] = useState("2026");
    const [oficioNum, setOficioNum] = useState("0");
    const [tieneAcoso, setTieneAcoso] = useState(false);

    // Formulario de acoso
    const [escuelasList, setEscuelasList] = useState<Escuela[]>([]);
    const [escuelaId, setEscuelaId] = useState("");
    const [tipoViolencia, setTipoViolencia] = useState("violencia por parte del docente");
    const [acciones, setAcciones] = useState(
        "reuniones con las personas involucradas, atención y acompañamiento a las y los estudiantes afectados, canalización para atención psicológica, así como acciones preventivas y de fortalecimiento institucional dirigidas a la comunidad educativa"
    );
    const [estatus, setEstatus] = useState("pendiente");

    const [loadingEscuelas, setLoadingEscuelas] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Configuración institucional dinámica
    const [institucionConfig, setInstitucionConfig] = useState<any>(null);

    // Estados de copia
    const [copiedSubject, setCopiedSubject] = useState(false);
    const [copiedBody, setCopiedBody] = useState(false);

    // Estados para carga y parseo automático de casos CEDAVIM
    const [loadingAcoso, setLoadingAcoso] = useState(false);
    const [acosoSchools, setAcosoSchools] = useState<any[]>([]);
    const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

    // Cargar lista de escuelas y config institucional
    useEffect(() => {
        async function fetchEscuelasYConfig() {
            setLoadingEscuelas(true);
            try {
                const [resEscuelas, resConfig] = await Promise.all([
                    fetch("/api/admin/escuelas"),
                    fetch("/api/admin/autoridades-config"),
                ]);
                if (resEscuelas.ok) {
                    const data = await resEscuelas.json();
                    setEscuelasList(data);
                }
                if (resConfig.ok) {
                    const cfg = await resConfig.json();
                    setInstitucionConfig(cfg);
                }
            } catch (err) {
                console.error("Error al cargar datos institucionales:", err);
            } finally {
                setLoadingEscuelas(false);
            }
        }
        fetchEscuelasYConfig();
    }, []);

    // Cargar casos de acoso desde archivos Excel subidos por escuelas
    useEffect(() => {
        if (programa !== "CEDAVIM") return;

        async function fetchAcosoCasos() {
            setLoadingAcoso(true);
            try {
                const res = await fetch(`/api/admin/reportes-nivel/acoso-casos?mes=${mes}&anio=${anio}`);
                if (res.ok) {
                    const data = await res.json();
                    setAcosoSchools(data.schools || []);
                    if (data.schools && data.schools.length > 0) {
                        setTieneAcoso(true);
                        setEscuelaId(data.schools[0].id);
                        setSelectedCaseIdx(0);

                        const firstCase = data.schools[0].casos[0];
                        if (firstCase) {
                            setTipoViolencia(firstCase.tipoViolencia);
                            setAcciones(firstCase.acciones || "No se especificaron acciones de intervención en el archivo Excel.");
                            setEstatus(firstCase.estatus);
                        }
                    } else {
                        setTieneAcoso(false);
                        setEscuelaId(escuelasList[0]?.id || "");
                        setTipoViolencia("violencia por parte del docente");
                        setAcciones("reuniones con las personas involucradas, atención y acompañamiento a las y los estudiantes afectados, canalización para atención psicológica, así como acciones preventivas y de fortalecimiento institucional dirigidas a la comunidad educativa");
                        setEstatus("pendiente");
                        setSelectedCaseIdx(0);
                    }
                }
            } catch (err) {
                console.error("Error al cargar casos de acoso:", err);
            } finally {
                setLoadingAcoso(false);
            }
        }
        fetchAcosoCasos();
    }, [programa, mes, anio, escuelasList]);

    const handleSchoolChange = (schoolId: string) => {
        setEscuelaId(schoolId);
        setSelectedCaseIdx(0);
        const schoolObj = acosoSchools.find(s => s.id === schoolId);
        if (schoolObj && schoolObj.casos && schoolObj.casos.length > 0) {
            const firstCase = schoolObj.casos[0];
            setTipoViolencia(firstCase.tipoViolencia);
            setAcciones(firstCase.acciones || "No se especificaron acciones de intervención en el archivo Excel.");
            setEstatus(firstCase.estatus);
        }
    };

    const handleCaseChange = (idx: number) => {
        setSelectedCaseIdx(idx);
        const schoolObj = acosoSchools.find(s => s.id === escuelaId);
        if (schoolObj && schoolObj.casos && schoolObj.casos[idx]) {
            const caseObj = schoolObj.casos[idx];
            setTipoViolencia(caseObj.tipoViolencia);
            setAcciones(caseObj.acciones || "No se especificaron acciones de intervención en el archivo Excel.");
            setEstatus(caseObj.estatus);
        }
    };

    // Escuela seleccionada (dinámica para CEDAVIM)
    const selectedEscuela = useMemo(() => {
        if (programa === "CEDAVIM" && tieneAcoso && acosoSchools.length > 0) {
            const acosoSch = acosoSchools.find(s => s.id === escuelaId);
            if (acosoSch) {
                const caseObj = acosoSch.casos[selectedCaseIdx];
                return {
                    id: acosoSch.id,
                    nombre: caseObj ? caseObj.escuela : acosoSch.nombre,
                    cct: caseObj ? caseObj.cct : acosoSch.cct,
                    municipio: caseObj ? caseObj.municipio : acosoSch.municipio
                };
            }
        }
        return escuelasList.find((e) => e.id === escuelaId);
    }, [escuelasList, escuelaId, tieneAcoso, acosoSchools, selectedCaseIdx, programa]);

    // Redacción dinámica del correo
    const emailData = useMemo(() => {
        const dest = institucionConfig?.emailReporteNivel || INSTITUCION_FALLBACK.emailReporteNivel;
        const zonaStr = institucionConfig?.zona || "004";
        const cctStr = institucionConfig?.cct || "21FMS0020X";
        const supervisorStr = institucionConfig?.supervisor || "Ing. Alejandro Escamilla Martínez";
        const entidadStr = institucionConfig?.entidad || "Puebla";
        const nombreSupervisionStr = institucionConfig?.nombreSupervision || `SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES ZONA ${zonaStr}`;

        let sub = "";
        let body = "";

        if (programa === "BANAVIM") {
            sub = `REPORTE_BANAVIM_ZONA${zonaStr}_${cctStr}`;
            body = `En respuesta a su oficio SEP-1.1.2.1-DBEPA/0330/2026, y con fundamento en los artículos 3º y 4º de la Constitución Política de los Estados Unidos Mexicanos; 83 de la Constitución Política del Estado Libre y Soberano de ${entidadStr}; 31 fracción XII; 43 fracción XXXVIII de la Ley Orgánica de la Administración Pública del Estado de ${entidadStr}; 1, 4 fracción II, 6, 18 fracción IV y 19 de la Ley de Educación del Estado de ${entidadStr}, así como a la fracción X del artículo 43 de la Ley para el Acceso de las Mujeres a una Vida Libre de Violencia del Estado de ${entidadStr}; y con el objetivo de consolidar el Banco Estatal de Datos de Violencia contra las Mujeres (BANAVIM), me permito informarle que durante el mes de ${mes} del año en curso, no se ha recibido ningún reporte de casos de violencia contra niñas, adolescentes o mujeres en los planteles adscritos a esta Supervisión Escolar Zona ${zonaStr}, con CCT ${cctStr}.

Sin otro particular, le envío un cordial saludo.

ATENTAMENTE
«SUFRAGIO EFECTIVO. NO REELECCIÓN»
${supervisorStr}
Supervisor Escolar
Zona Escolar ${zonaStr}
CCT: ${cctStr}`;
        } else if (programa === "CEDAVIM") {
            sub = `TEMAS DE ACOSO ESCOLAR_ZONA ${zonaStr}_${cctStr}`;
            if (tieneAcoso) {
                const escNombre = selectedEscuela ? selectedEscuela.nombre : "Nombre Escuela";
                const escCct = selectedEscuela ? selectedEscuela.cct : "CCT";
                const escMuni = selectedEscuela?.municipio || "Municipio";

                body = `En atención al oficio identificado con número SEP-1.1.2.1-DBEPA/2026, mediante el cual se solicita el reporte mensual correspondiente al formato denominado "TEMAS ACOSO ESCOLAR 2026", me permito informar a usted que, derivado del seguimiento realizado en las instituciones educativas que integran la Zona Escolar ${zonaStr} a mi cargo, durante el mes de ${mes} de ${anio} se registró un (1) caso relacionado con ${tipoViolencia}, en el Bachillerato General "${escNombre}", con CCT. ${escCct}, ubicado en el municipio de ${escMuni}, ${entidadStr}.

Al respecto, el plantel educativo, en coordinación con esta Supervisión Escolar y las instancias competentes, implementó las acciones de atención e intervención correspondientes, entre las que destacan ${acciones}. Derivado de dichas intervenciones, el caso se reporta con estatus de ${estatus}, conforme a la información proporcionada por el plantel.

Asimismo, se remite adjunto el formato correspondiente debidamente requisitado, para los efectos administrativos conducentes y en cumplimiento a lo solicitado.

Sin otro particular, le envío un cordial saludo y quedo a sus órdenes para cualquier duda o aclaración.

ATENTAMENTE
«SUFRAGIO EFECTIVO. NO REELECCIÓN»
SUPERVISOR DE LA ZONA ESCOLAR ${zonaStr}
${supervisorStr.toUpperCase()}
CCT: ${cctStr}`;
            } else {
                body = `En atención al oficio identificado con número SEP-1.1.2.1-DBEPA/2026, mediante el cual se solicita el reporte mensual correspondiente al formato denominado “TEMAS ACOSO ESCOLAR 2026”, me permito informar a usted que, derivado de la revisión realizada en las instituciones educativas que integran la Zona Escolar ${zonaStr} a mi cargo, no se presentó ningún caso relacionado con los rubros señalados (Acoso Escolar, Acoso Sexual, Violencia Intrafamiliar, Violencia Cibernética, Violencia por parte del docente y Violencia contra el docente por parte del alumno o alumna) durante el mes de ${mes.toLowerCase()} del presente año.

Lo anterior se comunica para los efectos administrativos correspondientes, dando cumplimiento en tiempo y forma a lo solicitado.

ATENTAMENTE
«SUFRAGIO EFECTIVO. NO REELECCIÓN»
SUPERVISOR DE LA ZONA ESCOLAR ${zonaStr}
${supervisorStr.toUpperCase()}
CCT: ${cctStr}`;
            }
        } else {
            // DIA NARANJA
            sub = `25N_${mes.toUpperCase()}_GEN${zonaStr}_${cctStr}`;
            body = `Por este medio, y en atención al oficio SEP-1.1.2.1-DBEPA/2026, relacionado con la Conmemoración del “25 N - Día Naranja” mes de ${mes}, me permito hacer llegar la información correspondiente a la Zona Escolar ${zonaStr}, con CCT de Supervisión ${cctStr}.

Se anexan dos archivos que integran la información de los 17 bachilleratos adscritos a esta Zona Escolar:
Archivo 1: Evidencias fotográficas
Archivo 2: Listas de registro

Ambos archivos se encuentran debidamente revisados, firmados y sellados, conforme a lo establecido en la convocatoria.

Sin más por el momento, reitero mi disposición para cualquier aclaración o información adicional que se requiera.

Reciba un cordial y atento saludo.

ATENTAMENTE
${supervisorStr}
Supervisor Escolar
Zona Escolar ${zonaStr}
CCT: ${cctStr}`;
        }

        return { dest, sub, body };
    }, [programa, mes, anio, tieneAcoso, selectedEscuela, tipoViolencia, acciones, estatus, institucionConfig]);

    // Función para copiar texto al portapapeles
    const handleCopy = async (text: string, type: "subject" | "body") => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === "subject") {
                setCopiedSubject(true);
                setTimeout(() => setCopiedSubject(false), 2000);
            } else {
                setCopiedBody(true);
                setTimeout(() => setCopiedBody(false), 2000);
            }
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    // Descargar el documento de Word consolidado
    const handleDownloadReport = async () => {
        setDownloading(true);
        setMessage(null);
        try {
            const urlParams = new URLSearchParams({
                programa,
                mes,
                anio,
                oficioNum,
                tieneAcoso: tieneAcoso ? "true" : "false",
                escuelaNombre: selectedEscuela?.nombre || "",
                escuelaCct: selectedEscuela?.cct || "",
                escuelaMunicipio: selectedEscuela?.municipio || "",
                tipoViolencia,
                acciones,
                estatus,
            });

            const res = await fetch(`/api/admin/reportes-nivel?${urlParams.toString()}`);
            if (!res.ok) throw new Error("Error al generar el archivo Word.");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const prefix = programa === "BANAVIM" ? "REPORTE_BANAVIM" : tieneAcoso ? "REPORTE_CEDAVIM_SI_ACOSO" : "REPORTE_CEDAVIM_NO_ACOSO";
            a.download = `${prefix}_ZONA004_${mes.toUpperCase()}_${anio}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setMessage({ type: "success", text: "Reporte de Zona generado y descargado correctamente." });
        } catch (err: any) {
            console.error(err);
            setMessage({ type: "error", text: err.message || "Error al descargar el archivo." });
        } finally {
            setDownloading(false);
        }
    };

    // Descargar plantillas fijas de Día Naranja o Control Excel
    const handleDownloadTemplate = async (archivo: "EVIDENCIA_FOTO" | "REGISTRO_PARTICIPANTES" | "CONTROL_EXCEL") => {
        try {
            const res = await fetch(`/api/admin/reportes-nivel/plantillas?archivo=${archivo}`);
            if (!res.ok) throw new Error("Error al descargar el archivo.");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            let filename = "archivo";
            if (archivo === "EVIDENCIA_FOTO") filename = "FORMATO PARA EVIDENCIA FOTOGRAFICA (DÍA NARANJA).docx";
            else if (archivo === "REGISTRO_PARTICIPANTES") filename = "FORMATO PARA REGISTRO DE PARTICIPANTES (DÍA NARANJA).docx";
            else if (archivo === "CONTROL_EXCEL") filename = "TEMAS_ACOSO ESCOLAR_2026 - Escuelas CEDAVIM.xlsx";
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error(err);
            alert("No se pudo descargar la plantilla seleccionada: " + err.message);
        }
    };

    const [sendingResumen, setSendingResumen] = useState(false);

    const handleEnviarResumenSemanal = async () => {
        setSendingResumen(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/reportes/resumen-semanal", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: data.mensaje || "Resumen semanal enviado exitosamente." });
            } else {
                setMessage({ type: "error", text: data.error || "Error al enviar resumen semanal." });
            }
        } catch (err: any) {
            setMessage({ type: "error", text: "Error al conectar con el servidor." });
        } finally {
            setSendingResumen(false);
        }
    };

    return (
        <div style={{ padding: "0.5rem" }}>
            <div className="page-header" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 className="title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem" }}>
                        <Mail size={24} style={{ color: "var(--primary)" }} />
                        Reportes y Respuestas al Nivel
                    </h1>
                    <p className="description" style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                        Genera las redacciones de correos y los reportes de supervisión (.docx) membretados para enviar formalmente a la Dirección de Bachilleratos.
                    </p>
                </div>

                <button
                    onClick={handleEnviarResumenSemanal}
                    disabled={sendingResumen}
                    className="btn btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.2rem" }}
                >
                    {sendingResumen ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span>Enviar resumen ahora</span>
                </button>
            </div>

            {message && (
                <div className={`alert alert-${message.type === "error" ? "danger" : "success"}`} style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", borderRadius: "6px" }}>
                    {message.text}
                </div>
            )}

            {/* Pestañas de Programas */}
            <div className="tab-list">
                <button
                    onClick={() => { setPrograma("BANAVIM"); setMessage(null); }}
                    className={`tab-item ${programa === "BANAVIM" ? "active" : ""}`}
                >
                    BANAVIM
                </button>
                <button
                    onClick={() => { setPrograma("CEDAVIM"); setMessage(null); }}
                    className={`tab-item ${programa === "CEDAVIM" ? "active" : ""}`}
                >
                    CEDAVIM (Acoso Escolar)
                </button>
                <button
                    onClick={() => { setPrograma("DIA_NARANJA"); setMessage(null); }}
                    className={`tab-item ${programa === "DIA_NARANJA" ? "active" : ""}`}
                >
                    Día Naranja (25N)
                </button>
            </div>

            {/* Layout en dos columnas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                
                {/* Columna Izquierda: Configuración y Datos */}
                <div>
                    <div className="card" style={{ background: "white", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "1rem" }}>
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                            <Calendar size={16} />
                            Filtros de Período y Datos del Oficio
                        </h3>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Mes de Reporte</label>
                                <select className="form-control" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: "100%" }}>
                                    {MESES.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Año</label>
                                <select className="form-control" value={anio} onChange={(e) => setAnio(e.target.value)} style={{ width: "100%" }}>
                                    {ANIOS.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {programa !== "DIA_NARANJA" && (
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Número correlativo de Oficio</label>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{`SEP-${(new Date().getMonth() + 1 >= 8 || new Date().getMonth() + 1 === 1) ? "A" : "B"}/ZONA004/`}</span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={oficioNum}
                                        onChange={(e) => setOficioNum(e.target.value)}
                                        placeholder="0"
                                        style={{ width: "80px" }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lógica de Formulario CEDAVIM (Sí/No Acoso) */}
                    {programa === "CEDAVIM" && (
                        <div className="card" style={{ background: "white", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "1rem" }}>
                            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>Reporte de Casos e Incidencias</h3>
                            
                            {loadingAcoso ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "1rem 0" }}>
                                    <Loader2 size={16} className="spin" />
                                    Buscando y procesando reportes Excel subidos en este mes...
                                </div>
                            ) : (
                                <>
                                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "1rem", fontWeight: 600, fontSize: "0.875rem" }}>
                                        <input
                                            type="checkbox"
                                            checked={tieneAcoso}
                                            onChange={(e) => setTieneAcoso(e.target.checked)}
                                            style={{ width: "16px", height: "16px" }}
                                        />
                                        ¿Se presentaron casos de acoso o violencia en este mes?
                                    </label>

                                    {tieneAcoso && (
                                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                                            {acosoSchools.length === 0 ? (
                                                <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "0.75rem", borderRadius: "6px", color: "#b45309", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
                                                    ⚠️ No se detectaron archivos Excel con reportes de acoso subidos por los directores para este mes. Puedes ingresar los datos manualmente a continuación.
                                                </div>
                                            ) : (
                                                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "6px", color: "#166534", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
                                                    🎉 Se detectaron automáticamente {acosoSchools.length} escuela(s) con reportes de acoso en Excel. Selecciona una a continuación.
                                                </div>
                                            )}

                                            <div>
                                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                                    {acosoSchools.length > 0 ? "Escuela con reporte (detectada en Excel)" : "Escuela con el reporte (manual)"}
                                                </label>
                                                {acosoSchools.length > 0 ? (
                                                    <select className="form-control" value={escuelaId} onChange={(e) => handleSchoolChange(e.target.value)} style={{ width: "100%" }}>
                                                        {acosoSchools.map((esc) => (
                                                            <option key={esc.id} value={esc.id}>
                                                                {esc.nombre} ({esc.cct})
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <select className="form-control" value={escuelaId} onChange={(e) => setEscuelaId(e.target.value)} style={{ width: "100%" }}>
                                                        {escuelasList.map((esc) => (
                                                            <option key={esc.id} value={esc.id}>
                                                                {esc.nombre} ({esc.cct})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>

                                            {/* Sub-selector si la escuela tiene múltiples casos de acoso en su archivo Excel */}
                                            {programa === "CEDAVIM" && tieneAcoso && acosoSchools.length > 0 && (acosoSchools.find(s => s.id === escuelaId)?.casos.length || 0) > 1 && (
                                                <div>
                                                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem", color: "var(--primary)" }}>
                                                        Incidencia reportada en el archivo Excel
                                                    </label>
                                                    <select 
                                                        className="form-control" 
                                                        value={selectedCaseIdx} 
                                                        onChange={(e) => handleCaseChange(Number(e.target.value))} 
                                                        style={{ width: "100%", borderColor: "var(--primary)" }}
                                                    >
                                                        {(acosoSchools.find(s => s.id === escuelaId)?.casos || []).map((caso: any, idx: number) => (
                                                            <option key={idx} value={idx}>
                                                                {idx + 1}. {caso.tipoViolencia} - {caso.escuela} ({caso.cct})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {selectedEscuela && (
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.8125rem", background: "var(--bg-secondary)", padding: "0.625rem", borderRadius: "6px" }}>
                                                    <div>
                                                        <strong>CCT:</strong> {selectedEscuela.cct}
                                                    </div>
                                                    <div>
                                                        <strong>Municipio:</strong> {selectedEscuela.municipio || "N/A"}
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Tipo de Violencia / Incidencia</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={tipoViolencia}
                                                    onChange={(e) => setTipoViolencia(e.target.value)}
                                                    style={{ width: "100%" }}
                                                    placeholder="Violencia por parte del docente, acoso escolar, etc."
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Acciones de Intervención Implementadas</label>
                                                <textarea
                                                    className="form-control"
                                                    value={acciones}
                                                    onChange={(e) => setAcciones(e.target.value)}
                                                    style={{ width: "100%", height: "80px", fontSize: "0.8125rem" }}
                                                    placeholder="Reuniones con los padres, actas, canalización psicológica..."
                                                />
                                            </div>

                                            <div>
                                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>Estatus del caso</label>
                                                <select className="form-control" value={estatus} onChange={(e) => setEstatus(e.target.value)} style={{ width: "100%" }}>
                                                    <option value="pendiente">Pendiente</option>
                                                    <option value="concluido">Concluido</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}



                    {/* Acciones de Oficios de Supervisión */}
                    {programa !== "DIA_NARANJA" && (
                        <div className="card" style={{ background: "white", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Generar Documento Impreso</h3>
                            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                Descarga el oficio membretado en formato Word oficial de supervisión ya redactado y rellenado con las firmas del supervisor listas.
                            </p>
                            <button
                                onClick={handleDownloadReport}
                                disabled={downloading}
                                className="btn btn-primary"
                                style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}
                            >
                                {downloading ? (
                                    <Loader2 size={16} className="spin" />
                                ) : (
                                    <FileText size={16} />
                                )}
                                Descargar Oficio de Supervisión (.docx)
                            </button>
                        </div>
                    )}
                </div>

                {/* Columna Derecha: Redacción y Copiado de Correo */}
                <div>
                    <div className="card" style={{ background: "white", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)" }}>
                            <Mail size={18} />
                            Borrador de Correo Institucional
                        </h3>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "-0.5rem" }}>
                            Copia directamente estos campos en tu gestor de correo (Gmail/Outlook) para enviar las evidencias firmadas al Nivel.
                        </p>

                        {/* Campo: Para */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Para (Destinatario):</label>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg-secondary)", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)" }}>
                                <span style={{ fontSize: "0.8125rem", fontFamily: "monospace", flexGrow: 1, color: "var(--text-primary)" }}>{emailData.dest}</span>
                            </div>
                        </div>

                        {/* Campo: Asunto */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Asunto:</label>
                                <button
                                    onClick={() => handleCopy(emailData.sub, "subject")}
                                    style={{
                                        border: "none", background: "none", cursor: "pointer",
                                        color: copiedSubject ? "var(--success)" : "var(--primary)",
                                        fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "2px"
                                    }}
                                >
                                    {copiedSubject ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedSubject ? "¡Copiado!" : "Copiar"}
                                </button>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--bg-secondary)", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)" }}>
                                <span style={{ fontSize: "0.8125rem", fontFamily: "monospace", flexGrow: 1, fontWeight: "bold" }}>{emailData.sub}</span>
                            </div>
                        </div>

                        {/* Campo: Cuerpo */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Cuerpo del Mensaje:</label>
                                <button
                                    onClick={() => handleCopy(emailData.body, "body")}
                                    style={{
                                        border: "none", background: "none", cursor: "pointer",
                                        color: copiedBody ? "var(--success)" : "var(--primary)",
                                        fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "2px"
                                    }}
                                >
                                    {copiedBody ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedBody ? "¡Copiado!" : "Copiar todo el cuerpo"}
                                </button>
                            </div>
                            <pre
                                style={{
                                    margin: 0,
                                    padding: "0.75rem",
                                    background: "#0f172a",
                                    color: "#e2e8f0",
                                    fontSize: "0.77rem",
                                    borderRadius: "6px",
                                    overflowX: "auto",
                                    whiteSpace: "pre-wrap",
                                    fontFamily: "monospace",
                                    height: "280px",
                                    border: "1px solid #1e293b",
                                    lineHeight: "1.4",
                                }}
                            >
                                {emailData.body}
                            </pre>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
