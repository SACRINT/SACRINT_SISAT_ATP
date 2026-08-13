"use client";

import { useState, useEffect, useRef } from "react";
import {
    BarChart3,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Clock,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    Info,
    Calendar,
    Users,
    Building,
    Check,
} from "lucide-react";

interface Estadistica911DirectorProps {
    escuela: {
        id: string;
        cct: string;
        nombre: string;
        localidad: string;
        director?: string | null;
        municipio?: string | null;
        zonaEscolar?: string | null;
    };
}

interface PeriodoConfig {
    activo: boolean;
    periodoCorte: "INICIO_CURSOS" | "FIN_CURSOS";
    fechaLimiteInicio: string | null;
    fechaLimiteFin: string | null;
}

interface RegistroEscuela {
    id: string;
    periodoCorte: "INICIO_CURSOS" | "FIN_CURSOS";
    estado: "PENDIENTE" | "CON_INCONSISTENCIAS" | "VALIDADO" | "ENTREGADO_A_CORDE";
    inconsistencias: Array<{ campo: string; esperado: number; obtenido: number; mensaje: string }>;
    totalAlumnos: number;
    totalHombres: number;
    totalMujeres: number;
    totalDocentes: number;
    totalGrupos: number;
    detallesGrado: Array<{ grado: number; hombres: number; mujeres: number; total: number; grupos: number }>;
    crucesSicep: Array<{ fechaCruce: string; matriculaSicep: number; diferencia: number; discrepancias: any }>;
    archivoUrl: string | null;
    archivoNombre: string | null;
    observaciones: string | null;
    updatedAt: string;
}

