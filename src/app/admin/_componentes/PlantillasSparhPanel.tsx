"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
    FileSpreadsheet,
    Upload,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Download,
    RefreshCw,
    Trash2,
    Users,
    Clock,
    FileText,
    School,
    ArrowRight,
    Send,
    Eye,
    ShieldCheck
} from "lucide-react";
import toast from "react-hot-toast";

interface EscuelaItem {
    id: string;
    nombre: string;
    cct: string;
    claveEscuela?: string | null;
}

interface Inconsistencia {
    id: string;
    escuelaCCT?: string | null;
    tipoInconsistencia: string;
    severidad: "INFO" | "ADVERTENCIA" | "ERROR_CRITICO";
    filaNumero?: number | null;
    columnaCampo?: string | null;
    valorEncontrado?: string | null;
    descripcion: string;
    createdAt: string;
}

interface PlantillaRegistro {
    id: string;
    tenantId: string;
    escuelaId?: string | null;
    escuelaCCT?: string | null;
    escuelaNombre?: string | null;
    nombreArchivo: string;
    sha256Hash: string;
    pdfNombre?: string | null;
    pdfUrl?: string | null;
    excelNombre?: string | null;
    excelUrl?: string | null;
    fechaEntregaPdf?: string | null;
    fechaSubidaExcel?: string | null;
    observacionesSupervision?: string | null;
    totalRegistros: number;
    totalHoras: number;
    estado: "PENDIENTE" | "RECIBIDO" | "VALIDADO" | "CON_ERRORES" | "CORREGIR" | "LISTO_PARA_CORDE" | "ENTREGADO_A_CORDE" | "CARGADO" | "EN_VALIDACION" | "CONSOLIDADO";
    createdAt: string;
    _count?: {
        plazas: number;
        inconsistencias: number;
    };
    inconsistencias?: Inconsistencia[];
}

