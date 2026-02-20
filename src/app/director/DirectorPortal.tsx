"use client";

import { signOut } from "next-auth/react";
import {
    Upload,
    CheckCircle2,
    Clock,
    XCircle,
    LogOut,
    FileText,
    Download,
    School,
    BookOpen,
} from "lucide-react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Entrega {
    id: string;
    estatus: string;
    archivoNombre: string | null;
    fechaSubida: string | null;
    programa: { id: string; nombre: string };
}

interface Escuela {
    id: string;
    cct: string;
    nombre: string;
    localidad: string;
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

export default function DirectorPortal({
    escuela,
    recursos,
}: {
    escuela: Escuela;
    recursos: Recurso[];
}) {
    const [tab, setTab] = useState<"entregas" | "recursos">("entregas");
    const [uploading, setUploading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedEntrega, setSelectedEntrega] = useState<string | null>(null);
    const router = useRouter();

    const completadas = escuela.entregas.filter((e) => e.estatus === "COMPLETO").length;
    const total = escuela.entregas.length;
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

    async function handleUpload(entregaId: string) {
        setSelectedEntrega(entregaId);
        fileInputRef.current?.click();
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedEntrega) return;

        setUploading(selectedEntrega);
        setMessage(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("entregaId", selectedEntrega);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

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
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    return (
        <>
            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-brand">
                    <School size={24} />
                    <span style={{ fontSize: "0.9375rem" }}>Centro de Mando</span>
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
                {/* Header with school info */}
                <div className="card" style={{ marginBottom: "1.5rem", background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", color: "white", border: "none" }}>
                    <h2 style={{ marginBottom: "0.25rem" }}>{escuela.nombre}</h2>
                    <p style={{ opacity: 0.85, fontSize: "0.875rem", margin: 0 }}>
                        {escuela.cct} • {escuela.localidad}
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
                        {completadas} de {total} programas entregados
                    </p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1rem" }}>
                        {message.text}
                    </div>
                )}

                {/* Tab Toggle */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                    <button
                        className={`btn ${tab === "entregas" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setTab("entregas")}
                        style={{ flex: 1 }}
                    >
                        <Upload size={18} />
                        Mis Entregas
                    </button>
                    <button
                        className={`btn ${tab === "recursos" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => setTab("recursos")}
                        style={{ flex: 1 }}
                    >
                        <BookOpen size={18} />
                        Recursos
                    </button>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.jpg,.jpeg,.png"
                    onChange={handleFileSelected}
                />

                {/* Entregas Tab */}
                {tab === "entregas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {escuela.entregas.map((ent) => (
                            <div key={ent.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{ent.programa.nombre}</div>
                                        {ent.archivoNombre && (
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem" }}>
                                                <FileText size={12} />
                                                {ent.archivoNombre}
                                            </div>
                                        )}
                                    </div>
                                    <span className={`badge badge-${ent.estatus.toLowerCase().replace(/_/g, "-")}`}>
                                        {ent.estatus === "COMPLETO" && <CheckCircle2 size={14} />}
                                        {ent.estatus === "PENDIENTE" && <Clock size={14} />}
                                        {ent.estatus === "NO_ENTREGADO" && <XCircle size={14} />}
                                        {ent.estatus.replace("_", " ")}
                                    </span>
                                </div>

                                {ent.estatus !== "COMPLETO" && (
                                    <button
                                        className="btn btn-success btn-block"
                                        onClick={() => handleUpload(ent.id)}
                                        disabled={uploading === ent.id}
                                    >
                                        {uploading === ent.id ? (
                                            <span className="loading">Subiendo...</span>
                                        ) : (
                                            <>
                                                <Upload size={20} />
                                                Subir Archivo
                                            </>
                                        )}
                                    </button>
                                )}

                                {ent.estatus === "COMPLETO" && (
                                    <div style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--success)", fontWeight: 600 }}>
                                        ✅ Entregado correctamente
                                    </div>
                                )}
                            </div>
                        ))}
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
                                <div key={rec.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{rec.titulo}</div>
                                        {rec.descripcion && (
                                            <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{rec.descripcion}</div>
                                        )}
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.25rem" }}>
                                            <FileText size={12} />
                                            {rec.archivoNombre}
                                            {rec.programa && <span> • {rec.programa.nombre}</span>}
                                        </div>
                                    </div>
                                    {rec.archivoDriveUrl && (
                                        <a
                                            href={rec.archivoDriveUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn btn-primary"
                                            style={{ padding: "0.5rem 1rem", minHeight: "auto", flexShrink: 0 }}
                                        >
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
