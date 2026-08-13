"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
    BarChart3,
    FileSpreadsheet,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Search,
    Filter,
    Download,
    Eye,
    Settings,
    RefreshCw,
    X,
    Building2,
    Users,
    GraduationCap,
    Send,
    HelpCircle
} from "lucide-react";

interface Estadistica911PanelProps {
    readOnly?: boolean;
}

export default function Estadistica911Panel({ readOnly = false }: Estadistica911PanelProps) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<{
        ciclo?: { id: string; nombre: string; activo: boolean };
        config?: any;
        escuelas?: any[];
        registros?: any[];
        kpis?: any;
    }>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

    // Modales
    const [selectedEscuela, setSelectedEscuela] = useState<any | null>(null);
    const [selectedRegistro, setSelectedRegistro] = useState<any | null>(null);
    const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
    const [modalUploadOpen, setModalUploadOpen] = useState(false);
    const [modalConfigOpen, setModalConfigOpen] = useState(false);

    // Form upload
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form config
    const [configTipoCorte, setConfigTipoCorte] = useState("INICIO_DE_CURSOS");
    const [configFechaLimite, setConfigFechaLimite] = useState("");
    const [savingConfig, setSavingConfig] = useState(false);

    // Form notas ATP
    const [notasAtp, setNotasAtp] = useState("");
    const [savingEstado, setSavingEstado] = useState(false);

    const cargarDatos = async () => {
        try {
            const res = await fetch("/api/admin/estadistica-911");
            if (!res.ok) throw new Error("Error al cargar datos");
            const json = await res.json();
            setData(json);
            if (json.config) {
                setConfigTipoCorte(json.config.tipoCorte || "INICIO_DE_CURSOS");
                setConfigFechaLimite(json.config.fechaLimite ? json.config.fechaLimite.split("T")[0] : "");
            }
        } catch {
            toast.error("No se pudieron cargar los datos de estadística 911");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        cargarDatos();
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile || !selectedEscuela) {
            toast.error("Seleccione un archivo y una escuela");
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", uploadFile);
            formData.append("escuelaId", selectedEscuela.id);

            const res = await fetch("/api/admin/estadistica-911/upload", {
                method: "POST",
                body: formData
            });
            const json = await res.json();

            if (json.success) {
                toast.success(json.message || "Formato 911 procesado correctamente");
                setModalUploadOpen(false);
                setUploadFile(null);
                cargarDatos();
            } else {
                toast.error(json.error || "Error al procesar formato 911");
            }
        } catch {
            toast.error("Error de red al subir archivo");
        } finally {
            setUploading(false);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            const res = await fetch("/api/admin/estadistica-911/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tipoCorte: configTipoCorte,
                    fechaLimite: configFechaLimite || null
                })
            });
            const json = await res.json();
            if (json.success) {
                toast.success("Configuración de corte actualizada");
                setModalConfigOpen(false);
                cargarDatos();
            } else {
                toast.error(json.error || "Error al guardar configuración");
            }
        } catch {
            toast.error("Error de red al guardar configuración");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleCambiarEstado = async (nuevoEstado: string) => {
        if (!selectedRegistro) return;
        setSavingEstado(true);
        try {
            const res = await fetch(`/api/admin/estadistica-911/${selectedRegistro.id}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    estado: nuevoEstado,
                    notasAtp
                })
            });
            const json = await res.json();
            if (json.success) {
                toast.success(`Estado actualizado a ${nuevoEstado}`);
                setModalDetalleOpen(false);
                cargarDatos();
            } else {
                toast.error(json.error || "Error al actualizar estado");
            }
        } catch {
            toast.error("Error al actualizar estado");
        } finally {
            setSavingEstado(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", color: "#64748b" }}>
                <RefreshCw style={{ width: "32px", height: "32px", animation: "spin 1s linear infinite" }} />
                <span style={{ marginLeft: "12px", fontWeight: 600 }}>Cargando módulo Estadística 911...</span>
            </div>
        );
    }

    const escuelas = data.escuelas || [];
    const registros = data.registros || [];
    const kpis = data.kpis || {
        totalEscuelas: 0,
        entregadas: 0,
        validados: 0,
        conInconsistencias: 0,
        pendientes: 0,
        matriculaZonal: 0,
        hombresZonal: 0,
        mujeresZonal: 0,
        gruposZonal: 0,
        docentesZonal: 0
    };

    // Mapeo de registros por escuelaId
    const registrosMap = new Map();
    registros.forEach(r => registrosMap.set(r.escuelaId, r));

    // Filtrar escuelas
    const escuelasFiltradas = escuelas.filter(esc => {
        const matchesSearch = esc.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            esc.cct.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (esc.localidad && esc.localidad.toLowerCase().includes(searchTerm.toLowerCase()));

        const reg = registrosMap.get(esc.id);
        const estado = reg ? reg.estado : "PENDIENTE";

        let matchesEstado = true;
        if (filtroEstado !== "TODOS") {
            matchesEstado = estado === filtroEstado;
        }

        return matchesSearch && matchesEstado;
    });

    const isInicioCursos = (data.config?.tipoCorte || configTipoCorte) === "INICIO_DE_CURSOS";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header del Módulo */}
            <div style={{
                background: "linear-gradient(135deg, #1e293b, #0f172a)",
                padding: "1.75rem",
                borderRadius: "16px",
                color: "#ffffff",
                boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem"
            }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        <span style={{ background: "rgba(59, 130, 246, 0.2)", padding: "0.5rem", borderRadius: "10px", display: "inline-flex" }}>
                            <BarChart3 style={{ width: "24px", height: "24px", color: "#60a5fa" }} />
                        </span>
                        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                            Auditoría y Validación Estadística 911 / SICEP
                        </h2>
                        <span style={{
                            background: isInicioCursos ? "#059669" : "#2563eb",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "9999px",
                            textTransform: "uppercase"
                        }}>
                            {isInicioCursos ? "911.8A Inicio de Cursos" : "911.8B Fin de Cursos"}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                        Supervisión Escolar - Control de Matrícula, Desglose por Grado/Edad y Cuadre Aritmético Zonal (Ciclo {data.ciclo?.nombre || "Actual"}).
                    </p>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.6rem 1rem",
                            borderRadius: "10px",
                            background: "rgba(255, 255, 255, 0.1)",
                            color: "#ffffff",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                    >
                        <RefreshCw style={{ width: "16px", height: "16px", animation: refreshing ? "spin 1s linear infinite" : "none" }} />
                        Actualizar
                    </button>

                    <a
                        href="/api/admin/estadistica-911/exportar"
                        download
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.6rem 1.1rem",
                            borderRadius: "10px",
                            background: "#10b981",
                            color: "#ffffff",
                            textDecoration: "none",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
                        }}
                    >
                        <Download style={{ width: "16px", height: "16px" }} />
                        Exportar Concentrado Excel
                    </a>

                    {!readOnly && (
                        <button
                            onClick={() => setModalConfigOpen(true)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.6rem 1rem",
                                borderRadius: "10px",
                                background: "rgba(255, 255, 255, 0.15)",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            <Settings style={{ width: "16px", height: "16px" }} />
                            Corte
                        </button>
                    )}
                </div>
            </div>

            {/* Tarjetas KPIs Zonales */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#64748b", fontSize: "0.8rem", fontWeight: 700 }}>
                        <span>MATRÍCULA ZONAL</span>
                        <GraduationCap style={{ width: "18px", height: "18px", color: "#3b82f6" }} />
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#1e293b", marginTop: "0.25rem" }}>
                        {kpis.matriculaZonal.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                        👨 {kpis.hombresZonal.toLocaleString()} Hombres | 👩 {kpis.mujeresZonal.toLocaleString()} Mujeres
                    </div>
                </div>

                <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#64748b", fontSize: "0.8rem", fontWeight: 700 }}>
                        <span>ENTREGAS 911</span>
                        <Building2 style={{ width: "18px", height: "18px", color: "#6366f1" }} />
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#1e293b", marginTop: "0.25rem" }}>
                        {kpis.entregadas} / {kpis.totalEscuelas}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                        {Math.round((kpis.entregadas / (kpis.totalEscuelas || 1)) * 100)}% de cobertura en zona
                    </div>
                </div>

                <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#64748b", fontSize: "0.8rem", fontWeight: 700 }}>
                        <span>VALIDADOS SIN ERROR</span>
                        <CheckCircle2 style={{ width: "18px", height: "18px", color: "#10b981" }} />
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#059669", marginTop: "0.25rem" }}>
                        {kpis.validados}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: "0.25rem" }}>
                        Cuadre aritmético 100% perfecto
                    </div>
                </div>

                <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#64748b", fontSize: "0.8rem", fontWeight: 700 }}>
                        <span>CON DISCREPANCIAS</span>
                        <AlertTriangle style={{ width: "18px", height: "18px", color: "#f59e0b" }} />
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 900, color: kpis.conInconsistencias > 0 ? "#d97706" : "#64748b", marginTop: "0.25rem" }}>
                        {kpis.conInconsistencias}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#d97706", marginTop: "0.25rem" }}>
                        {kpis.pendientes} pendientes de entregar
                    </div>
                </div>

                <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#64748b", fontSize: "0.8rem", fontWeight: 700 }}>
                        <span>GRUPOS Y DOCENTES</span>
                        <Users style={{ width: "18px", height: "18px", color: "#8b5cf6" }} />
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#1e293b", marginTop: "0.25rem" }}>
                        {kpis.gruposZonal} <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 600 }}>Grupos</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                        👨‍🏫 {kpis.docentesZonal} docentes frente a grupo
                    </div>
                </div>
            </div>

            {/* Barra de Búsqueda y Filtros */}
            <div style={{
                background: "#ffffff",
                padding: "1rem 1.25rem",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "260px" }}>
                    <Search style={{ width: "18px", height: "18px", color: "#94a3b8" }} />
                    <input
                        type="text"
                        placeholder="Buscar por escuela, CCT o localidad..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: "100%",
                            border: "none",
                            outline: "none",
                            fontSize: "0.875rem",
                            color: "#1e293b"
                        }}
                    />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Filter style={{ width: "16px", height: "16px", color: "#64748b" }} />
                    <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Estado:</span>
                    <select
                        value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value)}
                        style={{
                            padding: "0.4rem 0.8rem",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color: "#1e293b",
                            background: "#f8fafc",
                            cursor: "pointer"
                        }}
                    >
                        <option value="TODOS">Todos ({escuelas.length})</option>
                        <option value="VALIDADO">Validados ({kpis.validados})</option>
                        <option value="CON_INCONSISTENCIAS">Con Inconsistencias ({kpis.conInconsistencias})</option>
                        <option value="ENTREGADO_A_CORDE">Entregados a CORDE</option>
                        <option value="PENDIENTE">Pendientes ({kpis.pendientes})</option>
                    </select>
                </div>
            </div>

            {/* Tabla de Escuelas */}
            <div style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}>
                <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.825rem" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 800 }}>
                                <th style={{ padding: "0.85rem 1rem" }}>Escuela / CCT</th>
                                <th style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>1er Año (H/M/Tot)</th>
                                <th style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>2do Año (H/M/Tot)</th>
                                <th style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>3er Año (H/M/Tot)</th>
                                <th style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>Matrícula Total</th>
                                <th style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>Grupos / Docentes</th>
                                <th style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>Estado</th>
                                <th style={{ padding: "0.85rem 1rem", textAlign: "right" }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {escuelasFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                                        No se encontraron escuelas con los filtros seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                escuelasFiltradas.map((esc) => {
                                    const reg = registrosMap.get(esc.id);
                                    const estado = reg ? reg.estado : "PENDIENTE";
                                    const tieneInconsistencias = reg && Array.isArray(reg.inconsistenciasJson) && reg.inconsistenciasJson.length > 0;

                                    let a1H = 0, a1M = 0, a1T = 0;
                                    let a2H = 0, a2M = 0, a2T = 0;
                                    let a3H = 0, a3M = 0, a3T = 0;

                                    if (reg && reg.detalles) {
                                        reg.detalles.forEach((d: any) => {
                                            if (d.semestreGrado === 1 || d.semestreGrado === 2) {
                                                a1H += d.hombres; a1M += d.mujeres; a1T += d.total;
                                            } else if (d.semestreGrado === 3 || d.semestreGrado === 4) {
                                                a2H += d.hombres; a2M += d.mujeres; a2T += d.total;
                                            } else if (d.semestreGrado === 5 || d.semestreGrado === 6) {
                                                a3H += d.hombres; a3M += d.mujeres; a3T += d.total;
                                            }
                                        });
                                    }

                                    return (
                                        <tr
                                            key={esc.id}
                                            style={{
                                                borderBottom: "1px solid #f1f5f9",
                                                transition: "background 0.15s ease"
                                            }}
                                        >
                                            <td style={{ padding: "0.85rem 1rem" }}>
                                                <div style={{ fontWeight: 700, color: "#1e293b" }}>{esc.nombre}</div>
                                                <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
                                                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb" }}>{esc.cct}</span>
                                                    <span>•</span>
                                                    <span>{esc.localidad || "Sin localidad"}</span>
                                                </div>
                                            </td>

                                            <td style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>
                                                {reg ? (
                                                    <span style={{ fontWeight: 600, color: "#334155" }}>
                                                        {a1H} / {a1M} = <strong style={{ color: "#1e293b" }}>{a1T}</strong>
                                                    </span>
                                                ) : <span style={{ color: "#cbd5e1" }}>-</span>}
                                            </td>

                                            <td style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>
                                                {reg ? (
                                                    <span style={{ fontWeight: 600, color: "#334155" }}>
                                                        {a2H} / {a2M} = <strong style={{ color: "#1e293b" }}>{a2T}</strong>
                                                    </span>
                                                ) : <span style={{ color: "#cbd5e1" }}>-</span>}
                                            </td>

                                            <td style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>
                                                {reg ? (
                                                    <span style={{ fontWeight: 600, color: "#334155" }}>
                                                        {a3H} / {a3M} = <strong style={{ color: "#1e293b" }}>{a3T}</strong>
                                                    </span>
                                                ) : <span style={{ color: "#cbd5e1" }}>-</span>}
                                            </td>

                                            <td style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>
                                                {reg ? (
                                                    <div>
                                                        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b" }}>
                                                            {reg.totalAlumnos}
                                                        </div>
                                                        <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                                                            {reg.totalHombres} H / {reg.totalMujeres} M
                                                        </div>
                                                    </div>
                                                ) : <span style={{ color: "#cbd5e1" }}>-</span>}
                                            </td>

                                            <td style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>
                                                {reg ? (
                                                    <span style={{ fontWeight: 600, color: "#334155" }}>
                                                        {reg.totalGrupos} grp / {reg.totalDocentes} doc
                                                    </span>
                                                ) : <span style={{ color: "#cbd5e1" }}>-</span>}
                                            </td>

                                            <td style={{ padding: "0.85rem 0.75rem", textAlign: "center" }}>
                                                {estado === "VALIDADO" && (
                                                    <span style={{ background: "#ecfdf5", color: "#059669", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontWeight: 700, fontSize: "0.725rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                                        <CheckCircle2 style={{ width: "12px", height: "12px" }} /> Validado
                                                    </span>
                                                )}
                                                {estado === "CON_INCONSISTENCIAS" && (
                                                    <span style={{ background: "#fffbeb", color: "#d97706", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontWeight: 700, fontSize: "0.725rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                                        <AlertTriangle style={{ width: "12px", height: "12px" }} /> Descuadre
                                                    </span>
                                                )}
                                                {estado === "ENTREGADO_A_CORDE" && (
                                                    <span style={{ background: "#eff6ff", color: "#2563eb", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontWeight: 700, fontSize: "0.725rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                                        <Send style={{ width: "12px", height: "12px" }} /> En CORDE
                                                    </span>
                                                )}
                                                {estado === "PENDIENTE" && (
                                                    <span style={{ background: "#f1f5f9", color: "#64748b", padding: "0.25rem 0.6rem", borderRadius: "9999px", fontWeight: 600, fontSize: "0.725rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                                        <Clock style={{ width: "12px", height: "12px" }} /> Pendiente
                                                    </span>
                                                )}
                                            </td>

                                            <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
                                                    {reg && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedEscuela(esc);
                                                                setSelectedRegistro(reg);
                                                                setNotasAtp(reg.notasAtp || "");
                                                                setModalDetalleOpen(true);
                                                            }}
                                                            style={{
                                                                background: "#f1f5f9",
                                                                border: "none",
                                                                padding: "0.35rem 0.65rem",
                                                                borderRadius: "8px",
                                                                color: "#334155",
                                                                fontWeight: 600,
                                                                fontSize: "0.75rem",
                                                                cursor: "pointer",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "0.25rem"
                                                            }}
                                                        >
                                                            <Eye style={{ width: "14px", height: "14px" }} />
                                                            {tieneInconsistencias ? "Inconsistencias" : "Detalles"}
                                                        </button>
                                                    )}

                                                    {!readOnly && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedEscuela(esc);
                                                                setModalUploadOpen(true);
                                                            }}
                                                            style={{
                                                                background: "#eff6ff",
                                                                border: "1px solid #bfdbfe",
                                                                padding: "0.35rem 0.65rem",
                                                                borderRadius: "8px",
                                                                color: "#2563eb",
                                                                fontWeight: 600,
                                                                fontSize: "0.75rem",
                                                                cursor: "pointer",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "0.25rem"
                                                            }}
                                                        >
                                                            <Upload style={{ width: "14px", height: "14px" }} />
                                                            {reg ? "Reemplazar" : "Subir"}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Detalle de Inconsistencias y Validación */}
            {modalDetalleOpen && selectedEscuela && selectedRegistro && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: "1rem"
                }}>
                    <div style={{
                        background: "#ffffff",
                        borderRadius: "16px",
                        width: "100%",
                        maxWidth: "650px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        padding: "1.75rem",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
                            <div>
                                <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                                    Detalle de Auditoría 911 - {selectedEscuela.nombre}
                                </h3>
                                <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0.2rem 0 0" }}>
                                    CCT: <strong>{selectedEscuela.cct}</strong> | Corte: <strong>{selectedRegistro.tipoCorte}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setModalDetalleOpen(false)}
                                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                            >
                                <X style={{ width: "20px", height: "20px" }} />
                            </button>
                        </div>

                        {/* Inconsistencias detectadas */}
                        <div style={{ marginTop: "1.25rem" }}>
                            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "0.5rem" }}>
                                Discrepancias Aritméticas Encontradas:
                            </h4>

                            {(!selectedRegistro.inconsistenciasJson || selectedRegistro.inconsistenciasJson.length === 0) ? (
                                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "1rem", borderRadius: "10px", color: "#065f46", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <CheckCircle2 style={{ width: "20px", height: "20px", color: "#059669" }} />
                                    <span>¡Excelente! No se encontraron errores aritméticos en la suma de género, edades ni totales.</span>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {selectedRegistro.inconsistenciasJson.map((inc: any, i: number) => (
                                        <div
                                            key={i}
                                            style={{
                                                background: inc.severidad === "ERROR_CRITICO" ? "#fef2f2" : "#fffbeb",
                                                border: `1px solid ${inc.severidad === "ERROR_CRITICO" ? "#fecaca" : "#fde68a"}`,
                                                padding: "0.75rem",
                                                borderRadius: "8px",
                                                fontSize: "0.8rem",
                                                color: inc.severidad === "ERROR_CRITICO" ? "#991b1b" : "#92400e"
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                <AlertTriangle style={{ width: "14px", height: "14px" }} />
                                                {inc.campo}
                                            </div>
                                            <div style={{ marginTop: "0.25rem" }}>{inc.descripcion}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Desglose por Semestres */}
                        {selectedRegistro.detalles && selectedRegistro.detalles.length > 0 && (
                            <div style={{ marginTop: "1.25rem" }}>
                                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "0.5rem" }}>
                                    Desglose por Semestre Capturado:
                                </h4>
                                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                                        <thead>
                                            <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                                                <th style={{ padding: "0.5rem 0.75rem" }}>Semestre</th>
                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Hombres</th>
                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Mujeres</th>
                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Total</th>
                                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Grupos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRegistro.detalles.map((d: any) => (
                                                <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700 }}>{d.semestreGrado}° Semestre</td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{d.hombres}</td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{d.mujeres}</td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700, color: "#2563eb" }}>{d.total}</td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{d.grupos}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Notas del ATP */}
                        {!readOnly && (
                            <div style={{ marginTop: "1.25rem" }}>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
                                    Notas y Observaciones de Supervisión:
                                </label>
                                <textarea
                                    value={notasAtp}
                                    onChange={(e) => setNotasAtp(e.target.value)}
                                    placeholder="Ingrese observaciones para el director o constancia de recepción..."
                                    rows={3}
                                    style={{
                                        width: "100%",
                                        padding: "0.6rem",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "0.85rem",
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>
                        )}

                        {/* Botones de acción */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                Hash SHA-256: <code style={{ color: "#2563eb" }}>{selectedRegistro.sha256Hash?.substring(0, 16)}...</code>
                            </div>

                            {!readOnly && (
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        onClick={() => handleCambiarEstado("CON_INCONSISTENCIAS")}
                                        disabled={savingEstado}
                                        style={{
                                            background: "#fffbeb",
                                            border: "1px solid #fde68a",
                                            padding: "0.5rem 0.9rem",
                                            borderRadius: "8px",
                                            color: "#92400e",
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            cursor: "pointer"
                                        }}
                                    >
                                        Marcar Descuadre
                                    </button>

                                    <button
                                        onClick={() => handleCambiarEstado("VALIDADO")}
                                        disabled={savingEstado}
                                        style={{
                                            background: "#ecfdf5",
                                            border: "1px solid #a7f3d0",
                                            padding: "0.5rem 0.9rem",
                                            borderRadius: "8px",
                                            color: "#065f46",
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            cursor: "pointer"
                                        }}
                                    >
                                        Aprobar / Validar
                                    </button>

                                    <button
                                        onClick={() => handleCambiarEstado("ENTREGADO_A_CORDE")}
                                        disabled={savingEstado}
                                        style={{
                                            background: "#2563eb",
                                            border: "none",
                                            padding: "0.5rem 0.9rem",
                                            borderRadius: "8px",
                                            color: "#ffffff",
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            cursor: "pointer"
                                        }}
                                    >
                                        Entregado a CORDE
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Subir Archivo 911 */}
            {modalUploadOpen && selectedEscuela && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: "1rem"
                }}>
                    <div style={{
                        background: "#ffffff",
                        borderRadius: "16px",
                        width: "100%",
                        maxWidth: "480px",
                        padding: "1.75rem",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
                            <div>
                                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                                    Cargar Formato Oficial 911.8
                                </h3>
                                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0.2rem 0 0" }}>
                                    {selectedEscuela.nombre} ({selectedEscuela.cct})
                                </p>
                            </div>
                            <button
                                onClick={() => setModalUploadOpen(false)}
                                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                            >
                                <X style={{ width: "20px", height: "20px" }} />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} style={{ marginTop: "1.25rem" }}>
                            <div style={{
                                border: "2px dashed #cbd5e1",
                                padding: "1.5rem",
                                borderRadius: "12px",
                                textAlign: "center",
                                background: "#f8fafc",
                                cursor: "pointer"
                            }}>
                                <FileSpreadsheet style={{ width: "36px", height: "36px", color: "#10b981", margin: "0 auto 0.5rem" }} />
                                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", margin: 0 }}>
                                    {uploadFile ? uploadFile.name : "Seleccione o arrastre el archivo Excel (.xlsx / .xls) o PDF"}
                                </p>
                                <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                                    El motor validará automáticamente la suma por género, edades y grupos.
                                </p>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.pdf"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setModalUploadOpen(false)}
                                    style={{
                                        padding: "0.5rem 1rem",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        background: "#ffffff",
                                        color: "#475569",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!uploadFile || uploading}
                                    style={{
                                        padding: "0.5rem 1.25rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background: "#2563eb",
                                        color: "#ffffff",
                                        fontSize: "0.85rem",
                                        fontWeight: 700,
                                        cursor: (!uploadFile || uploading) ? "not-allowed" : "pointer",
                                        opacity: (!uploadFile || uploading) ? 0.6 : 1
                                    }}
                                >
                                    {uploading ? "Validando..." : "Subir y Validar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Configuración de Corte */}
            {modalConfigOpen && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: "1rem"
                }}>
                    <div style={{
                        background: "#ffffff",
                        borderRadius: "16px",
                        width: "100%",
                        maxWidth: "440px",
                        padding: "1.75rem",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                                Configuración de Corte 911
                            </h3>
                            <button
                                onClick={() => setModalConfigOpen(false)}
                                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                            >
                                <X style={{ width: "20px", height: "20px" }} />
                            </button>
                        </div>

                        <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
                                    Tipo de Corte Activo:
                                </label>
                                <select
                                    value={configTipoCorte}
                                    onChange={(e) => setConfigTipoCorte(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "0.55rem",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        color: "#1e293b"
                                    }}
                                >
                                    <option value="INICIO_DE_CURSOS">🟢 911.8A - Inicio de Cursos</option>
                                    <option value="FIN_DE_CURSOS">🔵 911.8B - Fin de Cursos</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.35rem" }}>
                                    Fecha Límite de Entrega:
                                </label>
                                <input
                                    type="date"
                                    value={configFechaLimite}
                                    onChange={(e) => setConfigFechaLimite(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "0.55rem",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "0.85rem",
                                        color: "#1e293b",
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setModalConfigOpen(false)}
                                    style={{
                                        padding: "0.5rem 1rem",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        background: "#ffffff",
                                        color: "#475569",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveConfig}
                                    disabled={savingConfig}
                                    style={{
                                        padding: "0.5rem 1.25rem",
                                        borderRadius: "8px",
                                        border: "none",
                                        background: "#2563eb",
                                        color: "#ffffff",
                                        fontSize: "0.85rem",
                                        fontWeight: 700,
                                        cursor: "pointer"
                                    }}
                                >
                                    {savingConfig ? "Guardando..." : "Guardar Ajustes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
