"use client";

import { useState, useMemo } from "react";
import {
    Download,
    Send,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCw,
    BarChart3,
    TrendingUp,
    School,
    FileCheck2,
    FileMinus,
    ChevronRight,
    MapPin,
} from "lucide-react";
import type { ZonaStat } from "@/types";

interface EscuelaAlerta {
    id: string;
    cct: string;
    nombre: string;
    pendientes: number;
    requiereCorreccion: number;
    noEntregadas: number;
    aprobadas: number;
    total: number;
}

interface Stats {
    totalEntregas: number;
    aprobadas: number;
    pendientes: number;
    enRevision: number;
    requiereCorreccion: number;
    noAprobado: number;
    noEntregadas: number;
    escuelas?: EscuelaAlerta[];
}

export default function VistaGeneral({
    stats,
    zonaStats,
    ciclo,
    totalEscuelas,
    anuncioGlobal,
    onSaveAnuncio,
    onExportExcel,
    onNavigateEscuelas,
}: {
    stats: Stats;
    zonaStats?: ZonaStat[];
    ciclo: string;
    totalEscuelas: number;
    anuncioGlobal: string | null;
    onSaveAnuncio: (anuncio: string) => Promise<boolean>;
    onExportExcel: () => void;
    onNavigateEscuelas?: () => void;
}) {
    const [anuncio, setAnuncio] = useState(anuncioGlobal || "");
    const [savingAnuncio, setSavingAnuncio] = useState(false);
    const [savedOk, setSavedOk] = useState(false);

    const entregadas = stats.totalEntregas - stats.noEntregadas;
    const porcentaje = stats.totalEntregas > 0
        ? Math.round((entregadas / stats.totalEntregas) * 100)
        : 0;
    const porcentajeAprobadas = stats.totalEntregas > 0
        ? Math.round((stats.aprobadas / stats.totalEntregas) * 100)
        : 0;

    // Donut chart values (percentages for SVG arc)
    const donutData = useMemo(() => {
        const total = stats.totalEntregas || 1;
        return [
            { label: "Aprobadas", value: stats.aprobadas, color: "#22c55e" },
            { label: "En Revisión", value: stats.enRevision, color: "#3b82f6" },
            { label: "Entregadas", value: stats.pendientes, color: "#f59e0b" },
            { label: "Req. Corrección", value: stats.requiereCorreccion, color: "#f97316" },
            { label: "No Aprobadas", value: stats.noAprobado, color: "#ef4444" },
            { label: "No Entregadas", value: stats.noEntregadas, color: "#d1d5db" },
        ].map(item => ({
            ...item,
            pct: item.value / total,
        }));
    }, [stats]);

    // SVG Donut path builder
    function buildDonut(data: typeof donutData, r = 54, cx = 64, cy = 64) {
        let currentAngle = -Math.PI / 2;
        const arcs: { d: string; color: string; label: string; value: number }[] = [];
        const gap = 0.02;
        for (const segment of data) {
            if (segment.pct === 0) continue;
            const angle = segment.pct * 2 * Math.PI - gap;
            const x1 = cx + r * Math.cos(currentAngle);
            const y1 = cy + r * Math.sin(currentAngle);
            currentAngle += angle;
            const x2 = cx + r * Math.cos(currentAngle);
            const y2 = cy + r * Math.sin(currentAngle);
            const largeArc = angle > Math.PI ? 1 : 0;
            arcs.push({
                d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
                color: segment.color,
                label: segment.label,
                value: segment.value,
            });
            currentAngle += gap;
        }
        return arcs;
    }

    const donutArcs = buildDonut(donutData);

    // Alerts: schools that need attention
    const escuelasAlerta = useMemo(() => {
        if (!stats.escuelas) return [];
        return stats.escuelas
            .filter(e => e.noEntregadas > 0 || e.requiereCorreccion > 0)
            .sort((a, b) => (b.noEntregadas + b.requiereCorreccion) - (a.noEntregadas + a.requiereCorreccion))
            .slice(0, 8);
    }, [stats.escuelas]);

    const escuelasCompletas = stats.escuelas?.filter(e => e.aprobadas === e.total && e.total > 0).length ?? 0;
    const escuelasSinEntregar = stats.escuelas?.filter(e => e.noEntregadas > 0).length ?? 0;
    const escuelasConCorreccion = stats.escuelas?.filter(e => e.requiereCorreccion > 0).length ?? 0;

    const handleSave = async () => {
        setSavingAnuncio(true);
        const ok = await onSaveAnuncio(anuncio);
        setSavingAnuncio(false);
        if (ok) {
            setSavedOk(true);
            setTimeout(() => setSavedOk(false), 2500);
        }
    };

    return (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* ─── Header ─── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800 }}>Vista General</h1>
                    <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                        Ciclo {ciclo} · {totalEscuelas} bachilleratos · {stats.totalEntregas} entregas totales
                    </p>
                </div>
                <button
                    onClick={onExportExcel}
                    className="btn btn-outline"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}
                >
                    <Download size={16} /> Exportar a Excel
                </button>
            </div>

            {/* ─── KPI Cards + Donut ─── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start" }}>

                {/* KPI Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
                    {/* Completion rate - hero card */}
                    <div className="card" style={{
                        gridColumn: "1 / -1",
                        background: "linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)",
                        color: "white",
                        border: "none",
                        padding: "1.25rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "1.5rem",
                        flexWrap: "wrap",
                    }}>
                        <div>
                            <div style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1 }}>{porcentaje}%</div>
                            <div style={{ fontSize: "0.875rem", opacity: 0.85, marginTop: "0.25rem" }}>Tasa de entrega global</div>
                        </div>
                        <div style={{ flex: 1, minWidth: "180px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", opacity: 0.8, marginBottom: "0.375rem" }}>
                                <span>{entregadas} entregadas</span>
                                <span>{stats.noEntregadas} faltantes</span>
                            </div>
                            <div style={{ height: "8px", background: "rgba(255,255,255,0.25)", borderRadius: "4px" }}>
                                <div style={{ height: "100%", width: `${porcentaje}%`, background: "white", borderRadius: "4px", transition: "width 0.6s ease" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", opacity: 0.8, marginTop: "0.375rem" }}>
                                <span style={{ fontWeight: 700 }}>{porcentajeAprobadas}% aprobadas</span>
                                <span>{escuelasCompletas} escuelas al 100%</span>
                            </div>
                        </div>
                        <TrendingUp size={36} style={{ opacity: 0.3, flexShrink: 0 }} />
                    </div>

                    {/* Individual stat cards */}
                    {[
                        { label: "Aprobadas", value: stats.aprobadas, color: "#22c55e", icon: <CheckCircle2 size={20} />, bg: "#f0fdf4" },
                        { label: "Entregadas", value: stats.pendientes, color: "#f59e0b", icon: <Clock size={20} />, bg: "#fffbeb" },
                        { label: "En Revisión", value: stats.enRevision, color: "#3b82f6", icon: <RefreshCw size={20} />, bg: "#eff6ff" },
                        { label: "Req. Corrección", value: stats.requiereCorreccion, color: "#f97316", icon: <AlertTriangle size={20} />, bg: "#fff7ed" },
                        { label: "No Aprobadas", value: stats.noAprobado, color: "#ef4444", icon: <XCircle size={20} />, bg: "#fef2f2" },
                        { label: "No Entregadas", value: stats.noEntregadas, color: "#6b7280", icon: <FileMinus size={20} />, bg: "var(--bg-secondary)" },
                    ].map(({ label, value, color, icon, bg }) => (
                        <div key={label} className="card" style={{ padding: "0.875rem", background: bg, border: `1px solid ${color}20` }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                <div style={{ color, opacity: 0.8 }}>{icon}</div>
                                <div style={{ fontSize: "1.75rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                            </div>
                            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* Donut Chart */}
                <div className="card" style={{ padding: "1rem", minWidth: "180px", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Distribución
                    </div>
                    <svg width="128" height="128" viewBox="0 0 128 128">
                        {donutArcs.map((arc, i) => (
                            <path key={i} d={arc.d} fill={arc.color} opacity={0.9} />
                        ))}
                        {/* Inner circle (donut hole) */}
                        <circle cx="64" cy="64" r="36" fill="var(--surface)" />
                        <text x="64" y="60" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--text)">{porcentajeAprobadas}%</text>
                        <text x="64" y="74" textAnchor="middle" fontSize="8" fill="var(--text-muted)">aprobadas</text>
                    </svg>
                    {/* Legend */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "100%" }}>
                        {donutData.filter(d => d.value > 0).map(d => (
                            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.7rem" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: d.color, flexShrink: 0 }} />
                                <span style={{ color: "var(--text-muted)", flex: 1 }}>{d.label}</span>
                                <span style={{ fontWeight: 700, color: "var(--text)" }}>{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── School Alert Panels ─── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                <div className="card" style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <School size={18} style={{ color: "#ef4444" }} />
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#dc2626" }}>Sin Entregas</span>
                        <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: "1.25rem", color: "#dc2626" }}>{escuelasSinEntregar}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#7f1d1d" }}>
                        {escuelasSinEntregar === 0
                            ? "✅ Todas las escuelas han entregado"
                            : `${escuelasSinEntregar} escuela${escuelasSinEntregar !== 1 ? "s" : ""} con entregas faltantes`}
                    </p>
                </div>
                <div className="card" style={{ padding: "1rem", background: "#fff7ed", border: "1px solid #fed7aa" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <AlertTriangle size={18} style={{ color: "#f97316" }} />
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#ea580c" }}>Con Correcciones</span>
                        <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: "1.25rem", color: "#ea580c" }}>{escuelasConCorreccion}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#7c2d12" }}>
                        {escuelasConCorreccion === 0
                            ? "✅ Sin correcciones pendientes"
                            : `${escuelasConCorreccion} escuela${escuelasConCorreccion !== 1 ? "s" : ""} requieren corrección`}
                    </p>
                </div>
                <div className="card" style={{ padding: "1rem", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <FileCheck2 size={18} style={{ color: "#22c55e" }} />
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#16a34a" }}>Al 100%</span>
                        <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: "1.25rem", color: "#16a34a" }}>{escuelasCompletas}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#14532d" }}>
                        {escuelasCompletas === totalEscuelas
                            ? "🎉 ¡Todas las escuelas completas!"
                            : `${escuelasCompletas} de ${totalEscuelas} escuelas con todo aprobado`}
                    </p>
                </div>
            </div>

            {/* ─── Zone Stats Panel ─── */}
            {zonaStats && zonaStats.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{
                        padding: "0.875rem 1rem",
                        background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)",
                        color: "white",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.875rem" }}>
                            <MapPin size={16} />
                            Avance por Zona Escolar
                        </div>
                        <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                            {zonaStats.length} zona{zonaStats.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-secondary)", textAlign: "left" }}>
                                    <th style={{ padding: "0.5rem 1rem", fontWeight: 600, whiteSpace: "nowrap" }}>Zona</th>
                                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", whiteSpace: "nowrap" }}>Escuelas</th>
                                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", whiteSpace: "nowrap" }}>Aprobadas</th>
                                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", whiteSpace: "nowrap" }}>Entregadas</th>
                                    <th style={{ padding: "0.5rem 0.75rem", minWidth: "120px" }}>Progreso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {zonaStats.map((z, i) => {
                                    const pct = z.total > 0 ? Math.round((z.aprobadas / z.total) * 100) : 0;
                                    const barColor = pct === 100 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
                                    return (
                                        <tr key={z.zona} style={{
                                            background: i % 2 === 0 ? "white" : "var(--bg-secondary)",
                                            borderBottom: "1px solid var(--border)",
                                        }}>
                                            <td style={{ padding: "0.625rem 1rem", fontWeight: 600 }}>{z.zona}</td>
                                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "var(--text-muted)" }}>
                                                {z.escuelas}
                                            </td>
                                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700, color: "#22c55e" }}>
                                                {z.aprobadas}/{z.total}
                                            </td>
                                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "var(--text-secondary)" }}>
                                                {z.entregadas}/{z.total}
                                            </td>
                                            <td style={{ padding: "0.5rem 1rem" }}>
                                                <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", marginBottom: "2px" }}>
                                                    <div style={{
                                                        height: "100%", width: `${pct}%`,
                                                        background: barColor, borderRadius: "3px",
                                                        transition: "width 0.5s ease",
                                                    }} />
                                                </div>
                                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textAlign: "right" }}>{pct}%</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Schools requiring attention ─── */}
            {escuelasAlerta.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "0.875rem 1rem", background: "#fff7ed", borderBottom: "1px solid #fed7aa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <AlertTriangle size={16} style={{ color: "#f97316" }} />
                            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#ea580c" }}>
                                Escuelas que Requieren Atención
                            </span>
                        </div>
                        {onNavigateEscuelas && (
                            <button
                                onClick={onNavigateEscuelas}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}
                            >
                                Ver todas <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-secondary)", textAlign: "left" }}>
                                    <th style={{ padding: "0.5rem 0.875rem", fontWeight: 600 }}>Escuela</th>
                                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Faltantes</th>
                                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Correcciones</th>
                                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Aprobadas</th>
                                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Progreso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {escuelasAlerta.map((esc, i) => {
                                    const pct = esc.total > 0 ? Math.round((esc.aprobadas / esc.total) * 100) : 0;
                                    const rowBg = i % 2 === 0 ? "white" : "var(--bg-secondary)";
                                    return (
                                        <tr key={esc.id} style={{ background: rowBg, borderBottom: "1px solid var(--border)" }}>
                                            <td style={{ padding: "0.5rem 0.875rem" }}>
                                                <div style={{ fontWeight: 600 }}>{esc.nombre}</div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{esc.cct}</div>
                                            </td>
                                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                {esc.noEntregadas > 0 && (
                                                    <span style={{ background: "#fee2e2", color: "#dc2626", padding: "0.125rem 0.5rem", borderRadius: "12px", fontWeight: 700, fontSize: "0.75rem" }}>
                                                        {esc.noEntregadas}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                {esc.requiereCorreccion > 0 && (
                                                    <span style={{ background: "#fed7aa", color: "#c2410c", padding: "0.125rem 0.5rem", borderRadius: "12px", fontWeight: 700, fontSize: "0.75rem" }}>
                                                        {esc.requiereCorreccion}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700, color: "#22c55e" }}>
                                                {esc.aprobadas}/{esc.total}
                                            </td>
                                            <td style={{ padding: "0.5rem 0.75rem", minWidth: "80px" }}>
                                                <div style={{ height: "6px", background: "var(--bg)", borderRadius: "3px" }}>
                                                    <div style={{
                                                        height: "100%",
                                                        width: `${pct}%`,
                                                        background: pct === 100 ? "#22c55e" : pct > 50 ? "#f59e0b" : "#ef4444",
                                                        borderRadius: "3px",
                                                        transition: "width 0.4s ease",
                                                    }} />
                                                </div>
                                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px", textAlign: "right" }}>{pct}%</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Anuncio Global ─── */}
            <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7" }}>
                <h3 style={{ color: "#0c5a8e", marginBottom: "0.5rem", fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Send size={16} /> Aviso Global para Directores
                </h3>
                <textarea
                    className="form-control"
                    rows={2}
                    value={anuncio}
                    onChange={(e) => setAnuncio(e.target.value)}
                    placeholder="Escribe un aviso que todos los directores visualizarán en su portal..."
                    style={{ resize: "vertical", fontFamily: "inherit", marginBottom: "0.5rem", background: "white" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {savedOk && (
                        <span style={{ fontSize: "0.8125rem", color: "#16a34a", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <CheckCircle2 size={14} /> Aviso guardado correctamente
                        </span>
                    )}
                    <div style={{ marginLeft: "auto" }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={savingAnuncio || anuncio === anuncioGlobal}
                            style={{ minHeight: "auto", padding: "0.5rem 1rem" }}
                        >
                            <Send size={14} /> {savingAnuncio ? "Guardando..." : "Actualizar Aviso"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
