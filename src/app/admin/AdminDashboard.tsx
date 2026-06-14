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
    Trophy,
    Users,
    BookMarked,
    GraduationCap,
    Lightbulb,
    FolderOpen,
    ShieldCheck,
    ListChecks,
    Settings2,
    Menu,
    X as XIcon,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import GestionEscuelas from "./_componentes/GestionEscuelas";
import GestionFechas from "./_componentes/GestionFechas";
import GestionRecursos from "./_componentes/GestionRecursos";
import GestionProgramas from "./_componentes/GestionProgramas";
import GestionATPs from "./_componentes/GestionATPs";
import VistaGeneral from "./_componentes/VistaGeneral";
import ListadoEscuelas from "./_componentes/ListadoEscuelas";
import ListadoProgramas from "./_componentes/ListadoProgramas";
import GestionPeriodos from "./_componentes/GestionPeriodos";
import GestionEventos from "./_componentes/GestionEventos";
import GestionOlimpiada from "./_componentes/GestionOlimpiada";
import GestionEncuentroPAEC from "./_componentes/GestionEncuentroPAEC";
import GestionCircular05 from "./_componentes/GestionCircular05";
import GestionCapems from "./_componentes/GestionCapems";
import GestionExpedientes from "./_componentes/GestionExpedientes";
import PanelModulos from "./_componentes/PanelModulos";

import { ProgramaAdmin, EscuelaAdmin, Stats, ZonaStat } from "@/types";

import { MESES, ESTADOS, ESTADO_LABELS, ESTADO_COLORS } from "@/lib/constants";
import { getDownloadUrl } from "@/lib/download-url";

