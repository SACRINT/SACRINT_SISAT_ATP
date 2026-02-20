"use client";

import { signOut } from "next-auth/react";
import {
    BarChart3,
    CheckCircle2,
    Clock,
    XCircle,
    LogOut,
    School,
    FileText,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface Programa {
    id: string;
    nombre: string;
    descripcion: string;
    entregas: Entrega[];
}

interface Escuela {
    id: string;
    cct: string;
    nombre: string;
    localidad: string;
    total: number;
    entregas: (Entrega & { programa: { nombre: string } })[];
}

interface Entrega {
    id: string;
    estatus: string;
    archivoNombre: string | null;
    fechaSubida: string | null;
    observaciones: string | null;
    escuela?: { cct: string; nombre: string; localidad: string };
}

interface Stats {
    totalEntregas: number;
    completas: number;
    pendientes: number;
    noEntregadas: number;
}

export default function AdminDashboard({
    programas,
    escuelas,
    stats,
    userName,
}: {
    programas: Programa[];
    escuelas: Escuela[];
    stats: Stats;
    userName: string;
}) {
    const [vista, setVista] = useState<"escuelas" | "programas">("escuelas");
    const [expanded, setExpanded] = useState<string | null>(null);

    const porcentajeCompleto = Math.round((stats.completas / stats.totalEntregas) * 100);

    return (
        <>
            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-brand">
                    <BarChart3 size={24} />
                    <span>Centro de Mando ATP</span>
                </div>
                <div className="navbar-user">
                    <span style={{ display: "none" }}>{userName}</span>
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
                <div className="page-header">
                    <h1>
                        <BarChart3 size={28} />
                        Panel de Control
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Supervisión de 18 bachilleratos • {stats.totalEntregas} entregas totales
                    </p>
                </div>

                {/* Stats Row */}
                <div className="stats-row">
                    <div className="card stat-card">
                        <div className="stat-number" style={{ color: "var(--success)" }}>
                            {stats.completas}
                        </div>
                        <div className="stat-label">Completas</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-number" style={{ color: "var(--warning)" }}>
                            {stats.pendientes}
                        </div>
                        <div className="stat-label">Pendientes</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-number" style={{ color: "var(--danger)" }}>
                            {stats.noEntregadas}
                        </div>
                        <div className="stat-label">No entregadas</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span style={{ fontWeight: 600 }}>Progreso General</span>
                        <span style={{ color: "var(--primary)", fontWeight: 700 }}>{porcentajeCompleto}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${porcentajeCompleto}%` }} />
                    </div>
                </div>

                {/* View Toggle */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                    <button
                        className={`btn ${vista === "escuelas" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setVista("escuelas")}
                        style={{ flex: 1 }}
                    >
                        <School size={18} />
                        Por Escuela
                    </button>
                    <button
                        className={`btn ${vista === "programas" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setVista("programas")}
                        style={{ flex: 1 }}
                    >
                        <FileText size={18} />
                        Por Programa
                    </button>
                </div>

                {/* Vista por Escuelas */}
                {vista === "escuelas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {escuelas.map((esc) => {
                            const completasEsc = esc.entregas.filter((e) => e.estatus === "COMPLETO").length;
                            const totalEsc = esc.entregas.length;
                            const porcEsc = totalEsc > 0 ? Math.round((completasEsc / totalEsc) * 100) : 0;
                            const isExpanded = expanded === esc.id;

                            let borderColor = "var(--danger)";
                            if (porcEsc === 100) borderColor = "var(--success)";
                            else if (porcEsc > 0) borderColor = "var(--warning)";

                            return (
                                <div key={esc.id} className="card" style={{ borderLeft: `4px solid ${borderColor}`, padding: 0 }}>
                                    <button
                                        onClick={() => setExpanded(isExpanded ? null : esc.id)}
                                        style={{
                                            width: "100%",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "1rem",
                                            textAlign: "left",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{esc.nombre}</div>
                                                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                                    {esc.cct} • {esc.localidad} • {esc.total} alumnos
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <span style={{ fontWeight: 700, color: borderColor }}>{porcEsc}%</span>
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                        <div className="progress-bar" style={{ marginTop: "0.5rem", height: "6px" }}>
                                            <div className="progress-fill" style={{ width: `${porcEsc}%`, background: borderColor }} />
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" }}>
                                            {esc.entregas.map((ent) => (
                                                <div
                                                    key={ent.id}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        padding: "0.5rem 0",
                                                        borderBottom: "1px solid var(--border)",
                                                    }}
                                                >
                                                    <span style={{ fontSize: "0.875rem" }}>{ent.programa.nombre}</span>
                                                    <span className={`badge badge-${ent.estatus.toLowerCase().replace(/_/g, "-").replace(" ", "-")}`}>
                                                        {ent.estatus === "COMPLETO" && <CheckCircle2 size={14} />}
                                                        {ent.estatus === "PENDIENTE" && <Clock size={14} />}
                                                        {ent.estatus === "NO_ENTREGADO" && <XCircle size={14} />}
                                                        {ent.estatus.replace("_", " ")}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Vista por Programas */}
                {vista === "programas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {programas.map((prog) => {
                            const completasProg = prog.entregas.filter((e) => e.estatus === "COMPLETO").length;
                            const total = prog.entregas.length;
                            const porc = total > 0 ? Math.round((completasProg / total) * 100) : 0;
                            const isExpanded = expanded === prog.id;

                            return (
                                <div key={prog.id} className="card" style={{ padding: 0 }}>
                                    <button
                                        onClick={() => setExpanded(isExpanded ? null : prog.id)}
                                        style={{
                                            width: "100%",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "1rem",
                                            textAlign: "left",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{prog.nombre}</div>
                                                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                                    {completasProg}/{total} escuelas completadas
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
                                        <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" }}>
                                            {prog.entregas.map((ent) => (
                                                <div
                                                    key={ent.id}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        padding: "0.5rem 0",
                                                        borderBottom: "1px solid var(--border)",
                                                    }}
                                                >
                                                    <div style={{ fontSize: "0.875rem" }}>
                                                        <div style={{ fontWeight: 500 }}>{ent.escuela?.nombre}</div>
                                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                            {ent.escuela?.cct} • {ent.escuela?.localidad}
                                                        </div>
                                                    </div>
                                                    <span className={`badge badge-${ent.estatus.toLowerCase().replace(/_/g, "-").replace(" ", "-")}`}>
                                                        {ent.estatus === "COMPLETO" && <CheckCircle2 size={14} />}
                                                        {ent.estatus === "PENDIENTE" && <Clock size={14} />}
                                                        {ent.estatus === "NO_ENTREGADO" && <XCircle size={14} />}
                                                        {ent.estatus.replace("_", " ")}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
