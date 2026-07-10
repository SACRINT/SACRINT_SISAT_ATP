"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Trash2,
    Upload,
    FileText,
    ChevronDown,
    ChevronUp,
    Lock,
    Loader2,
    Download,
    Eye,
    X,
} from "lucide-react";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";
import { getDownloadUrl } from "@/lib/download-url";

interface Ficha {
    id: string;
    nombre: string;
}

interface Capem {
    id: string;
    nombre: string;
    orden: number;
    activo: boolean;
}

interface Registro {
    id: string;
    capemId: string;
    fichaId: string;
    archivoNombre: string | null;
    archivoDriveId: string | null;
    archivoDriveUrl: string | null;
    bloqueado: boolean;
    validoIA?: string | null;
    observacionesIA?: string | null;
    ficha: { id: string; nombre: string };
    capem: { id: string; nombre: string };
}

// Slot en memoria para UI (antes de guardar)
interface SlotState {
    localId: string; // para key de react
    registroId: string | null; // id del registro si ya existe en DB
    fichaId: string;
    uploading: boolean;
    archivoNombre: string | null;
    archivoDriveUrl: string | null;
    archivoDriveId: string | null;
    bloqueado: boolean;
    validoIA?: string | null;
    observacionesIA?: string | null;
}


function renderIABadge(validoIA: string | null | undefined, observacionesIA: string | null | undefined) {
    if (!validoIA) return null;

    let bg = "#f1f5f9";
    let color = "#475569";
    let text = "Pendiente IA";

    if (validoIA === "PENDIENTE") {
        bg = "#fef3c7";
        color = "#d97706";
        text = "⏳ Validando...";
    } else if (validoIA === "APROBADO") {
        bg = "#dcfce7";
        color = "#15803d";
        text = "✓ Validado por IA";
    } else if (validoIA === "ADVERTENCIA") {
        bg = "#fffbeb";
        color = "#b45309";
        text = "⚠️ Advertencia IA";
    } else if (validoIA === "RECHAZADO") {
        bg = "#fee2e2";
        color = "#b91c1c";
        text = "❌ Rechazado por IA";
    }

    return (
        <span
            style={{
                fontSize: "0.68rem",
                padding: "0.15rem 0.4rem",
                borderRadius: "4px",
                background: bg,
                color: color,
                fontWeight: 600,
                cursor: observacionesIA ? "help" : "default",
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0
            }}
            title={observacionesIA || undefined}
        >
            {text}
        </span>
    );
}

