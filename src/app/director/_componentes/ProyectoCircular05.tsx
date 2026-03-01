"use client";

import { useState, useEffect } from "react";
import {
    FileText, Download, Plus, Trash2, ClipboardCheck, ChevronDown, ChevronUp,
    AlertTriangle, CheckCircle2, Info, Loader2,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────
interface Alumno {
    nombre: string; curp: string; nia: string; nss: string; disciplina: string;
}
interface Itinerario {
    hora: string; actividad: string; lugar: string;
}
interface Docente {
    nombre: string; cargo: string;
}

interface ProyectoCircular05Props {
    escuela: {
        id: string; cct: string; nombre: string; localidad: string;
        director?: string | null; municipio?: string | null;
        zonaEscolar?: string | null; codigoPostal?: string | null;
    };
}

// ─── Checklist Items ──────────────────────────────
const CHECKLIST_ITEMS = [
    "Oficio de solicitud firmado por el Director.",
    "Formatos originales de autorización firmados por los padres/tutores.",
    "Copia del INE de cada padre/tutor que firma.",
    "Constancia de vigencia de derechos (NSS/IMSS) o certificado médico de cada alumno.",
    "Acta original de la reunión con padres de familia.",
    "Si hay transporte rentado: Contrato de transporte, póliza de seguro de viajero y licencia del conductor.",
    "Acreditación de la persona encargada de primeros auxilios (ej. Cruz Roja).",
];

const ORDEN_INTEGRACION = [
    "1. Oficio de solicitud firmado y sellado por el Director.",
    "2. Proyecto operativo (objetivo, itinerario, relación de asistentes, gastos, transporte).",
    "3. Relación del personal de custodia firmada.",
    "4. Oficios de comisión de cada docente responsable.",
    "5. Oficio de autorización firmado por la Supervisión Escolar.",
    "6. Contrato de transporte con la empresa.",
    "7. Póliza de seguro de viajero vigente.",
    "8. Licencia del conductor.",
    "9. Constancia de primeros auxilios (acreditación Cruz Roja u otras).",
    "10. Formatos de autorización firmados por padres/tutores con copia de INE.",
    "11. Constancias de vigencia de derechos (NSS/IMSS) o certificados médicos.",
    "12. Acta de la reunión con padres de familia.",
    "13. Credenciales escolares de los alumnos participantes.",
];

// ─── Componente ───────────────────────────────────
export default function ProyectoCircular05({ escuela }: ProyectoCircular05Props) {
    // Estado del checklist
    const [checks, setChecks] = useState<boolean[]>(new Array(CHECKLIST_ITEMS.length).fill(false));
    const [showOrden, setShowOrden] = useState(false);

    // Estado del formulario
    const [supervisorNombre, setSupervisorNombre] = useState("");
    const [zonaEscolar, setZonaEscolar] = useState(escuela.zonaEscolar || "004");
    const [directorNombre, setDirectorNombre] = useState(escuela.director || "");
    const [bachilleratoNombre, setBachilleratoNombre] = useState(escuela.nombre || "");
    const [cct, setCct] = useState(escuela.cct || "");
    const [municipio, setMunicipio] = useState(escuela.municipio || "");
    const [localidad, setLocalidad] = useState(escuela.localidad || "");

    // Destinatario (se carga desde config)
    const [destinatario, setDestinatario] = useState("");
    const [cargoDestinatario, setCargoDestinatario] = useState("");
    const [zonaDestinatario, setZonaDestinatario] = useState("");

    // Evento
    const [nombreEvento, setNombreEvento] = useState("");
    const [disciplinaRama, setDisciplinaRama] = useState("");
    const [sede, setSede] = useState("");
    const [domicilioSede, setDomicilioSede] = useState("");
    const [fechaEvento, setFechaEvento] = useState("");
    const [horaInicio, setHoraInicio] = useState("");
    const [horaTermino, setHoraTermino] = useState("");

    // Proyecto
    const [objetivoEducativo, setObjetivoEducativo] = useState("");
    const [itinerario, setItinerario] = useState<Itinerario[]>([
        { hora: "", actividad: "REUNIÓN DE LOS ASISTENTES", lugar: "" },
        { hora: "", actividad: "SALIDA", lugar: "" },
        { hora: "", actividad: "LLEGADA APROXIMADA A LA SEDE", lugar: "" },
        { hora: "", actividad: "DESAYUNO", lugar: "" },
        { hora: "", actividad: "INICIO DE LA PARTICIPACIÓN", lugar: "" },
        { hora: "", actividad: "ALMUERZO", lugar: "" },
        { hora: "", actividad: "CLAUSURA DEL EVENTO", lugar: "" },
        { hora: "", actividad: "SALIDA DE REGRESO", lugar: "" },
        { hora: "", actividad: "LLEGADA APROXIMADA", lugar: "" },
    ]);

    // Gastos
    const [gastoTransporteIda, setGastoTransporteIda] = useState("");
    const [gastoAlimentos, setGastoAlimentos] = useState("");
    const [gastoTransporteRegreso, setGastoTransporteRegreso] = useState("");
    const [financiamiento, setFinanciamiento] = useState("Comité de APF");

    // Transporte
    const [tipoTransporte, setTipoTransporte] = useState("");
    const [descripcionVehiculo, setDescripcionVehiculo] = useState("");
    const [nombreConductor, setNombreConductor] = useState("");
    const [aseguradora, setAseguradora] = useState("");
    const [numeroPóliza, setNumeroPóliza] = useState("");

    // Custodia
    const [docentesResponsables, setDocentesResponsables] = useState<Docente[]>([
        { nombre: "", cargo: "Docente" },
    ]);
    const [personaPrimerosAuxilios, setPersonaPrimerosAuxilios] = useState("");

    // Alumnos
    const [alumnos, setAlumnos] = useState<Alumno[]>([
        { nombre: "", curp: "", nia: "", nss: "", disciplina: "" },
    ]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [seccionActiva, setSeccionActiva] = useState<string>("checklist");

    // Cargar config
    useEffect(() => {
        fetch("/api/circular05/config")
            .then((r) => r.json())
            .then((c) => {
                setDestinatario(c.destinatario || "");
                setCargoDestinatario(c.cargoDestinatario || "");
                setZonaDestinatario(c.zonaDestinatario || "");
            })
            .catch(() => { });
    }, []);

    // Helpers para tablas dinámicas
    const agregarItinerario = () => setItinerario([...itinerario, { hora: "", actividad: "", lugar: "" }]);
    const removerItinerario = (i: number) => setItinerario(itinerario.filter((_, idx) => idx !== i));
    const updateItinerario = (i: number, field: keyof Itinerario, value: string) => {
        const arr = [...itinerario];
        arr[i] = { ...arr[i], [field]: value };
        setItinerario(arr);
    };

    const agregarAlumno = () => setAlumnos([...alumnos, { nombre: "", curp: "", nia: "", nss: "", disciplina: "" }]);
    const removerAlumno = (i: number) => setAlumnos(alumnos.filter((_, idx) => idx !== i));
    const updateAlumno = (i: number, field: keyof Alumno, value: string) => {
        const arr = [...alumnos];
        arr[i] = { ...arr[i], [field]: value };
        setAlumnos(arr);
    };

    const agregarDocente = () => setDocentesResponsables([...docentesResponsables, { nombre: "", cargo: "Docente" }]);
    const removerDocente = (i: number) => setDocentesResponsables(docentesResponsables.filter((_, idx) => idx !== i));
    const updateDocente = (i: number, field: keyof Docente, value: string) => {
        const arr = [...docentesResponsables];
        arr[i] = { ...arr[i], [field]: value };
        setDocentesResponsables(arr);
    };

    // Formatear fecha
    const formatearFecha = (fechaISO: string) => {
        if (!fechaISO) return "";
        const d = new Date(fechaISO + "T12:00:00");
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
    };

    // Generar y descargar
    const handleDescargar = async () => {
        // Validaciones básicas
        if (!nombreEvento || !disciplinaRama || !sede || !fechaEvento || !directorNombre) {
            setMessage({ type: "error", text: "Por favor complete los campos obligatorios: Evento, Disciplina, Sede, Fecha y Director." });
            return;
        }
        if (alumnos.length === 0 || !alumnos[0].nombre) {
            setMessage({ type: "error", text: "Debe agregar al menos un alumno." });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const payload = {
                supervisorNombre,
                zonaEscolar,
                directorNombre,
                bachilleratoNombre,
                cct,
                municipio,
                localidad,
                destinatario,
                cargoDestinatario,
                zonaDestinatario,
                nombreEvento,
                disciplinaRama,
                sede,
                domicilioSede,
                fechaEvento: formatearFecha(fechaEvento),
                horaInicio,
                horaTermino,
                objetivoEducativo,
                itinerario: itinerario.filter(it => it.hora || it.actividad),
                gastoTransporteIda,
                gastoAlimentos,
                gastoTransporteRegreso,
                financiamiento,
                tipoTransporte,
                descripcionVehiculo,
                nombreConductor,
                aseguradora,
                "numeroPóliza": numeroPóliza,
                docentesResponsables: docentesResponsables.filter(d => d.nombre),
                personaPrimerosAuxilios,
                alumnos: alumnos.filter(a => a.nombre),
            };

            const res = await fetch("/api/circular05/generar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al generar documento");
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Proyecto_Circular05_${cct}_${disciplinaRama.replace(/\s+/g, "_")}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setMessage({ type: "success", text: "✅ Documento generado y descargado exitosamente." });
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Error al generar el documento" });
        } finally {
            setLoading(false);
        }
    };

    // Toggle checklist
    const toggleCheck = (index: number) => {
        const arr = [...checks];
        arr[index] = !arr[index];
        setChecks(arr);
    };

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "0.625rem 0.75rem", borderRadius: "8px",
        border: "1px solid var(--border)", fontSize: "0.875rem", fontFamily: "inherit",
        background: "var(--bg)", color: "var(--text)",
    };
    const labelStyle: React.CSSProperties = {
        display: "block", marginBottom: "0.35rem", fontSize: "0.8125rem",
        fontWeight: 600, color: "var(--text)",
    };
    const sectionHeaderStyle = (id: string): React.CSSProperties => ({
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1rem", cursor: "pointer", borderRadius: "8px",
        background: seccionActiva === id ? "var(--primary)" : "var(--bg-secondary)",
        color: seccionActiva === id ? "white" : "var(--text)",
        fontWeight: 700, fontSize: "0.9375rem", transition: "all 0.2s",
    });

    const SectionToggle = ({ id, icon, label }: { id: string; icon: React.ReactNode; label: string }) => (
        <div style={sectionHeaderStyle(id)} onClick={() => setSeccionActiva(seccionActiva === id ? "" : id)}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {icon} {label}
            </div>
            {seccionActiva === id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header */}
            <div className="card" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%)", color: "white", border: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <FileText size={28} />
                    <h2 style={{ margin: 0 }}>Proyecto Circular 05</h2>
                </div>
                <p style={{ opacity: 0.85, fontSize: "0.875rem", margin: 0 }}>
                    Generador automático del expediente para autorización de salidas extraescolares (Circular No. 05/2017 SEP)
                </p>
            </div>

            {/* Messages */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* ═══ SECCIÓN 1: CHECKLIST ═══ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <SectionToggle id="checklist" icon={<ClipboardCheck size={20} />} label="Lista de Verificación - Requisitos Documentales" />
                {seccionActiva === "checklist" && (
                    <div style={{ padding: "1rem" }}>
                        <div style={{ background: "#fff8e1", border: "1px solid #ffcc02", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
                            <AlertTriangle size={18} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "2px" }} />
                            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#92400e" }}>
                                <strong>Importante:</strong> Antes de generar el documento, asegúrese de contar con todos estos requisitos físicos. El documento Word generado aquí es solo una parte del expediente completo.
                            </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                            {CHECKLIST_ITEMS.map((item, i) => (
                                <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "8px", background: checks[i] ? "#f0fdf4" : "var(--bg-secondary)", border: checks[i] ? "1px solid #86efac" : "1px solid var(--border)", cursor: "pointer", transition: "all 0.2s" }}>
                                    <input type="checkbox" checked={checks[i]} onChange={() => toggleCheck(i)} style={{ marginTop: "3px", accentColor: "var(--success)" }} />
                                    <span style={{ fontSize: "0.875rem", color: checks[i] ? "#166534" : "var(--text)" }}>{item}</span>
                                </label>
                            ))}
                        </div>

                        {/* Orden de integración */}
                        <div style={{ marginTop: "1rem" }}>
                            <div onClick={() => setShowOrden(!showOrden)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, color: "var(--primary)" }}>
                                <Info size={16} />
                                {showOrden ? "Ocultar" : "Ver"} orden correcto de integración del expediente
                                {showOrden ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            {showOrden && (
                                <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                                    {ORDEN_INTEGRACION.map((item, i) => (
                                        <p key={i} style={{ margin: "0.25rem 0", fontSize: "0.8125rem", color: "#1e40af" }}>{item}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ SECCIÓN 2: DATOS INSTITUCIONALES ═══ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <SectionToggle id="institucional" icon={<FileText size={20} />} label="Datos Institucionales (Precargados)" />
                {seccionActiva === "institucional" && (
                    <div style={{ padding: "1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                            <div>
                                <label style={labelStyle}>Nombre del Supervisor</label>
                                <input style={inputStyle} value={supervisorNombre} onChange={(e) => setSupervisorNombre(e.target.value)} placeholder="Ej: Ing. Alejandro Escamilla Martínez" />
                            </div>
                            <div>
                                <label style={labelStyle}>Zona Escolar</label>
                                <input style={inputStyle} value={zonaEscolar} onChange={(e) => setZonaEscolar(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Nombre del Director ✦</label>
                                <input style={{ ...inputStyle, background: "#f0fdf4" }} value={directorNombre} onChange={(e) => setDirectorNombre(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Nombre del Bachillerato ✦</label>
                                <input style={{ ...inputStyle, background: "#f0fdf4" }} value={bachilleratoNombre} onChange={(e) => setBachilleratoNombre(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>C.C.T. ✦</label>
                                <input style={{ ...inputStyle, background: "#f0fdf4" }} value={cct} readOnly />
                            </div>
                            <div>
                                <label style={labelStyle}>Municipio ✦</label>
                                <input style={{ ...inputStyle, background: "#f0fdf4" }} value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Localidad ✦</label>
                                <input style={{ ...inputStyle, background: "#f0fdf4" }} value={localidad} onChange={(e) => setLocalidad(e.target.value)} />
                            </div>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>✦ Datos precargados de la base de datos.</p>
                    </div>
                )}
            </div>

            {/* ═══ SECCIÓN 3: DATOS DEL EVENTO ═══ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <SectionToggle id="evento" icon={<FileText size={20} />} label="Datos del Evento" />
                {seccionActiva === "evento" && (
                    <div style={{ padding: "1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                            <div style={{ gridColumn: "span 2" }}>
                                <label style={labelStyle}>Nombre del Evento *</label>
                                <input style={inputStyle} value={nombreEvento} onChange={(e) => setNombreEvento(e.target.value)} placeholder="Ej: Juegos Deportivos Estudiantiles 2025" />
                            </div>
                            <div>
                                <label style={labelStyle}>Disciplina y Rama *</label>
                                <input style={inputStyle} value={disciplinaRama} onChange={(e) => setDisciplinaRama(e.target.value)} placeholder="Ej: Basquetbol Varonil y Femenil" />
                            </div>
                            <div>
                                <label style={labelStyle}>Sede (Escuela destino) *</label>
                                <input style={inputStyle} value={sede} onChange={(e) => setSede(e.target.value)} placeholder="Ej: Bachillerato Aquiles Serdán" />
                            </div>
                            <div style={{ gridColumn: "span 2" }}>
                                <label style={labelStyle}>Domicilio / Ubicación de la Sede</label>
                                <input style={inputStyle} value={domicilioSede} onChange={(e) => setDomicilioSede(e.target.value)} placeholder="Ej: Municipio de Pantepec, Puebla" />
                            </div>
                            <div>
                                <label style={labelStyle}>Fecha del Evento *</label>
                                <input type="date" style={inputStyle} value={fechaEvento} onChange={(e) => setFechaEvento(e.target.value)} />
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Hora Inicio</label>
                                    <input type="time" style={inputStyle} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Hora Término</label>
                                    <input type="time" style={inputStyle} value={horaTermino} onChange={(e) => setHoraTermino(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ SECCIÓN 4: PROYECTO OPERATIVO ═══ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <SectionToggle id="proyecto" icon={<FileText size={20} />} label="Proyecto Operativo" />
                {seccionActiva === "proyecto" && (
                    <div style={{ padding: "1rem" }}>
                        <div style={{ marginBottom: "1rem" }}>
                            <label style={labelStyle}>Objetivo Educativo</label>
                            <textarea
                                style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
                                value={objetivoEducativo}
                                onChange={(e) => setObjetivoEducativo(e.target.value)}
                                placeholder="Fomentar el desarrollo integral de los estudiantes a través de la participación en actividades deportivas..."
                            />
                        </div>

                        {/* Itinerario */}
                        <div style={{ marginBottom: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>Itinerario</label>
                                <button className="btn btn-outline" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem" }} onClick={agregarItinerario}>
                                    <Plus size={14} /> Agregar
                                </button>
                            </div>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                    <thead>
                                        <tr style={{ background: "var(--bg-secondary)" }}>
                                            <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "20%" }}>Hora</th>
                                            <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "50%" }}>Actividad</th>
                                            <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "25%" }}>Lugar</th>
                                            <th style={{ padding: "0.5rem", borderBottom: "2px solid var(--border)", width: "5%" }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itinerario.map((item, i) => (
                                            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                                <td style={{ padding: "0.35rem" }}>
                                                    <input type="time" style={{ ...inputStyle, padding: "0.35rem" }} value={item.hora} onChange={(e) => updateItinerario(i, "hora", e.target.value)} />
                                                </td>
                                                <td style={{ padding: "0.35rem" }}>
                                                    <input style={{ ...inputStyle, padding: "0.35rem" }} value={item.actividad} onChange={(e) => updateItinerario(i, "actividad", e.target.value)} />
                                                </td>
                                                <td style={{ padding: "0.35rem" }}>
                                                    <input style={{ ...inputStyle, padding: "0.35rem" }} value={item.lugar} onChange={(e) => updateItinerario(i, "lugar", e.target.value)} />
                                                </td>
                                                <td style={{ padding: "0.35rem", textAlign: "center" }}>
                                                    <button onClick={() => removerItinerario(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Gastos */}
                        <label style={{ ...labelStyle, marginTop: "1rem" }}>Gastos</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                            <div>
                                <label style={{ ...labelStyle, fontWeight: 400, fontSize: "0.8125rem" }}>Traslado ida ($)</label>
                                <input style={inputStyle} value={gastoTransporteIda} onChange={(e) => setGastoTransporteIda(e.target.value)} placeholder="0.00" />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontWeight: 400, fontSize: "0.8125rem" }}>Alimentos ($)</label>
                                <input style={inputStyle} value={gastoAlimentos} onChange={(e) => setGastoAlimentos(e.target.value)} placeholder="0.00" />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontWeight: 400, fontSize: "0.8125rem" }}>Traslado regreso ($)</label>
                                <input style={inputStyle} value={gastoTransporteRegreso} onChange={(e) => setGastoTransporteRegreso(e.target.value)} placeholder="0.00" />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontWeight: 400, fontSize: "0.8125rem" }}>Financiamiento</label>
                                <input style={inputStyle} value={financiamiento} onChange={(e) => setFinanciamiento(e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ SECCIÓN 5: TRANSPORTE ═══ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <SectionToggle id="transporte" icon={<FileText size={20} />} label="Transporte y Logística" />
                {seccionActiva === "transporte" && (
                    <div style={{ padding: "1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                            <div>
                                <label style={labelStyle}>Tipo de Transporte</label>
                                <input style={inputStyle} value={tipoTransporte} onChange={(e) => setTipoTransporte(e.target.value)} placeholder="Ej: Nissan Urvan, 18 pasajeros" />
                            </div>
                            <div>
                                <label style={labelStyle}>Descripción (Marca, modelo, placas)</label>
                                <input style={inputStyle} value={descripcionVehiculo} onChange={(e) => setDescripcionVehiculo(e.target.value)} placeholder="Ej: Nissan Urvan 2020, placas ABC123" />
                            </div>
                            <div>
                                <label style={labelStyle}>Nombre del Conductor</label>
                                <input style={inputStyle} value={nombreConductor} onChange={(e) => setNombreConductor(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Aseguradora</label>
                                <input style={inputStyle} value={aseguradora} onChange={(e) => setAseguradora(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>No. de Póliza</label>
                                <input style={inputStyle} value={numeroPóliza} onChange={(e) => setNumeroPóliza(e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ SECCIÓN 6: CUSTODIA ═══ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <SectionToggle id="custodia" icon={<FileText size={20} />} label="Personal de Custodia" />
                {seccionActiva === "custodia" && (
                    <div style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Docentes Responsables</label>
                            <button className="btn btn-outline" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem" }} onClick={agregarDocente}>
                                <Plus size={14} /> Agregar
                            </button>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 0.75rem" }}>
                            Se generará un Oficio de Comisión por cada docente registrado aquí.
                        </p>
                        {docentesResponsables.map((doc, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                                <input style={{ ...inputStyle, flex: 2 }} value={doc.nombre} onChange={(e) => updateDocente(i, "nombre", e.target.value)} placeholder="Nombre completo" />
                                <input style={{ ...inputStyle, flex: 1 }} value={doc.cargo} onChange={(e) => updateDocente(i, "cargo", e.target.value)} placeholder="Cargo" />
                                <button onClick={() => removerDocente(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", flexShrink: 0 }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        <div style={{ marginTop: "1rem" }}>
                            <label style={labelStyle}>Persona encargada de Primeros Auxilios</label>
                            <input style={inputStyle} value={personaPrimerosAuxilios} onChange={(e) => setPersonaPrimerosAuxilios(e.target.value)} placeholder="Nombre completo" />
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ SECCIÓN 7: ALUMNOS ═══ */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <SectionToggle id="alumnos" icon={<FileText size={20} />} label={`Relación de Alumnos (${alumnos.filter(a => a.nombre).length})`} />
                {seccionActiva === "alumnos" && (
                    <div style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                {alumnos.filter(a => a.nombre).length} alumno(s) registrado(s)
                            </span>
                            <button className="btn btn-outline" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem" }} onClick={agregarAlumno}>
                                <Plus size={14} /> Agregar Alumno
                            </button>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", minWidth: "700px" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-secondary)" }}>
                                        <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "5%" }}>#</th>
                                        <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "25%" }}>Nombre Completo</th>
                                        <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "25%" }}>CURP</th>
                                        <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "15%" }}>NIA</th>
                                        <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "15%" }}>NSS</th>
                                        <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid var(--border)", width: "12%" }}>Disciplina</th>
                                        <th style={{ padding: "0.5rem", borderBottom: "2px solid var(--border)", width: "3%" }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alumnos.map((alumno, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "0.3rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>{i + 1}</td>
                                            <td style={{ padding: "0.3rem" }}>
                                                <input style={{ ...inputStyle, padding: "0.3rem" }} value={alumno.nombre} onChange={(e) => updateAlumno(i, "nombre", e.target.value)} placeholder="Nombre" />
                                            </td>
                                            <td style={{ padding: "0.3rem" }}>
                                                <input style={{ ...inputStyle, padding: "0.3rem", textTransform: "uppercase" }} value={alumno.curp} onChange={(e) => updateAlumno(i, "curp", e.target.value.toUpperCase())} placeholder="CURP" maxLength={18} />
                                            </td>
                                            <td style={{ padding: "0.3rem" }}>
                                                <input style={{ ...inputStyle, padding: "0.3rem" }} value={alumno.nia} onChange={(e) => updateAlumno(i, "nia", e.target.value)} placeholder="NIA" />
                                            </td>
                                            <td style={{ padding: "0.3rem" }}>
                                                <input style={{ ...inputStyle, padding: "0.3rem" }} value={alumno.nss} onChange={(e) => updateAlumno(i, "nss", e.target.value)} placeholder="NSS" />
                                            </td>
                                            <td style={{ padding: "0.3rem" }}>
                                                <input style={{ ...inputStyle, padding: "0.3rem" }} value={alumno.disciplina} onChange={(e) => updateAlumno(i, "disciplina", e.target.value)} placeholder="Disc." />
                                            </td>
                                            <td style={{ padding: "0.3rem", textAlign: "center" }}>
                                                <button onClick={() => removerAlumno(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ BOTÓN DESCARGAR ═══ */}
            <button
                className="btn btn-primary"
                onClick={handleDescargar}
                disabled={loading}
                style={{
                    padding: "1rem 2rem", fontSize: "1.125rem", fontWeight: 800,
                    background: loading ? "var(--text-muted)" : "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                    border: "none", borderRadius: "12px", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem",
                    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.4)",
                    transition: "all 0.3s",
                }}
            >
                {loading ? (
                    <><Loader2 size={22} className="spin" /> Generando documento...</>
                ) : (
                    <><Download size={22} /> Descargar Proyecto Circular 05</>
                )}
            </button>
        </div>
    );
}
