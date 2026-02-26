"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    Upload,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Eye,
    FileText,
    Download,
    Trash2,
    ChevronDown,
    ChevronUp,
    MessageSquare,
} from "lucide-react";
import { ProgramaGroup, EntregaDirector } from "@/types/director";
import { getDownloadUrl } from "@/lib/download-url";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ESTADO_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDIENTE: { color: "var(--success)", icon: <CheckCircle2 size={14} />, label: "Entregado" },
    EN_REVISION: { color: "var(--primary)", icon: <Eye size={14} />, label: "En Revisión" },
    REQUIERE_CORRECCION: { color: "#e67e22", icon: <AlertTriangle size={14} />, label: "Requiere Corrección" },
    APROBADO: { color: "var(--success)", icon: <CheckCircle2 size={14} />, label: "Aprobado" },
    NO_APROBADO: { color: "var(--danger)", icon: <XCircle size={14} />, label: "No Aprobado" },
    NO_ENTREGADO: { color: "var(--text-muted)", icon: <XCircle size={14} />, label: "No Entregado" },
};

function getPeriodoLabel(ent: EntregaDirector): string {
    const periodo = ent.periodoEntrega;
    if (periodo.mes) return MESES[periodo.mes];
    if (periodo.semestre) return `Semestre ${periodo.semestre}`;
    return "Ciclo completo";
}

export default function EntregasListado({
    programas,
    onSetMessage,
}: {
    programas: ProgramaGroup[];
    onSetMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
    const [uploading, setUploading] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [expandedProg, setExpandedProg] = useState<string | null>(programas[0]?.programa.id ?? null);
    const [expandedCorrecciones, setExpandedCorrecciones] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedEntrega, setSelectedEntrega] = useState<string | null>(null);
    const [selectedEtiqueta, setSelectedEtiqueta] = useState<string | null>(null);
    const router = useRouter();

    async function handleUpload(entregaId: string, etiqueta?: string) {
        setSelectedEntrega(entregaId);
        setSelectedEtiqueta(etiqueta || null);
        fileInputRef.current?.click();
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedEntrega) return;

        setUploading(selectedEntrega + (selectedEtiqueta || ""));
        onSetMessage(null);

        try {
            // 1. Obtener firma
            const signRes = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entregaId: selectedEntrega,
                    originalFilename: file.name,
                    etiqueta: selectedEtiqueta
                })
            });

            if (!signRes.ok) {
                const err = await signRes.json();
                throw new Error(err.error || "No se pudo iniciar la subida");
            }

            const { signature, timestamp, folder, publicId, apiKey, cloudName } = await signRes.json();

            // 2. Subir
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", apiKey);
            formData.append("timestamp", timestamp.toString());
            formData.append("signature", signature);
            formData.append("folder", folder);
            if (publicId) formData.append("public_id", publicId);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: "POST",
                body: formData
            });

            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                throw new Error(errData.error?.message || "Error al subir a la nube");
            }

            const uploadData = await uploadRes.json();

            // 3. Confirmar
            const confirmRes = await fetch("/api/upload/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entregaId: selectedEntrega,
                    etiqueta: selectedEtiqueta,
                    fileData: {
                        name: file.name,
                        type: file.type,
                        url: uploadData.secure_url,
                        publicId: uploadData.public_id
                    }
                })
            });

            if (confirmRes.ok) {
                onSetMessage({ type: "success", text: `✅ "${file.name}" subido correctamente` });
                router.refresh();
            } else {
                const data = await confirmRes.json();
                onSetMessage({ type: "error", text: data.error || "Error al guardar el archivo" });
            }
        } catch (error: any) {
            onSetMessage({ type: "error", text: error.message || "Error de conexión. Intenta de nuevo." });
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
                onSetMessage({ type: "success", text: "Archivo eliminado" });
                router.refresh();
            } else {
                const data = await res.json();
                onSetMessage({ type: "error", text: data.error || "Error al eliminar" });
            }
        } catch {
            onSetMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setDeleting(null);
        }
    }

    const canUpload = (estado: string) => estado !== "APROBADO";

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept="*/*"
                onChange={handleFileSelected}
            />

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
                                                                                href={getDownloadUrl(corr.archivo.driveUrl, corr.archivo.nombre, corr.archivo.driveId) || "#"}
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
                                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%" }}>
                                                        {Array.from({ length: group.programa.numArchivos }).map((_, i) => {
                                                            // Mantenemos retrocompatibilidad con Día Naranja si son 2 archivos
                                                            const isDianaranja = group.programa.nombre === "Día Naranja" && group.programa.numArchivos === 2;
                                                            let defaultLabel = `Archivo ${i + 1}`;
                                                            if (isDianaranja) defaultLabel = i === 0 ? "Registro" : "Evidencias";

                                                            // Si solo es 1 archivo general, lo usualmente no usa etiqueta en la UI original
                                                            if (group.programa.numArchivos === 1) defaultLabel = "";

                                                            const hasFileAlready = defaultLabel !== "" ? entregaArchivos.some(a => a.etiqueta === defaultLabel) : entregaArchivos.length > 0;

                                                            if (hasFileAlready) return null;

                                                            return (
                                                                <button
                                                                    key={i}
                                                                    className="btn btn-success"
                                                                    onClick={() => handleUpload(ent.id, defaultLabel !== "" ? defaultLabel : undefined)}
                                                                    disabled={uploading === ent.id + defaultLabel}
                                                                    style={{ flex: 1, fontSize: "0.8125rem", minWidth: "120px" }}
                                                                >
                                                                    {uploading === ent.id + defaultLabel ? "Subiendo..." : (
                                                                        <><Upload size={16} /> Subir {defaultLabel || "Archivo"}</>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
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
        </>
    );
}