export default function AdminDashboard({
    programas,
    escuelas,
    recursos,
    stats,
    zonaStats,
    ciclo,
    cicloId,
    anuncioGlobal,
    userName,
    dbRole,
    sidebarConfig,
}: {
    programas: ProgramaAdmin[];
    escuelas: EscuelaAdmin[];
    recursos: Record<string, unknown>[];
    stats: Stats;
    zonaStats: ZonaStat[];
    ciclo: string;
    userName: string;
    dbRole: string;
    cicloId: string;
    anuncioGlobal: string | null;
    sidebarConfig: {
        showRecursos: boolean;
        showEventos: boolean;
        showCircular05: boolean;
        showOlimpiada: boolean;
        showPAEC: boolean;
        showCapems: boolean;
        showExpedientes: boolean;
    };
}) {
    const [vista, setVista] = useState<"general" | "escuelas" | "programas" | "gestion-escuelas" | "gestion-programas" | "gestion-periodos" | "gestion-fechas" | "recursos" | "gestion-atps" | "eventos" | "circular05" | "olimpiada" | "paec" | "capems" | "expedientes" | "modulos-control">("general");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({
        monitoreo: true,
        config: false,
        modulos: true,
    });

    const toggleGroup = (key: string) =>
        setGroupOpen(prev => ({ ...prev, [key]: !prev[key] }));

    const navigate = (v: typeof vista) => {
        setVista(v);
        setSidebarOpen(false);
    };
    const [correccionModal, setCorreccionModal] = useState<{ entregaId: string; escuelaNombre: string; history?: any[] } | null>(null);
    const [correccionTexto, setCorreccionTexto] = useState("");
    const [correccionFile, setCorreccionFile] = useState<File | null>(null);

    const [sendingCorreccion, setSendingCorreccion] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const router = useRouter();

    async function handleSaveAnuncio(nuevoAnuncio: string) {
        try {
            const res = await fetch("/api/ciclos/anuncio", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ anuncioGlobal: nuevoAnuncio }),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Anuncio global actualizado" });
                router.refresh();
                return true;
            } else {
                setMessage({ type: "error", text: "Error al actualizar anuncio" });
                return false;
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
            return false;
        }
    }

    const entregadas = stats.totalEntregas - stats.noEntregadas;
    const porcentaje = stats.totalEntregas > 0 ? Math.round((entregadas / stats.totalEntregas) * 100) : 0;

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

    async function handleSendCorreccion() {
        if (!correccionModal || (!correccionTexto.trim() && !correccionFile)) return;
        setSendingCorreccion(true);

        try {
            let uploadedFileData = null;

            if (correccionFile) {
                // 1. Get signature for subfolder _correcciones
                const signRes = await fetch("/api/sign-cloudinary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        entregaId: correccionModal.entregaId,
                        subfolder: "_correcciones",
                        originalFilename: correccionFile.name
                    })
                });

                if (!signRes.ok) throw new Error("Error obteniendo firma para subir archivo");
                const { signature, timestamp, folder, apiKey, cloudName, publicId } = await signRes.json();

                // 2. Direct upload to Cloudinary
                const formData = new FormData();
                formData.append("file", correccionFile);
                formData.append("api_key", apiKey);
                formData.append("timestamp", timestamp.toString());
                formData.append("signature", signature);
                formData.append("folder", folder);
                if (publicId) formData.append("public_id", publicId);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                    method: "POST",
                    body: formData
                });

                if (!uploadRes.ok) throw new Error("Error subiendo el archivo de corrección a la nube");
                const uploadData = await uploadRes.json();

                uploadedFileData = {
                    name: correccionFile.name,
                    url: uploadData.secure_url,
                    publicId: uploadData.public_id
                };
            }

            // 3. Confirm with backend
            const res = await fetch(`/api/entregas/${correccionModal.entregaId}/correcciones`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texto: correccionTexto.trim() || null,
                    fileData: uploadedFileData
                }),
            });

            if (res.ok) {
                setMessage({ type: "success", text: "Corrección enviada" });
                setCorreccionModal(null);
                setCorreccionTexto("");
                setCorreccionFile(null);
                router.refresh();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error al guardar corrección" });
            }
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error de conexión" });
        } finally {
            setSendingCorreccion(false);
        }
    }


    // Count active special modules for badge
    const activeModulesCount = [
        sidebarConfig.showEventos,
        sidebarConfig.showCircular05,
        sidebarConfig.showOlimpiada,
        sidebarConfig.showPAEC,
        sidebarConfig.showCapems,
        sidebarConfig.showExpedientes,
    ].filter(Boolean).length;

    const modulosVistaActiva = ["eventos", "circular05", "olimpiada", "paec", "capems", "expedientes"].includes(vista);
    const configVistaActiva = ["gestion-escuelas", "gestion-programas", "gestion-periodos", "gestion-fechas", "recursos", "gestion-atps", "modulos-control"].includes(vista);

    return (
        <div className="admin-layout">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile hamburger */}
            <button
                className="sidebar-hamburger"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menú"
            >
                <Menu size={22} />
            </button>

            {/* Sidebar */}
            <aside className={`admin-sidebar ${sidebarOpen ? "sidebar-mobile-open" : ""}`}>
                {/* Sidebar Header */}
                <div className="admin-sidebar-header">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <div style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderRadius: "10px", padding: "6px", display: "flex" }}>
                                <BarChart3 size={20} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>SISAT-ATP</div>
                                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", lineHeight: 1.2 }}>Supervisión · Automatización</div>
                            </div>
                        </div>
                        <button
                            className="sidebar-close-btn"
                            onClick={() => setSidebarOpen(false)}
                            aria-label="Cerrar menú"
                        >
                            <XIcon size={18} />
                        </button>
                    </div>
                    {/* Ciclo badge */}
                    <div style={{ marginTop: "0.75rem", background: "var(--primary-bg)", borderRadius: "8px", padding: "0.375rem 0.625rem", display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)" }}>
                        <Calendar size={13} />
                        Ciclo {ciclo}
                    </div>
                </div>

                <div className="admin-sidebar-nav">

                    {/* ── GRUPO: MONITOREO ── */}
                    <div className="sidebar-group">
                        <button
                            className="sidebar-group-header"
                            onClick={() => toggleGroup("monitoreo")}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <BarChart3 size={14} />
                                <span>Monitoreo</span>
                            </div>
                            {groupOpen.monitoreo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {groupOpen.monitoreo && (
                            <div className="sidebar-group-items">
                                <button className={`sidebar-link ${vista === "general" ? "active" : ""}`} onClick={() => navigate("general")}>
                                    <BarChart3 size={17} />
                                    <span>Vista General</span>
                                </button>
                                <button className={`sidebar-link ${vista === "escuelas" ? "active" : ""}`} onClick={() => navigate("escuelas")}>
                                    <School size={17} />
                                    <span>Avance por Escuela</span>
                                </button>
                                <button className={`sidebar-link ${vista === "programas" ? "active" : ""}`} onClick={() => navigate("programas")}>
                                    <ListChecks size={17} />
                                    <span>Avance por Programa</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── GRUPO: CONFIGURACIÓN ── */}
                    <div className="sidebar-group">
                        <button
                            className={`sidebar-group-header ${configVistaActiva ? "sidebar-group-header-active" : ""}`}
                            onClick={() => toggleGroup("config")}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Settings2 size={14} />
                                <span>Configuración</span>
                            </div>
                            {groupOpen.config ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {groupOpen.config && (
                            <div className="sidebar-group-items">
                                <button className={`sidebar-link ${vista === "gestion-escuelas" ? "active" : ""}`} onClick={() => navigate("gestion-escuelas")}>
                                    <School size={17} />
                                    <span>Escuelas</span>
                                </button>
                                <button className={`sidebar-link ${vista === "gestion-programas" ? "active" : ""}`} onClick={() => navigate("gestion-programas")}>
                                    <Layers size={17} />
                                    <span>Programas</span>
                                </button>
                                <button className={`sidebar-link ${vista === "gestion-periodos" ? "active" : ""}`} onClick={() => navigate("gestion-periodos")}>
                                    <Clock size={17} />
                                    <span>Periodos</span>
                                </button>
                                <button className={`sidebar-link ${vista === "gestion-fechas" ? "active" : ""}`} onClick={() => navigate("gestion-fechas")}>
                                    <Calendar size={17} />
                                    <span>Fechas y Tareas</span>
                                </button>
                                {sidebarConfig.showRecursos && (
                                    <button className={`sidebar-link ${vista === "recursos" ? "active" : ""}`} onClick={() => navigate("recursos")}>
                                        <BookMarked size={17} />
                                        <span>Formatos y Plantillas</span>
                                    </button>
                                )}
                                {dbRole === "SUPER_ADMIN" && (
                                    <button className={`sidebar-link ${vista === "gestion-atps" ? "active" : ""}`} onClick={() => navigate("gestion-atps")}>
                                        <ShieldCheck size={17} />
                                        <span>Accesos y Seguridad</span>
                                    </button>
                                )}
                                {/* Panel de módulos — always visible in config */}
                                <button className={`sidebar-link ${vista === "modulos-control" ? "active" : ""}`} onClick={() => navigate("modulos-control")}>
                                    <FolderOpen size={17} />
                                    <span>Módulos Especiales</span>
                                    {activeModulesCount > 0 && (
                                        <span className="sidebar-badge" style={{ marginLeft: "auto" }}>{activeModulesCount}</span>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── GRUPO: MÓDULOS ACTIVOS ── */}
                    {activeModulesCount > 0 && (
                        <div className="sidebar-group">
                            <button
                                className={`sidebar-group-header ${modulosVistaActiva ? "sidebar-group-header-active" : ""}`}
                                onClick={() => toggleGroup("modulos")}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FolderOpen size={14} />
                                    <span>Módulos Activos</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                    <span className="sidebar-badge">{activeModulesCount}</span>
                                    {groupOpen.modulos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </button>
                            {groupOpen.modulos && (
                                <div className="sidebar-group-items">
                                    {sidebarConfig.showEventos && (
                                        <button className={`sidebar-link ${vista === "eventos" ? "active" : ""}`} onClick={() => navigate("eventos")}>
                                            <Trophy size={17} />
                                            <span>Eventos Culturales</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showCircular05 && (
                                        <button className={`sidebar-link ${vista === "circular05" ? "active" : ""}`} onClick={() => navigate("circular05")}>
                                            <FileText size={17} />
                                            <span>Circular 05</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showOlimpiada && (
                                        <button className={`sidebar-link ${vista === "olimpiada" ? "active" : ""}`} onClick={() => navigate("olimpiada")}>
                                            <GraduationCap size={17} />
                                            <span>Olimpiada Matemáticas</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showPAEC && (
                                        <button className={`sidebar-link ${vista === "paec" ? "active" : ""}`} onClick={() => navigate("paec")}>
                                            <Lightbulb size={17} />
                                            <span>Encuentro PAEC</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showCapems && (
                                        <button className={`sidebar-link ${vista === "capems" ? "active" : ""}`} onClick={() => navigate("capems")}>
                                            <BookMarked size={17} />
                                            <span>Fichas CAPEMS</span>
                                        </button>
                                    )}
                                    {sidebarConfig.showExpedientes && (
                                        <button className={`sidebar-link ${vista === "expedientes" ? "active" : ""}`} onClick={() => navigate("expedientes")}>
                                            <Users size={17} />
                                            <span>Expedientes Personal</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Footer */}
                <div className="admin-sidebar-footer">
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-avatar">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ overflow: "hidden" }}>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{dbRole === "SUPER_ADMIN" ? "Super Admin" : "ATP Revisor"}</div>
                        </div>
                    </div>
                    <button
                        className="btn btn-outline btn-block"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        style={{ fontSize: "0.8125rem", padding: "0.5rem", minHeight: "auto", marginTop: "0.75rem" }}
                    >
                        <LogOut size={16} /> Cerrar Sesión
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
                    <VistaGeneral
                        stats={{
                            ...stats,
                            escuelas: escuelas.map(e => ({
                                id: e.id,
                                cct: e.cct,
                                nombre: e.nombre,
                                pendientes: e.entregas.filter(en => en.estado === "PENDIENTE").length,
                                requiereCorreccion: e.entregas.filter(en => en.estado === "REQUIERE_CORRECCION").length,
                                noEntregadas: e.entregas.filter(en => en.estado === "NO_ENTREGADO").length,
                                aprobadas: e.entregas.filter(en => en.estado === "APROBADO").length,
                                total: e.entregas.length,
                            }))
                        }}
                        zonaStats={zonaStats}
                        ciclo={ciclo}
                        totalEscuelas={escuelas.length}
                        anuncioGlobal={anuncioGlobal}
                        onSaveAnuncio={handleSaveAnuncio}
                        onExportExcel={exportToExcel}
                        onNavigateEscuelas={() => navigate("escuelas")}
                    />
                )}


                {/* ========= VISTA: ESCUELAS ========= */}
                {vista === "escuelas" && (
                    <ListadoEscuelas
                        escuelas={escuelas}
                        onSetMessage={setMessage}
                        onSetCorreccionModal={setCorreccionModal}
                    />
                )}

                {/* ========= VISTA: PROGRAMAS ========= */}
                {vista === "programas" && (
                    <ListadoProgramas
                        programas={programas}
                        onSetMessage={setMessage}
                        onSetCorreccionModal={setCorreccionModal}
                    />
                )}

                {/* ========= VISTA: GESTIÓN DE PERIODOS ========= */}
                {vista === "gestion-periodos" && (
                    <GestionPeriodos programas={programas} sidebarConfig={sidebarConfig} />
                )}
                {/* ========= VISTA: GESTIÓN DE FECHAS Y TAREAS EXTRAORDINARIAS ========= */}
                {vista === "gestion-fechas" && (
                    <GestionFechas programas={programas} />
                )}
                {/* ========= VISTA: GESTIÓN DE ESCUELAS ========= */}
                {
                    vista === "gestion-escuelas" && (
                        <GestionEscuelas
                            programas={programas}
                            inicialEscuelas={escuelas.map(e => ({
                                id: e.id,
                                cct: e.cct,
                                nombre: e.nombre,
                                director: e.director ?? null,
                                email: e.email ?? null,
                                ultimoIngreso: e.ultimoIngreso ?? null
                            }))}
                        />
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

                {/* ========= VISTA: USUARIOS ATP (ACCESOS Y SEGURIDAD) ========= */}
                {
                    vista === "gestion-atps" && (
                        <GestionATPs />
                    )
                }

                {/* ========= VISTA: PANEL DE MÓDULOS ESPECIALES ========= */}
                {vista === "modulos-control" && (
                    <PanelModulos sidebarConfig={sidebarConfig} />
                )}


                {
                    vista === "eventos" && (
                        <GestionEventos />
                    )
                }

                {/* ========= VISTA: CIRCULAR 05 ========= */}
                {
                    vista === "circular05" && (
                        <GestionCircular05 />
                    )
                }

                {/* ========= VISTA: OLIMPIADA MATEMÁTICAS ========= */}
                {
                    vista === "olimpiada" && (
                        <GestionOlimpiada />
                    )
                }

                {/* ========= VISTA: ENCUENTRO PAEC ========= */}
                {
                    vista === "paec" && (
                        <GestionEncuentroPAEC />
                    )
                }

                {/* ========= VISTA: FICHAS CAPEMS ========= */}
                {
                    vista === "capems" && (
                        <GestionCapems />
                    )
                }

                {/* ========= VISTA: EXPEDIENTES DE PERSONAL ========= */}
                {
                    vista === "expedientes" && (
                        <GestionExpedientes />
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
                                                        href={getDownloadUrl(hist.archivo.driveUrl, hist.archivo.nombre, hist.archivo.driveId) || "#"}
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
