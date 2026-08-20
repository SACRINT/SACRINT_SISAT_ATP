"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BookOpen, Clock, AlertTriangle,
    ChevronDown, ChevronUp, Plus, Settings, RefreshCw,
    FileText, Calendar, GraduationCap, Loader2, X, Save,
    Layers, Download, Eye, CheckSquare, Sparkles, CheckCircle2,
    Upload
} from "lucide-react";
import CteCompromisosTablero from "@/components/cte/CteCompromisosTablero";
import PdfViewerModal from "@/app/_componentes/PdfViewerModal";
import { getDownloadUrl } from "@/lib/download-url";

interface TemaIA {
    titulo: string;
    descripcion: string | null;
}

interface AcuerdoSugeridoIA {
    texto: string;
}

interface Sesion {
    id: string;
    numero: number;
    fase: "INTENSIVA" | "ORDINARIA";
    descripcion: string | null;
    fechaSesion: string | null;
    fechaLimite: string | null;
    guiaUrl: string | null;
    archivoNombre?: string | null;
    archivoUrl?: string | null;
    archivoPublicId?: string | null;
    sha256Hash?: string | null;
    iaProcessed?: boolean;
    temasIA?: TemaIA[] | null;
    acuerdosSugeridosIA?: AcuerdoSugeridoIA[] | null;
    activo: boolean;
}