export default function PlantillasSparhPanel({
    tenantId: propTenantId,
    readOnly = false
}: {
    tenantId?: string;
    readOnly?: boolean;
}) {
    const { data: session } = useSession() || {};
    const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
    const tenantId = propTenantId || user?.organizacionId || user?.tenantId || "zona004";

    const [tab, setTab] = useState<"tablero" | "carga" | "inconsistencias">("tablero");
    const [escuelas, setEscuelas] = useState<EscuelaItem[]>([]);
    const [registros, setRegistros] = useState<PlantillaRegistro[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [consolidando, setConsolidando] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Form inputs for upload
    const [selectedEscuelaCCT, setSelectedEscuelaCCT] = useState("");
    const pdfFileInputRef = useRef<HTMLInputElement | null>(null);
    const excelFileInputRef = useRef<HTMLInputElement | null>(null);

    async function fetchDatos() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/plantillas");
            if (res.ok) {
                const data = await res.json();
                setEscuelas(data.escuelas || []);
                setRegistros(data.registros || []);
            }
        } catch (err) {
            console.error("Error al cargar plantillas:", err);
            toast.error("Error al cargar el tablero de plantillas SPARH");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchDatos();
    }, []);

    async function handleCambiarEstado(registroId: string, nuevoEstado: string, observaciones?: string) {
        const toastId = toast.loading(`Actualizando estado a ${nuevoEstado}...`);
        try {
            const res = await fetch("/api/admin/plantillas", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: registroId,
                    estado: nuevoEstado,
                    observacionesSupervision: observaciones
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al actualizar estado");
            }

            toast.success(`Estado actualizado a ${nuevoEstado}`, { id: toastId });
            await fetchDatos();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error al actualizar estado";
            toast.error(msg, { id: toastId });
        }
    }

    async function handleUploadForm(e: React.FormEvent) {
        e.preventDefault();
        const pdfFile = pdfFileInputRef.current?.files?.[0];
        const excelFile = excelFileInputRef.current?.files?.[0];

        if (!pdfFile && !excelFile) {
            toast.error("Debe seleccionar al menos el PDF escaneado firmado o el archivo Excel");
            return;
        }

        setUploading(true);
        const toastId = toast.loading("Procesando entregables SPARH...");

        try {
            const formData = new FormData();
            if (pdfFile) formData.append("pdfFile", pdfFile);
            if (excelFile) formData.append("excelFile", excelFile);
            if (selectedEscuelaCCT) formData.append("escuelaCCT", selectedEscuelaCCT);

            const escMatch = escuelas.find(e => e.cct === selectedEscuelaCCT);
            if (escMatch) {
                formData.append("escuelaId", escMatch.id);
                formData.append("escuelaNombre", escMatch.nombre);
            }

            const res = await fetch("/api/admin/plantillas/upload", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al subir entregable");
            }

            const data = await res.json();
            toast.success("¡Entregables SPARH subidos correctamente!", { id: toastId });
            await fetchDatos();
            setTab("tablero");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error de subida";
            toast.error(msg, { id: toastId });
        } finally {
            setUploading(false);
            if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
            if (excelFileInputRef.current) excelFileInputRef.current.value = "";
        }
    }

    async function handleEliminar(id: string) {
        if (!confirm("¿Deseas eliminar este registro de entregable de plantilla?")) return;

        try {
            const res = await fetch(`/api/admin/plantillas?id=${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Registro eliminado correctamente");
                await fetchDatos();
            }
        } catch (err) {
            console.error("Error al eliminar:", err);
            toast.error("Error al eliminar el registro");
        }
    }

    async function handleDescargarConsolidado() {
        setConsolidando(true);
        const toastId = toast.loading("Generando libro oficial de zona Excel...");
        try {
            const res = await fetch("/api/admin/plantillas/consolidar", {
                method: "POST"
            });

            if (!res.ok) throw new Error("Error al generar el archivo consolidado");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `CONSOLIDADO_SPARH_${tenantId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            toast.success("¡Libro oficial descargado exitosamente!", { id: toastId });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error de descarga";
            toast.error(msg, { id: toastId });
        } finally {
            setConsolidando(false);
        }
    }

    // Unir lista de escuelas de la zona con sus registros de plantilla
    const escuelasConEstado = escuelas.map((esc) => {
        const reg = registros.find((r) => r.escuelaCCT === esc.cct || r.escuelaId === esc.id);
        return {
            escuela: esc,
            registro: reg,
            estado: reg ? reg.estado : "PENDIENTE"
        };
    }).filter(item => 
        item.escuela.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.escuela.cct.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalEntregados = registros.filter(r => r.pdfNombre || r.nombreArchivo).length;
    const totalValidados = registros.filter(r => r.estado === "VALIDADO" || r.estado === "LISTO_PARA_CORDE" || r.estado === "ENTREGADO_A_CORDE").length;
    const totalEnCorde = registros.filter(r => r.estado === "ENTREGADO_A_CORDE").length;
    const totalInconsistenciasCount = registros.reduce((acc, r) => acc + (r._count?.inconsistencias || 0), 0);

    const todasInconsistencias = registros.flatMap((r) => r.inconsistencias || []);

    const getBadgeStyle = (estado: string) => {
        switch (estado) {
            case "PENDIENTE":
                return { background: "#f1f5f9", color: "#64748b", border: "1px solid #cbd5e1" };
            case "RECIBIDO":
                return { background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd" };
            case "VALIDADO":
                return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
            case "CON_ERRORES":
            case "CORREGIR":
                return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" };
            case "LISTO_PARA_CORDE":
                return { background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe" };
            case "ENTREGADO_A_CORDE":
                return { background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7" };
            default:
                return { background: "#e2e8f0", color: "#334155", border: "1px solid #cbd5e1" };
        }
    };

    return (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header del Módulo */}
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
                            background: "linear-gradient(135deg, #10b981, #059669)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)"
                        }}>
                            <FileSpreadsheet size={26} />
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "white", margin: 0 }}>
                                    Control de Plantillas SPARH / CENSUS (ATP-MOD-02)
                                </h2>
                                <span style={{
                                    fontSize: "0.6875rem",
                                    padding: "0.2rem 0.6rem",
                                    borderRadius: "20px",
                                    background: "rgba(16, 185, 129, 0.2)",
                                    color: "#6ee7b7",
                                    fontWeight: 700,
                                    border: "1px solid rgba(16, 185, 129, 0.3)"
                                }}>
                                    Zona: {tenantId}
                                </span>
                            </div>
                            <p style={{ color: "#94a3b8", fontSize: "0.8125rem", margin: "0.25rem 0 0" }}>
                                Recepción de PDF escaneado firmado, validación complementaria Excel y entrega física a CORDE.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
                        <button
                            onClick={handleDescargarConsolidado}
                            disabled={consolidando || registros.length === 0}
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
                                cursor: consolidando || registros.length === 0 ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <Download size={15} className={consolidando ? "spin" : ""} />
                            <span>{consolidando ? "Generando..." : "Exportar Concentrado Zona Excel"}</span>
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "1rem"
                }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <School size={14} style={{ color: "#60a5fa" }} /> Escuelas de la Zona
                        </span>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "white", marginTop: "0.4rem" }}>{escuelas.length}</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <FileText size={14} style={{ color: "#38bdf8" }} /> PDF Recibidos
                        </span>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "white", marginTop: "0.4rem" }}>{totalEntregados}</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <CheckCircle2 size={14} style={{ color: "#4ade80" }} /> Plantillas Validadas
                        </span>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "white", marginTop: "0.4rem" }}>{totalValidados}</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <Send size={14} style={{ color: "#c084fc" }} /> Entregados a CORDE
                        </span>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "white", marginTop: "0.4rem" }}>{totalEnCorde}</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <AlertTriangle size={14} style={{ color: "#f59e0b" }} /> Inconsistencias Excel
                        </span>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: totalInconsistenciasCount > 0 ? "#f87171" : "#4ade80", marginTop: "0.4rem" }}>
                            {totalInconsistenciasCount}
                        </div>
                    </div>
                </div>
            </div>

            {/* Pestañas de Navegación */}
            <div style={{
                display: "flex",
                gap: "0.5rem",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "0.5rem"
            }}>
                <button
                    onClick={() => setTab("tablero")}
                    style={{
                        padding: "0.625rem 1rem",
                        borderRadius: "10px",
                        border: "none",
                        background: tab === "tablero" ? "#0f172a" : "transparent",
                        color: tab === "tablero" ? "white" : "#64748b",
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        transition: "all 0.2s ease"
                    }}
                >
                    <School size={16} /> Tablero de Cumplimiento por Escuela
                </button>

                <button
                    onClick={() => setTab("carga")}
                    style={{
                        padding: "0.625rem 1rem",
                        borderRadius: "10px",
                        border: "none",
                        background: tab === "carga" ? "#0f172a" : "transparent",
                        color: tab === "carga" ? "white" : "#64748b",
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        transition: "all 0.2s ease"
                    }}
                >
                    <Upload size={16} /> Registrar Entregable (PDF / Sábana Excel)
                </button>

                <button
                    onClick={() => setTab("inconsistencias")}
                    style={{
                        padding: "0.625rem 1rem",
                        borderRadius: "10px",
                        border: "none",
                        background: tab === "inconsistencias" ? "#0f172a" : "transparent",
                        color: tab === "inconsistencias" ? "white" : "#64748b",
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        transition: "all 0.2s ease"
                    }}
                >
                    <AlertTriangle size={16} /> Matriz de Errores ({todasInconsistencias.length})
                </button>
            </div>

            {/* TABLERO DE CUMPLIMIENTO DE ESCUELAS */}
            {tab === "tablero" && (
                <div className="card" style={{ padding: "1.25rem", borderRadius: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
                        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                            Estado y Seguimiento de Plantillas SPARH por Plantel
                        </h3>

                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                            <input
                                type="text"
                                placeholder="Buscar por CCT o nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    padding: "0.4rem 0.8rem",
                                    borderRadius: "8px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "0.8125rem",
                                    width: "220px"
                                }}
                            />

                            <button
                                onClick={fetchDatos}
                                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontSize: "0.8125rem" }}
                            >
                                <RefreshCw size={14} className={loading ? "spin" : ""} /> Actualizar
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Cargando datos de escuelas...</div>
                    ) : escuelasConEstado.length === 0 ? (
                        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "10px" }}>
                            No hay escuelas registradas o coincidentes en el filtro.
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                <thead>
                                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                                        <th style={{ padding: "0.75rem" }}>CCT</th>
                                        <th style={{ padding: "0.75rem" }}>Escuela / Plantel</th>
                                        <th style={{ padding: "0.75rem" }}>Entregable PDF Escaneado</th>
                                        <th style={{ padding: "0.75rem" }}>Sábana Excel Opcional</th>
                                        <th style={{ padding: "0.75rem" }}>Estado SPARH</th>
                                        <th style={{ padding: "0.75rem" }}>Errores Aritméticos</th>
                                        <th style={{ padding: "0.75rem", textAlign: "right" }}>Acción de Supervisión</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {escuelasConEstado.map(({ escuela, registro, estado }) => {
                                        const badge = getBadgeStyle(estado);
                                        const numInconsistencias = registro?._count?.inconsistencias || 0;

                                        return (
                                            <tr key={escuela.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                <td style={{ padding: "0.75rem", fontWeight: 700, color: "#0f172a" }}>{escuela.cct}</td>
                                                <td style={{ padding: "0.75rem", fontWeight: 600, color: "#334155" }}>{escuela.nombre}</td>

                                                {/* PDF Deliverable */}
                                                <td style={{ padding: "0.75rem" }}>
                                                    {registro?.pdfNombre || registro?.nombreArchivo.endsWith(".pdf") ? (
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#0284c7" }}>
                                                            <FileText size={15} />
                                                            <span style={{ fontWeight: 600 }}>{registro.pdfNombre || registro.nombreArchivo}</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin PDF</span>
                                                    )}
                                                </td>

                                                {/* Excel Deliverable */}
                                                <td style={{ padding: "0.75rem" }}>
                                                    {registro?.excelNombre || registro?.nombreArchivo.endsWith(".xlsx") ? (
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#16a34a" }}>
                                                            <FileSpreadsheet size={15} />
                                                            <span style={{ fontWeight: 600 }}>{registro.excelNombre || registro.nombreArchivo}</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No adjunta</span>
                                                    )}
                                                </td>

                                                {/* Estado Badge */}
                                                <td style={{ padding: "0.75rem" }}>
                                                    <span style={{
                                                        padding: "0.25rem 0.65rem",
                                                        borderRadius: "12px",
                                                        fontSize: "0.75rem",
                                                        fontWeight: 800,
                                                        ...badge
                                                    }}>
                                                        {estado}
                                                    </span>
                                                </td>

                                                {/* Inconsistencias Badge */}
                                                <td style={{ padding: "0.75rem" }}>
                                                    {numInconsistencias > 0 ? (
                                                        <span style={{ color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                            <AlertTriangle size={14} /> {numInconsistencias} error(es)
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: "#10b981", fontWeight: 600 }}>Sin errores</span>
                                                    )}
                                                </td>

                                                {/* Acciones manuales de Supervisión */}
                                                <td style={{ padding: "0.75rem", textAlign: "right" }}>
                                                    {registro ? (
                                                        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                                                            {estado === "PENDIENTE" && (
                                                                <button
                                                                    onClick={() => handleCambiarEstado(registro.id, "RECIBIDO")}
                                                                    style={{ padding: "0.3rem 0.6rem", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                                                                >
                                                                    Marcar Recibido
                                                                </button>
                                                            )}

                                                            {(estado === "RECIBIDO" || estado === "CON_ERRORES") && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleCambiarEstado(registro.id, "VALIDADO")}
                                                                        style={{ padding: "0.3rem 0.6rem", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                                                                    >
                                                                        Validar
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleCambiarEstado(registro.id, "CORREGIR")}
                                                                        style={{ padding: "0.3rem 0.6rem", background: "#f97316", color: "white", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                                                                    >
                                                                        Solicitar Corregir
                                                                    </button>
                                                                </>
                                                            )}

                                                            {estado === "VALIDADO" && (
                                                                <button
                                                                    onClick={() => handleCambiarEstado(registro.id, "LISTO_PARA_CORDE")}
                                                                    style={{ padding: "0.3rem 0.6rem", background: "#8b5cf6", color: "white", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                                                                >
                                                                    Listo p/ CORDE
                                                                </button>
                                                            )}

                                                            {estado === "LISTO_PARA_CORDE" && (
                                                                <button
                                                                    onClick={() => handleCambiarEstado(registro.id, "ENTREGADO_A_CORDE")}
                                                                    style={{ padding: "0.3rem 0.6rem", background: "#059669", color: "white", border: "none", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                                                                >
                                                                    Entregar a CORDE
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => handleEliminar(registro.id)}
                                                                style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", padding: "0.3rem" }}
                                                                title="Eliminar registro"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Esperando entrega del plantel</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* FORMULARIO DE REGISTRO / CARGA */}
            {tab === "carga" && (
                <div className="card" style={{ padding: "1.75rem", borderRadius: "16px" }}>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>
                        Registrar Entregable de Plantilla de Personal (PDF Escaneado + Sábana Excel Opcional)
                    </h3>

                    <form onSubmit={handleUploadForm} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "600px" }}>
                        <div>
                            <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "0.4rem" }}>
                                Seleccionar Escuela / Plantel:
                            </label>
                            <select
                                value={selectedEscuelaCCT}
                                onChange={(e) => setSelectedEscuelaCCT(e.target.value)}
                                style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
                            >
                                <option value="">-- Seleccione una escuela --</option>
                                {escuelas.map((e) => (
                                    <option key={e.id} value={e.cct}>
                                        {e.cct} - {e.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a", display: "block", marginBottom: "0.4rem" }}>
                                Entregable Principal (PDF Escaneado Firmado y Sellado):
                            </label>
                            <input
                                type="file"
                                ref={pdfFileInputRef}
                                accept=".pdf"
                                style={{ fontSize: "0.8125rem" }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a", display: "block", marginBottom: "0.4rem" }}>
                                Sábana Excel Complementaria (Opcional para validación aritmética):
                            </label>
                            <input
                                type="file"
                                ref={excelFileInputRef}
                                accept=".xlsx, .xls"
                                style={{ fontSize: "0.8125rem" }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={uploading || readOnly}
                            style={{
                                padding: "0.75rem 1.5rem",
                                background: "linear-gradient(135deg, #10b981, #059669)",
                                color: "white",
                                border: "none",
                                borderRadius: "10px",
                                fontWeight: 700,
                                fontSize: "0.875rem",
                                cursor: uploading || readOnly ? "not-allowed" : "pointer"
                            }}
                        >
                            {uploading ? "Procesando..." : "Subir y Registrar Entregable"}
                        </button>
                    </form>
                </div>
            )}

            {/* MATRIZ DE INCONSISTENCIAS */}
            {tab === "inconsistencias" && (
                <div className="card" style={{ padding: "1.25rem", borderRadius: "14px" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>
                        Matriz de Inconsistencias y Errores Aritméticos Detectados
                    </h3>

                    {todasInconsistencias.length === 0 ? (
                        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "10px" }}>
                            <CheckCircle2 size={36} style={{ color: "#10b981", marginBottom: "0.5rem" }} />
                            <h4 style={{ margin: 0, color: "#334155" }}>Sin inconsistencias detectadas</h4>
                            <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.25rem 0 0" }}>
                                Todas las plantillas procesadas están validadas.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {todasInconsistencias.map((inc) => (
                                <div
                                    key={inc.id}
                                    style={{
                                        padding: "1rem",
                                        borderRadius: "10px",
                                        borderLeft: `4px solid ${inc.severidad === "ERROR_CRITICO" ? "#ef4444" : "#f59e0b"}`,
                                        background: inc.severidad === "ERROR_CRITICO" ? "#fef2f2" : "#fffbeb",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}
                                >
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ fontSize: "0.75rem", fontWeight: 800, color: inc.severidad === "ERROR_CRITICO" ? "#991b1b" : "#92400e" }}>
                                                [{inc.tipoInconsistencia}]
                                            </span>
                                            {inc.escuelaCCT && (
                                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                                                    Plantel: {inc.escuelaCCT}
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "#1e293b" }}>{inc.descripcion}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
