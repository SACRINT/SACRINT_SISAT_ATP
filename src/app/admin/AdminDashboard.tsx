"use client";

import { signOut } from "next-auth/react";
import {
    BarChart3,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    Eye,
    LogOut,
    School,
    FileText,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Send,
    Upload,
    ToggleLeft,
    ToggleRight,
    Calendar,
    Download,
    Layers,
    Search,
    UserCog,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import GestionEscuelas from "./_componentes/GestionEscuelas";
import GestionFechas from "./_componentes/GestionFechas";
import GestionRecursos from "./_componentes/GestionRecursos";
import GestionProgramas from "./_componentes/GestionProgramas";
import GestionATPs from "./_componentes/GestionATPs";

interface Archivo {
    id: string;
    nombre: string;
    etiqueta: string | null;
    tipo: string;
    createdAt?: string | Date;
}

interface EntregaAdmin {
    id: string;
    estado: string;
    fechaSubida: string | null;
    observacionesATP: string | null;
    archivos: Archivo[];
    correcciones: {
        id: string;
        texto: string | null;
        createdAt: string;
        admin: { nombre: string };
        archivo?: { nombre: string; driveUrl: string | null } | null;
    }[];
    escuela: { id: string; cct: string; nombre: string; localidad: string; total: number };
}

interface PeriodoAdmin {
    id: string;
    mes: number | null;
    semestre: number | null;
    activo: boolean;
    fechaLimite?: Date | string | null;
    entregas: EntregaAdmin[];
}

interface ProgramaAdmin {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: string;
    numArchivos: number;
    orden: number;
    periodos: PeriodoAdmin[];
}

interface EscuelaAdmin {
    id: string;
    cct: string;
    nombre: string;
    localidad: string;
    director?: string | null;
    email?: string | null;
    total: number;
    entregas: {
        id: string;
        estado: string;
        fechaSubida: string | null;
        archivos: Archivo[];
        correcciones: {
            id: string;
            texto: string | null;
            createdAt: string;
            admin: { nombre: string };
            archivo?: { nombre: string; driveUrl: string | null } | null;
        }[];
        periodoEntrega: { programa: { nombre: string }; mes: number | null; semestre: number | null };
    }[];
}

interface Stats {
    totalEntregas: number;
    aprobadas: number;
    pendientes: number;
    enRevision: number;
    requiereCorreccion: number;
    noAprobado: number;
    noEntregadas: number;
}

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ESTADOS = ["PENDIENTE", "EN_REVISION", "REQUIERE_CORRECCION", "APROBADO", "NO_APROBADO", "NO_ENTREGADO"];
const ESTADO_LABELS: Record<string, string> = {
    PENDIENTE: "Pendiente", EN_REVISION: "En Revisión", REQUIERE_CORRECCION: "Req. Corrección",
    APROBADO: "Aprobado", NO_APROBADO: "No Aprobado", NO_ENTREGADO: "No Entregado",
};
const ESTADO_COLORS: Record<string, string> = {
    PENDIENTE: "var(--warning)", EN_REVISION: "var(--primary)", REQUIERE_CORRECCION: "#e67e22",
    APROBADO: "var(--success)", NO_APROBADO: "var(--danger)", NO_ENTREGADO: "var(--text-muted)",
};

export default function AdminDashboard({
    programas,
    escuelas,
    recursos,
    stats,
    ciclo,
    userName,
    dbRole,
}: {
    programas: ProgramaAdmin[];
    escuelas: EscuelaAdmin[];
    recursos: any[];
    stats: Stats;
    ciclo: string;
    userName: string;
    dbRole: string;
}) {
    const [vista, setVista] = useState<"general" | "escuelas" | "programas" | "gestion-escuelas" | "gestion-programas" | "gestion-periodos" | "gestion-fechas" | "recursos" | "gestion-atps">("general");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [expandedPeriodo, setExpandedPeriodo] = useState<string | null>(null);
    const [correccionModal, setCorreccionModal] = useState<{ entregaId: string; escuelaNombre: string; history?: any[] } | null>(null);
    const [correccionTexto, setCorreccionTexto] = useState("");
    const [correccionFile, setCorreccionFile] = useState<File | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("TODOS");
    const [sendingCorreccion, setSendingCorreccion] = useState(false);
    const [updatingEstado, setUpdatingEstado] = useState<string | null>(null);
    const [togglingPeriodo, setTogglingPeriodo] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const router = useRouter();

    const entregadas = stats.totalEntregas - stats.noEntregadas;
    const porcentaje = stats.totalEntregas > 0 ? Math.round((entregadas / stats.totalEntregas) * 100) : 0;

    async function handleEstadoChange(entregaId: string, nuevoEstado: string) {
        setUpdatingEstado(entregaId);
        try {
            const res = await fetch(`/api/entregas/${entregaId}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setUpdatingEstado(null);
        }
    }

    const exportToExcel = () => {
        try {
            const rows: any[] = [];
            escuelas.forEach(esc => {
                esc.entregas.forEach(ent => {
                    const programa = ent.periodoEntrega?.programa?.nombre || "N/A";
                    let periodoName = "Anual";
                    if (ent.periodoEntrega?.mes) periodoName = MESES[ent.periodoEntrega.mes];
                    else if (ent.periodoEntrega?.semestre) periodoName = `Semestre ${ent.periodoEntrega.semestre}`;

                    rows.push({
                        "CCT": esc.cct,
                        "Escuela": esc.nombre,
                        "Programa": programa,
                        "Periodo": periodoName,
                        "Estado": ESTADO_LABELS[ent.estado] || ent.estado,
                        "Archivos Subidos": ent.archivos.length,
                    });
                });
            });

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Avance Global");
            XLSX.writeFile(workbook, `Reporte_SISAT_${new Date().toISOString().split("T")[0]}.xlsx`);
            setMessage({ type: "success", text: "Reporte Excel generado exitosamente." });
        } catch (error) {
            console.error("Error exporting to excel:", error);
            setMessage({ type: "error", text: "Hubo un error al generar el archivo Excel." });
        }
    };

    const exportEscuelaPDF = (esc: EscuelaAdmin) => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text("Acuse de Recepción SISAT", 14, 20);

            doc.setFontSize(11);
            doc.text(`CCT: ${esc.cct}`, 14, 30);
            doc.text(`Escuela: ${esc.nombre}`, 14, 36);
            doc.text(`Director: ${esc.director || "No especificado"}`, 14, 42);
            doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString("es-MX")}`, 14, 48);

            const tableData = esc.entregas.map(ent => {
                const progName = ent.periodoEntrega?.programa?.nombre || "N/A";
                let perName = "Anual";
                if (ent.periodoEntrega?.mes) perName = MESES[ent.periodoEntrega.mes];
                else if (ent.periodoEntrega?.semestre) perName = `Semestre ${ent.periodoEntrega.semestre}`;

                return [
                    progName,
                    perName,
                    ESTADO_LABELS[ent.estado] || ent.estado,
                    ent.archivos.length.toString(),
                    ent.archivos?.[0]?.createdAt ? new Date(ent.archivos[0].createdAt).toLocaleDateString("es-MX") : "N/A"
                ];
            });

            autoTable(doc, {
                startY: 55,
                head: [['Programa', 'Periodo', 'Estado', 'Archivos', 'Fecha Subida']],
                body: tableData,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [12, 90, 142] }
            });

            const finalY = (doc as any).lastAutoTable.finalY || 60;
            doc.text("___________________________", 14, finalY + 30);
            doc.text("Sello / Firma Supervisión", 14, finalY + 36);

            doc.save(`Acuse_${esc.cct}_${new Date().toISOString().split("T")[0]}.pdf`);
            setMessage({ type: "success", text: "Acuse PDF generado exitosamente." });
        } catch (error) {
            console.error("Error generating PDF:", error);
            setMessage({ type: "error", text: "Error al generar el PDF." });
        }
    };

    async function handleSendCorreccion() {
        if (!correccionModal || (!correccionTexto.trim() && !correccionFile)) return;
        setSendingCorreccion(true);

        const formData = new FormData();
        if (correccionTexto.trim()) formData.append("texto", correccionTexto);
        if (correccionFile) formData.append("file", correccionFile);

        try {
            const res = await fetch(`/api/entregas/${correccionModal.entregaId}/correcciones`, {
                method: "POST",
                body: formData,
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Corrección enviada" });
                setCorreccionModal(null);
                setCorreccionTexto("");
                setCorreccionFile(null);
                router.refresh();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setSendingCorreccion(false);
        }
    }

    async function handleTogglePeriodo(periodoId: string, activo: boolean) {
        setTogglingPeriodo(periodoId);
        try {
            const res = await fetch(`/api/periodos/${periodoId}/activar`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo }),
            });
            if (res.ok) {
                router.refresh();
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setTogglingPeriodo(null);
        }
    }

    function getPeriodoLabel(periodo: { mes: number | null; semestre: number | null }): string {
        if (periodo.mes) return MESES[periodo.mes];
        if (periodo.semestre) return `Semestre ${periodo.semestre}`;
        return "Ciclo completo";
    }

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <BarChart3 size={24} />
                    <span style={{ fontSize: "0.9375rem" }}>SISAT-ATP</span>
                </div>
                <div className="admin-sidebar-nav">
                    <button className={`sidebar-link ${vista === "general" ? "active" : ""}`} onClick={() => setVista("general")}>
                        <BarChart3 size={18} /> Vista General
                    </button>
                    <button className={`sidebar-link ${vista === "escuelas" ? "active" : ""}`} onClick={() => setVista("escuelas")}>
                        <CheckCircle2 size={18} /> Avance Escuelas
                    </button>
                    <button className={`sidebar-link ${vista === "programas" ? "active" : ""}`} onClick={() => setVista("programas")}>
                        <FileText size={18} /> Avance Programas
                    </button>

                    <div style={{ margin: "1rem 0 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", paddingLeft: "0.5rem" }}>Administración</div>

                    <button className={`sidebar-link ${vista === "gestion-escuelas" ? "active" : ""}`} onClick={() => setVista("gestion-escuelas")}>
                        <School size={18} /> Gestión de Escuelas
                    </button>
                    <button className={`sidebar-link ${vista === "gestion-programas" ? "active" : ""}`} onClick={() => setVista("gestion-programas")}>
                        <Layers size={18} /> Gestión de Programas
                    </button>
                    <button className={`sidebar-link ${vista === "gestion-periodos" ? "active" : ""}`} onClick={() => setVista("gestion-periodos")}>
                        <Clock size={18} /> Activar Periodos
                    </button>
                    <button className={`sidebar-link ${vista === "gestion-fechas" ? "active" : ""}`} onClick={() => setVista("gestion-fechas")}>
                        <Calendar size={18} /> Fechas y Tareas
                    </button>
                    <button className={`sidebar-link ${vista === "recursos" ? "active" : ""}`} onClick={() => setVista("recursos")}>
                        <Upload size={18} /> Formatos y Plantillas
                    </button>
                    {dbRole === "SUPER_ADMIN" && (
                        <button className={`sidebar-link ${vista === "gestion-atps" ? "active" : ""}`} onClick={() => setVista("gestion-atps")}>
                            <UserCog size={18} /> Accesos y Seguridad
                        </button>
                    )}
                </div>
                <div className="admin-sidebar-footer">
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.5rem", paddingLeft: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Conectado como <br /><strong>{userName}</strong>
                    </div>
                    <button
                        className="btn btn-outline btn-block"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        style={{ fontSize: "0.8125rem", padding: "0.5rem", minHeight: "auto", marginTop: "0.5rem" }}
                    >
                        <LogOut size={16} /> Salir
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-content fade-in">
                {message && (
                    <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                        {message.text}
                        <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                    </div>
                )}

                {/* ========= VISTA: VISTA GENERAL ========= */}
                {vista === "general" && (
                    <div className="fade-in">
                        <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                            <div>
                                <h1>Vista General</h1>
                                <p style={{ color: "var(--text-secondary)" }}>
                                    Ciclo {ciclo} • 18 bachilleratos • {stats.totalEntregas} entregas
                                </p>
                            </div>
                            <button onClick={exportToExcel} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}>
                                <Download size={18} /> Exportar Reporte a Excel
                            </button>
                        </div>

                        {/* Stats Row */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                            {[
                                { label: "Aprobadas", value: stats.aprobadas, color: "var(--success)" },
                                { label: "Pendientes", value: stats.pendientes, color: "var(--warning)" },
                                { label: "En Revisión", value: stats.enRevision, color: "var(--primary)" },
                                { label: "Req. Corrección", value: stats.requiereCorreccion, color: "#e67e22" },
                                { label: "No Aprobadas", value: stats.noAprobado, color: "var(--danger)" },
                                { label: "No Entregadas", value: stats.noEntregadas, color: "var(--text-muted)" },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="card" style={{ textAlign: "center", padding: "1rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <div style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem", textAlign: "center", fontWeight: 600 }}>{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Progress Bar */}
                        <div className="card" style={{ marginBottom: "1.5rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                <span style={{ fontWeight: 600 }}>Progreso de Recepción (Entregados vs Faltantes)</span>
                                <span style={{ color: "var(--primary)", fontWeight: 700 }}>{porcentaje}%</span>
                            </div>
                            <div className="progress-bar" style={{ height: "12px" }}>
                                <div className="progress-fill" style={{ width: `${porcentaje}%` }} />
                            </div>
                        </div>

                        <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7" }}>
                            <h3 style={{ color: "#0c5a8e", marginBottom: "0.5rem", fontSize: "1rem" }}>Siguientes Pasos</h3>
                            <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c5a8e" }}>
                                Utiliza el menú lateral para revisar el progreso individual por escuela o por programa.
                                Para administrar fechas límite o la información de las escuelas, utiliza la sección de Administración.
                            </p>
                        </div>
                    </div>
                )}

                {/* ========= VISTA: ESCUELAS ========= */}
                {vista === "escuelas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ marginBottom: "0.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
                                <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por CCT o nombre de escuela..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="form-control"
                                    style={{ paddingLeft: "2.5rem" }}
                                />
                            </div>
                            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                {["TODOS", ...ESTADOS].map((st) => {
                                    const color = st === "TODOS" ? "var(--text-muted)" : ESTADO_COLORS[st] || "var(--text-muted)";
                                    const isActive = statusFilter === st;
                                    return (
                                        <button
                                            key={st}
                                            onClick={() => setStatusFilter(st)}
                                            style={{
                                                padding: "0.4rem 0.75rem",
                                                borderRadius: "20px",
                                                border: `1px solid ${color}`,
                                                background: isActive ? color : "transparent",
                                                color: isActive ? "#fff" : color,
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                transition: "all 0.2s"
                                            }}
                                        >
                                            {st === "TODOS" ? "Mostrar Todos" : ESTADO_LABELS[st]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {escuelas.filter(esc => {
                            const matchesSearch = esc.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || esc.cct.toLowerCase().includes(searchQuery.toLowerCase());
                            const matchesStatus = statusFilter === "TODOS" || esc.entregas.some(ent => ent.estado === statusFilter);
                            return matchesSearch && matchesStatus;
                        }).map((esc) => {
                            const entregadosEsc = esc.entregas.filter((e) => e.estado !== "NO_ENTREGADO").length;
                            const totalEsc = esc.entregas.length;
                            const porcEsc = totalEsc > 0 ? Math.round((entregadosEsc / totalEsc) * 100) : 0;
                            const isExpanded = expanded === esc.id;

                            let borderColor = "var(--danger)";
                            if (porcEsc === 100) borderColor = "var(--success)";
                            else if (porcEsc > 0) borderColor = "var(--warning)";

                            return (
                                <div key={esc.id} className="card" style={{ borderLeft: `4px solid ${borderColor}`, padding: 0 }}>
                                    <button onClick={() => setExpanded(isExpanded ? null : esc.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{esc.nombre}</div>
                                                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                                    {esc.cct} • {esc.localidad} • {esc.total} alumnos
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <span style={{ fontWeight: 700, color: borderColor }}>{porcEsc}%</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); exportEscuelaPDF(esc); }}
                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0.25rem", display: "flex", alignItems: "center" }}
                                                    title="Descargar Acuse PDF"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                        <div className="progress-bar" style={{ marginTop: "0.5rem", height: "6px" }}>
                                            <div className="progress-fill" style={{ width: `${porcEsc}%`, background: borderColor }} />
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" }}>
                                            {esc.entregas.map((ent) => {
                                                const color = ESTADO_COLORS[ent.estado] || "var(--text-muted)";
                                                const periodoLabel = ent.periodoEntrega.mes
                                                    ? `${MESES[ent.periodoEntrega.mes]}`
                                                    : ent.periodoEntrega.semestre
                                                        ? `S${ent.periodoEntrega.semestre}`
                                                        : "";

                                                return (
                                                    <div key={ent.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", gap: "0.5rem", flexWrap: "wrap" }}>
                                                        <div style={{ fontSize: "0.875rem", minWidth: "140px" }}>
                                                            <span style={{ fontWeight: 500 }}>{ent.periodoEntrega.programa.nombre}</span>
                                                            {periodoLabel && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}> ({periodoLabel})</span>}
                                                            {ent.archivos.length > 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}> • {ent.archivos.length} archivo(s)</span>}
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                            <select
                                                                value={ent.estado}
                                                                onChange={(e) => handleEstadoChange(ent.id, e.target.value)}
                                                                disabled={updatingEstado === ent.id}
                                                                style={{
                                                                    padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                                    border: `1px solid ${color}`, background: `${color}15`,
                                                                    color, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                                                                }}
                                                            >
                                                                {ESTADOS.map((e) => (
                                                                    <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => setCorreccionModal({ entregaId: ent.id, escuelaNombre: esc.nombre, history: ent.correcciones })}
                                                                style={{ background: "none", border: "none", cursor: "pointer", color: "#e67e22", padding: "0.25rem" }}
                                                                title="Enviar corrección / Ver historial"
                                                            >
                                                                <MessageSquare size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ========= VISTA: PROGRAMAS ========= */}
                {vista === "programas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {programas.map((prog) => {
                            const activeEntregas = prog.periodos.filter((p) => p.activo).flatMap((p) => p.entregas);
                            const entregadosProg = activeEntregas.filter((e) => e.estado !== "NO_ENTREGADO").length;
                            const totalProg = activeEntregas.length;
                            const porc = totalProg > 0 ? Math.round((entregadosProg / totalProg) * 100) : 0;
                            const isExpanded = expanded === prog.id;

                            return (
                                <div key={prog.id} className="card" style={{ padding: 0 }}>
                                    <button onClick={() => setExpanded(isExpanded ? null : prog.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{prog.nombre}</div>
                                                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                                    {entregadosProg}/{totalProg} recibidas • {prog.periodos.filter((p) => p.activo).length} periodo(s) activo(s)
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{porc}%</span>
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                        <div className="progress-bar" style={{ marginTop: "0.5rem" }}>
                                            <div className="progress-fill" style={{ width: `${porc}%` }} />
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div style={{ borderTop: "1px solid var(--border)" }}>
                                            {prog.periodos.filter((p) => p.activo).map((periodo) => (
                                                <div key={periodo.id}>
                                                    {prog.tipo !== "ANUAL" && (
                                                        <div style={{ padding: "0.5rem 1rem", background: "var(--bg-secondary)", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
                                                            onClick={() => setExpandedPeriodo(expandedPeriodo === periodo.id ? null : periodo.id)}
                                                        >
                                                            {getPeriodoLabel(periodo)} ({periodo.entregas.filter((e) => e.estado !== "NO_ENTREGADO").length}/{periodo.entregas.length} recibidas)
                                                        </div>
                                                    )}

                                                    {(prog.tipo === "ANUAL" || expandedPeriodo === periodo.id) && (
                                                        <div style={{ padding: "0 1rem 0.5rem" }}>
                                                            {periodo.entregas.map((ent) => {
                                                                const color = ESTADO_COLORS[ent.estado] || "var(--text-muted)";
                                                                return (
                                                                    <div key={ent.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)", gap: "0.5rem", flexWrap: "wrap" }}>
                                                                        <div style={{ fontSize: "0.875rem" }}>
                                                                            <div style={{ fontWeight: 500 }}>{ent.escuela.nombre}</div>
                                                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                                                {ent.escuela.cct} • {ent.archivos.length} archivo(s)
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                                            <select
                                                                                value={ent.estado}
                                                                                onChange={(e) => handleEstadoChange(ent.id, e.target.value)}
                                                                                disabled={updatingEstado === ent.id}
                                                                                style={{
                                                                                    padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                                                    border: `1px solid ${color}`, background: `${color}15`,
                                                                                    color, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer",
                                                                                }}
                                                                            >
                                                                                {ESTADOS.map((e) => (
                                                                                    <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                                                                                ))}
                                                                            </select>
                                                                            <button
                                                                                onClick={() => setCorreccionModal({ entregaId: ent.id, escuelaNombre: ent.escuela.nombre, history: ent.correcciones })}
                                                                                style={{ background: "none", border: "none", cursor: "pointer", color: "#e67e22", padding: "0.25rem" }}
                                                                                title="Enviar corrección / Ver historial"
                                                                            >
                                                                                <MessageSquare size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ========= VISTA: GESTIÓN DE PERIODOS ========= */}
                {vista === "gestion-periodos" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7" }}>
                            <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c5a8e" }}>
                                <strong>Gestión de Periodos</strong> — Activa o desactiva los meses en los que requieres entregas.
                                Los periodos desactivados no aparecerán en el portal del director.
                            </p>
                        </div>

                        {programas.filter((p) => p.tipo === "MENSUAL").map((prog) => (
                            <div key={prog.id} className="card" style={{ padding: 0 }}>
                                <div style={{ padding: "1rem", fontWeight: 700 }}>{prog.nombre}</div>
                                <div style={{ borderTop: "1px solid var(--border)" }}>
                                    {prog.periodos.map((periodo) => (
                                        <div key={periodo.id} style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)",
                                        }}>
                                            <span style={{ fontWeight: 500 }}>{getPeriodoLabel(periodo)}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                    {periodo.entregas.filter((e) => e.estado !== "NO_ENTREGADO").length}/{periodo.entregas.length}
                                                </span>
                                                <button
                                                    onClick={() => handleTogglePeriodo(periodo.id, !periodo.activo)}
                                                    disabled={togglingPeriodo === periodo.id}
                                                    style={{
                                                        background: "none", border: "none", cursor: "pointer",
                                                        color: periodo.activo ? "var(--success)" : "var(--text-muted)",
                                                    }}
                                                    title={periodo.activo ? "Desactivar" : "Activar"}
                                                >
                                                    {periodo.activo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* ========= VISTA: GESTIÓN DE FECHAS Y TAREAS EXTRAORDINARIAS ========= */}
                {vista === "gestion-fechas" && (
                    <GestionFechas programas={programas} />
                )}
                {/* ========= VISTA: GESTIÓN DE ESCUELAS ========= */}
                {
                    vista === "gestion-escuelas" && (
                        <GestionEscuelas inicialEscuelas={escuelas.map(e => ({
                            id: e.id,
                            cct: e.cct,
                            nombre: e.nombre,
                            director: e.director ?? null,
                            email: e.email ?? null
                        }))} />
                    )
                }

                {/* ========= VISTA: GESTIÓN DE PROGRAMAS ========= */}
                {
                    vista === "gestion-programas" && (
                        <GestionProgramas inicialProgramas={programas} />
                    )
                }

                {/* ========= VISTA: RECURSOS Y FORMATOS ========= */}
                {
                    vista === "recursos" && (
                        <GestionRecursos recursos={recursos} programas={programas} />
                    )
                }
            </main >

            {/* Correction Modal */}
            {
                correccionModal && (
                    <div style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1rem", zIndex: 1000,
                    }}>
                        <div className="card" style={{ maxWidth: "500px", width: "100%" }}>
                            <h3 style={{ marginBottom: "0.5rem" }}>
                                <MessageSquare size={20} /> Enviar Corrección
                            </h3>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                                Para: <strong>{correccionModal.escuelaNombre}</strong>
                            </p>

                            {correccionModal.history && correccionModal.history.length > 0 && (
                                <div style={{
                                    maxHeight: "200px", overflowY: "auto", marginBottom: "1rem",
                                    padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border)",
                                }}>
                                    <h4 style={{ fontSize: "0.8125rem", margin: "0 0 0.5rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Historial de Correcciones
                                    </h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                        {correccionModal.history.map((hist) => (
                                            <div key={hist.id} style={{ fontSize: "0.8125rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                                                    <strong>{hist.admin?.nombre || "ATP"}</strong>
                                                    <span>{new Date(hist.createdAt).toLocaleDateString()} {new Date(hist.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                </div>
                                                <div style={{ color: "var(--text)" }}>{hist.texto || <em style={{ color: "var(--text-muted)" }}>[Sin texto, solo adjunto]</em>}</div>
                                                {hist.archivo && hist.archivo.driveUrl && (
                                                    <a
                                                        href={hist.archivo.driveUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem", color: "var(--primary)", textDecoration: "none", fontWeight: 500 }}
                                                    >
                                                        <FileText size={12} /> {hist.archivo.nombre}
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <textarea
                                value={correccionTexto}
                                onChange={(e) => setCorreccionTexto(e.target.value)}
                                placeholder="Escribe las correcciones necesarias..."
                                style={{
                                    width: "100%", minHeight: "120px", padding: "0.75rem",
                                    borderRadius: "8px", border: "1px solid var(--border)",
                                    fontFamily: "inherit", fontSize: "0.875rem", resize: "vertical",
                                }}
                            />

                            <div style={{ marginTop: "1rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                                    Adjuntar Archivo de Corrección (Opcional)
                                </label>
                                <input
                                    type="file"
                                    className="form-control"
                                    onChange={(e) => setCorreccionFile(e.target.files ? e.target.files[0] : null)}
                                    style={{ padding: "0.5rem", fontSize: "0.875rem" }}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png"
                                />
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => { setCorreccionModal(null); setCorreccionTexto(""); setCorreccionFile(null); }}
                                    style={{ flex: 1 }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSendCorreccion}
                                    disabled={sendingCorreccion || (!correccionTexto.trim() && !correccionFile)}
                                    style={{ flex: 1 }}
                                >
                                    {sendingCorreccion ? "Enviando..." : (
                                        <><Send size={16} /> Enviar</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
