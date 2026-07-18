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
} from "lucide-react";
import { useState, useEffect } from "react";

import EntregasListado from "../director/_componentes/EntregasListado";
import ExpedientesPanel from "../director/_componentes/ExpedientesPanel";
import CapemsPanel from "../director/_componentes/CapemsPanel";
import RecursosListado from "../director/_componentes/RecursosListado";
import ListadoEscuelas from "../admin/_componentes/ListadoEscuelas";

type TabType = "monitoreo" | "entregas" | "expedientes" | "capems" | "documentos" | "recursos";

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
}) {
    const [activeTab, setActiveTab] = useState<TabType>("monitoreo");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
                        <ListadoEscuelas
                            escuelas={escuelas}
                            readOnly={true}
                            onSetMessage={() => {}}
                            onSetCorreccionModal={() => {}}
                        />
                    </div>
                );
            case "entregas":
                return <EntregasListado programas={programas} onSetMessage={() => {}} />;
            case "recursos":
                return <RecursosListado recursos={recursos} />;
            case "expedientes":
                return <ExpedientesPanel escuela={{ id: supervision.id, cct: supervision.cct, nombre: supervision.nombre }} />;
            case "capems":
                return <CapemsPanel escuela={{ id: supervision.id, cct: supervision.cct, nombre: supervision.nombre }} />;
            case "documentos":
                return (
                    <div className="fade-in card">
                        <h2>Generar Constancias</h2>
                        <p>Sección en construcción.</p>
                    </div>
                );
            default:
                return <div>Sección no encontrada</div>;
        }
    };

    return (
        <div className="admin-dashboard">
            {isSidebarOpen && (
                <div className="sidebar-overlay active" onClick={() => setIsSidebarOpen(false)} />
            )}
            
            <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
                <div className="admin-sidebar-header">
                    <div className="admin-logo">SISAT</div>
                    <div className="admin-subtitle">Portal Supervisión</div>
                </div>

                <nav className="admin-nav">
                    <div className="nav-group">
                        <div className="nav-group-title">Monitoreo de Zona</div>
                        {canVerAvance && (
                            <button
                                className={`nav-item ${activeTab === "monitoreo" ? "active" : ""}`}
                                onClick={() => { setActiveTab("monitoreo"); setIsSidebarOpen(false); }}
                            >
                                <BarChart3 size={18} /> Avance de Entregas
                            </button>
                        )}
                        {canGenerarConstancias && (
                            <button
                                className={`nav-item ${activeTab === "documentos" ? "active" : ""}`}
                                onClick={() => { setActiveTab("documentos"); setIsSidebarOpen(false); }}
                            >
                                <FileText size={18} /> Generar Constancias
                            </button>
                        )}
                    </div>

                    <div className="nav-group">
                        <div className="nav-group-title">Mi Institución</div>
                        <button
                            className={`nav-item ${activeTab === "entregas" ? "active" : ""}`}
                            onClick={() => { setActiveTab("entregas"); setIsSidebarOpen(false); }}
                        >
                            <FolderOpen size={18} /> Entregas (PIPS, Informes)
                        </button>
                        <button
                            className={`nav-item ${activeTab === "recursos" ? "active" : ""}`}
                            onClick={() => { setActiveTab("recursos"); setIsSidebarOpen(false); }}
                        >
                            <BookOpen size={18} /> Recursos
                        </button>
                        {canVerExpedientes && (
                            <button
                                className={`nav-item ${activeTab === "expedientes" ? "active" : ""}`}
                                onClick={() => { setActiveTab("expedientes"); setIsSidebarOpen(false); }}
                            >
                                <Users size={18} /> Mi Personal
                            </button>
                        )}
                        {canVerCapems && (
                            <button
                                className={`nav-item ${activeTab === "capems" ? "active" : ""}`}
                                onClick={() => { setActiveTab("capems"); setIsSidebarOpen(false); }}
                            >
                                <Building2 size={18} /> Fichas CAPEMS
                            </button>
                        )}
                    </div>

                    <div className="nav-group" style={{ marginTop: "auto", paddingTop: "1rem" }}>
                        <button className="nav-item text-danger" onClick={() => signOut({ callbackUrl: "/login" })}>
                            <LogOut size={18} /> Cerrar Sesión
                        </button>
                    </div>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <School size={20} color="var(--primary)" />
                            {supervision.nombre}
                        </h2>
                    </div>
                    <div className="admin-user-info" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span className="badge" style={{ background: "var(--primary-light)", color: "var(--primary-dark)" }}>
                            Ciclo: {ciclo}
                        </span>
                        <div className="user-avatar">{supervision.cct.substring(0, 2)}</div>
                        <div className="user-details hide-on-mobile">
                            <div className="user-name">{supervision.cct}</div>
                            <div className="user-role">Supervisión</div>
                        </div>
                    </div>
                </header>

                <div className="admin-content">
                    {anuncioGlobal && (
                        <div className="alert alert-info" style={{ marginBottom: "1.5rem" }}>
                            <MessageSquare size={18} style={{ flexShrink: 0 }} />
                            <div>
                                <strong>Aviso Importante:</strong> {anuncioGlobal}
                            </div>
                        </div>
                    )}
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}
