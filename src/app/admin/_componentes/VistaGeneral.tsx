"use client";

import { useState } from "react";
import { Download, Send } from "lucide-react";

interface Stats {
    totalEntregas: number;
    aprobadas: number;
    pendientes: number;
    enRevision: number;
    requiereCorreccion: number;
    noAprobado: number;
    noEntregadas: number;
}

export default function VistaGeneral({
    stats,
    ciclo,
    totalEscuelas,
    anuncioGlobal,
    onSaveAnuncio,
    onExportExcel
}: {
    stats: Stats;
    ciclo: string;
    totalEscuelas: number;
    anuncioGlobal: string | null;
    onSaveAnuncio: (anuncio: string) => Promise<boolean>;
    onExportExcel: () => void;
}) {
    const [anuncio, setAnuncio] = useState(anuncioGlobal || "");
    const [savingAnuncio, setSavingAnuncio] = useState(false);

    const entregadas = stats.totalEntregas - stats.noEntregadas;
    const porcentaje = stats.totalEntregas > 0 ? Math.round((entregadas / stats.totalEntregas) * 100) : 0;

    const handleSave = async () => {
        setSavingAnuncio(true);
        await onSaveAnuncio(anuncio);
        setSavingAnuncio(false);
    };

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1>Vista General</h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Ciclo {ciclo} • {totalEscuelas} bachilleratos • {stats.totalEntregas} entregas
                    </p>
                </div>
                <button onClick={onExportExcel} className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}>
                    <Download size={18} /> Exportar Reporte a Excel
                </button>
            </div>

            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                    { label: "Aprobadas", value: stats.aprobadas, color: "var(--success)" },
                    { label: "Entregados", value: stats.pendientes, color: "var(--warning)" },
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

            <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7", marginBottom: "1.5rem" }}>
                <h3 style={{ color: "#0c5a8e", marginBottom: "0.5rem", fontSize: "1rem" }}>Aviso Global para Directores</h3>
                <textarea
                    className="form-control"
                    rows={2}
                    value={anuncio}
                    onChange={(e) => setAnuncio(e.target.value)}
                    placeholder="Escribe un aviso que todos los directores visualizarán en su portal..."
                    style={{ resize: "vertical", fontFamily: "inherit", marginBottom: "0.5rem" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={savingAnuncio || anuncio === anuncioGlobal}>
                        <Send size={16} /> {savingAnuncio ? "Guardando..." : "Actualizar Aviso"}
                    </button>
                </div>
            </div>

            <div className="card" style={{ background: "#f8f9fa", border: "1px solid var(--border)" }}>
                <h3 style={{ color: "var(--text)", marginBottom: "0.5rem", fontSize: "1rem" }}>Siguientes Pasos</h3>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Utiliza el menú lateral para revisar el progreso individual por escuela o por programa.
                    Para administrar fechas límite o la información de las escuelas, utiliza la sección de Administración.
                </p>
            </div>
        </div>
    );
}
