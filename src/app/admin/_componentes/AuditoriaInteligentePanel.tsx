"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
    Database,
    Mail,
    Search,
    RefreshCw,
    Sliders,
    Bot,
    Shield,
    Workflow,
    ListTodo,
    SplitSquareVertical,
    Boxes,
    FileCode2,
    CheckCircle,
    XCircle,
    PauseCircle,
    Edit3,
    Layers,
    Clock
} from "lucide-react";
import toast from "react-hot-toast";

interface CuentaAuditoriaData {
    id: string;
    tenantId: string;
    email: string;
    nombreTitular?: string | null;
    tipoFuente: string;
    directorioCorpus?: string | null;
    totalMensajes: number;
    totalRecibidos: number;
    totalEnviados: number;
    totalHilos: number;
    totalAdjuntos: number;
    fechaInicioCorpus?: string | null;
    fechaFinCorpus?: string | null;
    estadoIngestion: string;
    ultimaIngestion?: string | null;
    _count?: {
        mensajes: number;
        conversaciones: number;
        adjuntos: number;
    };
    syncStates?: unknown[];
}

interface MensajeData {
    id: string;
    bandeja: string;
    esEnviado: boolean;
    fechaMensaje: string;
    remitenteNombre?: string | null;
    remitenteEmail: string | null;
    destinatariosJson: unknown[];
    conCopiaJson?: unknown[];
    asunto: string;
    asuntoNormalizado?: string | null;
    categoriaTematica?: string | null;
    rutaMd?: string | null;
    bodyHash?: string | null;
    tamanoCuerpoChars: number;
    tieneAdjuntos: boolean;
    numAdjuntos: number;
    tieneSenalesPlazo: boolean;
    estadoAnalisis: string;
    resumenIA?: string | null;
    clasificacionOrigen?: string | null;
    clasificacionTipo?: string | null;
    clasificacionAccion?: string | null;
    fechaLimiteDetectada?: string | null;
    prioridadIA?: string | null;
    entidadesJson?: unknown;
    adjuntos?: unknown[];
    conversation?: {
        hiloId: string;
        numMensajes: number;
        confianzaHilo: number;
    } | null;
}

interface HiloData {
    id: string;
    hiloId: string;
    asuntoNormalizado: string;
    numMensajes: number;
    confianzaHilo: number;
    razonUnion?: string | null;
    fechaInicio: string;
    fechaFin: string;
    participantesJson: string[];
    mensajesIdsJson?: string[];
    mensajes?: MensajeData[];
}

interface ProcesoData {
    id: string;
    tenantId: string;
    nombre: string;
    descripcion: string;
    origenPrincipal: string;
    frecuenciaEstimada: string;
    participantes: string[];
    entradas: string[];
    salidas: string[];
    documentosRelacionados: string[];
    nivelRepeticion: string;
    tiempoEstimadoMinHoras: number;
    tiempoEstimadoMaxHoras: number;
    ahorroEstimadoHoras: number;
    automatizabilidad: number;
    prioridadScore: number;
    nivelPrioridad: string;
    riesgoOperativo: string;
    confianzaScore: number;
    razonDeteccion: string;
    estado: string;
    _count?: {
        tareas: number;
        mensajes: number;
        adjuntos: number;
    };
}

interface TareaData {
    id: string;
    tenantId: string;
    procesoId: string;
    nombre: string;
    descripcion?: string | null;
    responsableActual?: string | null;
    responsablePropuesto?: string | null;
    automatizabilidad?: number | null;
    automatizabilidadDesc?: string | null;
    automatizacionPropuesta?: string | null;
    frecuencia?: string | null;
    frecuenciaAnual?: number | null;
    tiempoMinUnitario?: number | null;
    tiempoMaxUnitario?: number | null;
    horasMinAno?: number | null;
    horasMaxAno?: number | null;
    herramientasUsadas?: string[] | null;
    actividadManualTipo?: string | null;
    estado: string;
    proceso?: {
        id: string;
        nombre: string;
        nivelPrioridad: string;
    };
}

interface GapItemData {
    id: string;
    tenantId: string;
    procesoId?: string | null;
    nombreProceso: string;
    plataformaActual: string;
    estadoCobertura: string;
    funcionalidadFaltante: string;
    solucionPropuesta: string;
    prioridad: string;
    proceso?: {
        id: string;
        nombre: string;
    } | null;
}

interface ModuloPlanData {
    id: string;
    tenantId: string;
    procesoOrigenId?: string | null;
    nombreModulo: string;
    faseRoadmap: number;
    objetivo: string;
    problemaQueResuelve: string;
    especificacionJson: unknown;
    especificacionMd?: string | null;
    prioridad: string;
    complejidad: string;
    beneficioCualitativo: string;
    ahorroHorasAnualMin: number;
    ahorroHorasAnualMax: number;
    estado: string; // PENDIENTE | APROBADO | RECHAZADO | MODIFICADO | EN_ESPERA
    fechaDecision?: string | null;
    decisionPor?: string | null;
    comentarioDecision?: string | null;
    procesoOrigen?: {
        id: string;
        nombre: string;
        prioridadScore: number;
    } | null;
}

