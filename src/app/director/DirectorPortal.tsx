"use client";

import { signOut } from "next-auth/react";
import {
    Upload,
    CheckCircle2,
    Clock,
    XCircle,
    AlertTriangle,
    Eye,
    LogOut,
    FileText,
    Download,
    School,
    BookOpen,
    Trash2,
    ChevronDown,
    ChevronUp,
    MessageSquare,
} from "lucide-react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Archivo {
    id: string;
    nombre: string;
    driveId: string | null;
    driveUrl: string | null;
    etiqueta: string | null;
    tipo: string;
    subidoPor: string;
    createdAt: string;
}

interface Correccion {
    id: string;
    texto: string | null;
    archivo: Archivo | null;
    admin: { nombre: string };
    createdAt: string;
}

interface PeriodoEntrega {
    id: string;
    mes: number | null;
    semestre: number | null;
    fechaLimite?: string | null;
    programa: { id: string; nombre: string; numArchivos: number; tipo: string };
}

interface Entrega {
    id: string;
    estado: string;
    fechaSubida: string | null;
    observacionesATP: string | null;
    periodoEntrega: PeriodoEntrega;
    archivos: Archivo[];
    correcciones: Correccion[];
}

interface ProgramaGroup {
    programa: { id: string; nombre: string; numArchivos: number; tipo: string };
    entregas: Entrega[];
}

interface Recurso {
    id: string;
    titulo: string;
    descripcion: string | null;
    archivoNombre: string;
    archivoDriveUrl: string | null;
    programa: { nombre: string } | null;
}

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ESTADO_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDIENTE: { color: "var(--warning)", icon: <Clock size={14} />, label: "Pendiente" },
    EN_REVISION: { color: "var(--primary)", icon: <Eye size={14} />, label: "En Revisión" },
    REQUIERE_CORRECCION: { color: "#e67e22", icon: <AlertTriangle size={14} />, label: "Requiere Corrección" },
    APROBADO: { color: "var(--success)", icon: <CheckCircle2 size={14} />, label: "Aprobado" },
    NO_APROBADO: { color: "var(--danger)", icon: <XCircle size={14} />, label: "No Aprobado" },
    NO_ENTREGADO: { color: "var(--text-muted)", icon: <XCircle size={14} />, label: "No Entregado" },
};

