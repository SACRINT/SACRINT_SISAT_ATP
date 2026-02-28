"use client";

import { signOut } from "next-auth/react";
import {
    Upload,
    LogOut,
    School,
    BookOpen,
    MessageSquare,
    Trophy,
} from "lucide-react";
import { useState } from "react";

import EntregasListado from "./_componentes/EntregasListado";
import RecursosListado from "./_componentes/RecursosListado";
import InscripcionEventos from "./_componentes/InscripcionEventos";

import { ProgramaGroup, RecursoDirector } from "@/types/director";

export default function DirectorPortal({
    escuela,
    programas,
    ciclo,
    anuncioGlobal,
    recursos,
}: {
    escuela: { id: string; cct: string; nombre: string; localidad: string };
    programas: ProgramaGroup[];
    ciclo: string;
    anuncioGlobal?: string;
    recursos: RecursoDirector[];
}) {
    const [tab, setTab] = useState<"entregas" | "recursos" | "eventos">("entregas");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Stats
    const allEntregas = programas.flatMap((p) => p.entregas);
    const aprobadas = allEntregas.filter((e) => e.estado === "APROBADO").length;
    const porcentaje = allEntregas.length > 0 ? Math.round((aprobadas / allEntregas.length) * 100) : 0;

    return (
        <>
            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-brand" style={{ display: "flex", flexDirection: "column", gap: "0.15rem", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <School size={24} />
                        <span style={{ fontSize: "0.9375rem", fontWeight: "bold" }}>SISAT-ATP</span>
                    </div>
                    <span style={{ fontSize: "0.6rem", opacity: 0.8, lineHeight: 1 }}>
                        Sistema Inteligente de Supervisión y Automatización Técnica
                    </span>
                </div>
                <div className="navbar-user">
                    <button
                        className="btn btn-outline"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        style={{ fontSize: "0.8125rem", padding: "0.5rem 0.75rem", minHeight: "auto" }}
                    >
                        <LogOut size={16} />
                        Salir
                    </button>
                </div>
            </nav>

            <div className="page-container fade-in">
                {/* Header */}
                <div className="card" style={{ marginBottom: "1.5rem", background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", color: "white", border: "none" }}>
                    <h2 style={{ marginBottom: "0.25rem" }}>{escuela.nombre}</h2>
                    <p style={{ opacity: 0.85, fontSize: "0.875rem", margin: 0 }}>
                        {escuela.cct} • {escuela.localidad} • Ciclo {ciclo}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
                        <div style={{ flex: 1 }}>
                            <div className="progress-bar" style={{ background: "rgba(255,255,255,0.2)" }}>
                                <div className="progress-fill" style={{ width: `${porcentaje}%`, background: "white" }} />
                            </div>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: "1.25rem" }}>{porcentaje}%</span>
                    </div>
                    <p style={{ opacity: 0.7, fontSize: "0.75rem", margin: "0.25rem 0 0" }}>
                        {aprobadas} de {allEntregas.length} entregas aprobadas
                    </p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                        {message.text}
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

                {/* Tab Toggle */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                    <button className={`btn ${tab === "entregas" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("entregas")} style={{ flex: 1 }}>
                        <Upload size={18} />
                        Mis Entregas
                    </button>
                    <button className={`btn ${tab === "eventos" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("eventos")} style={{ flex: 1 }}>
                        <Trophy size={18} />
                        Eventos 2026
                    </button>
                    <button className={`btn ${tab === "recursos" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("recursos")} style={{ flex: 1 }}>
                        <BookOpen size={18} />
                        Recursos
                    </button>
                </div>

                {/* Tab Content */}
                {tab === "entregas" && (
                    <EntregasListado
                        programas={programas}
                        onSetMessage={setMessage}
                    />
                )}

                {tab === "recursos" && (
                    <RecursosListado
                        recursos={recursos}
                    />
                )}

                {tab === "eventos" && (
                    <InscripcionEventos />
                )}
            </div>
        </>
    );
}