export default function AuditoriaInteligentePanel({
    tenantId: propTenantId,
    readOnly = false,
}: {
    tenantId?: string;
    readOnly?: boolean;
}) {
    const { data: session } = useSession();
    const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string; name?: string; email?: string } | undefined;
    const tenantId = propTenantId || user?.organizacionId || user?.tenantId;

    const [tab, setTab] = useState<"resumen" | "procesos" | "tareas" | "gap" | "modulos" | "explorador" | "hilos" | "cuenta">("resumen");
    const [cuenta, setCuenta] = useState<CuentaAuditoriaData | null>(null);
    const [loadingCuenta, setLoadingCuenta] = useState(true);
    const [ingestando, setIngestando] = useState(false);
    const [importandoPlanes, setImportandoPlanes] = useState(false);

    // Formulario de cuenta
    const [formEmail, setFormEmail] = useState("");
    const [formNombre, setFormNombre] = useState("");
    const [formDirectorio, setFormDirectorio] = useState("");
    const [formTipoFuente, setFormTipoFuente] = useState("CORPUS_LOCAL");
    const [guardandoCuenta, setGuardandoCuenta] = useState(false);

    // Descubrimientos & Planes
    const [procesos, setProcesos] = useState<ProcesoData[]>([]);
    const [tareas, setTareas] = useState<TareaData[]>([]);
    const [gapItems, setGapItems] = useState<GapItemData[]>([]);
    const [modulos, setModulos] = useState<ModuloPlanData[]>([]);
    const [loadingPlanes, setLoadingPlanes] = useState(false);
    const [filtroProcesoTarea, setFiltroProcesoTarea] = useState<string>("TODOS");
    const [filtroGap, setFiltroGap] = useState<string>("TODOS");
    const [selectedModulo, setSelectedModulo] = useState<ModuloPlanData | null>(null);
    const [modalDecision, setModalDecision] = useState<{ moduloId: string; estado: string; titulo: string } | null>(null);
    const [comentarioDecision, setComentarioDecision] = useState("");
    const [guardandoDecision, setGuardandoDecision] = useState(false);

    // Explorador de mensajes
    const [mensajes, setMensajes] = useState<MensajeData[]>([]);
    const [loadingMensajes, setLoadingMensajes] = useState(false);
    const [totalMensajes, setTotalMensajes] = useState(0);
    const [pageMensajes, setPageMensajes] = useState(1);
    const [searchQ, setSearchQ] = useState("");
    const [filtroBandeja, setFiltroBandeja] = useState<string>("TODOS");
    const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
    const [filtroPlazos, setFiltroPlazos] = useState<boolean>(false);
    const [filtroAdjuntos, setFiltroAdjuntos] = useState<boolean>(false);
    const [selectedMensaje, setSelectedMensaje] = useState<MensajeData | null>(null);

    // Hilos
    const [hilos, setHilos] = useState<HiloData[]>([]);
    const [loadingHilos, setLoadingHilos] = useState(false);
    const [totalHilos, setTotalHilos] = useState(0);
    const [pageHilos, setPageHilos] = useState(1);
    const [searchHilos, setSearchHilos] = useState("");
    const [selectedHilo, setSelectedHilo] = useState<HiloData | null>(null);

    // Cargar Cuenta
    async function loadCuenta() {
        setLoadingCuenta(true);
        try {
            const res = await fetch("/api/admin/auditoria/cuenta");
            if (res.ok) {
                const data = await res.json();
                setCuenta(data);
                if (data) {
                    setFormEmail(data.email || "");
                    setFormNombre(data.nombreTitular || "");
                    setFormDirectorio(data.directorioCorpus || "");
                    setFormTipoFuente(data.tipoFuente || "CORPUS_LOCAL");
                }
            }
        } catch (err) {
            console.error("Error al cargar cuenta:", err);
            toast.error("Error al conectar con la cuenta de auditoría");
        } finally {
            setLoadingCuenta(false);
        }
    }

    // Cargar Planes y Descubrimientos
    async function loadPlanes() {
        setLoadingPlanes(true);
        try {
            const res = await fetch("/api/admin/auditoria/planes");
            if (res.ok) {
                const data = await res.json();
                setProcesos(data.procesos || []);
                setTareas(data.tareas || []);
                setGapItems(data.gapItems || []);
                setModulos(data.modulos || []);
            }
        } catch (err) {
            console.error("Error al cargar planes y descubrimientos:", err);
        } finally {
            setLoadingPlanes(false);
        }
    }

    // Guardar Cuenta
    async function handleGuardarCuenta(e: React.FormEvent) {
        e.preventDefault();
        setGuardandoCuenta(true);
        try {
            const res = await fetch("/api/admin/auditoria/cuenta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId,
                    email: formEmail,
                    nombreTitular: formNombre,
                    tipoFuente: formTipoFuente,
                    directorioCorpus: formDirectorio,
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al guardar configuración");
            }
            const data = await res.json();
            setCuenta(data);
            toast.success("Configuración de Cuenta guardada correctamente");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error al guardar";
            toast.error(msg);
        } finally {
            setGuardandoCuenta(false);
        }
    }

    // Ingestar Local (Correos y Adjuntos)
    async function handleEjecutarIngesta() {
        if (!confirm("¿Deseas iniciar la ingesta del corpus local de 5,272 correos y sus adjuntos a PostgreSQL?")) return;
        setIngestando(true);
        toast.loading("Procesando archivos del corpus e ingesta a base de datos...", { id: "ingesta" });
        try {
            const res = await fetch("/api/admin/auditoria/ingestar-local", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cuentaId: cuenta?.id,
                    tenantId,
                    directorioCorpus: formDirectorio,
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error en la ingesta");
            }
            const result = await res.json();
            toast.success(`¡Ingesta completada! ${result.totalMensajes} mensajes y ${result.totalAdjuntos} adjuntos listos en ${result.duracionSegundos}s.`, { id: "ingesta" });
            await loadCuenta();
            if (tab === "explorador") loadMensajes();
            if (tab === "hilos") loadHilos();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error durante la ingesta";
            toast.error(msg, { id: "ingesta" });
        } finally {
            setIngestando(false);
        }
    }

    // Importar Planes y Descubrimientos
    async function handleImportarPlanes() {
        if (!confirm("¿Deseas importar el Catálogo de Procesos (10), Micro-tareas (38), Matriz GAP y Planes de Módulos (7) a la base de datos?")) return;
        setImportandoPlanes(true);
        toast.loading("Importando procesos, tareas, brechas y planes de desarrollo...", { id: "import-planes" });
        try {
            const res = await fetch("/api/admin/auditoria/importar-planes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    directorioCorpus: formDirectorio,
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al importar planes");
            }
            const data = await res.json();
            toast.success(
                `¡Importación completada! ${data.procesosImportados} procesos, ${data.tareasImportadas} micro-tareas, ${data.gapItemsImportados} brechas y ${data.modulosImportados} módulos registrados.`,
                { id: "import-planes", duration: 5000 }
            );
            await loadPlanes();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error durante la importación";
            toast.error(msg, { id: "import-planes" });
        } finally {
            setImportandoPlanes(false);
        }
    }

    // Workflow de Aprobación de Módulos
    async function handleConfirmarDecision() {
        if (!modalDecision) return;
        setGuardandoDecision(true);
        try {
            const res = await fetch(`/api/admin/auditoria/modulos/${modalDecision.moduloId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    estado: modalDecision.estado,
                    comentario: comentarioDecision,
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al registrar decisión");
            }
            toast.success(`Estado del módulo ${modalDecision.moduloId} actualizado a "${modalDecision.estado}"`);
            setModalDecision(null);
            setComentarioDecision("");
            await loadPlanes();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error al guardar decisión";
            toast.error(msg);
        } finally {
            setGuardandoDecision(false);
        }
    }

    // Cargar Mensajes
    async function loadMensajes() {
        setLoadingMensajes(true);
        try {
            const params = new URLSearchParams({
                page: pageMensajes.toString(),
                limit: "20",
            });
            if (tenantId) params.append("tenantId", tenantId);
            if (searchQ) params.append("q", searchQ);
            if (filtroBandeja && filtroBandeja !== "TODOS") params.append("bandeja", filtroBandeja);
            if (filtroCategoria && filtroCategoria !== "TODAS") params.append("categoria", filtroCategoria);
            if (filtroPlazos) params.append("plazos", "true");
            if (filtroAdjuntos) params.append("adjuntos", "true");

            const res = await fetch(`/api/admin/auditoria/mensajes?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setMensajes(data.mensajes || []);
                setTotalMensajes(data.total || 0);
            }
        } catch (err) {
            console.error("Error al cargar mensajes:", err);
        } finally {
            setLoadingMensajes(false);
        }
    }

    // Cargar Hilos
    async function loadHilos() {
        setLoadingHilos(true);
        try {
            const params = new URLSearchParams({
                page: pageHilos.toString(),
                limit: "15",
            });
            if (tenantId) params.append("tenantId", tenantId);
            if (searchHilos) params.append("q", searchHilos);

            const res = await fetch(`/api/admin/auditoria/hilos?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setHilos(data.hilos || []);
                setTotalHilos(data.total || 0);
            }
        } catch (err) {
            console.error("Error al cargar hilos:", err);
        } finally {
            setLoadingHilos(false);
        }
    }

    useEffect(() => {
        loadCuenta();
        loadPlanes();
    }, []);

    useEffect(() => {
        if (tab === "explorador") loadMensajes();
        if (tab === "hilos") loadHilos();
        if (["procesos", "tareas", "gap", "modulos"].includes(tab)) loadPlanes();
    }, [tab, pageMensajes, pageHilos, filtroBandeja, filtroCategoria, filtroPlazos, filtroAdjuntos]);

    // Filtrar tareas
    const tareasFiltradas = tareas.filter((t) => {
        if (filtroProcesoTarea !== "TODOS" && t.procesoId !== filtroProcesoTarea) return false;
        return true;
    });

    // Filtrar gap items
    const gapFiltrados = gapItems.filter((g) => {
        if (filtroGap !== "TODOS" && g.estadoCobertura !== filtroGap) return false;
        return true;
    });

    // Cálculos de ahorro
    const totalAhorroMin = modulos.reduce((acc, m) => acc + (m.ahorroHorasAnualMin || 0), 0);
    const totalAhorroMax = modulos.reduce((acc, m) => acc + (m.ahorroHorasAnualMax || 0), 0);
    const modulosAprobados = modulos.filter((m) => m.estado === "APROBADO").length;

    return (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header del Módulo con Aislamiento Tenant */}
            <div style={{
                background: "linear-gradient(135deg, #0f172a, #1e293b)",
                borderRadius: "16px",
                padding: "1.5rem 1.75rem",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "12px",
                            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)"
                        }}>
                            <Bot size={26} />
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "white", margin: 0 }}>
                                    Auditoría Inteligente & Descubrimiento de Procesos ATP
                                </h2>
                                <span style={{
                                    fontSize: "0.6875rem",
                                    padding: "0.2rem 0.6rem",
                                    borderRadius: "20px",
                                    background: "rgba(59, 130, 246, 0.2)",
                                    color: "#93c5fd",
                                    fontWeight: 700,
                                    border: "1px solid rgba(59, 130, 246, 0.3)"
                                }}>
                                    Tenant: {tenantId || "No asignado"}
                                </span>
                            </div>
                            <p style={{ color: "#94a3b8", fontSize: "0.8125rem", margin: "0.25rem 0 0" }}>
                                Motor de análisis semántico, extracción de evidencia documental y hoja de ruta tecnológica para la supervisión escolar.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
                        <button
                            onClick={handleImportarPlanes}
                            disabled={importandoPlanes || readOnly}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                                color: "white",
                                border: "none",
                                padding: "0.625rem 1.125rem",
                                borderRadius: "10px",
                                fontSize: "0.8125rem",
                                fontWeight: 700,
                                cursor: importandoPlanes || readOnly ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <Workflow size={15} className={importandoPlanes ? "spin" : ""} />
                            <span>{importandoPlanes ? "Importando..." : "Importar Descubrimientos"}</span>
                        </button>

                        <button
                            onClick={handleEjecutarIngesta}
                            disabled={ingestando || readOnly}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                background: "linear-gradient(135deg, #10b981, #059669)",
                                color: "white",
                                border: "none",
                                padding: "0.625rem 1.125rem",
                                borderRadius: "10px",
                                fontSize: "0.8125rem",
                                fontWeight: 700,
                                cursor: ingestando || readOnly ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <RefreshCw size={15} className={ingestando ? "spin" : ""} />
                            <span>{ingestando ? "Ingestando Corpus..." : "Importar Evidencia Local"}</span>
                        </button>
                    </div>
                </div>

                {/* Métricas clave */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "0.75rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid rgba(255,255,255,0.08)"
                }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: "0.6875rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total Correos</div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#60a5fa", marginTop: "0.2rem" }}>
                            {cuenta?.totalMensajes?.toLocaleString() || "0"}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                            {cuenta?.totalHilos?.toLocaleString() || 0} hilos corroborados
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: "0.6875rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Procesos Detectados</div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#34d399", marginTop: "0.2rem" }}>
                            {procesos.length} Procesos
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                            {tareas.length} micro-tareas repetitivas
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: "0.6875rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Módulos Propuestos</div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#fbbf24", marginTop: "0.2rem" }}>
                            {modulos.length} Módulos
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                            {modulosAprobados} aprobados • {modulos.length - modulosAprobados} pendientes
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: "0.6875rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Ahorro Proyectado</div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#a78bfa", marginTop: "0.2rem" }}>
                            {totalAhorroMin} - {totalAhorroMax} hrs/año
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                            Recuperación de capacidad operativa
                        </div>
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas */}
            <div style={{
                display: "flex",
                gap: "0.375rem",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "0.25rem",
                overflowX: "auto"
            }}>
                <button
                    onClick={() => setTab("resumen")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "resumen" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "resumen" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "resumen" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Layers size={15} />
                    <span>Resumen & Roadmap</span>
                </button>

                <button
                    onClick={() => setTab("modulos")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "modulos" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "modulos" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "modulos" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Boxes size={15} />
                    <span>Módulos & Aprobación ({modulos.length})</span>
                </button>

                <button
                    onClick={() => setTab("procesos")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "procesos" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "procesos" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "procesos" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Workflow size={15} />
                    <span>Catálogo de Procesos ({procesos.length})</span>
                </button>

                <button
                    onClick={() => setTab("tareas")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "tareas" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "tareas" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "tareas" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <ListTodo size={15} />
                    <span>Micro-tareas Repetitivas ({tareas.length})</span>
                </button>

                <button
                    onClick={() => setTab("gap")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "gap" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "gap" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "gap" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <SplitSquareVertical size={15} />
                    <span>Matriz GAP ({gapItems.length})</span>
                </button>

                <button
                    onClick={() => setTab("explorador")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "explorador" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "explorador" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "explorador" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Mail size={15} />
                    <span>Explorador de Correos</span>
                </button>

                <button
                    onClick={() => setTab("hilos")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "hilos" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "hilos" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "hilos" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Sliders size={15} />
                    <span>Hilos Temáticos</span>
                </button>

                <button
                    onClick={() => setTab("cuenta")}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.625rem 0.875rem",
                        background: "none",
                        border: "none",
                        borderBottom: tab === "cuenta" ? "2px solid var(--primary)" : "2px solid transparent",
                        color: tab === "cuenta" ? "var(--primary)" : "var(--text-muted)",
                        fontWeight: tab === "cuenta" ? 700 : 500,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    <Database size={15} />
                    <span>Configuración Fuente</span>
                </button>
            </div>

            {/* CONTENIDO DE PESTAÑAS */}

            {/* 1. RESUMEN & ROADMAP */}
            {tab === "resumen" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {/* Alerta de Gobernanza y Aprobación */}
                    <div style={{
                        background: "rgba(59, 130, 246, 0.08)",
                        border: "1px solid rgba(59, 130, 246, 0.25)",
                        borderRadius: "12px",
                        padding: "1rem 1.25rem",
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "center"
                    }}>
                        <Shield size={24} style={{ color: "var(--primary)", flexShrink: 0 }} />
                        <div style={{ fontSize: "0.8125rem", color: "var(--text-main)" }}>
                            <strong>Gobernanza de Implementación:</strong> Los módulos propuestos se derivaron automáticamente del análisis de auditoría de los 5,272 correos institucionales. <em>Ningún módulo entrará en fase de desarrollo o afectará el código fuente hasta que sea formalmente APROBADO</em> en la pestaña de <strong>Módulos & Aprobación</strong>.
                        </div>
                    </div>

                    {/* Resumen de Fases del Roadmap */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                        <div className="card" style={{ borderLeft: "4px solid #3b82f6" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#3b82f6" }}>FASE 1 (Semanas 1–3)</span>
                                <span className="badge badge-info">Urgente</span>
                            </div>
                            <h4 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1rem" }}>Núcleo de Oficios y Plazos Urgentes</h4>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                                Módulo ATP-MOD-01 para recepción, extracción OCR de plazos fatales y recolección masiva de acuses.
                            </p>
                            <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#10b981" }}>
                                Ahorro: 180 – 360 horas/año
                            </div>
                        </div>

                        <div className="card" style={{ borderLeft: "4px solid #10b981" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981" }}>FASE 2 (Semanas 4–6)</span>
                                <span className="badge badge-success">Alto Impacto</span>
                            </div>
                            <h4 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1rem" }}>Plantillas SPARH y Estadística 911</h4>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                                Módulos ATP-MOD-02 y ATP-MOD-03 para validación matemática de nómina y cruce de matrícula SICEP.
                            </p>
                            <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#10b981" }}>
                                Ahorro: 216 – 432 horas/año
                            </div>
                        </div>

                        <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b" }}>FASE 3 (Semanas 7–9)</span>
                                <span className="badge badge-warning">Medio Impacto</span>
                            </div>
                            <h4 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1rem" }}>Becas, USICAMM y Comités</h4>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                                Módulos ATP-MOD-04, ATP-MOD-05 y ATP-MOD-07 para dictamen docente, dispersión de becas y actas.
                            </p>
                            <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#10b981" }}>
                                Ahorro: 148 – 296 horas/año
                            </div>
                        </div>

                        <div className="card" style={{ borderLeft: "4px solid #8b5cf6" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6" }}>FASE 4 (Semanas 10–12)</span>
                                <span className="badge" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>Pedagógico</span>
                            </div>
                            <h4 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1rem" }}>Acompañamiento CTE y Cierre</h4>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                                Módulo ATP-MOD-06 para síntesis analítica de acuerdos CTE y fin de ciclo escolar.
                            </p>
                            <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#10b981" }}>
                                Ahorro: 50 – 100 horas/año
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. MÓDULOS & WORKFLOW DE APROBACIÓN */}
            {tab === "modulos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
                                Hoja de Ruta de Módulos & Mesa de Decisión
                            </h3>
                            <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", margin: "0.25rem 0 0" }}>
                                Evalúa cada especificación técnica y decide el estatus de implementación.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {modulos.map((m) => {
                            const badgeColor =
                                m.estado === "APROBADO" ? "#10b981" :
                                m.estado === "RECHAZADO" ? "#ef4444" :
                                m.estado === "MODIFICADO" ? "#3b82f6" :
                                m.estado === "EN_ESPERA" ? "#f59e0b" : "#64748b";

                            return (
                                <div
                                    key={m.id}
                                    className="card"
                                    style={{
                                        borderLeft: `4px solid ${badgeColor}`,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.75rem"
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <span style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--primary)", fontSize: "0.875rem" }}>
                                                    {m.id}
                                                </span>
                                                <span className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", fontSize: "0.6875rem" }}>
                                                    Fase {m.faseRoadmap}
                                                </span>
                                                <span className="badge" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", fontSize: "0.6875rem" }}>
                                                    Prioridad: {m.prioridad}
                                                </span>
                                                <span className="badge" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontSize: "0.6875rem" }}>
                                                    Complejidad: {m.complejidad}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: "0.375rem 0 0", fontSize: "1.0625rem", fontWeight: 700 }}>
                                                {m.nombreModulo}
                                            </h4>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{
                                                padding: "0.35rem 0.75rem",
                                                borderRadius: "20px",
                                                background: `${badgeColor}15`,
                                                color: badgeColor,
                                                fontWeight: 800,
                                                fontSize: "0.75rem",
                                                border: `1px solid ${badgeColor}40`,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.375rem"
                                            }}>
                                                {m.estado === "APROBADO" && <CheckCircle size={14} />}
                                                {m.estado === "RECHAZADO" && <XCircle size={14} />}
                                                {m.estado === "EN_ESPERA" && <PauseCircle size={14} />}
                                                {m.estado === "MODIFICADO" && <Edit3 size={14} />}
                                                {m.estado === "PENDIENTE" && <Clock size={14} />}
                                                <span>{m.estado}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.8125rem" }}>
                                        <div>
                                            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Objetivo:</span>
                                            <p style={{ margin: "0.2rem 0 0", lineHeight: 1.4 }}>{m.objetivo}</p>
                                        </div>
                                        <div>
                                            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Problema que Resuelve:</span>
                                            <p style={{ margin: "0.2rem 0 0", lineHeight: 1.4 }}>{m.problemaQueResuelve}</p>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        background: "var(--bg-secondary)",
                                        padding: "0.625rem 0.875rem",
                                        borderRadius: "8px",
                                        fontSize: "0.75rem"
                                    }}>
                                        <div style={{ display: "flex", gap: "1.25rem" }}>
                                            <span><strong>Ahorro anual:</strong> {m.ahorroHorasAnualMin} – {m.ahorroHorasAnualMax} hrs</span>
                                            <span><strong>Proceso origen:</strong> {m.procesoOrigenId || "General"}</span>
                                            {m.decisionPor && (
                                                <span style={{ color: "var(--text-muted)" }}>
                                                    Decidido por <strong>{m.decisionPor}</strong> {m.fechaDecision ? `el ${new Date(m.fechaDecision).toLocaleDateString()}` : ""}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", gap: "0.375rem" }}>
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={() => setSelectedModulo(m)}
                                                style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem" }}
                                            >
                                                <FileCode2 size={13} />
                                                <span>Ver Spec</span>
                                            </button>

                                            {!readOnly && (
                                                <>
                                                    <button
                                                        className="btn btn-sm"
                                                        onClick={() => setModalDecision({ moduloId: m.id, estado: "APROBADO", titulo: `Aprobar ${m.id}` })}
                                                        style={{
                                                            background: "#10b981",
                                                            color: "white",
                                                            border: "none",
                                                            fontSize: "0.75rem",
                                                            padding: "0.25rem 0.6rem"
                                                        }}
                                                    >
                                                        Aprobar
                                                    </button>
                                                    <button
                                                        className="btn btn-sm"
                                                        onClick={() => setModalDecision({ moduloId: m.id, estado: "EN_ESPERA", titulo: `Poner en Espera ${m.id}` })}
                                                        style={{
                                                            background: "#f59e0b",
                                                            color: "white",
                                                            border: "none",
                                                            fontSize: "0.75rem",
                                                            padding: "0.25rem 0.6rem"
                                                        }}
                                                    >
                                                        En Espera
                                                    </button>
                                                    <button
                                                        className="btn btn-sm"
                                                        onClick={() => setModalDecision({ moduloId: m.id, estado: "RECHAZADO", titulo: `Rechazar ${m.id}` })}
                                                        style={{
                                                            background: "#ef4444",
                                                            color: "white",
                                                            border: "none",
                                                            fontSize: "0.75rem",
                                                            padding: "0.25rem 0.6rem"
                                                        }}
                                                    >
                                                        Rechazar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. CATÁLOGO DE PROCESOS (10) */}
            {tab === "procesos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
                            Catálogo de Procesos Identificados en Auditoría ({procesos.length})
                        </h3>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1rem" }}>
                        {procesos.map((p) => (
                            <div key={p.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                            <span style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--primary)", fontSize: "0.8125rem" }}>
                                                {p.id}
                                            </span>
                                            <span className="badge" style={{
                                                background: p.prioridadScore >= 80 ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
                                                color: p.prioridadScore >= 80 ? "#ef4444" : "#3b82f6",
                                                fontSize: "0.6875rem"
                                            }}>
                                                Prioridad: {p.prioridadScore} pts
                                            </span>
                                        </div>
                                        <h4 style={{ margin: "0.25rem 0 0", fontSize: "0.9375rem", fontWeight: 700 }}>
                                            {p.nombre}
                                        </h4>
                                    </div>
                                    <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>
                                        Nivel {p.automatizabilidad}
                                    </span>
                                </div>

                                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                                    {p.descripcion}
                                </p>

                                <div style={{
                                    background: "var(--bg-secondary)",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "6px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "0.75rem"
                                }}>
                                    <span><strong>Origen:</strong> {p.origenPrincipal}</span>
                                    <span><strong>Ahorro:</strong> {p.ahorroEstimadoHoras} hrs/año</span>
                                </div>

                                <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                                    <strong>Evidencia:</strong> {p.razonDeteccion}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. MICRO-TAREAS REPETITIVAS (38) */}
            {tab === "tareas" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
                            Inventario de Micro-tareas Repetitivas ({tareasFiltradas.length})
                        </h3>

                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Filtrar por Proceso:</label>
                            <select
                                className="form-select"
                                value={filtroProcesoTarea}
                                onChange={(e) => setFiltroProcesoTarea(e.target.value)}
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                            >
                                <option value="TODOS">Todos los procesos</option>
                                {procesos.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.id} - {p.nombre.substring(0, 40)}...
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table className="table" style={{ width: "100%", fontSize: "0.8125rem" }}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Proceso</th>
                                    <th>Tarea</th>
                                    <th>Frecuencia Anual</th>
                                    <th>Tiempo Unit.</th>
                                    <th>Horas/Año</th>
                                    <th>Herramienta Actual</th>
                                    <th>Automatización Propuesta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tareasFiltradas.map((t) => (
                                    <tr key={t.id}>
                                        <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{t.id}</td>
                                        <td style={{ fontFamily: "monospace", color: "var(--primary)" }}>{t.procesoId}</td>
                                        <td>
                                            <strong>{t.nombre}</strong>
                                            {t.descripcion && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{t.descripcion}</div>}
                                        </td>
                                        <td>{t.frecuenciaAnual} veces</td>
                                        <td>{t.tiempoMinUnitario}–{t.tiempoMaxUnitario} min</td>
                                        <td><strong>{t.horasMinAno}–{t.horasMaxAno} h</strong></td>
                                        <td><span className="badge badge-secondary">{t.actividadManualTipo || "Manual"}</span></td>
                                        <td style={{ color: "#10b981", fontSize: "0.75rem" }}>{t.automatizacionPropuesta}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 5. MATRIZ GAP */}
            {tab === "gap" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
                            Matriz GAP: Cobertura de Procesos vs Plataforma Actual ({gapFiltrados.length})
                        </h3>

                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 600 }}>Filtrar Cobertura:</label>
                            <select
                                className="form-select"
                                value={filtroGap}
                                onChange={(e) => setFiltroGap(e.target.value)}
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                            >
                                <option value="TODOS">Todas las coberturas</option>
                                <option value="NO CUBIERTO">NO CUBIERTO</option>
                                <option value="PARCIAL">PARCIAL</option>
                                <option value="CUBIERTO">CUBIERTO</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {gapFiltrados.map((g) => {
                            const badgeBg =
                                g.estadoCobertura === "CUBIERTO" ? "#10b981" :
                                g.estadoCobertura === "PARCIAL" ? "#f59e0b" : "#ef4444";

                            return (
                                <div key={g.id} className="card" style={{ borderLeft: `4px solid ${badgeBg}` }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--primary)", fontSize: "0.8125rem" }}>
                                                {g.procesoId}
                                            </span>
                                            <h4 style={{ margin: "0.2rem 0", fontSize: "1rem" }}>{g.nombreProceso}</h4>
                                        </div>
                                        <span style={{
                                            padding: "0.25rem 0.6rem",
                                            borderRadius: "12px",
                                            background: `${badgeBg}20`,
                                            color: badgeBg,
                                            fontWeight: 800,
                                            fontSize: "0.75rem"
                                        }}>
                                            {g.estadoCobertura}
                                        </span>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8125rem" }}>
                                        <div>
                                            <strong style={{ color: "var(--text-muted)" }}>Diagnóstico de Brecha:</strong>
                                            <p style={{ margin: "0.2rem 0 0", lineHeight: 1.4 }}>{g.funcionalidadFaltante}</p>
                                        </div>
                                        <div>
                                            <strong style={{ color: "var(--text-muted)" }}>Solución Propuesta:</strong>
                                            <p style={{ margin: "0.2rem 0 0", color: "var(--primary)", fontWeight: 600 }}>{g.solucionPropuesta}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 6. EXPLORADOR DE MENSAJES */}
            {tab === "explorador" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <div style={{ position: "relative", minWidth: "260px" }}>
                                <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-muted)" }} />
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Buscar en asunto o ID..."
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") loadMensajes(); }}
                                    style={{ paddingLeft: "32px", fontSize: "0.8125rem" }}
                                />
                            </div>
                            <button className="btn btn-sm btn-primary" onClick={loadMensajes}>Buscar</button>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <select
                                className="form-select"
                                value={filtroBandeja}
                                onChange={(e) => setFiltroBandeja(e.target.value)}
                                style={{ fontSize: "0.75rem" }}
                            >
                                <option value="TODOS">Todas las bandejas</option>
                                <option value="BandejaEntrada">Entrada (3,068)</option>
                                <option value="Enviados">Enviados (2,204)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table className="table" style={{ width: "100%", fontSize: "0.8125rem" }}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Bandeja</th>
                                    <th>Fecha</th>
                                    <th>Remitente</th>
                                    <th>Asunto</th>
                                    <th>Adjuntos</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingMensajes ? (
                                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>Cargando mensajes...</td></tr>
                                ) : mensajes.map((m) => (
                                    <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => setSelectedMensaje(m)}>
                                        <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{m.id}</td>
                                        <td>
                                            <span className={`badge badge-${m.bandeja === "BandejaEntrada" ? "info" : "secondary"}`}>
                                                {m.bandeja === "BandejaEntrada" ? "Entrada" : "Enviado"}
                                            </span>
                                        </td>
                                        <td style={{ whiteSpace: "nowrap" }}>{new Date(m.fechaMensaje).toLocaleDateString()}</td>
                                        <td>{m.remitenteEmail || "(remitente no disponible)"}</td>
                                        <td style={{ fontWeight: 600 }}>{m.asunto}</td>
                                        <td>{m.tieneAdjuntos ? `📎 ${m.numAdjuntos}` : "—"}</td>
                                        <td>
                                            <button className="btn btn-xs btn-outline">Ver</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 7. HILOS */}
            {tab === "hilos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
                            Hilos Temáticos y Conversaciones ({totalHilos})
                        </h3>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.75rem" }}>
                        {hilos.map((h) => (
                            <div key={h.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{h.hiloId}</span>
                                    <span className="badge badge-info">{h.numMensajes} mensajes</span>
                                </div>
                                <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700 }}>{h.asuntoNormalizado}</h4>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    {new Date(h.fechaInicio).toLocaleDateString()} — {new Date(h.fechaFin).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 8. CONFIGURACIÓN DE CUENTA */}
            {tab === "cuenta" && (
                <div className="card" style={{ maxWidth: "600px", margin: "0 auto", width: "100%" }}>
                    <h3 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>
                        Configuración de Cuenta de Auditoría
                    </h3>
                    <form onSubmit={handleGuardarCuenta} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                                Correo Electrónico Institucional
                            </label>
                            <input
                                type="email"
                                className="form-control"
                                value={formEmail}
                                onChange={(e) => setFormEmail(e.target.value)}
                                placeholder="ejemplo@seppue.gob.mx"
                                required
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                                Nombre del Titular / Supervisión
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={formNombre}
                                onChange={(e) => setFormNombre(e.target.value)}
                                placeholder="Supervisión Escolar de Bachilleratos"
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                                Tipo de Fuente
                            </label>
                            <select
                                className="form-select"
                                value={formTipoFuente}
                                onChange={(e) => setFormTipoFuente(e.target.value)}
                            >
                                <option value="CORPUS_LOCAL">Corpus Local Extraído (Recomendado)</option>
                                <option value="MICROSOFT_GRAPH">Microsoft Graph (Monitoreo Futuro)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                                Directorio del Corpus Local
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                value={formDirectorio}
                                onChange={(e) => setFormDirectorio(e.target.value)}
                                placeholder="C:\NotebookLM\BaseConocimiento"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={guardandoCuenta || readOnly}
                            className="btn btn-primary"
                            style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}
                        >
                            {guardandoCuenta ? "Guardando..." : "Guardar Configuración"}
                        </button>
                    </form>
                </div>
            )}

            {/* MODAL: VER ESPECIFICACIÓN TÉCNICA MARKDOWN */}
            {selectedModulo && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                    zIndex: 1200
                }}>
                    <div className="card" style={{ maxWidth: "800px", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
                            <div>
                                <span style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--primary)" }}>{selectedModulo.id}</span>
                                <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.125rem" }}>{selectedModulo.nombreModulo}</h3>
                            </div>
                            <button className="btn btn-sm btn-outline" onClick={() => setSelectedModulo(null)}>Cerrar</button>
                        </div>

                        <div style={{ overflowY: "auto", padding: "1rem 0", fontSize: "0.8125rem", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                            {selectedModulo.especificacionMd || "Sin especificación detallada."}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: REGISTRAR DECISIÓN DE GOBERNANZA */}
            {modalDecision && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                    zIndex: 1200
                }}>
                    <div className="card" style={{ maxWidth: "480px", width: "100%" }}>
                        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>{modalDecision.titulo}</h3>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: "0 0 1rem" }}>
                            ¿Confirmas que deseas cambiar el estatus del módulo a <strong>{modalDecision.estado}</strong>?
                        </p>

                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                Comentario / Nota de la decisión (Opcional):
                            </label>
                            <textarea
                                className="form-control"
                                rows={3}
                                value={comentarioDecision}
                                onChange={(e) => setComentarioDecision(e.target.value)}
                                placeholder="Ej: Aprobado para iniciar en Fase 1 según calendario acordado..."
                            />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                            <button className="btn btn-outline" onClick={() => setModalDecision(null)}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirmarDecision}
                                disabled={guardandoDecision}
                            >
                                {guardandoDecision ? "Guardando..." : "Confirmar Decisión"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: VER MENSAJE */}
            {selectedMensaje && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                    zIndex: 1200
                }}>
                    <div className="card" style={{ maxWidth: "680px", width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                            <div>
                                <span style={{ fontFamily: "monospace", color: "var(--primary)", fontWeight: 700 }}>{selectedMensaje.id}</span>
                                <h3 style={{ margin: "0.25rem 0", fontSize: "1rem" }}>{selectedMensaje.asunto}</h3>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    De: {selectedMensaje.remitenteEmail || "(remitente no disponible)"} • {new Date(selectedMensaje.fechaMensaje).toLocaleString()}
                                </div>
                            </div>
                            <button className="btn btn-sm btn-outline" onClick={() => setSelectedMensaje(null)}>Cerrar</button>
                        </div>

                        <div style={{ marginTop: "1rem", fontSize: "0.8125rem" }}>
                            <strong>Ruta Markdown:</strong>
                            <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                                {selectedMensaje.rutaMd || "No asignada"}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
