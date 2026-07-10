"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    ToggleLeft,
    ToggleRight,
    Lock,
    Unlock,
    Download,
    ChevronDown,
    ChevronUp,
    Search,
    Loader2,
    FileText,
    Users,
    AlertCircle,
    Eye,
    Trash2,
    Upload,
} from "lucide-react";
import { getDownloadUrl, getExpedienteDownloadUrl, buildExpedienteFileName } from "@/lib/download-url";
import {
    DOCUMENTOS_PREDETERMINADOS,
    CARGOS_PERSONAL,
    GRADOS_ACADEMICOS,
    SEXOS,
} from "@/lib/constants";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";

// ─── Types ──────────────────────────────────────────────

interface Documento {
    id: string;
    tipoDocumento: string;
    etiqueta: string | null;
    archivoNombre: string | null;
    archivoDriveId: string | null;
    archivoDriveUrl: string | null;
    bloqueado: boolean;
    noTiene?: boolean;
    validoIA?: string | null;
    observacionesIA?: string | null;
    createdAt: string;
}

interface Personal {
    id: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    cargo: string;
    sexo: string;
    curp: string | null;
    rfc: string | null;
    gradoAcademico: string | null;
    escuelaId: string;
    escuela: { id: string; cct: string; nombre: string };
    documentos: Documento[];
}

interface EscuelaGroup {
    id: string;
    cct: string;
    nombre: string;
    personal: Personal[];
}

// ─── Helpers ────────────────────────────────────────────

const TOTAL_REQUIRED_DOCS = DOCUMENTOS_PREDETERMINADOS.length; // 10

function getCargoLabel(value: string): string {
    return CARGOS_PERSONAL.find(c => c.value === value)?.label || value;
}

function getGradoLabel(value: string): string {
    return GRADOS_ACADEMICOS.find(g => g.value === value)?.label || value;
}

function getSexoLabel(value: string): string {
    return SEXOS.find(s => s.value === value)?.label || value;
}

/** Count how many of the 10 required document types have at least one uploaded file or are marked as not owned */
function countCompleteDocs(documentos: Documento[]): number {
    const uploadedOrNotOwnedTypes = new Set(
        documentos
            .filter(d => d.archivoDriveUrl || d.noTiene)
            .map(d => d.tipoDocumento)
    );
    return DOCUMENTOS_PREDETERMINADOS.filter(dp => uploadedOrNotOwnedTypes.has(dp.tipo)).length;
}

function completenessColor(complete: number, total: number): string {
    if (complete >= total) return "var(--success)";
    if (complete < total / 2) return "var(--error)";
    return "var(--warning, #e67e22)";
}

// ─── Component ──────────────────────────────────────────

