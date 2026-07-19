"use client";

import { signOut } from "next-auth/react";
import {
    LogOut,
    School,
    BookOpen,
    MessageSquare,
    FolderOpen,
    BarChart3,
    Users,
    Menu,
    X as XIcon,
    Search,
    Building2,
    FileText,
    ListChecks,
    Key,
} from "lucide-react";
import { useState, useEffect } from "react";

import EntregasListado from "../director/_componentes/EntregasListado";
import ExpedientesPanel from "../director/_componentes/ExpedientesPanel";
import CapemsPanel from "../director/_componentes/CapemsPanel";
import RecursosListado from "../director/_componentes/RecursosListado";
import GestionCapems from "../admin/_componentes/GestionCapems";
import DocumentosPanel from "../director/_componentes/DocumentosPanel";
import GestionExpedientes from "../admin/_componentes/GestionExpedientes";
import ListadoEscuelas from "../admin/_componentes/ListadoEscuelas";
import ListadoProgramas from "../admin/_componentes/ListadoProgramas";
import AjustesApiPanel from "../director/_componentes/AjustesApiPanel";

type TabType = "monitoreo" | "entregas" | "expedientes" | "capems" | "documentos" | "recursos" | "configuracion";

export default function SupervisionPortal({
    supervision,
    escuelas,
    programas,
    ciclo,
    cicloId,
    cicloObj,
    todosCiclos = [],
    anuncioGlobal,
    recursos,
    programasRegulares,
}: {
    supervision: any;
    escuelas: any[];
    programas: any[];
    ciclo: string;
    cicloId: string;
    cicloObj: any;
    todosCiclos: any[];
    anuncioGlobal?: string;
    recursos: any[];
    programasRegulares?: any[];
}) {
    const [activeTab, setActiveTab] = useState<TabType>("monitoreo");
    const [monitoreoTab, setMonitoreoTab] = useState<"escuelas" | "programas" | "capems">("programas");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [expedientesTab, setExpedientesTab] = useState<"generales" | "supervision">("generales");

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Permisos
    const permisos = supervision.permisos || {};
    const canVerAvance = permisos.verAvance ?? true;
    const canVerExpedientes = permisos.verExpedientes ?? true;
    const canVerCapems = permisos.verCapems ?? true;
    const canGenerarConstancias = permisos.generarConstancias ?? true;

    // Handle initial redirect if monitoreo is disabled
    useEffect(() => {
        if (activeTab === "monitoreo" && !canVerAvance) {
            setActiveTab("entregas");
        }
    }, [activeTab, canVerAvance]);

    const renderContent = () => {
        switch (activeTab) {
            case "monitoreo":
                return (
                    <div className="fade-in card">
                        <div style={{ marginBottom: "1.5rem" }}>
                            <h2>Monitoreo de Escuelas (Zona)</h2>
                            <p style={{ color: "var(--text-secondary)" }}>
                                Visión global del avance de entregas de todas las escuelas en la zona.
                            </p>
                        </div>

                        <div style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginBottom: "1.25rem",
                            background: "var(--bg-secondary)",
                            padding: "0.25rem",
                            borderRadius: "8px",
                            width: "fit-content"
                        }}>
                            <button
                                onClick={() => setMonitoreoTab("programas")}
                                style={{
                                    padding: "0.45rem 0.9rem",
                                    background: monitoreoTab === "programas" ? "white" : "none",
                                    border: "none",
                                    borderRadius: "6px",
                                    boxShadow: monitoreoTab === "programas" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                                    color: monitoreoTab === "programas" ? "var(--primary)" : "var(--text-secondary)",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontSize: "0.8125rem",
                                    transition: "all 0.15s ease",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem"
                                }}
                            >
                                <ListChecks size={13} />
                                Avance por Programa
                            </button>
                            <button
                                onClick={() => setMonitoreoTab("escuelas")}
                                style={{
                                    padding: "0.45rem 0.9rem",
                                    background: monitoreoTab === "escuelas" ? "white" : "none",
                                    border: "none",
                                    borderRadius: "6px",
                                    boxShadow: monitoreoTab === "escuelas" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                                    color: monitoreoTab === "escuelas" ? "var(--primary)" : "var(--text-secondary)",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontSize: "0.8125rem",
                                    transition: "all 0.15s ease",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem"
                                }}
                            >
                                <School size={13} />
                                Avance por Escuela
                            </button>
                            {canVerCapems && (
                                <button
                                    onClick={() => setMonitoreoTab("capems")}
                                    style={{
                                        padding: "0.45rem 0.9rem",
                                        background: monitoreoTab === "capems" ? "white" : "none",
                                        border: "none",
                                        borderRadius: "6px",
                                        boxShadow: monitoreoTab === "capems" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                                        color: monitoreoTab === "capems" ? "var(--primary)" : "var(--text-secondary)",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontSize: "0.8125rem",
                                        transition: "all 0.15s ease",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.375rem"
                                    }}
                                >
                                    <BookOpen size={13} />
                                    Fichas CAPEMS
                                </button>
                            )}
                        </div>

                        {monitoreoTab === "escuelas" ? (
                            <ListadoEscuelas
                                escuelas={escuelas}
                                readOnly={true}
                                onSetMessage={() => {}}
                                onSetCorreccionModal={() => {}}
                            />
                        ) : (
                            <ListadoProgramas
                                programas={programasRegulares || []}
                                readOnly={true}
                                onSetMessage={() => {}}
                                onSetCorreccionModal={() => {}}
                            />
                        )}
                        {monitoreoTab === "capems" && (
                            <GestionCapems viewMode="resumen" readOnly={true} />
                        )}
                    </div>
                );
            case "entregas":
                return <EntregasListado programas={programas} onSetMessage={() => {}} />;
            case "recursos":
                return <RecursosListado recursos={recursos} />;
            case "expedientes":
                return (
                    <div className="fade-in card">
                        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                            <button 
                                className={`btn ${expedientesTab === "generales" ? "btn-primary" : "btn-outline"}`}
                                onClick={() => setExpedientesTab("generales")}
                                style={{ borderRadius: "20px", padding: "0.25rem 1rem", fontSize: "0.875rem" }}
                            >
                                Expedientes Generales
                            </button>
                            <button 
                                className={`btn ${expedientesTab === "supervision" ? "btn-primary" : "btn-outline"}`}
                                onClick={() => setExpedientesTab("supervision")}
                                style={{ borderRadius: "20px", padding: "0.25rem 1rem", fontSize: "0.875rem" }}
                            >
                                Personal de Supervisión
                            </button>
                        </div>
                        {expedientesTab === "generales" ? (
                            <GestionExpedientes readOnly={true} />
                        ) : (
                            <ExpedientesPanel escuela={{ id: supervision.id, cct: supervision.cct, nombre: supervision.nombre }} />
                        )}
                    </div>
                );
            case "capems":
                return (
                    <div className="fade-in card">
                        <h2>Monitoreo CAPEMS</h2>
                        <GestionCapems readOnly={true} />
                    </div>
                );
            case "documentos":
                return <DocumentosPanel escuela={supervision} hasApiKey={!!(supervision as any).geminiApiKey} />;
            case "configuracion":
                return <AjustesApiPanel escuela={supervision} />;
            default:
                return <div>Sección no encontrada</div>;
        }
    };
    if (!isMounted) return null;

    return (
        <div className="admin-layout">
            {isSidebarOpen && (
                <div className="sidebar-overlay active" onClick={() => setIsSidebarOpen(false)} />
            )}
            
            {/* Mobile hamburger */}
            <button
                className="sidebar-hamburger"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Abrir menú"
            >
                <Menu size={22} />
            </button>

            <aside className={`admin-sidebar ${isSidebarOpen ? "sidebar-mobile-open" : ""}`}>
                <div className="admin-sidebar-header" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0.5rem", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <div style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderRadius: "10px", padding: "6px", display: "flex" }}>
                                <School size={20} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>SISAT-ATP</div>
                                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", lineHeight: 1.2 }}>Supervisión</div>
                            </div>
                        </div>
                        <button
                            className="sidebar-close-btn"
                            onClick={() => setIsSidebarOpen(false)}
                            aria-label="Cerrar menú"
                        >
                            <XIcon size={18} />
                        </button>
                    </div>

                    <div style={{ marginTop: "0.75rem", background: "var(--primary-bg)", borderRadius: "8px", padding: "0.5rem 0.625rem" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {supervision.cct}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text)", fontWeight: 600, lineHeight: 1.3, marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {supervision.nombre}
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
                </div>

                <div className="admin-sidebar-nav">
                    <div style={{ marginBottom: "0.25rem" }}>
                        <div style={{ fontSize: "0.675rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
                            Monitoreo de Zona
                        </div>
                        {canVerAvance && (
                            <button
                                className={`sidebar-link ${activeTab === "monitoreo" ? "active" : ""}`}
                                onClick={() => { setActiveTab("monitoreo"); setIsSidebarOpen(false); }}
                            >
                                <BarChart3 size={17} /> <span>Avance de Entregas</span>
                            </button>
                        )}
                        {canGenerarConstancias && (
                            <button
                                className={`sidebar-link ${activeTab === "documentos" ? "active" : ""}`}
                                onClick={() => { setActiveTab("documentos"); setIsSidebarOpen(false); }}
                            >
                                <FileText size={17} /> <span>Generar Constancias</span>
                            </button>
                        )}
                    </div>

                    <div style={{ marginBottom: "0.25rem" }}>
                        <div style={{ fontSize: "0.675rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
                            Mi Institución
                        </div>
                        <button
                            className={`sidebar-link ${activeTab === "entregas" ? "active" : ""}`}
                            onClick={() => { setActiveTab("entregas"); setIsSidebarOpen(false); }}
                        >
                            <FolderOpen size={17} /> <span>Entregas (PIPS, Informes)</span>
                        </button>
                        <button
                            className={`sidebar-link ${activeTab === "recursos" ? "active" : ""}`}
                            onClick={() => { setActiveTab("recursos"); setIsSidebarOpen(false); }}
                        >
                            <BookOpen size={17} /> <span>Recursos</span>
                        </button>
                        {canVerExpedientes && (
                            <button
                                className={`sidebar-link ${activeTab === "expedientes" ? "active" : ""}`}
                                onClick={() => { setActiveTab("expedientes"); setIsSidebarOpen(false); }}
                            >
                                <Users size={17} /> <span>Expedientes</span>
                            </button>
                        )}

                    </div>

                    <div style={{ marginTop: "1rem" }}>
                        <div style={{ fontSize: "0.675rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
                            Ajustes
                        </div>
                        <button className={`sidebar-link ${activeTab === "configuracion" ? "active" : ""}`} onClick={() => { setActiveTab("configuracion"); setIsSidebarOpen(false); }}>
                            <Key size={17} />
                            <span>Ajustes de API</span>
                        </button>
                    </div>

                    <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
                        <button 
                            className="sidebar-link" 
                            style={{ color: "var(--danger)" }}
                            onClick={() => signOut({ callbackUrl: "/login" })}
                        >
                            <LogOut size={17} /> <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="admin-content fade-in">
                {anuncioGlobal && (
                    <div className="alert alert-info" style={{ marginBottom: "1.5rem" }}>
                        <MessageSquare size={18} style={{ flexShrink: 0 }} />
                        <div>
                            <strong>Aviso Importante:</strong> {anuncioGlobal}
                        </div>
                    </div>
                )}
                {renderContent()}
            </main>
        </div>
    );
}