export default function CteSesionesPanel({ readOnly = false }: { readOnly?: boolean }) {
    const [sesiones, setSesiones] = useState<Sesion[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabActiva, setTabActiva] = useState<"sesiones" | "compromisos">("sesiones");
    const [sesionExpandida, setSesionExpandida] = useState<string | null>(null);
    const [showFormSesion, setShowFormSesion] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [campoInvalido, setCampoInvalido] = useState<string | null>(null);

    // Formulario nueva sesión
    const [formSesion, setFormSesion] = useState({
        numero: "",
        fase: "ORDINARIA",
        descripcion: "",
        fechaSesion: "",
        fechaLimite: "",
        guiaUrl: "",
    });
    const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);

    // Modal de resultados y edición IA
    const [modalIA, setModalIA] = useState<{
        isOpen: boolean;
        sesionId: string;
        numero: number;
        fase: string;
        temas: TemaIA[];
        acuerdos: AcuerdoSugeridoIA[];
        acuerdosSeleccionados: boolean[];
    } | null>(null);
    const [guardandoTemas, setGuardandoTemas] = useState(false);
    const [guardandoCompromisos, setGuardandoCompromisos] = useState(false);
    const [mensajeIA, setMensajeIA] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

    // Modal visor PDF
    const [pdfViewer, setPdfViewer] = useState<{
        isOpen: boolean;
        url: string;
        title: string;
        downloadUrl?: string;
        fileName?: string;
    } | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/cte");
            if (!res.ok) throw new Error("Error al cargar datos de CAPEMS");
            const data = await res.json();
            setSesiones(Array.isArray(data) ? data : (data.sesiones ?? []));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const crearSesion = async () => {
        if (!formSesion.numero) {
            setError("Por favor ingresa el Número de Sesión.");
            setCampoInvalido("numero");
            return;
        }
        setSaving(true);
        setError(null);
        setCampoInvalido(null);
        try {
            if (archivoSeleccionado) {
                if (archivoSeleccionado.size > 100 * 1024 * 1024) {
                    throw new Error(`El archivo excede el tamaño máximo permitido de 100 MB (${(archivoSeleccionado.size / 1024 / 1024).toFixed(1)} MB).`);
                }

                // 1. Firma de subida directa a Cloudinary (evita el límite de body de Vercel)
                const signRes = await fetch("/api/sign-cloudinary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        programa: "SESION_CAPEMS",
                        originalFilename: archivoSeleccionado.name,
                    }),
                });
                if (!signRes.ok) throw new Error("Error obteniendo firma de subida");
                const { signature, timestamp, folder, apiKey, cloudName, publicId } = await signRes.json();

                // 2. Subida directa navegador → Cloudinary (sin límite de Vercel)
                const upForm = new FormData();
                upForm.append("file", archivoSeleccionado);
                upForm.append("api_key", apiKey);
                upForm.append("timestamp", timestamp.toString());
                upForm.append("signature", signature);
                upForm.append("folder", folder);
                if (publicId) upForm.append("public_id", publicId);

                const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                    method: "POST",
                    body: upForm,
                });
                if (!upRes.ok) throw new Error("Error subiendo el archivo a Cloudinary");
                const upData = await upRes.json();

                // 3. Crear sesión con los datos del archivo (el servidor descarga desde Cloudinary y corre la IA)
                const res = await fetch("/api/admin/cte/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        numero: Number(formSesion.numero),
                        fase: formSesion.fase,
                        descripcion: formSesion.descripcion || null,
                        fechaSesion: formSesion.fechaSesion || null,
                        fechaLimite: formSesion.fechaLimite || null,
                        guiaUrl: formSesion.guiaUrl || null,
                        archivoNombre: archivoSeleccionado.name,
                        archivoUrl: upData.secure_url,
                        archivoPublicId: upData.public_id,
                    }),
                });

                const resText = await res.text();
                if (!res.ok) {
                    let msg = "Error al subir archivo de sesión";
                    try { msg = JSON.parse(resText).error || msg; } catch { /* cuerpo no JSON */ }
                    throw new Error(msg);
                }
                const result = JSON.parse(resText);

                if (result.iaWarning) {
                    setError(result.iaWarning);
                }

                setShowFormSesion(false);
                setArchivoSeleccionado(null);
                setFormSesion({ numero: "", fase: "ORDINARIA", descripcion: "", fechaSesion: "", fechaLimite: "", guiaUrl: "" });
                await cargar();

                // Abrir modal de revisión IA si se obtuvieron temas o acuerdos
                if (result.sesion) {
                    const temasExtraidos: TemaIA[] = result.temas || result.sesion.temasIA || [];
                    const acuerdosExtraidos: AcuerdoSugeridoIA[] = result.acuerdosSugeridos || result.sesion.acuerdosSugeridosIA || [];
                    if (temasExtraidos.length > 0 || acuerdosExtraidos.length > 0) {
                        setModalIA({
                            isOpen: true,
                            sesionId: result.sesion.id,
                            numero: result.sesion.numero,
                            fase: result.sesion.fase,
                            temas: temasExtraidos,
                            acuerdos: acuerdosExtraidos,
                            acuerdosSeleccionados: acuerdosExtraidos.map(() => true),
                        });
                    }
                }
            } else {
                // Envío JSON estándar sin archivo
                const res = await fetch("/api/admin/cte", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        numero: Number(formSesion.numero),
                        fase: formSesion.fase,
                        descripcion: formSesion.descripcion || null,
                        fechaSesion: formSesion.fechaSesion || null,
                        fechaLimite: formSesion.fechaLimite || null,
                        guiaUrl: formSesion.guiaUrl || null,
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || "Error al crear sesión");
                }

                setShowFormSesion(false);
                setFormSesion({ numero: "", fase: "ORDINARIA", descripcion: "", fechaSesion: "", fechaLimite: "", guiaUrl: "" });
                await cargar();
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error al guardar sesión");
        } finally {
            setSaving(false);
        }
    };

    const guardarTemasIA = async () => {
        if (!modalIA) return;
        setGuardandoTemas(true);
        setMensajeIA(null);
        try {
            const res = await fetch(`/api/admin/cte/${modalIA.sesionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    temasIA: modalIA.temas,
                }),
            });
            if (!res.ok) throw new Error("Error al guardar temas confirmados");
            setMensajeIA({ tipo: "ok", texto: "Temas guardados correctamente en la sesión." });
            await cargar();
        } catch (e: any) {
            setMensajeIA({ tipo: "error", texto: e.message || "Error al guardar temas" });
        } finally {
            setGuardandoTemas(false);
        }
    };

    const agregarCompromisosAlTablero = async () => {
        if (!modalIA) return;
        const seleccionados = modalIA.acuerdos.filter((_, idx) => modalIA.acuerdosSeleccionados[idx]);
        if (seleccionados.length === 0) {
            setMensajeIA({ tipo: "error", texto: "Selecciona al menos un acuerdo para agregar al Tablero." });
            return;
        }

        setGuardandoCompromisos(true);
        setMensajeIA(null);
        let agregados = 0;

        try {
            for (const ac of seleccionados) {
                const res = await fetch("/api/admin/cte/compromisos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sesionId: modalIA.sesionId,
                        texto: ac.texto,
                        categoria: "OTRO",
                        prioridad: 1,
                    }),
                });
                if (res.ok) agregados++;
            }

            setMensajeIA({ tipo: "ok", texto: `Se agregaron ${agregados} acuerdos al Tablero Zonal.` });
            await cargar();
        } catch (e: any) {
            setMensajeIA({ tipo: "error", texto: e.message || "Error al agregar acuerdos al Tablero" });
        } finally {
            setGuardandoCompromisos(false);
        }
    };

    const abrirVisorPresentacion = (sesion: Sesion) => {
        if (!sesion.archivoUrl) return;
        const isPdf =
            sesion.archivoNombre?.toLowerCase().endsWith(".pdf") ||
            sesion.archivoUrl.toLowerCase().includes(".pdf");

        if (isPdf) {
            setPdfViewer({
                isOpen: true,
                url: sesion.archivoUrl,
                title: `Presentación — Sesión ${sesion.numero} (${sesion.fase})`,
                downloadUrl: getDownloadUrl(sesion.archivoUrl, sesion.archivoNombre || undefined, sesion.archivoPublicId),
                fileName: sesion.archivoNombre || undefined,
            });
        } else {
            // PPTX u otros formatos: abrir en pestaña nueva
            window.open(sesion.archivoUrl, "_blank");
        }
    };

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px", color: "var(--text-muted)" }}>
            <Loader2 size={36} className="spin" style={{ color: "var(--primary)" }} />
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text)" }}>
                        <GraduationCap style={{ color: "var(--primary)" }} size={28} />
                        Consejos Académicos (CAPEMS)
                    </h2>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        Repositorio de sesiones de Consejos Académicos (CAPEMS) — Zona 004
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button className="btn btn-outline" onClick={cargar} style={{ fontSize: "0.8125rem" }}>
                        <RefreshCw size={15} /> Actualizar
                    </button>
                    {!readOnly && (
                        <button className="btn btn-primary" onClick={() => { setError(null); setCampoInvalido(null); setShowFormSesion(true); }} style={{ fontSize: "0.8125rem" }}>
                            <Plus size={15} /> Nueva Sesión
                        </button>
                    )}
                </div>
            </div>

            {/* Selector de Pestañas */}
            <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                <button
                    onClick={() => setTabActiva("sesiones")}
                    style={{
                        background: tabActiva === "sesiones" ? "var(--primary)" : "transparent",
                        color: tabActiva === "sesiones" ? "#fff" : "var(--text-muted)",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.45rem 0.9rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        transition: "all 0.2s ease",
                    }}
                >
                    <FileText size={15} />
                    Sesiones y Temas
                </button>
                <button
                    onClick={() => setTabActiva("compromisos")}
                    style={{
                        background: tabActiva === "compromisos" ? "var(--primary)" : "transparent",
                        color: tabActiva === "compromisos" ? "#fff" : "var(--text-muted)",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.45rem 0.9rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        transition: "all 0.2s ease",
                    }}
                >
                    <Layers size={15} />
                    Tablero de Acuerdos Zonal
                </button>
            </div>

            {error && (
                <div className="alert alert-error">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* Modal nueva sesión con subida de archivo */}
            {showFormSesion && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: "540px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Settings size={18} style={{ color: "var(--primary)" }} /> Configurar Sesión CAPEMS
                            </h3>
                            <button onClick={() => { setError(null); setCampoInvalido(null); setShowFormSesion(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>
                        {error && (
                            <div className="alert alert-error" style={{ fontSize: "0.8125rem", padding: "0.6rem 0.8rem" }}>
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Número de Sesión *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="form-control"
                                        value={formSesion.numero}
                                        onChange={e => {
                                            setFormSesion(f => ({ ...f, numero: e.target.value }));
                                            if (campoInvalido === "numero") setCampoInvalido(null);
                                        }}
                                        placeholder="1"
                                        style={{
                                            width: "100%",
                                            borderColor: campoInvalido === "numero" ? "#ef4444" : undefined,
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fase *</label>
                                    <select className="form-control" value={formSesion.fase}
                                        onChange={e => setFormSesion(f => ({ ...f, fase: e.target.value as any }))} style={{ width: "100%" }}>
                                        <option value="ORDINARIA">Ordinaria</option>
                                        <option value="INTENSIVA">Intensiva</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Descripción / Tema Principal</label>
                                <input className="form-control" value={formSesion.descripcion}
                                    onChange={e => setFormSesion(f => ({ ...f, descripcion: e.target.value }))}
                                    placeholder="Evaluación formativa, PMC, acuerdos de zona..." style={{ width: "100%" }} />
                            </div>

                            {/* Carga de archivo oficial con extracción IA */}
                            <div style={{ background: "var(--bg-secondary)", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)" }}>
                                    <Upload size={14} /> Presentación Oficial (PDF o PPTX)
                                </label>
                                <input
                                    type="file"
                                    accept=".pdf,.pptx"
                                    onChange={e => setArchivoSeleccionado(e.target.files?.[0] || null)}
                                    style={{ fontSize: "0.8125rem", width: "100%" }}
                                />
                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "0.25rem" }}>
                                    ✨ La IA extraerá automáticamente los temas y acuerdos sugeridos de la presentación.
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fecha de Sesión</label>
                                    <input type="date" className="form-control" value={formSesion.fechaSesion}
                                        onChange={e => setFormSesion(f => ({ ...f, fechaSesion: e.target.value }))} style={{ width: "100%" }} />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>Fecha Límite Compromisos</label>
                                    <input type="date" className="form-control" value={formSesion.fechaLimite}
                                        onChange={e => setFormSesion(f => ({ ...f, fechaLimite: e.target.value }))} style={{ width: "100%" }} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>URL Guía Oficial (Opcional)</label>
                                <input type="url" className="form-control" value={formSesion.guiaUrl}
                                    onChange={e => setFormSesion(f => ({ ...f, guiaUrl: e.target.value }))}
                                    placeholder="https://..." style={{ width: "100%" }} />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                            <button onClick={() => { setError(null); setCampoInvalido(null); setShowFormSesion(false); }} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={crearSesion} disabled={saving}
                                className="btn btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                                {saving ? "Procesando con IA..." : "Guardar Sesión"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Revisión / Confirmación de IA */}
            {modalIA && modalIA.isOpen && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1050,
                    background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
                }}>
                    <div className="card" style={{ width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto", padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text)" }}>
                                    <Sparkles size={20} style={{ color: "#f59e0b" }} />
                                    Resultados de Extracción IA — Sesión {modalIA.numero} ({modalIA.fase})
                                </h3>
                                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    Verifica y edita los temas tratados y confirma los acuerdos explícitos para enviarlos al Tablero Zonal.
                                </p>
                            </div>
                            <button onClick={() => { setModalIA(null); setMensajeIA(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <X size={20} />
                            </button>
                        </div>

                        {mensajeIA && (
                            <div className={`alert ${mensajeIA.tipo === "ok" ? "alert-success" : "alert-error"}`} style={{ fontSize: "0.8125rem", padding: "0.6rem 0.8rem" }}>
                                {mensajeIA.tipo === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                {mensajeIA.texto}
                            </div>
                        )}

                        {/* Sección 1: Temas extraídos (Editables) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <FileText size={16} style={{ color: "var(--primary)" }} /> Temas / Orden del Día Extraídos ({modalIA.temas.length})
                                </h4>
                                <button
                                    onClick={() => setModalIA(prev => prev ? ({ ...prev, temas: [...prev.temas, { titulo: "", descripcion: "" }] }) : null)}
                                    className="btn btn-outline"
                                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                                >
                                    <Plus size={12} /> Agregar Tema
                                </button>
                            </div>

                            {modalIA.temas.length === 0 ? (
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>No se detectaron temas en el documento.</p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                    {modalIA.temas.map((tema, idx) => (
                                        <div key={idx} style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", width: "20px" }}>#{idx + 1}</span>
                                                <input
                                                    className="form-control"
                                                    style={{ fontSize: "0.8125rem", padding: "0.3rem 0.5rem", fontWeight: 600 }}
                                                    value={tema.titulo}
                                                    placeholder="Título del tema..."
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setModalIA(prev => {
                                                            if (!prev) return null;
                                                            const newTemas = [...prev.temas];
                                                            newTemas[idx] = { ...newTemas[idx], titulo: val };
                                                            return { ...prev, temas: newTemas };
                                                        });
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        setModalIA(prev => {
                                                            if (!prev) return null;
                                                            return { ...prev, temas: prev.temas.filter((_, i) => i !== idx) };
                                                        });
                                                    }}
                                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            <textarea
                                                className="form-control"
                                                rows={2}
                                                style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem", resize: "vertical" }}
                                                value={tema.descripcion || ""}
                                                placeholder="Descripción o puntos tratados..."
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setModalIA(prev => {
                                                        if (!prev) return null;
                                                        const newTemas = [...prev.temas];
                                                        newTemas[idx] = { ...newTemas[idx], descripcion: val || null };
                                                        return { ...prev, temas: newTemas };
                                                    });
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                    onClick={guardarTemasIA}
                                    disabled={guardandoTemas}
                                    className="btn btn-outline"
                                    style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                                >
                                    {guardandoTemas ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
                                    Guardar Temas Confirmados
                                </button>
                            </div>
                        </div>

                        <hr style={{ borderColor: "var(--border)", margin: "0.5rem 0" }} />

                        {/* Sección 2: Acuerdos sugeridos con Checkboxes */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <CheckSquare size={16} style={{ color: "#10b981" }} /> Acuerdos Explícitos Detectados ({modalIA.acuerdos.length})
                            </h4>

                            {modalIA.acuerdos.length === 0 ? (
                                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>
                                    No se encontraron acuerdos explícitos en el documento. Puedes agregarlos manualmente en el Tablero de Acuerdos.
                                </p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {modalIA.acuerdos.map((ac, idx) => (
                                        <label key={idx} style={{
                                            display: "flex", alignItems: "flex-start", gap: "0.6rem",
                                            background: modalIA.acuerdosSeleccionados[idx] ? "rgba(16, 185, 129, 0.08)" : "var(--bg-secondary)",
                                            padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer"
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={modalIA.acuerdosSeleccionados[idx]}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setModalIA(prev => {
                                                        if (!prev) return null;
                                                        const newSel = [...prev.acuerdosSeleccionados];
                                                        newSel[idx] = checked;
                                                        return { ...prev, acuerdosSeleccionados: newSel };
                                                    });
                                                }}
                                                style={{ marginTop: "0.2rem" }}
                                            />
                                            <span style={{ fontSize: "0.8125rem", color: "var(--text)", lineHeight: 1.4 }}>
                                                {ac.texto}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {modalIA.acuerdos.length > 0 && (
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <button
                                        onClick={agregarCompromisosAlTablero}
                                        disabled={guardandoCompromisos}
                                        className="btn btn-primary"
                                        style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                                    >
                                        {guardandoCompromisos ? <Loader2 size={13} className="spin" /> : <Layers size={13} />}
                                        Agregar Seleccionados al Tablero
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                            <button
                                onClick={() => { setModalIA(null); setMensajeIA(null); }}
                                className="btn btn-outline"
                                style={{ fontSize: "0.8125rem" }}
                            >
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vista 2: Tablero de Acuerdos Zonal */}
            {tabActiva === "compromisos" && (
                <CteCompromisosTablero
                    sesiones={sesiones.map(s => ({
                        id: s.id,
                        numero: s.numero,
                        fase: s.fase,
                        descripcion: s.descripcion,
                    }))}
                    readOnly={readOnly}
                />
            )}

            {/* Vista 1: Tarjetas de Sesiones y Temas */}
            {tabActiva === "sesiones" && (
                sesiones.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
                        <GraduationCap size={44} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>No hay sesiones de CAPEMS configuradas</p>
                        <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>Crea la primera sesión con el botón &quot;Nueva Sesión&quot;</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {sesiones.map(sesion => {
                            const expandida = sesionExpandida === sesion.id;
                            const temasList = (sesion.temasIA as TemaIA[]) || [];

                            return (
                                <div key={sesion.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                                    {/* Cabecera de sesión */}
                                    <div
                                        style={{
                                            padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
                                            cursor: "pointer", background: "var(--bg-card)", transition: "background 0.2s ease"
                                        }}
                                        onClick={() => setSesionExpandida(expandida ? null : sesion.id)}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                            <div style={{
                                                width: "42px", height: "42px", borderRadius: "10px",
                                                background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontWeight: 800, fontSize: "1rem"
                                            }}>
                                                {sesion.numero}
                                            </div>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>
                                                        Sesión {sesion.numero} — {sesion.fase === "INTENSIVA" ? "Fase Intensiva" : "Fase Ordinaria"}
                                                    </span>
                                                    <span style={{
                                                        fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "12px",
                                                        background: sesion.fase === "INTENSIVA" ? "rgba(124, 58, 237, 0.15)" : "rgba(37, 99, 235, 0.15)",
                                                        color: sesion.fase === "INTENSIVA" ? "#7c3aed" : "var(--primary)",
                                                        textTransform: "uppercase"
                                                    }}>
                                                        {sesion.fase}
                                                    </span>
                                                    {sesion.archivoUrl && (
                                                        <span style={{
                                                            fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "12px",
                                                            background: "rgba(16, 185, 129, 0.15)", color: "#10b981",
                                                            display: "inline-flex", alignItems: "center", gap: "0.25rem"
                                                        }}>
                                                            <FileText size={11} /> Con Presentación
                                                        </span>
                                                    )}
                                                </div>
                                                {sesion.descripcion && <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>{sesion.descripcion}</p>}
                                                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                                                    {sesion.fechaSesion && (
                                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                            <Calendar size={12} /> {new Date(sesion.fechaSesion).toLocaleDateString("es-MX")}
                                                        </span>
                                                    )}
                                                    {sesion.fechaLimite && (
                                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                            <Clock size={12} /> Límite: {new Date(sesion.fechaLimite).toLocaleDateString("es-MX")}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                            <div style={{ color: "var(--text-muted)" }}>
                                                {expandida ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bloque expandido: Archivo Oficial + Temas Tratados */}
                                    {expandida && (
                                        <div style={{ padding: "1.25rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                            {/* 1. Bloque de Archivos y Guías */}
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                                {sesion.archivoUrl && (
                                                    <>
                                                        <button
                                                            onClick={() => abrirVisorPresentacion(sesion)}
                                                            className="btn btn-primary"
                                                            style={{ fontSize: "0.8rem", padding: "0.4rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                                                        >
                                                            <Eye size={14} /> Ver Presentación Oficial
                                                        </button>
                                                        <a
                                                            href={getDownloadUrl(sesion.archivoUrl, sesion.archivoNombre || `CAPEMS_Sesion_${sesion.numero}`, sesion.archivoPublicId)}
                                                            download
                                                            className="btn btn-outline"
                                                            style={{ fontSize: "0.8rem", padding: "0.4rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                                                        >
                                                            <Download size={14} /> Descargar Archivo
                                                        </a>
                                                    </>
                                                )}

                                                {sesion.guiaUrl && (
                                                    <a
                                                        href={sesion.guiaUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-outline"
                                                        style={{ fontSize: "0.8rem", padding: "0.4rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                                                    >
                                                        <BookOpen size={14} /> Ver Guía Oficial de Trabajo
                                                    </a>
                                                )}

                                                {!readOnly && (
                                                    <button
                                                        onClick={() => {
                                                            setModalIA({
                                                                isOpen: true,
                                                                sesionId: sesion.id,
                                                                numero: sesion.numero,
                                                                fase: sesion.fase,
                                                                temas: (sesion.temasIA as TemaIA[]) || [],
                                                                acuerdos: (sesion.acuerdosSugeridosIA as AcuerdoSugeridoIA[]) || [],
                                                                acuerdosSeleccionados: ((sesion.acuerdosSugeridosIA as AcuerdoSugeridoIA[]) || []).map(() => true),
                                                            });
                                                        }}
                                                        className="btn btn-outline"
                                                        style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem", marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                                                    >
                                                        <Sparkles size={13} style={{ color: "#f59e0b" }} /> Editar Temas / Acuerdos IA
                                                    </button>
                                                )}
                                            </div>

                                            {/* 2. Bloque de Temas Tratados */}
                                            <div style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                                <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text)" }}>
                                                    <FileText size={15} style={{ color: "var(--primary)" }} /> Temas y Orden del Día de la Sesión
                                                </h4>

                                                {temasList.length === 0 ? (
                                                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                                        Sin temas registrados para esta sesión.
                                                    </p>
                                                ) : (
                                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
                                                        {temasList.map((tema, idx) => (
                                                            <div key={idx} style={{
                                                                padding: "0.75rem", borderRadius: "6px",
                                                                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                                                                display: "flex", flexDirection: "column", gap: "0.25rem"
                                                            }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                                    <span style={{
                                                                        fontSize: "0.7rem", fontWeight: 800, padding: "0.1rem 0.4rem",
                                                                        borderRadius: "4px", background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)"
                                                                    }}>
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)" }}>
                                                                        {tema.titulo}
                                                                    </span>
                                                                </div>
                                                                {tema.descripcion && (
                                                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                                                                        {tema.descripcion}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Modal Visor de Presentaciones PDF */}
            {pdfViewer && (
                <PdfViewerModal
                    isOpen={pdfViewer.isOpen}
                    onClose={() => setPdfViewer(null)}
                    url={pdfViewer.url}
                    title={pdfViewer.title}
                    downloadUrl={pdfViewer.downloadUrl}
                    fileName={pdfViewer.fileName}
                />
            )}
        </div>
    );
}