export default function CapemsPanel({ escuela }: { escuela: { id: string; cct: string; nombre: string } }) {
    const [fichas, setFichas] = useState<Ficha[]>([]);
    const [capems, setCapems] = useState<Capem[]>([]);
    const [registros, setRegistros] = useState<Registro[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [expandedCapem, setExpandedCapem] = useState<string | null>(null);

    // Slots por capem: { [capemId]: SlotState[] }
    const [slots, setSlots] = useState<Record<string, SlotState[]>>({});
    const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; downloadUrl?: string; fileName?: string } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [fichasRes, capemsRes, regsRes] = await Promise.all([
                fetch("/api/admin/fichas"),
                fetch("/api/admin/capems"),
                fetch("/api/capems/registros"),
            ]);
            const fichasData: Ficha[] = fichasRes.ok ? await fichasRes.json() : [];
            const capemsData: Capem[] = capemsRes.ok ? await capemsRes.json() : [];
            const regsData: Registro[] = regsRes.ok ? await regsRes.json() : [];

            setFichas(fichasData);
            setCapems(capemsData.filter(c => c.activo));
            setRegistros(regsData);

            // Inicializar slots a partir de los registros existentes
            const initialSlots: Record<string, SlotState[]> = {};
            capemsData.filter(c => c.activo).forEach(capem => {
                const capemRegs = regsData.filter(r => r.capemId === capem.id);
                const existingSlots: SlotState[] = capemRegs.map(r => ({
                    localId: r.id,
                    registroId: r.id,
                    fichaId: r.fichaId,
                    uploading: false,
                    archivoNombre: r.archivoNombre,
                    archivoDriveUrl: r.archivoDriveUrl,
                    archivoDriveId: r.archivoDriveId,
                    bloqueado: r.bloqueado,
                    validoIA: r.validoIA,
                    observacionesIA: r.observacionesIA,
                }));
                // Si no hay slots, empezar con uno vacío
                if (existingSlots.length === 0) {
                    existingSlots.push({
                        localId: `new-${capem.id}-${Date.now()}`,
                        registroId: null,
                        fichaId: "",
                        uploading: false,
                        archivoNombre: null,
                        archivoDriveUrl: null,
                        archivoDriveId: null,
                        bloqueado: false,
                        validoIA: null,
                        observacionesIA: null,
                    });
                }
                initialSlots[capem.id] = existingSlots;
            });
            setSlots(initialSlots);
        } catch {
            setMessage({ type: "error", text: "Error cargando datos de CAPEMS" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Fichas ya seleccionadas en un capem
    function getUsedFichaIds(capemId: string): Set<string> {
        const capemSlots = slots[capemId] || [];
        return new Set(capemSlots.map(s => s.fichaId).filter(Boolean));
    }

    // Agregar un slot nuevo
    function handleAddSlot(capemId: string) {
        setSlots(prev => ({
            ...prev,
            [capemId]: [
                ...(prev[capemId] || []),
                {
                    localId: `new-${capemId}-${Date.now()}`,
                    registroId: null,
                    fichaId: "",
                    uploading: false,
                    archivoNombre: null,
                    archivoDriveUrl: null,
                    archivoDriveId: null,
                    bloqueado: false,
                },
            ],
        }));
    }

    // Cambiar la ficha seleccionada en un slot
    function handleFichaChange(capemId: string, localId: string, fichaId: string) {
        setSlots(prev => ({
            ...prev,
            [capemId]: (prev[capemId] || []).map(s =>
                s.localId === localId ? { ...s, fichaId } : s
            ),
        }));
    }

    // Subir archivo para un slot
    async function handleUploadFile(capemId: string, localId: string, file: File) {
        const slot = (slots[capemId] || []).find(s => s.localId === localId);
        if (!slot || !slot.fichaId) {
            setMessage({ type: "error", text: "Selecciona una ficha primero" });
            return;
        }

        // Mark as uploading
        setSlots(prev => ({
            ...prev,
            [capemId]: (prev[capemId] || []).map(s =>
                s.localId === localId ? { ...s, uploading: true } : s
            ),
        }));

        try {
            // 1. Get Cloudinary signature
            const signRes = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    programa: "CAPEMS",
                    cct: escuela.cct,
                    escuelaNombre: escuela.nombre,
                    subfolder: capems.find(c => c.id === capemId)?.nombre?.replace(/\s+/g, "_") || "CAPEM",
                    originalFilename: file.name,
                }),
            });

            if (!signRes.ok) throw new Error("Error obteniendo firma");
            const { signature, timestamp, folder, apiKey, cloudName, publicId } = await signRes.json();

            // 2. Upload to Cloudinary
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", apiKey);
            formData.append("timestamp", timestamp.toString());
            formData.append("signature", signature);
            formData.append("folder", folder);
            if (publicId) formData.append("public_id", publicId);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) throw new Error("Error subiendo archivo");
            const uploadData = await uploadRes.json();

            const fileData = {
                name: file.name,
                url: uploadData.secure_url,
                publicId: uploadData.public_id,
            };

            // 3. Create or update registro in DB
            if (slot.registroId) {
                // Update existing
                const res = await fetch(`/api/capems/registros/${slot.registroId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileData }),
                });
                if (!res.ok) throw new Error("Error guardando registro");
            } else {
                // Create new
                const res = await fetch("/api/capems/registros", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        capemId,
                        fichaId: slot.fichaId,
                        fileData,
                    }),
                });
                if (!res.ok) throw new Error("Error creando registro");
                const newReg = await res.json();
                // Update slot with the new registroId
                setSlots(prev => ({
                    ...prev,
                    [capemId]: (prev[capemId] || []).map(s =>
                        s.localId === localId
                            ? { ...s, registroId: newReg.id, archivoNombre: file.name, archivoDriveUrl: uploadData.secure_url, archivoDriveId: uploadData.public_id, uploading: false, validoIA: "PENDIENTE", observacionesIA: null }
                            : s
                    ),
                }));
                setMessage({ type: "success", text: `Ficha subida correctamente para ${capems.find(c => c.id === capemId)?.nombre}` });
                return;
            }

            // Update slot locally
            setSlots(prev => ({
                ...prev,
                [capemId]: (prev[capemId] || []).map(s =>
                    s.localId === localId
                        ? { ...s, archivoNombre: file.name, archivoDriveUrl: uploadData.secure_url, archivoDriveId: uploadData.public_id, uploading: false, validoIA: "PENDIENTE", observacionesIA: null }
                        : s
                ),
            }));
            setMessage({ type: "success", text: "Archivo actualizado correctamente" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error al subir archivo" });
            setSlots(prev => ({
                ...prev,
                [capemId]: (prev[capemId] || []).map(s =>
                    s.localId === localId ? { ...s, uploading: false } : s
                ),
            }));
        }
    }

    // Eliminar registro
    async function handleDeleteRegistro(capemId: string, localId: string) {
        const slot = (slots[capemId] || []).find(s => s.localId === localId);
        if (!slot) return;

        if (slot.registroId) {
            if (!confirm("¿Eliminar este registro y su archivo?")) return;
            try {
                const res = await fetch(`/api/capems/registros/${slot.registroId}`, { method: "DELETE" });
                if (!res.ok) {
                    const d = await res.json();
                    setMessage({ type: "error", text: d.error || "Error al eliminar" });
                    return;
                }
                setMessage({ type: "success", text: "Registro eliminado" });
            } catch {
                setMessage({ type: "error", text: "Error de conexión" });
                return;
            }
        }

        // Remove slot locally
        setSlots(prev => {
            const capemSlots = (prev[capemId] || []).filter(s => s.localId !== localId);
            // Siempre mantener al menos 1 slot
            if (capemSlots.length === 0) {
                capemSlots.push({
                    localId: `new-${capemId}-${Date.now()}`,
                    registroId: null,
                    fichaId: "",
                    uploading: false,
                    archivoNombre: null,
                    archivoDriveUrl: null,
                    archivoDriveId: null,
                    bloqueado: false,
                });
            }
            return { ...prev, [capemId]: capemSlots };
        });
    }

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Loader2 className="spin" size={32} />
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c5a8e" }}>
                    <strong>Fichas CAPEMS</strong> — Selecciona las fichas que trabajarás en cada CAPEM y sube el archivo con las actividades realizadas.
                    Puedes agregar más fichas con el botón <strong>+</strong>.
                </p>
            </div>

            {capems.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    No hay CAPEMS disponibles en este momento.
                </div>
            ) : (
                capems.map(capem => {
                    const isExpanded = expandedCapem === capem.id;
                    const capemSlots = slots[capem.id] || [];
                    const filesCount = capemSlots.filter(s => s.archivoDriveUrl).length;

                    const hasFicha00 = capemSlots.some(s => {
                        const f = fichas.find(ficha => ficha.id === s.fichaId);
                        return f && (f.nombre.includes("00 ") || f.nombre.includes("00 ACTIVIDADES"));
                    });
                    
                    // Si seleccionaron la Ficha 00 y es la ÚNICA ficha en la lista, requiere 1. 
                    // Si hay 2 o más fichas, requiere al menos 2 (o la cantidad de slots que hayan agregado).
                    const requiredFiles = (hasFicha00 && capemSlots.length === 1) ? 1 : Math.max(2, capemSlots.length);
                    const isCompleted = filesCount >= requiredFiles;

                    return (
                        <div key={capem.id} className="card" style={{ padding: 0 }}>
                            {/* Header */}
                            <button
                                onClick={() => setExpandedCapem(isExpanded ? null : capem.id)}
                                style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    width: "100%", padding: "1rem",
                                    background: "none", border: "none", cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FileText size={20} style={{ color: "var(--primary)" }} />
                                    <span style={{ fontWeight: 700, fontSize: "1rem" }}>{capem.nombre}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    {filesCount > 0 && (
                                        <span style={{
                                            background: "var(--primary)", color: "white",
                                            borderRadius: "9999px", padding: "0.125rem 0.625rem",
                                            fontSize: "0.75rem", fontWeight: 700,
                                        }}>
                                            {filesCount} ficha{filesCount !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                            </button>

                            {/* Content */}
                            {isExpanded && (
                                <div style={{ borderTop: "1px solid var(--border)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    
                                    {/* Indicador de progreso */}
                                    <div style={{
                                        display: "flex", alignItems: "center", gap: "0.5rem",
                                        padding: "0.5rem 0.75rem", borderRadius: "6px",
                                        background: isCompleted ? "#e6f4ea" : "#fef7e0",
                                        color: isCompleted ? "#1e8e3e" : "#b06000",
                                        fontSize: "0.875rem", fontWeight: 600, border: `1px solid ${isCompleted ? "#ceead6" : "#fde293"}`
                                    }}>
                                        {isCompleted ? (
                                            <>✅ Has completado los requisitos para este CAPEM.</>
                                        ) : (
                                            <>⚠️ Requiere subir {requiredFiles} ficha{requiredFiles !== 1 ? "s" : ""} para completar este CAPEM ({filesCount}/{requiredFiles}).</>
                                        )}
                                    </div>

                                    {capemSlots.map((slot, idx) => {
                                        const usedFichas = getUsedFichaIds(capem.id);
                                        const availableFichas = fichas.filter(f => f.id === slot.fichaId || !usedFichas.has(f.id));

                                        return (
                                            <div key={slot.localId} style={{
                                                display: "flex", flexDirection: "column", gap: "0.5rem",
                                                padding: "0.75rem", background: "var(--bg-secondary)",
                                                borderRadius: "8px", border: "1px solid var(--border)",
                                            }}>
                                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                                    {/* Ficha selector */}
                                                    <select
                                                        className="form-control"
                                                        value={slot.fichaId}
                                                        onChange={e => handleFichaChange(capem.id, slot.localId, e.target.value)}
                                                        disabled={slot.bloqueado || !!slot.registroId}
                                                        style={{ flex: 1, minWidth: "200px" }}
                                                    >
                                                        <option value="">Seleccionar ficha...</option>
                                                        {availableFichas.map(f => (
                                                            <option key={f.id} value={f.id}>{f.nombre}</option>
                                                        ))}
                                                    </select>

                                                    {/* Upload button */}
                                                    {slot.fichaId && !slot.bloqueado && (
                                                        <label className="btn btn-primary" style={{
                                                            cursor: slot.uploading ? "not-allowed" : "pointer",
                                                            opacity: slot.uploading ? 0.6 : 1,
                                                            minHeight: "auto", padding: "0.5rem 0.75rem",
                                                        }}>
                                                            {slot.uploading ? (
                                                                <><Loader2 size={16} className="spin" /> Subiendo...</>
                                                            ) : (
                                                                <><Upload size={16} /> Subir</>
                                                            )}
                                                            <input
                                                                type="file"
                                                                style={{ display: "none" }}
                                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png"
                                                                disabled={slot.uploading || slot.bloqueado}
                                                                onChange={e => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleUploadFile(capem.id, slot.localId, file);
                                                                    e.target.value = "";
                                                                }}
                                                            />
                                                        </label>
                                                    )}

                                                    {/* Delete button */}
                                                    {!slot.bloqueado && (capemSlots.length > 1 || slot.registroId) && (
                                                        <button
                                                            onClick={() => handleDeleteRegistro(capem.id, slot.localId)}
                                                            style={{
                                                                background: "none", border: "none", cursor: "pointer",
                                                                color: "var(--error)", padding: "0.25rem",
                                                            }}
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}

                                                    {slot.bloqueado && (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--error)", fontSize: "0.75rem", fontWeight: 600 }}>
                                                            <Lock size={14} /> Bloqueado
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Archivo subido */}
                                                {slot.archivoDriveUrl && (
                                                    <div style={{
                                                        display: "flex", alignItems: "center", gap: "0.5rem",
                                                        padding: "0.375rem 0.625rem", background: "white",
                                                        borderRadius: "6px", border: "1px solid var(--border)",
                                                        fontSize: "0.8125rem",
                                                    }}>
                                                        {renderIABadge(slot.validoIA, slot.observacionesIA)}
                                                        <FileText size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                                                        {/* Ver */}
                                                        <button
                                                            onClick={() => setViewingPdf({
                                                                url: slot.archivoDriveUrl!,
                                                                title: `${capem.nombre} — ${slot.archivoNombre || 'Archivo'}`,
                                                                downloadUrl: getDownloadUrl(slot.archivoDriveUrl, slot.archivoNombre || "archivo", slot.archivoDriveId) || undefined,
                                                                fileName: slot.archivoNombre || undefined,
                                                            })}
                                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "2px", flexShrink: 0, display: "inline-flex", alignItems: "center" }}
                                                            title="Ver"
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                        <a
                                                            href={getDownloadUrl(slot.archivoDriveUrl, slot.archivoNombre || "archivo", slot.archivoDriveId) || "#"}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ color: "var(--primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                                        >
                                                            {slot.archivoNombre || "Archivo subido"}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Add slot button */}
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => handleAddSlot(capem.id)}
                                        style={{ alignSelf: "center", padding: "0.375rem 1rem", minHeight: "auto", fontSize: "0.8125rem" }}
                                    >
                                        <Plus size={16} /> Agregar otra ficha
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })
            )}

        {/* Visor de documentos */}
        {viewingPdf && (
            <PdfViewerModal
                isOpen={true}
                onClose={() => setViewingPdf(null)}
                url={viewingPdf.url}
                title={viewingPdf.title}
                downloadUrl={viewingPdf.downloadUrl}
                fileName={viewingPdf.fileName}
            />
        )}
        </div>
    );
}