function getPeriodoLabel(ent: Entrega): string {
    const periodo = ent.periodoEntrega;
    if (periodo.mes) return MESES[periodo.mes];
    if (periodo.semestre) return `Semestre ${periodo.semestre}`;
    return "Ciclo completo";
}

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
    recursos: Recurso[];
}) {
    const [tab, setTab] = useState<"entregas" | "recursos">("entregas");
    const [uploading, setUploading] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [expandedProg, setExpandedProg] = useState<string | null>(programas[0]?.programa.id ?? null);
    const [expandedCorrecciones, setExpandedCorrecciones] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedEntrega, setSelectedEntrega] = useState<string | null>(null);
    const [selectedEtiqueta, setSelectedEtiqueta] = useState<string | null>(null);
    const router = useRouter();

    // Stats
    const allEntregas = programas.flatMap((p) => p.entregas);
    const aprobadas = allEntregas.filter((e) => e.estado === "APROBADO").length;
    const porcentaje = allEntregas.length > 0 ? Math.round((aprobadas / allEntregas.length) * 100) : 0;

    async function handleUpload(entregaId: string, etiqueta?: string) {
        setSelectedEntrega(entregaId);
        setSelectedEtiqueta(etiqueta || null);
        fileInputRef.current?.click();
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedEntrega) return;

        setUploading(selectedEntrega + (selectedEtiqueta || ""));
        setMessage(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("entregaId", selectedEntrega);
        if (selectedEtiqueta) {
            formData.append("etiqueta", selectedEtiqueta);
        }

        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (res.ok) {
                setMessage({ type: "success", text: `✅ "${file.name}" subido correctamente` });
                router.refresh();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error al subir archivo" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión. Intenta de nuevo." });
        } finally {
            setUploading(null);
            setSelectedEntrega(null);
            setSelectedEtiqueta(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleDeleteFile(archivoId: string) {
        if (!confirm("¿Estás seguro de eliminar este archivo?")) return;
        setDeleting(archivoId);

        try {
            const res = await fetch(`/api/archivos/${archivoId}`, { method: "DELETE" });
            if (res.ok) {
                setMessage({ type: "success", text: "Archivo eliminado" });
                router.refresh();
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Error al eliminar" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setDeleting(null);
        }
    }

    const canUpload = (estado: string) => estado !== "APROBADO";

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
                    <button className={`btn ${tab === "recursos" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("recursos")} style={{ flex: 1 }}>
                        <BookOpen size={18} />
                        Recursos
                    </button>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    accept="*/*"
                    onChange={handleFileSelected}
                />

                {/* Entregas Tab */}
                {tab === "entregas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {programas.map((group) => {
                            const isExpanded = expandedProg === group.programa.id;
                            const aprobProg = group.entregas.filter((e) => e.estado === "APROBADO").length;
                            const totalProg = group.entregas.length;

                            return (
                                <div key={group.programa.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                                    {/* Programa header */}
                                    <button
                                        onClick={() => setExpandedProg(isExpanded ? null : group.programa.id)}
                                        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem", textAlign: "left" }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{group.programa.nombre}</div>
                                                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                                                    {aprobProg}/{totalProg} aprobadas •{" "}
                                                    {group.programa.tipo === "MENSUAL" ? "Mensual" : group.programa.tipo === "SEMESTRAL" ? "Semestral" : "Anual"}
                                                    {group.programa.numArchivos > 1 && ` • ${group.programa.numArchivos} archivos`}
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </button>

                                    {/* Entregas list per period */}
                                    {isExpanded && (
                                        <div style={{ borderTop: "1px solid var(--border)" }}>
                                            {group.entregas.map((ent) => {
                                                const estadoConf = ESTADO_CONFIG[ent.estado] || ESTADO_CONFIG.PENDIENTE;
                                                const entregaArchivos = ent.archivos.filter((a) => a.tipo === "ENTREGA");
                                                const hasCorrecciones = ent.correcciones.length > 0;
                                                const showCorrecciones = expandedCorrecciones === ent.id;

                                                return (
                                                    <div key={ent.id} style={{ padding: "1rem", borderBottom: "1px solid var(--border)" }}>
                                                        {/* Period label + status */}
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                                <span style={{ fontWeight: 600 }}>{getPeriodoLabel(ent)}</span>
                                                                {ent.periodoEntrega.fechaLimite && (
                                                                    <span style={{ fontSize: "0.75rem", color: "var(--danger)", padding: "0.1rem 0.4rem", background: "var(--danger-light, #fee2e2)", borderRadius: "12px", fontWeight: 500 }}>
                                                                        Vence: {new Date(ent.periodoEntrega.fechaLimite).toLocaleDateString("es-MX", { day: '2-digit', month: 'long', year: 'numeric' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span
                                                                style={{
                                                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                                                    padding: "0.25rem 0.5rem", borderRadius: "6px",
                                                                    fontSize: "0.75rem", fontWeight: 600,
                                                                    background: `${estadoConf.color}20`, color: estadoConf.color,
                                                                }}
                                                            >
                                                                {estadoConf.icon}
                                                                {estadoConf.label}
                                                            </span>
                                                        </div>

                                                        {/* Uploaded files */}
                                                        {entregaArchivos.length > 0 && (
                                                            <div style={{ marginBottom: "0.5rem" }}>
                                                                {entregaArchivos.map((arch) => (
                                                                    <div key={arch.id} style={{
                                                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                                                        padding: "0.375rem 0.5rem", background: "var(--bg-secondary)",
                                                                        borderRadius: "6px", marginBottom: "0.25rem", fontSize: "0.8125rem",
                                                                    }}>
                                                                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", minWidth: 0 }}>
                                                                            <FileText size={14} style={{ flexShrink: 0 }} />
                                                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                                {arch.etiqueta && <strong>{arch.etiqueta}: </strong>}
                                                                                {arch.nombre}
                                                                            </span>
                                                                            {arch.createdAt && (
                                                                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "auto", flexShrink: 0, paddingRight: "0.5rem" }}>
                                                                                    {new Date(arch.createdAt).toLocaleDateString("es-MX", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {canUpload(ent.estado) && (
                                                                            <button
                                                                                onClick={() => handleDeleteFile(arch.id)}
                                                                                disabled={deleting === arch.id}
                                                                                style={{
                                                                                    background: "none", border: "none", cursor: "pointer",
                                                                                    color: "var(--danger)", padding: "0.25rem", flexShrink: 0,
                                                                                }}
                                                                                title="Eliminar archivo"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* ATP observations */}
                                                        {ent.observacionesATP && (
                                                            <div style={{
                                                                padding: "0.5rem", background: "#fff3cd", borderRadius: "6px",
                                                                fontSize: "0.8125rem", marginBottom: "0.5rem", color: "#856404",
                                                            }}>
                                                                <strong>Observaciones ATP:</strong> {ent.observacionesATP}
                                                            </div>
                                                        )}

                                                        {/* Corrections toggle */}
                                                        {hasCorrecciones && (
                                                            <div style={{ marginBottom: "0.5rem" }}>
                                                                <button
                                                                    onClick={() => setExpandedCorrecciones(showCorrecciones ? null : ent.id)}
                                                                    style={{
                                                                        background: "#e67e2220", border: "1px solid #e67e22",
                                                                        borderRadius: "6px", padding: "0.375rem 0.75rem",
                                                                        cursor: "pointer", fontSize: "0.8125rem", color: "#e67e22",
                                                                        fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem",
                                                                        width: "100%",
                                                                    }}
                                                                >
                                                                    <MessageSquare size={14} />
                                                                    {ent.correcciones.length} corrección(es) del ATP
                                                                    {showCorrecciones ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                </button>

                                                                {showCorrecciones && (
                                                                    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                                                        {ent.correcciones.map((corr) => (
                                                                            <div key={corr.id} style={{
                                                                                padding: "0.5rem", background: "#fef2e6", borderRadius: "6px",
                                                                                borderLeft: "3px solid #e67e22", fontSize: "0.8125rem",
                                                                            }}>
                                                                                <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#e67e22" }}>
                                                                                    {corr.admin.nombre} — {new Date(corr.createdAt).toLocaleDateString("es-MX")}
                                                                                </div>
                                                                                {corr.archivo && (
                                                                                    <a
                                                                                        href={corr.archivo.driveUrl || "#"}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--primary)", textDecoration: "none", fontWeight: 600, marginTop: "0.25rem" }}
                                                                                    >
                                                                                        <Download size={12} />
                                                                                        <span>Descargar archivo: {corr.archivo.nombre}</span>
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Upload buttons */}
                                                        {canUpload(ent.estado) && (
                                                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                                {group.programa.numArchivos === 2 ? (
                                                                    // Día Naranja: 2 upload buttons
                                                                    <>
                                                                        {!entregaArchivos.some((a) => a.etiqueta === "Registro") && (
                                                                            <button
                                                                                className="btn btn-success"
                                                                                onClick={() => handleUpload(ent.id, "Registro")}
                                                                                disabled={uploading === ent.id + "Registro"}
                                                                                style={{ flex: 1, fontSize: "0.8125rem" }}
                                                                            >
                                                                                {uploading === ent.id + "Registro" ? "Subiendo..." : (
                                                                                    <><Upload size={16} /> Registro</>
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                        {!entregaArchivos.some((a) => a.etiqueta === "Evidencias") && (
                                                                            <button
                                                                                className="btn btn-success"
                                                                                onClick={() => handleUpload(ent.id, "Evidencias")}
                                                                                disabled={uploading === ent.id + "Evidencias"}
                                                                                style={{ flex: 1, fontSize: "0.8125rem" }}
                                                                            >
                                                                                {uploading === ent.id + "Evidencias" ? "Subiendo..." : (
                                                                                    <><Upload size={16} /> Evidencias</>
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    // Regular: 1 upload button (only if no files)
                                                                    entregaArchivos.length === 0 && (
                                                                        <button
                                                                            className="btn btn-success btn-block"
                                                                            onClick={() => handleUpload(ent.id)}
                                                                            disabled={uploading === ent.id}
                                                                        >
                                                                            {uploading === ent.id ? "Subiendo..." : (
                                                                                <><Upload size={18} /> Subir Archivo</>
                                                                            )}
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Approved message */}
                                                        {ent.estado === "APROBADO" && (
                                                            <div style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--success)", fontWeight: 600 }}>
                                                                ✅ Entrega aprobada
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Recursos Tab */}
                {tab === "recursos" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {recursos.length === 0 ? (
                            <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                                <BookOpen size={48} style={{ margin: "0 auto 0.75rem", opacity: 0.3 }} />
                                <p>Aún no hay recursos disponibles</p>
                                <p style={{ fontSize: "0.8125rem" }}>Cuando la supervisión suba manuales o lineamientos, aparecerán aquí.</p>
                            </div>
                        ) : (
                            recursos.map((rec) => (
                                <div key={rec.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{rec.titulo}</div>
                                        {rec.descripcion && <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", wordBreak: "break-word" }}>{rec.descripcion}</div>}
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem" }}>
                                            <FileText size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.archivoNombre}</span>
                                            {rec.programa && <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}> • {rec.programa.nombre}</span>}
                                        </div>
                                    </div>
                                    {rec.archivoDriveUrl && (
                                        <a href={rec.archivoDriveUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: "0.5rem 1rem", minHeight: "auto", flexShrink: 0 }}>
                                            <Download size={18} />
                                            Descargar
                                        </a>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