export default function Estadistica911Director({ escuela }: Estadistica911DirectorProps) {
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [config, setConfig] = useState<PeriodoConfig | null>(null);
    const [registro, setRegistro] = useState<RegistroEscuela | null>(null);
    const [mensaje, setMensaje] = useState<{ tipo: "success" | "error" | "info"; texto: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            // Cargar configuración
            const resConf = await fetch("/api/admin/estadistica-911/config");
            if (resConf.ok) {
                const confData = await resConf.json();
                setConfig(confData.config);
            }

            // Cargar registro de la escuela
            const resReg = await fetch("/api/admin/estadistica-911");
            if (resReg.ok) {
                const data = await resReg.json();
                const miEscuela = data.escuelas?.find((e: any) => e.cct === escuela.cct || e.id === escuela.id);
                if (miEscuela && miEscuela.registro) {
                    setRegistro(miEscuela.registro);
                } else {
                    setRegistro(null);
                }
            }
        } catch (err: any) {
            console.error("Error al cargar datos de Estadística 911:", err);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar los datos de estadística." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [escuela.id]);

    const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setMensaje(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("escuelaId", escuela.id);
        formData.append("periodoCorte", config?.periodoCorte || "INICIO_CURSOS");

        try {
            const res = await fetch("/api/admin/estadistica-911/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setMensaje({
                    tipo: data.estado === "VALIDADO" ? "success" : "info",
                    texto: `Formato procesado correctamente. Estado: ${data.estado === "VALIDADO" ? "✅ Validado sin inconsistencias" : "⚠️ Con inconsistencias aritméticas detectadas"}.`,
                });
                await cargarDatos();
            } else {
                setMensaje({ tipo: "error", texto: data.error || "Error al procesar el archivo 911." });
            }
        } catch (err: any) {
            setMensaje({ tipo: "error", texto: err.message || "Error al conectar con el servidor." });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const getEstadoBadge = (estado?: string) => {
        switch (estado) {
            case "VALIDADO":
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "0.85rem" }}>
                        <CheckCircle2 size={16} /> Validado por Supervisión
                    </span>
                );
            case "CON_INCONSISTENCIAS":
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "0.85rem" }}>
                        <AlertTriangle size={16} /> Inconsistencias Aritméticas
                    </span>
                );
            case "ENTREGADO_A_CORDE":
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#dbeafe", color: "#1d4ed8", fontWeight: 700, fontSize: "0.85rem" }}>
                        <Check size={16} /> Entregado a CORDE
                    </span>
                );
            default:
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#f1f5f9", color: "#64748b", fontWeight: 700, fontSize: "0.85rem" }}>
                        <Clock size={16} /> Pendiente de Entrega
                    </span>
                );
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #065f46, #047857)", padding: "1.5rem 1.75rem", borderRadius: "16px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <BarChart3 size={24} />
                        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0 }}>
                            Auditoría y Validación Estadística 911 / SICEP
                        </h2>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9 }}>
                        Formato Oficial 911.8 — {config?.periodoCorte === "FIN_CURSOS" ? "Fin de Cursos" : "Inicio de Cursos"}
                    </p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.15)", padding: "0.6rem 1rem", borderRadius: "12px", fontSize: "0.825rem", textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{escuela.cct}</div>
                    <div style={{ opacity: 0.9 }}>{escuela.nombre}</div>
                </div>
            </div>

            {/* Mensaje de alerta / feedback */}
            {mensaje && (
                <div style={{
                    padding: "0.875rem 1.25rem",
                    borderRadius: "10px",
                    background: mensaje.tipo === "success" ? "#dcfce7" : mensaje.tipo === "error" ? "#fee2e2" : "#eff6ff",
                    color: mensaje.tipo === "success" ? "#166534" : mensaje.tipo === "error" ? "#991b1b" : "#1e40af",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <span>{mensaje.texto}</span>
                    <button onClick={() => setMensaje(null)} style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
                </div>
            )}

            {loading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                    <RefreshCw className="animate-spin" size={32} style={{ margin: "0 auto 1rem" }} />
                    <p>Cargando información de estadística 911...</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
                    {/* Tarjeta de Estado & Subida */}
                    <div className="card" style={{ background: "white", padding: "1.5rem", borderRadius: "14px", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FileSpreadsheet size={20} color="#059669" />
                                Estado de la Entrega
                            </h3>
                            {getEstadoBadge(registro?.estado)}
                        </div>

                        <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "1.25rem", fontSize: "0.85rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                <span style={{ color: "#64748b" }}>Periodo de Corte:</span>
                                <strong style={{ color: "#0f172a" }}>
                                    {config?.periodoCorte === "FIN_CURSOS" ? "Fin de Cursos" : "Inicio de Cursos"}
                                </strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                <span style={{ color: "#64748b" }}>Fecha Límite:</span>
                                <strong style={{ color: "#0f172a" }}>
                                    {config?.periodoCorte === "FIN_CURSOS"
                                        ? (config?.fechaLimiteFin ? new Date(config.fechaLimiteFin).toLocaleDateString("es-MX") : "Sin fecha")
                                        : (config?.fechaLimiteInicio ? new Date(config.fechaLimiteInicio).toLocaleDateString("es-MX") : "Sin fecha")}
                                </strong>
                            </div>
                            {registro?.updatedAt && (
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Última Actualización:</span>
                                    <strong style={{ color: "#0f172a" }}>
                                        {new Date(registro.updatedAt).toLocaleString("es-MX")}
                                    </strong>
                                </div>
                            )}
                        </div>

                        {/* Botón de Carga */}
                        <div style={{ border: "2px dashed #cbd5e1", borderRadius: "12px", padding: "1.5rem", textAlign: "center", background: "#fcfdfe" }}>
                            <Upload size={28} color="#059669" style={{ margin: "0 auto 0.75rem" }} />
                            <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700 }}>
                                {registro ? "Actualizar Formato 911.8" : "Subir Formato 911.8"}
                            </h4>
                            <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "#64748b" }}>
                                Formato Excel (.xlsx, .xls) o PDF descargado del sistema oficial 911
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.pdf"
                                onChange={handleSubirArchivo}
                                style={{ display: "none" }}
                                id="archivo-911-input"
                                disabled={uploading}
                            />
                            <label
                                htmlFor="archivo-911-input"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    padding: "0.6rem 1.25rem",
                                    borderRadius: "8px",
                                    background: uploading ? "#94a3b8" : "#059669",
                                    color: "white",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                    cursor: uploading ? "not-allowed" : "pointer",
                                }}
                            >
                                {uploading ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" /> Procesando y Validando...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} /> Seleccionar Archivo
                                    </>
                                )}
                            </label>
                        </div>

                        {/* Observaciones de Supervisión */}
                        {registro?.observaciones && (
                            <div style={{ marginTop: "1rem", padding: "0.875rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", fontSize: "0.825rem" }}>
                                <div style={{ fontWeight: 700, color: "#166534", marginBottom: "0.25rem" }}>
                                    Nota de Supervisión:
                                </div>
                                <div style={{ color: "#15803d" }}>{registro.observaciones}</div>
                            </div>
                        )}
                    </div>

                    {/* Tarjeta de Resumen & Inconsistencias */}
                    <div className="card" style={{ background: "white", padding: "1.5rem", borderRadius: "14px", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Users size={20} color="#0284c7" />
                            Matrícula y Datos Validados
                        </h3>

                        {registro ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {/* Métricas clave */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", textAlign: "center" }}>
                                    <div style={{ background: "#f0fdf4", padding: "0.75rem", borderRadius: "8px", border: "1px solid #dcfce7" }}>
                                        <div style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 600 }}>ALUMNOS TOTAL</div>
                                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#15803d" }}>{registro.totalAlumnos}</div>
                                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                                            {registro.totalHombres} H / {registro.totalMujeres} M
                                        </div>
                                    </div>
                                    <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600 }}>DOCENTES</div>
                                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>{registro.totalDocentes}</div>
                                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Frente a grupo</div>
                                    </div>
                                    <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ fontSize: "0.7rem", color: "#475569", fontWeight: 600 }}>GRUPOS</div>
                                        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>{registro.totalGrupos}</div>
                                        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>1°, 2° y 3°</div>
                                    </div>
                                </div>

                                {/* Desglose por Grado */}
                                {registro.detallesGrado && registro.detallesGrado.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.5rem" }}>
                                            Desglose por Grado Escolar
                                        </div>
                                        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                                            <table style={{ width: "100%", fontSize: "0.75rem", textAlign: "center", borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                                                        <th style={{ padding: "0.4rem" }}>Grado</th>
                                                        <th style={{ padding: "0.4rem" }}>Hombres</th>
                                                        <th style={{ padding: "0.4rem" }}>Mujeres</th>
                                                        <th style={{ padding: "0.4rem" }}>Total</th>
                                                        <th style={{ padding: "0.4rem" }}>Grupos</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {registro.detallesGrado.map((d, idx) => (
                                                        <tr key={idx} style={{ borderBottom: idx < registro.detallesGrado.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                                            <td style={{ padding: "0.4rem", fontWeight: 700 }}>{d.grado}°</td>
                                                            <td style={{ padding: "0.4rem" }}>{d.hombres}</td>
                                                            <td style={{ padding: "0.4rem" }}>{d.mujeres}</td>
                                                            <td style={{ padding: "0.4rem", fontWeight: 700, color: "#059669" }}>{d.total}</td>
                                                            <td style={{ padding: "0.4rem" }}>{d.grupos}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Reporte de Inconsistencias Aritméticas si existen */}
                                {registro.inconsistencias && registro.inconsistencias.length > 0 ? (
                                    <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", padding: "0.875rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#b45309", fontWeight: 700, fontSize: "0.825rem", marginBottom: "0.5rem" }}>
                                            <AlertTriangle size={16} /> Inconsistencias Detectadas ({registro.inconsistencias.length})
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.75rem", color: "#92400e", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                            {registro.inconsistencias.map((inc, i) => (
                                                <li key={i}>{inc.mensaje}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#166534", fontSize: "0.8rem" }}>
                                        <CheckCircle2 size={16} />
                                        <span>Cuadre aritmético al 100%: Suma de géneros, edades y totales verificada.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                                <FileSpreadsheet size={36} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
                                <p>Aún no se ha cargado el formato 911.8 para este periodo.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
