"use client";

import { signOut } from "next-auth/react";
import {
    Upload,
    LogOut,
    School,
    BookOpen,
    MessageSquare,
    Trophy,
    FileText,
    GraduationCap,
    Lightbulb,
    FolderOpen,
    BarChart3,
    Users,
    BookMarked,
    Menu,
    X as XIcon,
    CheckCircle2,
    Search,
} from "lucide-react";
import { useState, useEffect } from "react";
import BuscadorGlobal from "@/app/_componentes/BuscadorGlobal";

import EntregasListado from "./_componentes/EntregasListado";
import RecursosListado from "./_componentes/RecursosListado";
import InscripcionEventos from "./_componentes/InscripcionEventos";
import ProyectoCircular05 from "./_componentes/ProyectoCircular05";
import OlimpiadaMatematicas from "./_componentes/OlimpiadaMatematicas";
import EncuentroPAEC from "./_componentes/EncuentroPAEC";
import CapemsPanel from "./_componentes/CapemsPanel";
import ExpedientesPanel from "./_componentes/ExpedientesPanel";

import { ProgramaGroup, RecursoDirector } from "@/types/director";

type TabType = "entregas" | "recursos" | "eventos" | "circular05" | "olimpiada" | "paec" | "capems" | "expedientes";

export default function DirectorPortal({
    escuela,
    programas,
    ciclo,
    cicloId,
    cicloObj,
    todosCiclos = [],
    anuncioGlobal,
    recursos,
    isEventosActive = true,
    isCircularActive = true,
    isOlimpiadaActive = false,
    isPAECActive = false,
    isCapemsActive = false,
    isExpedientesActive = false,
}: {
    escuela: { id: string; cct: string; nombre: string; localidad: string; director?: string | null; municipio?: string | null; zonaEscolar?: string | null; codigoPostal?: string | null };
    programas: ProgramaGroup[];
    ciclo: string;
    cicloId: string;
    cicloObj: { id: string; nombre: string; activo: boolean; anuncioGlobal: string | null };
    todosCiclos: { id: string; nombre: string; activo: boolean }[];
    anuncioGlobal?: string;
    recursos: RecursoDirector[];
    isEventosActive?: boolean;
    isCircularActive?: boolean;
    isOlimpiadaActive?: boolean;
    isPAECActive?: boolean;
    isCapemsActive?: boolean;
    isExpedientesActive?: boolean;
}) {
    const [tab, setTab] = useState<TabType>("entregas");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [expedientesHighlightId, setExpedientesHighlightId] = useState<string>("");

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "k") {
                e.preventDefault();
                setSearchOpen(prev => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Stats
    const allEntregas = programas.flatMap((p) => p.entregas);
    const aprobadas = allEntregas.filter((e) => e.estado === "APROBADO").length;
    const porcentaje = allEntregas.length > 0 ? Math.round((aprobadas / allEntregas.length) * 100) : 0;

    const navigate = (t: TabType) => {
        setTab(t);
        setSidebarOpen(false);
    };

    // Count active special modules
    const specialModules: { key: TabType; label: string; icon: React.ReactNode; active: boolean }[] = [
        { key: "eventos", label: "Eventos Culturales", icon: <Trophy size={17} />, active: isEventosActive },
        { key: "circular05", label: "Circular 03", icon: <FileText size={17} />, active: isCircularActive },
        { key: "olimpiada", label: "Olimpiada Matemáticas", icon: <GraduationCap size={17} />, active: isOlimpiadaActive },
        { key: "paec", label: "Encuentro PAEC", icon: <Lightbulb size={17} />, active: isPAECActive },
        { key: "capems", label: "Fichas CAPEMS", icon: <BookMarked size={17} />, active: isCapemsActive },
        { key: "expedientes", label: "Expedientes", icon: <Users size={17} />, active: isExpedientesActive },
    ];
    const activeSpecialModules = specialModules.filter(m => m.active);

    const tabLabels: Record<TabType, string> = {
        entregas: "Mis Entregas",
        recursos: "Recursos",
        eventos: "Eventos Culturales",
        circular05: "Circular 03",
        olimpiada: "Olimpiada Matemáticas",
        paec: "Encuentro PAEC",
        capems: "Fichas CAPEMS",
        expedientes: "Expedientes",
    };

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
                {/* Header */}
                <div className="admin-sidebar-header" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0.5rem", width: "100%" }}>
                    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <div style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderRadius: "10px", padding: "6px", display: "flex" }}>
                                <School size={20} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>Portal</div>
                                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", lineHeight: 1.2 }}>Director</div>
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

                    {/* School info badge */}
                    <div style={{ marginTop: "0.75rem", background: "var(--primary-bg)", borderRadius: "8px", padding: "0.5rem 0.625rem" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {escuela.cct}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text)", fontWeight: 600, lineHeight: 1.3, marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {escuela.nombre}
                        </div>
                        <div style={{ marginTop: "0.5rem", position: "relative", width: "100%" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <span>Ciclo Escolar:</span>
                                {cicloObj && !cicloObj.activo && (
                                    <span style={{ background: "var(--danger-bg, #fee2e2)", color: "var(--danger, #ef4444)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.55rem", fontWeight: 700 }}>
                                        Lector
                                    </span>
                                )}
                            </div>
                            <select
                                value={cicloId}
                                onChange={async (e) => {
                                    const selectedId = e.target.value;
                                    try {
                                        const res = await fetch("/api/ciclos/seleccionar", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ cicloId: selectedId }),
                                        });
                                        if (res.ok) {
                                            window.location.reload();
                                        } else {
                                            console.error("Error al seleccionar ciclo");
                                        }
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }}
                                style={{
                                    width: "100%",
                                    padding: "0.25rem 0.375rem",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-secondary, #f1f5f9)",
                                    color: "var(--text)",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    outline: "none",
                                }}
                            >
                                {todosCiclos.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.nombre} {c.activo ? "(Activo)" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Progress mini */}
                    <div style={{ marginTop: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                            <span>Avance global</span>
                            <span style={{ fontWeight: 700, color: porcentaje >= 80 ? "var(--success)" : porcentaje >= 50 ? "var(--warning)" : "var(--danger)" }}>
                                {porcentaje}%
                            </span>
                        </div>
                        <div className="progress-bar" style={{ height: "6px" }}>
                            <div
                                className="progress-fill"
                                style={{
                                    width: `${porcentaje}%`,
                                    background: porcentaje >= 80 ? "var(--success)" : porcentaje >= 50 ? "var(--warning)" : "var(--danger)"
                                }}
                            />
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                            {aprobadas} de {allEntregas.length} entregas aprobadas
                        </div>
                    </div>
                    
                    {/* Search Trigger Button */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        style={{
                            marginTop: "0.75rem",
                            width: "100%",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            background: "var(--bg-secondary, #f1f5f9)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            outline: "none",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Search size={14} />
                            <span>Buscar...</span>
                        </div>
                        <kbd style={{ border: "1px solid var(--border)", borderRadius: "3px", padding: "0 4px", fontSize: "0.65rem", background: "white", boxShadow: "0 1px 0 rgba(0,0,0,0.05)" }}>Ctrl K</kbd>
                    </button>
                    </div>{/* end column wrapper */}
                </div>

                {/* Navigation */}
                <div className="admin-sidebar-nav">

                    {/* Main sections - always visible */}
                    <div style={{ marginBottom: "0.25rem" }}>
                        <div style={{ fontSize: "0.675rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
                            Principal
                        </div>
                        <button className={`sidebar-link ${tab === "entregas" ? "active" : ""}`} onClick={() => navigate("entregas")}>
                            <Upload size={17} />
                            <span>Mis Entregas</span>
                            {/* Badge with pending count */}
                            {allEntregas.filter(e => e.estado === "PENDIENTE" || e.estado === "REQUIERE_CORRECCION").length > 0 && (
                                <span className="sidebar-badge" style={{ marginLeft: "auto", background: "var(--warning)", color: "white" }}>
                                    {allEntregas.filter(e => e.estado === "PENDIENTE" || e.estado === "REQUIERE_CORRECCION").length}
                                </span>
                            )}
                        </button>
                        <button className={`sidebar-link ${tab === "recursos" ? "active" : ""}`} onClick={() => navigate("recursos")}>
                            <BookOpen size={17} />
                            <span>Recursos y Formatos</span>
                        </button>
                    </div>

                    {/* Special modules - conditional */}
                    {activeSpecialModules.length > 0 && (
                        <div>
                            <div style={{ fontSize: "0.675rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0.5rem", marginBottom: "0.375rem", marginTop: "1rem" }}>
                                Módulos Activos
                            </div>
                            {activeSpecialModules.map(m => (
                                <button
                                    key={m.key}
                                    className={`sidebar-link ${tab === m.key ? "active" : ""}`}
                                    onClick={() => navigate(m.key)}
                                >
                                    {m.icon}
                                    <span>{m.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="admin-sidebar-footer">
                    {escuela.director && (
                        <div className="sidebar-user-info" style={{ marginBottom: "0.75rem" }}>
                            <div className="sidebar-user-avatar">
                                {escuela.director.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ overflow: "hidden" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {escuela.director}
                                </div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Director</div>
                            </div>
                        </div>
                    )}
                    <button
                        className="btn btn-outline btn-block"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        style={{ fontSize: "0.8125rem", padding: "0.5rem", minHeight: "auto" }}
                    >
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-content fade-in">
                {/* Page header */}
                <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>
                        {tabLabels[tab]}
                    </h2>
                    {tab === "entregas" && (
                        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {escuela.cct} · {escuela.localidad}
                        </span>
                    )}
                </div>

                {/* Message */}
                {message && (
                    <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                        {message.text}
                        <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                    </div>
                )}

                {/* Anuncio Global */}
                {anuncioGlobal && (
                    <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7", marginBottom: "1.5rem", padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                            <div style={{ color: "#0c5a8e", marginTop: "2px" }}>
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <h3 style={{ color: "#0c5a8e", marginBottom: "0.25rem", fontSize: "1rem", fontWeight: 700 }}>Aviso Importante</h3>
                                <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c5a8e", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                                    {anuncioGlobal}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                {tab === "entregas" && (
                    <EntregasListado
                        programas={programas}
                        onSetMessage={setMessage}
                        readOnly={!cicloObj?.activo}
                    />
                )}

                {tab === "recursos" && (
                    <RecursosListado
                        recursos={recursos}
                    />
                )}

                {tab === "eventos" && isEventosActive && (
                    <InscripcionEventos />
                )}

                {tab === "circular05" && isCircularActive && (
                    <ProyectoCircular05 escuela={escuela} />
                )}

                {tab === "olimpiada" && isOlimpiadaActive && (
                    <OlimpiadaMatematicas />
                )}

                {tab === "paec" && isPAECActive && (
                    <EncuentroPAEC />
                )}

                {tab === "capems" && isCapemsActive && (
                    <CapemsPanel escuela={escuela} />
                )}

                {tab === "expedientes" && isExpedientesActive && (
                    <ExpedientesPanel escuela={escuela} highlightPersonId={expedientesHighlightId} />
                )}
            </main>
            <BuscadorGlobal
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                onNavigate={(view, targetId) => {
                    setTab(view as any);
                    if (view === "expedientes" && targetId) {
                        setExpedientesHighlightId(targetId);
                    }
                }}
                role="director"
            />
        </div>
    );
}