export default function GestionExpedientes({ highlightId }: { highlightId?: string }) {
    const [personalList, setPersonalList] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [moduleActive, setModuleActive] = useState(false);
    const [analyzingIA, setAnalyzingIA] = useState<string | null>(null);

    async function handleReEvaluateIA(id: string) {
        setAnalyzingIA(id);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/valida-ia", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, modulo: "EXPEDIENTES" })
            });
            if (!res.ok) throw new Error("Error en el análisis de la IA");
            const data = await res.json();
            if (data.success && data.result) {
                setPersonalList(prev => prev.map(p => {
                    const hasDoc = p.documentos.some(d => d.id === id);
                    if (hasDoc) {
                        return {
                            ...p,
                            documentos: p.documentos.map(d => d.id === id ? { ...d, validoIA: data.result.valido, observacionesIA: data.result.observaciones } : d)
                        };
                    }
                    return p;
                }));
                setMessage({ type: "success", text: "Documento re-evaluado exitosamente por la IA." });
            }
        } catch (err: any) {
            console.error(err);
            setMessage({ type: "error", text: err.message || "Error al re-evaluar con IA" });
        } finally {
            setAnalyzingIA(null);
        }
    }
    const [todasEscuelas, setTodasEscuelas] = useState<{ id: string; cct: string; nombre: string }[]>([]);

    const [expandedEscuela, setExpandedEscuela] = useState<string | null>(null);
    const [expandedPersonal, setExpandedPersonal] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCargo, setFilterCargo] = useState<string>("");

    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [downloadingZip, setDownloadingZip] = useState(false);
    const [viewingPdf, setViewingPdf] = useState<{ url: string; title: string; downloadUrl?: string; fileName?: string } | null>(null);
 
    // ─── Estado para la subida/eliminación administrativa de expedientes ───
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [selectedPersonalId, setSelectedPersonalId] = useState<string | null>(null);
    const [selectedTipoDoc, setSelectedTipoDoc] = useState<string | null>(null);
    const [selectedEtiquetaDoc, setSelectedEtiquetaDoc] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleDeleteDoc(docId: string) {
        if (!confirm("¿Estás seguro de eliminar este documento del expediente?")) return;
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/expedientes/documentos/${docId}`, { method: "DELETE" });
            if (res.ok) {
                setMessage({ type: "success", text: "✅ Documento eliminado correctamente." });
                fetchData();
            } else {
                const errData = await res.json();
                setMessage({ type: "error", text: errData.error || "Error al eliminar." });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión." });
        } finally {
            setBusy(false);
        }
    }

    function handleUploadDocClick(personalId: string, tipoDocumento: string, etiqueta?: string) {
        setSelectedPersonalId(personalId);
        setSelectedTipoDoc(tipoDocumento);
        setSelectedEtiquetaDoc(etiqueta || null);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !selectedPersonalId || !selectedTipoDoc) return;

        const uploadKey = `${selectedPersonalId}-${selectedTipoDoc}`;
        setUploadingDoc(uploadKey);
        setMessage(null);

        try {
            const persona = personalList.find(p => p.id === selectedPersonalId);
            if (!persona) throw new Error("Docente no encontrado");

            const personName = `${persona.apellidoPaterno}_${persona.apellidoMaterno}_${persona.nombre}`;

            // 1. Get Cloudinary signature
            const signRes = await fetch("/api/sign-cloudinary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    programa: "Expedientes",
                    cct: persona.escuela.cct,
                    escuelaNombre: persona.escuela.nombre,
                    subfolder: personName.replace(/\s+/g, "_"),
                    originalFilename: file.name,
                    apellidoPaterno: persona.apellidoPaterno,
                    apellidoMaterno: persona.apellidoMaterno,
                    nombre: persona.nombre,
                    tipoDocumento: selectedTipoDoc,
                    etiqueta: selectedEtiquetaDoc || null,
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

            if (!uploadRes.ok) throw new Error("Error subiendo archivo a Cloudinary");
            const uploadData = await uploadRes.json();

            // 3. Create document record
            const res = await fetch("/api/expedientes/documentos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    personalId: selectedPersonalId,
                    tipoDocumento: selectedTipoDoc,
                    etiqueta: selectedEtiquetaDoc || null,
                    archivoNombre: file.name,
                    archivoDriveId: uploadData.public_id,
                    archivoDriveUrl: uploadData.secure_url,
                }),
            });

            if (!res.ok) throw new Error("Error guardando el documento en base de datos");

            setMessage({ type: "success", text: `✅ "${file.name}" subido al expediente de ${persona.nombre}.` });
            fetchData();
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Error al subir el documento." });
        } finally {
            setUploadingDoc(null);
            setSelectedPersonalId(null);
            setSelectedTipoDoc(null);
            setSelectedEtiquetaDoc(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    // ─── Data Fetching ─────────────────────────────────

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [configRes, personalRes, escuelasRes] = await Promise.all([
                fetch("/api/expedientes/config"),
                fetch("/api/expedientes/personal"),
                fetch("/api/admin/escuelas"),
            ]);
            if (configRes.ok) {
                const configData = await configRes.json();
                setModuleActive(configData.activo ?? false);
            }
            if (personalRes.ok) {
                setPersonalList(await personalRes.json());
            }
            if (escuelasRes.ok) {
                setTodasEscuelas(await escuelasRes.json());
            }
        } catch {
            setMessage({ type: "error", text: "Error cargando datos" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (highlightId && personalList.length > 0) {
            const found = personalList.find(p => p.id === highlightId);
            if (found) {
                // Set local search filter to match teacher's name
                const name = `${found.nombre} ${found.apellidoPaterno}`;
                setSearchTerm(name);
                setExpandedEscuela(found.escuelaId);
                setExpandedPersonal(highlightId);

                setTimeout(() => {
                    const el = document.getElementById(`person-row-${highlightId}`);
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.style.backgroundColor = "var(--primary-bg)";
                        setTimeout(() => {
                            el.style.transition = "background-color 1s ease";
                            el.style.backgroundColor = "";
                        }, 2000);
                    }
                }, 300);
            }
        }
    }, [highlightId, personalList]);

    // ─── Toggle Module ─────────────────────────────────

    async function handleToggleModule() {
        const newValue = !moduleActive;
        setBusy(true);
        try {
            const res = await fetch("/api/expedientes/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activo: newValue }),
            });
            if (res.ok) {
                setModuleActive(newValue);
                setMessage({
                    type: "success",
                    text: newValue
                        ? "Expedientes activado para directores"
                        : "Expedientes desactivado para directores",
                });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    // ─── Toggle Document Lock ──────────────────────────

    async function handleToggleBloqueo(docId: string, bloqueado: boolean) {
        setBusy(true);
        try {
            const res = await fetch(`/api/expedientes/documentos/${docId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bloqueado }),
            });
            if (res.ok) {
                setPersonalList(prev =>
                    prev.map(p => ({
                        ...p,
                        documentos: p.documentos.map(d =>
                            d.id === docId ? { ...d, bloqueado } : d
                        ),
                    }))
                );
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setBusy(false);
        }
    }

    // ─── Descarga masiva ZIP ───────────────────────────

    const [downloadingPersonZip, setDownloadingPersonZip] = useState<string | null>(null);

    async function handleDownloadZip(escuelaId?: string) {
        setDownloadingZip(true);
        try {
            const url = escuelaId
                ? `/api/expedientes/descargar?escuelaId=${escuelaId}`
                : "/api/expedientes/descargar";
            const res = await fetch(url);
            if (!res.ok) {
                const d = await res.json().catch(() => ({ error: "No se encontraron archivos para descargar" }));
                setMessage({ type: "error", text: d.error || "Error al descargar" });
                return;
            }
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const disposition = res.headers.get("content-disposition");
            const nameMatch = disposition?.match(/filename="(.+)"/);
            a.download = nameMatch?.[1] || "Expedientes.zip";
            a.click();
            URL.revokeObjectURL(a.href);
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setDownloadingZip(false);
        }
    }

    async function handleDownloadPersonZip(personalId: string) {
        setDownloadingPersonZip(personalId);
        try {
            const res = await fetch(`/api/expedientes/descargar?personalId=${personalId}`);
            if (!res.ok) {
                const d = await res.json().catch(() => ({ error: "Sin archivos subidos" }));
                setMessage({ type: "error", text: d.error || "Error al descargar" });
                return;
            }
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const disposition = res.headers.get("content-disposition");
            const nameMatch = disposition?.match(/filename="(.+)"/);
            a.download = nameMatch?.[1] || "Expediente.zip";
            a.click();
            URL.revokeObjectURL(a.href);
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setDownloadingPersonZip(null);
        }
    }

    // ─── Group by School ───────────────────────────────

    const escuelasArray = useMemo<EscuelaGroup[]>(() => {
        const map = new Map<string, EscuelaGroup & { tienePersonal: boolean }>();

        // 1. Pre-populate with ALL schools
        todasEscuelas.forEach(e => {
            map.set(e.id, {
                id: e.id,
                cct: e.cct,
                nombre: e.nombre,
                personal: [],
                tienePersonal: false,
            });
        });

        // 2. Add personal to corresponding schools
        personalList.forEach(p => {
            if (!map.has(p.escuelaId)) {
                map.set(p.escuelaId, {
                    id: p.escuelaId,
                    cct: p.escuela.cct,
                    nombre: p.escuela.nombre,
                    personal: [],
                    tienePersonal: true,
                });
            }
            const entry = map.get(p.escuelaId)!;

            if (searchTerm) {
                const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
                const matches = tokens.every(token => {
                    const matchPerson =
                        p.nombre.toLowerCase().includes(token) ||
                        p.apellidoPaterno.toLowerCase().includes(token) ||
                        p.apellidoMaterno.toLowerCase().includes(token) ||
                        (p.curp && p.curp.toLowerCase().includes(token)) ||
                        (p.rfc && p.rfc.toLowerCase().includes(token));

                    const matchSchool =
                        entry.cct.toLowerCase().includes(token) ||
                        entry.nombre.toLowerCase().includes(token);

                    return matchPerson || matchSchool;
                });

                if (matches) {
                    entry.personal.push(p);
                    entry.tienePersonal = true;
                }
            } else {
                entry.personal.push(p);
                entry.tienePersonal = true;
            }
        });

        return Array.from(map.values())
            .filter(e => {
                if (!searchTerm) return true;
                const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
                return (
                    e.personal.length > 0 ||
                    tokens.every(token =>
                        e.cct.toLowerCase().includes(token) ||
                        e.nombre.toLowerCase().includes(token)
                    )
                );
            })
            .sort((a, b) => {
                // Schools with records first, then alphabetical
                const aHas = (a as any).tienePersonal;
                const bHas = (b as any).tienePersonal;
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                return a.nombre.localeCompare(b.nombre);
            });
    }, [personalList, searchTerm, todasEscuelas]);

    // ─── Loading ───────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Loader2 className="spin" size={32} />
            </div>
        );
    }

    // ─── Render ────────────────────────────────────────

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileSelected}
            />
            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Toggle para directores */}
            <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <strong>Módulo Expedientes para Directores</strong>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        {moduleActive
                            ? "Los directores pueden ver y gestionar expedientes de personal"
                            : "Expedientes está oculto para los directores"}
                    </p>
                </div>
                <button
                    onClick={handleToggleModule}
                    disabled={busy}
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: moduleActive ? "var(--success)" : "var(--text-muted)",
                    }}
                    title={moduleActive ? "Desactivar" : "Activar"}
                >
                    {moduleActive ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
            </div>

            {/* ════════ RESUMEN DE ESCUELAS ════════ */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Filtros */}
                <div className="card" style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
                            <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Buscar por CCT o nombre..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: "2.25rem" }}
                            />
                        </div>
                        <select
                            className="form-control"
                            value={filterCargo}
                            onChange={e => setFilterCargo(e.target.value)}
                            style={{ width: "200px" }}
                        >
                            <option value="">Todos los cargos</option>
                            {CARGOS_PERSONAL.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Info summary */}
                <div className="card" style={{ background: "#e8f4fd", border: "1px solid #bee5f7", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c5a8e" }}>
                        <Users size={16} style={{ verticalAlign: "middle", marginRight: "0.375rem" }} />
                        <strong>{escuelasArray.filter(e => (e as any).tienePersonal).length}</strong> de <strong>{escuelasArray.length}</strong> escuelas con personal •{" "}
                        <strong>{personalList.length}</strong> empleados registrados
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleDownloadZip()}
                        disabled={downloadingZip || personalList.length === 0}
                        style={{ minHeight: "auto", padding: "0.375rem 0.75rem", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.375rem" }}
                    >
                        <Download size={14} /> Descargar Todos los Expedientes
                    </button>
                </div>

                {/* School list */}
                {escuelasArray.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                        <AlertCircle size={24} style={{ marginBottom: "0.5rem" }} />
                        <p style={{ margin: 0 }}>No hay registros de personal aún</p>
                    </div>
                ) : (
                    escuelasArray.map(escuela => {
                        const isExpanded = expandedEscuela === escuela.id || (!!searchTerm && escuela.personal.length > 0);
                        const filteredPersonal = filterCargo
                            ? escuela.personal.filter(p => p.cargo === filterCargo)
                            : escuela.personal;
                        const totalPersonnel = escuela.personal.length;
                        const completeCount = escuela.personal.filter(
                            p => countCompleteDocs(p.documentos) >= TOTAL_REQUIRED_DOCS
                        ).length;

                        return (
                            <div key={escuela.id} className="card" style={{ padding: 0, opacity: (escuela as any).tienePersonal ? 1 : 0.65 }}>
                                <div
                                    onClick={() => (escuela as any).tienePersonal && setExpandedEscuela(isExpanded ? null : escuela.id)}
                                    style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        width: "100%", padding: "0.875rem 1rem",
                                        cursor: (escuela as any).tienePersonal ? "pointer" : "default",
                                        fontWeight: 600,
                                        userSelect: "none",
                                    }}
                                >
                                    <div>
                                        <span style={{ color: "var(--text-muted)", marginRight: "0.5rem", fontSize: "0.8125rem" }}>{escuela.cct}</span>
                                        {escuela.nombre}
                                        {(escuela as any).tienePersonal ? (
                                            <span style={{ marginLeft: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                {totalPersonnel} empleado{totalPersonnel !== 1 ? "s" : ""}
                                            </span>
                                        ) : (
                                            <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>Sin personal registrado</span>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }} onClick={e => e.stopPropagation()}>
                                        {/* Completeness chip - only for schools with personnel */}
                                        {(escuela as any).tienePersonal && (
                                            <span style={{
                                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                background: completenessColor(completeCount, totalPersonnel),
                                                color: "white",
                                                borderRadius: "9999px", padding: "0.125rem 0.625rem",
                                                fontSize: "0.6875rem", fontWeight: 700,
                                            }} title={`${completeCount} de ${totalPersonnel} con expediente completo`}>
                                                {completeCount}/{totalPersonnel} completos
                                            </span>
                                        )}
                                        {totalPersonnel > 0 && (
                                            <button
                                                onClick={() => handleDownloadZip(escuela.id)}
                                                disabled={downloadingZip}
                                                className="btn btn-outline"
                                                style={{
                                                    minHeight: "auto",
                                                    padding: "0.25rem 0.5rem",
                                                    fontSize: "0.75rem",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.25rem",
                                                }}
                                                title="Descargar expediente escolar (ZIP)"
                                            >
                                                <Download size={14} /> ZIP
                                            </button>
                                        )}
                                        {(escuela as any).tienePersonal && (
                                            <div 
                                                onClick={() => setExpandedEscuela(isExpanded ? null : escuela.id)}
                                                style={{ cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                                            >
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ borderTop: "1px solid var(--border)" }}>
                                        {filteredPersonal.length === 0 ? (
                                            <p style={{ padding: "1rem", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                                                Sin personal {filterCargo ? "con este cargo" : ""}
                                            </p>
                                        ) : (
                                            <div style={{ overflowX: "auto" }}>
                                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                                    <thead>
                                                        <tr style={{ background: "var(--bg-secondary)" }}>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Nombre</th>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Cargo</th>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Sexo</th>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>CURP</th>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>RFC</th>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Grado</th>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Expediente</th>
                                                            <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredPersonal.map(persona => {
                                                            const isPersonExpanded = expandedPersonal === persona.id;
                                                            const complete = countCompleteDocs(persona.documentos);
                                                            return (
                                                                <PersonRow
                                                                    key={persona.id}
                                                                    id={`person-row-${persona.id}`}
                                                                    persona={persona}
                                                                    complete={complete}
                                                                    isExpanded={isPersonExpanded}
                                                                    onToggleExpand={() => setExpandedPersonal(isPersonExpanded ? null : persona.id)}
                                                                    onToggleBloqueo={handleToggleBloqueo}
                                                                    onDownloadZip={handleDownloadPersonZip}
                                                                    downloadingZip={downloadingPersonZip === persona.id}
                                                                    onViewPdf={(url, title, downloadUrl, fileName) => setViewingPdf({ url, title, downloadUrl, fileName })}
                                                                    busy={busy}
                                                                    onDeleteDoc={handleDeleteDoc}
                                                                    onUploadDocClick={handleUploadDocClick}
                                                                    uploadingDoc={uploadingDoc}
                                                                />
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            <PdfViewerModal
                isOpen={!!viewingPdf}
                onClose={() => setViewingPdf(null)}
                url={viewingPdf?.url || ""}
                title={viewingPdf?.title || ""}
                downloadUrl={viewingPdf?.downloadUrl}
                fileName={viewingPdf?.fileName}
            />
        </div>
    );
}

// ─── Person Row Sub-component ───────────────────────────

function PersonRow({
    persona,
    complete,
    isExpanded,
    onToggleExpand,
    onToggleBloqueo,
    onDownloadZip,
    downloadingZip,
    onViewPdf,
    busy,
    id,
    onDeleteDoc,
    onUploadDocClick,
    uploadingDoc,
}: {
    persona: Personal;
    complete: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onToggleBloqueo: (docId: string, bloqueado: boolean) => Promise<void>;
    onDownloadZip: (personalId: string) => Promise<void>;
    downloadingZip: boolean;
    onViewPdf: (url: string, title: string, downloadUrl?: string, fileName?: string) => void;
    busy: boolean;
    id?: string;
    onDeleteDoc: (docId: string) => Promise<void>;
    onUploadDocClick: (personalId: string, tipoDocumento: string, etiqueta?: string) => void;
    uploadingDoc: string | null;
}) {
    const fullName = `${persona.apellidoPaterno} ${persona.apellidoMaterno} ${persona.nombre}`;
    const docColor = completenessColor(complete, TOTAL_REQUIRED_DOCS);

    // Build a map of uploaded documents by type
    const docsByType = useMemo(() => {
        const map = new Map<string, Documento[]>();
        persona.documentos.forEach(d => {
            if (!map.has(d.tipoDocumento)) map.set(d.tipoDocumento, []);
            map.get(d.tipoDocumento)!.push(d);
        });
        return map;
    }, [persona.documentos]);

    // Custom docs (not in predefined list)
    const predefinedTypes: Set<string> = new Set(DOCUMENTOS_PREDETERMINADOS.map(dp => dp.tipo));
    const customDocs = persona.documentos.filter(d => !predefinedTypes.has(d.tipoDocumento));

    return (
        <>
            <tr id={id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{fullName}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{getCargoLabel(persona.cargo)}</td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{getSexoLabel(persona.sexo)}</td>
                <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {persona.curp || <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {persona.rfc || <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td style={{ padding: "0.5rem 0.75rem" }}>
                    {persona.gradoAcademico ? getGradoLabel(persona.gradoAcademico) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: docColor, color: "white",
                        borderRadius: "9999px", padding: "0.125rem 0.5rem",
                        fontSize: "0.6875rem", fontWeight: 700,
                    }}>
                        {complete}/{TOTAL_REQUIRED_DOCS} documentos
                    </span>
                </td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        {/* Per-person ZIP download */}
                        {persona.documentos.some(d => d.archivoDriveUrl) && (
                            <button
                                onClick={() => onDownloadZip(persona.id)}
                                disabled={downloadingZip || busy}
                                style={{
                                    background: "none", border: "1px solid var(--border)",
                                    borderRadius: "4px", cursor: "pointer",
                                    color: "var(--primary)", padding: "2px 6px",
                                    display: "inline-flex", alignItems: "center", gap: "3px",
                                    fontSize: "0.7rem", fontWeight: 700,
                                }}
                                title={`Descargar expediente de ${fullName} (ZIP)`}
                            >
                                {downloadingZip
                                    ? <Loader2 size={12} className="spin" />
                                    : <Download size={12} />}
                                ZIP
                            </button>
                        )}
                        {/* Expand / collapse */}
                        <button
                            onClick={onToggleExpand}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "2px" }}
                            title={isExpanded ? "Ocultar documentos" : "Ver documentos"}
                        >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>
                </td>
            </tr>

            {/* Expanded sub-row: document details */}
            {isExpanded && (
                <tr>
                    <td colSpan={8} style={{ padding: 0 }}>
                        <div style={{
                            background: "var(--bg-secondary)",
                            padding: "0.75rem 1rem",
                            borderTop: "1px solid var(--border)",
                        }}>
                            <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                <FileText size={14} /> Documentos de {persona.nombre}
                            </p>

                            {/* Required documents grid */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                                gap: "0.5rem",
                                marginBottom: customDocs.length > 0 ? "0.75rem" : 0,
                            }}>
                                {DOCUMENTOS_PREDETERMINADOS.map(dp => {
                                    const docs = docsByType.get(dp.tipo) || [];
                                    const hasFile = docs.some(d => d.archivoDriveUrl);
                                    const noTieneDoc = docs.some(d => d.noTiene);

                                    let statusIcon = "❌";
                                    let statusColor = "var(--error)";
                                    if (hasFile) {
                                        statusIcon = "✅";
                                        statusColor = "var(--success)";
                                    } else if (noTieneDoc) {
                                        statusIcon = "⚠️";
                                        statusColor = "var(--warning, #e67e22)";
                                    }

                                    return (
                                        <div key={dp.tipo} style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "0.375rem 0.625rem",
                                            borderRadius: "6px",
                                            background: "var(--bg-primary, white)",
                                            border: "1px solid var(--border)",
                                            fontSize: "0.8125rem",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                                <span style={{ color: statusColor, fontSize: "0.875rem" }}>
                                                    {statusIcon}
                                                </span>
                                                <span style={{ color: noTieneDoc ? "var(--text-muted)" : "inherit" }}>
                                                    {dp.label} {noTieneDoc && <span style={{ fontStyle: "italic", fontSize: "0.7rem", color: "var(--error)" }}>(No cuenta con él)</span>}
                                                {!hasFile && !noTieneDoc && (
                                                    <button
                                                        onClick={() => onUploadDocClick(persona.id, dp.tipo)}
                                                        disabled={busy || uploadingDoc === `${persona.id}-${dp.tipo}`}
                                                        style={{
                                                            marginLeft: "0.5rem",
                                                            padding: "0.15rem 0.35rem",
                                                            fontSize: "0.68rem",
                                                            borderRadius: "4px",
                                                            background: "var(--bg-secondary)",
                                                            border: "1px dashed var(--border)",
                                                            color: "var(--text-secondary)",
                                                            cursor: "pointer",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "0.2rem",
                                                            transition: "all 0.15s ease",
                                                        }}
                                                        title={`Subir ${dp.label}`}
                                                    >
                                                        {uploadingDoc === `${persona.id}-${dp.tipo}` ? (
                                                            <Loader2 size={10} className="spin" />
                                                        ) : (
                                                            <Upload size={10} />
                                                        )}
                                                        <span>Subir</span>
                                                    </button>
                                                )}
                                                </span>
                                            </div>

                                            {docs.length > 0 && (
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                    {docs.map(doc => {
                                                        const dlUrl = getExpedienteDownloadUrl({
                                                            url: doc.archivoDriveUrl!,
                                                            publicId: doc.archivoDriveId,
                                                            cct: persona.escuela?.cct || "",
                                                            apellidoPaterno: persona.apellidoPaterno,
                                                            apellidoMaterno: persona.apellidoMaterno,
                                                            nombre: persona.nombre,
                                                            tipoDocumento: dp.tipo,
                                                            etiqueta: null,
                                                            nombreOriginal: doc.archivoNombre || "archivo",
                                                        });
                                                        const fileTitle = buildExpedienteFileName(
                                                            persona.escuela?.cct || "",
                                                            persona.apellidoPaterno,
                                                            persona.apellidoMaterno,
                                                            persona.nombre,
                                                            dp.tipo,
                                                            null,
                                                            doc.archivoNombre || "archivo"
                                                        );
                                                        return (
                                                            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: "0.125rem" }}>
                                                                {doc.archivoDriveUrl && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => onViewPdf(
                                                                                doc.archivoDriveUrl!,
                                                                                `${dp.label} — ${persona.apellidoPaterno} ${persona.nombre}`,
                                                                                dlUrl || undefined,
                                                                                fileTitle
                                                                            )}
                                                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "2px", display: "inline-flex" }}
                                                                            title={`Ver ${dp.label}`}
                                                                        >
                                                                            <Eye size={14} />
                                                                        </button>
                                                                        <a
                                                                            href={dlUrl || "#"}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            style={{ color: "var(--text-secondary)", display: "inline-flex", padding: "2px" }}
                                                                            title={`Descargar ${dp.label}`}
                                                                        >
                                                                            <Download size={14} />
                                                                        </a>
                                                                        <button
                                                                            onClick={() => onDeleteDoc(doc.id)}
                                                                            disabled={busy}
                                                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "2px", display: "inline-flex" }}
                                                                            title="Eliminar archivo del expediente"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => onToggleBloqueo(doc.id, !doc.bloqueado)}
                                                                    disabled={busy}
                                                                    style={{
                                                                        background: "none", border: "none", cursor: "pointer",
                                                                        color: doc.bloqueado ? "var(--error)" : "var(--success)",
                                                                        padding: "2px",
                                                                    }}
                                                                    title={doc.bloqueado ? "Desbloquear" : "Bloquear"}
                                                                >
                                                                    {doc.bloqueado ? <Lock size={14} /> : <Unlock size={14} />}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Custom documents */}
                            {customDocs.length > 0 && (
                                <>
                                    <p style={{ margin: "0 0 0.375rem", fontWeight: 600, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        Documentos adicionales
                                    </p>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                                        gap: "0.5rem",
                                    }}>
                                        {customDocs.map(doc => (
                                            <div key={doc.id} style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                                padding: "0.375rem 0.625rem",
                                                borderRadius: "6px",
                                                background: "var(--bg-primary, white)",
                                                border: "1px dashed var(--border)",
                                                fontSize: "0.8125rem",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                                    <span style={{ color: doc.archivoDriveUrl ? "var(--success)" : "var(--error)", fontSize: "0.875rem" }}>
                                                        {doc.archivoDriveUrl ? "✅" : "❌"}
                                                    </span>
                                                    <span>{doc.etiqueta || doc.tipoDocumento}</span>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "0.125rem" }}>
                                                    {doc.archivoDriveUrl && (() => {
                                                        const dlUrl = getExpedienteDownloadUrl({
                                                            url: doc.archivoDriveUrl!,
                                                            publicId: doc.archivoDriveId,
                                                            cct: persona.escuela?.cct || "",
                                                            apellidoPaterno: persona.apellidoPaterno,
                                                            apellidoMaterno: persona.apellidoMaterno,
                                                            nombre: persona.nombre,
                                                            tipoDocumento: "CUSTOM",
                                                            etiqueta: doc.etiqueta,
                                                            nombreOriginal: doc.archivoNombre || "archivo",
                                                        });
                                                        const fileTitle = buildExpedienteFileName(
                                                            persona.escuela?.cct || "",
                                                            persona.apellidoPaterno,
                                                            persona.apellidoMaterno,
                                                            persona.nombre,
                                                            "CUSTOM",
                                                            doc.etiqueta,
                                                            doc.archivoNombre || "archivo"
                                                        );
                                                        return (
                                                            <>
                                                                <button
                                                                    onClick={() => onViewPdf(
                                                                        doc.archivoDriveUrl!,
                                                                        `${doc.etiqueta || doc.archivoNombre} — ${persona.apellidoPaterno} ${persona.nombre}`,
                                                                        dlUrl || undefined,
                                                                        fileTitle
                                                                    )}
                                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "2px", display: "inline-flex" }}
                                                                    title={`Ver ${doc.etiqueta || doc.archivoNombre}`}
                                                                >
                                                                    <Eye size={14} />
                                                                </button>
                                                                <a
                                                                    href={dlUrl || "#"}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ color: "var(--text-secondary)", display: "inline-flex", padding: "2px" }}
                                                                    title={`Descargar ${doc.etiqueta || doc.archivoNombre}`}
                                                                >
                                                                    <Download size={14} />
                                                                </a>
                                                                <button
                                                                    onClick={() => onDeleteDoc(doc.id)}
                                                                    disabled={busy}
                                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "2px", display: "inline-flex" }}
                                                                    title="Eliminar archivo del expediente"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </>
                                                        );
                                                    })()}
                                                    <button
                                                        onClick={() => onToggleBloqueo(doc.id, !doc.bloqueado)}
                                                        disabled={busy}
                                                        style={{
                                                            background: "none", border: "none", cursor: "pointer",
                                                            color: doc.bloqueado ? "var(--error)" : "var(--success)",
                                                            padding: "2px",
                                                        }}
                                                        title={doc.bloqueado ? "Desbloquear" : "Bloquear"}
                                                    >
                                                        {doc.bloqueado ? <Lock size={14} /> : <Unlock size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
