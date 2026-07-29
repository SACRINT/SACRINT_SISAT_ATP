"use client";

import { useState, useEffect, useRef } from "react";
import {
    FileText, Upload, ChevronDown, ChevronUp, AlertTriangle,
    CheckCircle, Clock, XCircle, Download, RefreshCw, Trash2,
    BookOpen, Star, AlertCircle, Lock
} from "lucide-react";
import { Packer, Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle } from "docx";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Requisitos {
    puedeUsar: boolean;
    tieneApiKey: boolean;
    tienePaecPec: boolean;
    requierePaecPec?: boolean;
    requiereApiKey?: boolean;
    motivoBloqueo: string | null;
}

interface CriterioResultado {
    id: string;
    criterio: string;
    categoria: string;
    puntajeMax: number;
    puntajeObtenido: number;
    cumple: "SI" | "PARCIAL" | "NO";
    evidencia: string;
    observacion: string;
    recomendacion: string;
}

interface Planeacion {
    id: string;
    docenteNombre: string;
    asignatura: string;
    semestre: number;
    bloqueCorte?: string;
    tipoAsignatura: string;
    archivoNombre: string;
    archivoUrl: string;
    estado: string;
    puntajeObtenido?: number;
    puntajeMaximo?: number;
    nivelCumplimiento?: string;
    resultadoJson?: { rubricaUsada: string; criterios: CriterioResultado[] };
    observacionesJson?: {
        puntosFuertes: string[];
        mejorasUrgentes: string[];
        observacionesExtendidas: string;
        alineacionPaecPec: string;
    };
    retroalimentacionDocente?: string;
    fechaSubida: string;
    fechaRevision?: string;
}

interface Estadisticas {
    total: number;
    revisadas: number;
    pendientes: number;
    conError: number;
    promedioZona: number;
}

interface Props {
    escuela: { id: string; cct: string; nombre: string };
}

// ── Colores por nivel ────────────────────────────────────────────────────────

const colorEstado: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
    PENDIENTE: { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0", label: "Pendiente", icon: <Clock size={14} /> },
    EN_REVISION: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe", label: "Analizando con IA...", icon: <RefreshCw size={14} className="spin" /> },
    REVISADO: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0", label: "Revisado", icon: <CheckCircle size={14} /> },
    ERROR: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", label: "Error", icon: <XCircle size={14} /> },
};

const colorNivel: Record<string, { bg: string; text: string; label: string }> = {
    COMPLETO: { bg: "#f0fdf4", text: "#16a34a", label: "Cumple satisfactoriamente" },
    PARCIAL: { bg: "#fffbeb", text: "#d97706", label: "Cumplimiento parcial" },
    REQUIERE_CORRECCION: { bg: "#fef2f2", text: "#dc2626", label: "Requiere correcciones" },
};

// ── Asignaturas disponibles ──────────────────────────────────────────────────

const ASIGNATURAS_POR_SEMESTRE: Record<number, string[]> = {
    1: ["Pensamiento Matemático I", "Lengua y Comunicación I", "Ciencias Naturales (Invitación a la Ciencia)", "Ciencias Sociales I", "Humanidades I (Pensamiento Filosófico)", "Inglés I", "Educación para la Salud y el Bienestar I", "Actividades Físicas y Deportivas I", "Actividades Artísticas y Culturales I", "Laboratorio de Investigación I", "Cultura Digital I", "Formación Laboral"],
    2: ["Pensamiento Matemático II", "Lengua y Comunicación II", "Ciencias Naturales II", "Ciencias Sociales II", "Humanidades II", "Inglés II", "Educación para la Salud y el Bienestar II", "Actividades Físicas y Deportivas II", "Actividades Artísticas y Culturales II", "Laboratorio de Investigación II", "Cultura Digital II", "Formación Laboral"],
    3: ["Pensamiento Matemático III", "Lengua y Comunicación III", "Ciencias Naturales III", "Ciencias Sociales III", "Humanidades III", "Inglés III", "Educación para la Salud y el Bienestar III", "Actividades Físicas y Deportivas III", "Actividades Artísticas y Culturales III", "Laboratorio de Investigación III", "Formación Laboral"],
    4: ["Pensamiento Matemático IV", "Lengua y Comunicación IV", "Ciencias Naturales IV", "Ciencias Sociales IV", "Inglés IV", "Formación Laboral"],
    5: ["Cálculo I", "Literatura I", "Física I", "Historia de México", "Filosofía", "Inglés V", "Formación Laboral", "Optativas FFE"],
    6: ["Cálculo II", "Literatura II", "Física II", "Historia Universal", "Ética", "Inglés VI", "Formación Laboral", "Optativas FFE"],
};

// ── Generador de Word ────────────────────────────────────────────────────────

async function generarWordRetroalimentacion(planeacion: Planeacion): Promise<void> {
    const criterios = planeacion.resultadoJson?.criterios ?? [];
    const obs = planeacion.observacionesJson;
    const pct = Math.round(((planeacion.puntajeObtenido ?? 0) / (planeacion.puntajeMaximo ?? 300)) * 100);
    const fecha = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "RETROALIMENTACIÓN DE PLANEACIÓN DIDÁCTICA", bold: true, size: 28 })] }),
                new Paragraph({ children: [new TextRun({ text: `Fecha: ${fecha}`, size: 22, color: "555555" })] }),
                new Paragraph({ children: [new TextRun("")] }),

                // Datos del docente
                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "I. DATOS DE IDENTIFICACIÓN", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Docente:", bold: true })] })] }), new TableCell({ children: [new Paragraph(planeacion.docenteNombre)] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Asignatura:", bold: true })] })] }), new TableCell({ children: [new Paragraph(planeacion.asignatura)] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Semestre:", bold: true })] })] }), new TableCell({ children: [new Paragraph(`${planeacion.semestre}° Semestre`)] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bloque/Corte:", bold: true })] })] }), new TableCell({ children: [new Paragraph(planeacion.bloqueCorte ?? "No especificado")] })] }),
                        new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Puntaje Obtenido:", bold: true })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${planeacion.puntajeObtenido ?? 0} / ${planeacion.puntajeMaximo ?? 300} pts (${pct}%)`, bold: true, color: pct >= 85 ? "16a34a" : pct >= 60 ? "d97706" : "dc2626" })] })] })] }),
                    ],
                }),

                new Paragraph({ children: [new TextRun("")] }),

                // Puntos fuertes
                ...(obs?.puntosFuertes?.length ? [
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "II. FORTALEZAS DESTACADAS", bold: true })] }),
                    ...obs.puntosFuertes.map(p => new Paragraph({ bullet: { level: 0 }, children: [new TextRun(p)] })),
                    new Paragraph({ children: [new TextRun("")] }),
                ] : []),

                // Mejoras urgentes
                ...(obs?.mejorasUrgentes?.length ? [
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "III. MEJORAS URGENTES", bold: true })] }),
                    ...obs.mejorasUrgentes.map(m => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: m, color: "dc2626" })] })),
                    new Paragraph({ children: [new TextRun("")] }),
                ] : []),

                // Tabla de criterios
                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "IV. EVALUACIÓN POR CRITERIO (ANEXO 12 USICAMM)", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            tableHeader: true,
                            children: ["Criterio", "Pts Máx", "Pts Obtenidos", "Cumple", "Observación"].map(h =>
                                new TableCell({ shading: { fill: "2E5F9A" }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })] })] })
                            ),
                        }),
                        ...criterios.map((c, i) => new TableRow({
                            children: [
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: c.criterio, size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: String(c.puntajeMax), size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: String(c.puntajeObtenido), bold: true, color: c.cumple === "SI" ? "16a34a" : c.cumple === "PARCIAL" ? "d97706" : "dc2626", size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: c.cumple === "SI" ? "✓ Sí" : c.cumple === "PARCIAL" ? "⚠ Parcial" : "✗ No", bold: true, color: c.cumple === "SI" ? "16a34a" : c.cumple === "PARCIAL" ? "d97706" : "dc2626", size: 18 })] })] }),
                                new TableCell({ shading: { fill: i % 2 === 0 ? "EFF5FB" : "FFFFFF" }, children: [new Paragraph({ children: [new TextRun({ text: c.observacion, size: 18 })] })] }),
                            ],
                        })),
                    ],
                }),

                new Paragraph({ children: [new TextRun("")] }),

                // Alineación PAEC
                ...(obs?.alineacionPaecPec ? [
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "V. ALINEACIÓN CON EL PAEC-PEC", bold: true })] }),
                    new Paragraph({ children: [new TextRun(obs.alineacionPaecPec)] }),
                    new Paragraph({ children: [new TextRun("")] }),
                ] : []),

                // Retroalimentación para el docente
                ...(planeacion.retroalimentacionDocente ? [
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "VI. RETROALIMENTACIÓN PARA EL DOCENTE", bold: true })] }),
                    new Paragraph({ children: [new TextRun(planeacion.retroalimentacionDocente)] }),
                    new Paragraph({ children: [new TextRun("")] }),
                ] : []),

                // Firmas
                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "VII. FIRMAS", bold: true })] }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                    rows: [
                        new TableRow({ children: [
                            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "\n\n\n______________________________\nDirector(a) del Plantel", size: 20 })] })] }),
                            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "\n\n\n______________________________\nAsesor Técnico Pedagógico (ATP)\nZona Escolar 004", size: 20 })] })] }),
                        ]}),
                    ],
                }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Retroalimentacion_${planeacion.docenteNombre.replace(/\s+/g, "_")}_${planeacion.asignatura.replace(/\s+/g, "_")}_S${planeacion.semestre}.docx`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function GestionPlaneaciones({ escuela }: Props) {
    const [requisitos, setRequisitos] = useState<Requisitos | null>(null);
    const [planeaciones, setPlaneaciones] = useState<Planeacion[]>([]);
    const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
    const [cargando, setCargando] = useState(true);
    const [expandida, setExpandida] = useState<string | null>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [generandoWord, setGenerandoWord] = useState<string | null>(null);
    const [eliminando, setEliminando] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ docenteNombre: "", asignatura: "", semestre: "1", bloqueCorte: "", tipoAsignatura: "FUNDAMENTAL" });
    const [archivo, setArchivo] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const cargarDatos = async () => {
        try {
            const res = await fetch("/api/director/planeaciones");
            if (!res.ok) return;
            const data = await res.json();
            setRequisitos(data.requisitos);
            setPlaneaciones(data.planeaciones);
            setEstadisticas(data.estadisticas);
        } catch { /* silent */ }
        finally { setCargando(false); }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    // Auto-polling cada 8 segundos si hay alguna en revisión
    useEffect(() => {
        const hayEnRevision = planeaciones.some(p => p.estado === "EN_REVISION");
        if (hayEnRevision) {
            pollingRef.current = setInterval(cargarDatos, 8000);
        } else {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        }
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [planeaciones]);

    const handleSubir = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!archivo) { alert("Selecciona el archivo de la planeación"); return; }

        setSubiendo(true);
        const fd = new FormData();
        fd.append("archivo", archivo);
        fd.append("docenteNombre", form.docenteNombre);
        fd.append("asignatura", form.asignatura || ASIGNATURAS_POR_SEMESTRE[parseInt(form.semestre)][0]);
        fd.append("semestre", form.semestre);
        fd.append("bloqueCorte", form.bloqueCorte);
        fd.append("tipoAsignatura", form.tipoAsignatura);

        try {
            const res = await fetch("/api/director/planeaciones", { method: "POST", body: fd });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error || "Error al subir la planeación");
                return;
            }
            setShowForm(false);
            setArchivo(null);
            setForm({ docenteNombre: "", asignatura: "", semestre: "1", bloqueCorte: "", tipoAsignatura: "FUNDAMENTAL" });
            await cargarDatos();
        } catch { alert("Error de conexión"); }
        finally { setSubiendo(false); }
    };

    const handleEliminar = async (id: string) => {
        if (!confirm("¿Eliminar esta planeación y su revisión?")) return;
        setEliminando(id);
        try {
            await fetch(`/api/director/planeaciones/${id}`, { method: "DELETE" });
            setPlaneaciones(prev => prev.filter(p => p.id !== id));
        } catch { /* silent */ }
        finally { setEliminando(null); }
    };

    const handleDescargarWord = async (planeacion: Planeacion) => {
        setGenerandoWord(planeacion.id);
        try { await generarWordRetroalimentacion(planeacion); }
        catch (e) { alert("Error al generar el documento Word"); }
        finally { setGenerandoWord(null); }
    };

    // ── Pantalla de carga ─────────────────────────────────────────────────────
    if (cargando) {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "1rem" }}>
                <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
                <p style={{ color: "var(--text-muted)" }}>Cargando módulo de planeaciones...</p>
            </div>
        );
    }

    // ── Pantalla de bloqueo si no cumple requisitos ───────────────────────────
    if (!requisitos?.puedeUsar) {
        const faltaPaec = requisitos ? (!requisitos.tienePaecPec && (requisitos.requierePaecPec ?? true)) : false;
        const faltaApi = requisitos ? (!requisitos.tieneApiKey && (requisitos.requiereApiKey ?? true)) : false;

        return (
            <div style={{ maxWidth: "640px", margin: "2rem auto", textAlign: "center" }}>
                <div style={{ background: faltaPaec ? "#fef2f2" : "#fffbeb", border: `2px solid ${faltaPaec ? "#fecaca" : "#fde68a"}`, borderRadius: "16px", padding: "2.5rem 2rem" }}>
                    <Lock size={48} style={{ color: faltaPaec ? "#dc2626" : "#d97706", marginBottom: "1rem" }} />
                    <h2 style={{ fontWeight: 800, fontSize: "1.25rem", color: faltaPaec ? "#991b1b" : "#92400e", marginBottom: "0.75rem" }}>
                        Módulo Bloqueado
                    </h2>
                    <p style={{ color: faltaPaec ? "#7f1d1d" : "#78350f", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                        {requisitos?.motivoBloqueo ?? "No tienes acceso a este módulo en este momento."}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {faltaPaec && (
                            <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: "10px", padding: "1rem", display: "flex", alignItems: "flex-start", gap: "0.75rem", textAlign: "left" }}>
                                <AlertTriangle size={18} style={{ color: "#dc2626", flexShrink: 0, marginTop: "2px" }} />
                                <div>
                                    <p style={{ fontWeight: 700, color: "#991b1b", margin: 0, fontSize: "0.875rem" }}>Requisito: PAEC-PEC</p>
                                    <p style={{ color: "#7f1d1d", margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                                        Ve a <strong>Mis Entregas</strong> y sube tu <strong>PAEC-PEC</strong> antes de poder revisar planeaciones.
                                    </p>
                                </div>
                            </div>
                        )}
                        {faltaApi && (
                            <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: "10px", padding: "1rem", display: "flex", alignItems: "flex-start", gap: "0.75rem", textAlign: "left" }}>
                                <AlertCircle size={18} style={{ color: "#d97706", flexShrink: 0, marginTop: "2px" }} />
                                <div>
                                    <p style={{ fontWeight: 700, color: "#92400e", margin: 0, fontSize: "0.875rem" }}>Requisito: API Key</p>
                                    <p style={{ color: "#78350f", margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                                        Ve a <strong>Ajustes de API</strong> y activa tu clave para usar la revisión automática.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Panel principal ───────────────────────────────────────────────────────
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Estadísticas */}
            {estadisticas && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
                    {[
                        { label: "Total Subidas", value: estadisticas.total, color: "var(--primary)", bg: "var(--primary-bg)" },
                        { label: "Revisadas", value: estadisticas.revisadas, color: "#16a34a", bg: "#f0fdf4" },
                        { label: "En Proceso", value: estadisticas.pendientes, color: "#2563eb", bg: "#eff6ff" },
                        { label: "Puntaje Promedio", value: `${Math.round(estadisticas.promedioZona)} / 300`, color: "#d97706", bg: "#fffbeb" },
                    ].map(stat => (
                        <div key={stat.label} style={{ background: stat.bg, borderRadius: "12px", padding: "1rem", textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Botón subir */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="btn btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                    <Upload size={16} />
                    {showForm ? "Cancelar" : "Subir Planeación para Revisión"}
                </button>
            </div>

            {/* Formulario de subida */}
            {showForm && (
                <div className="card" style={{ border: "2px solid var(--primary)", borderRadius: "14px" }}>
                    <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem", color: "var(--primary)" }}>
                        <Upload size={16} style={{ marginRight: "0.5rem" }} />
                        Nueva Planeación para Revisión con IA
                    </h3>
                    <form onSubmit={handleSubir} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                                <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Docente *</label>
                                <input
                                    required
                                    className="form-control"
                                    placeholder="Nombre completo del docente"
                                    value={form.docenteNombre}
                                    onChange={e => setForm(f => ({ ...f, docenteNombre: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Semestre *</label>
                                <select
                                    required
                                    className="form-control"
                                    value={form.semestre}
                                    onChange={e => setForm(f => ({ ...f, semestre: e.target.value, asignatura: "" }))}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(s => (
                                        <option key={s} value={s}>{s}° Semestre {s >= 5 ? "(Progresiones)" : "(Propósitos Formativos)"}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                                <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Asignatura / UAC *</label>
                                <select
                                    required
                                    className="form-control"
                                    value={form.asignatura}
                                    onChange={e => setForm(f => ({ ...f, asignatura: e.target.value, tipoAsignatura: e.target.value === "Formación Laboral" ? "LABORAL" : "FUNDAMENTAL" }))}
                                >
                                    <option value="">Seleccionar asignatura...</option>
                                    {(ASIGNATURAS_POR_SEMESTRE[parseInt(form.semestre)] ?? []).map(a => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Bloque / Corte</label>
                                <input
                                    className="form-control"
                                    placeholder="Ej. Corte 1, Bloque II..."
                                    value={form.bloqueCorte}
                                    onChange={e => setForm(f => ({ ...f, bloqueCorte: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>Archivo de Planeación (PDF o DOCX) *</label>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".pdf,.docx"
                                required
                                onChange={e => setArchivo(e.target.files?.[0] ?? null)}
                                style={{ width: "100%" }}
                            />
                            {archivo && (
                                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                    ✓ {archivo.name} ({(archivo.size / 1024).toFixed(1)} KB)
                                </p>
                            )}
                        </div>

                        {parseInt(form.semestre) >= 5 && (
                            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.75rem", fontSize: "0.8rem", color: "#92400e" }}>
                                ⚠️ <strong>Semestre {form.semestre}:</strong> La IA evaluará esta planeación con el Anexo 12 para <strong>semestres 5-6 (Generación 2023-2026)</strong>, que usa <strong>Progresiones</strong> en lugar de Propósitos Formativos.
                            </div>
                        )}

                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline">Cancelar</button>
                            <button type="submit" disabled={subiendo} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {subiendo ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Subiendo y analizando...</> : <><Upload size={14} /> Enviar a Revisión IA</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Lista de planeaciones */}
            {planeaciones.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", color: "var(--text-muted)" }}>
                    <FileText size={48} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
                    <p style={{ fontWeight: 600 }}>No hay planeaciones subidas aún.</p>
                    <p style={{ fontSize: "0.875rem" }}>Haz clic en "Subir Planeación para Revisión" para comenzar.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {planeaciones.map(p => {
                        const est = colorEstado[p.estado] ?? colorEstado.PENDIENTE;
                        const niv = p.nivelCumplimiento ? colorNivel[p.nivelCumplimiento] : null;
                        const pct = p.puntajeObtenido != null ? Math.round((p.puntajeObtenido / (p.puntajeMaximo ?? 300)) * 100) : null;
                        const isExpanded = expandida === p.id;

                        return (
                            <div key={p.id} className="card" style={{ padding: "1rem 1.25rem", border: `1px solid ${est.border}` }}>
                                {/* Header */}
                                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text)" }}>{p.asignatura}</span>
                                            <span style={{ fontSize: "0.7rem", background: "#f1f5f9", color: "var(--text-muted)", padding: "2px 8px", borderRadius: "4px" }}>
                                                {p.semestre}° Sem. {p.semestre >= 5 ? "· Progresiones" : "· Propósitos Formativos"}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                                            {p.docenteNombre} {p.bloqueCorte ? `· ${p.bloqueCorte}` : ""}
                                        </div>
                                    </div>

                                    {/* Estado y puntaje */}
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem" }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: est.bg, color: est.text, border: `1px solid ${est.border}`, borderRadius: "8px", padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600 }}>
                                            {est.icon} {est.label}
                                        </span>
                                        {pct !== null && niv && (
                                            <span style={{ background: niv.bg, color: niv.text, borderRadius: "8px", padding: "2px 8px", fontSize: "0.7rem", fontWeight: 700 }}>
                                                {p.puntajeObtenido} / {p.puntajeMaximo} pts ({pct}%)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Barra de progreso */}
                                {pct !== null && (
                                    <div style={{ marginTop: "0.75rem", height: "6px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 85 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626", borderRadius: "99px", transition: "width 0.6s ease" }} />
                                    </div>
                                )}

                                {/* Botones */}
                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                                    {p.estado === "REVISADO" && (
                                        <>
                                            <button
                                                onClick={() => setExpandida(isExpanded ? null : p.id)}
                                                style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "4px 12px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600 }}
                                            >
                                                <BookOpen size={13} />
                                                {isExpanded ? "Ocultar dictamen" : "Ver dictamen completo"}
                                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </button>
                                            <button
                                                onClick={() => handleDescargarWord(p)}
                                                disabled={generandoWord === p.id}
                                                style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "4px 12px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600 }}
                                            >
                                                {generandoWord === p.id ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={13} />}
                                                Retroalimentación (.docx)
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handleEliminar(p.id)}
                                        disabled={eliminando === p.id}
                                        style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", padding: "4px 10px", fontSize: "0.78rem", cursor: "pointer" }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                    <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                        {new Date(p.fechaSubida).toLocaleDateString("es-MX")}
                                    </span>
                                </div>

                                {/* Dictamen expandido */}
                                {isExpanded && p.resultadoJson && (
                                    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                                        {/* Puntos fuertes */}
                                        {(p.observacionesJson?.puntosFuertes?.length ?? 0) > 0 && (
                                            <div style={{ marginBottom: "1rem" }}>
                                                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#16a34a", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                    <Star size={14} /> Fortalezas
                                                </h4>
                                                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                                                    {p.observacionesJson!.puntosFuertes.map((f, i) => <li key={i} style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>{f}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Mejoras urgentes */}
                                        {(p.observacionesJson?.mejorasUrgentes?.length ?? 0) > 0 && (
                                            <div style={{ marginBottom: "1rem" }}>
                                                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#dc2626", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                    <AlertTriangle size={14} /> Mejoras urgentes
                                                </h4>
                                                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                                                    {p.observacionesJson!.mejorasUrgentes.map((m, i) => <li key={i} style={{ fontSize: "0.82rem", color: "#7f1d1d", marginBottom: "0.25rem" }}>{m}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Tabla de criterios */}
                                        <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>
                                            Evaluación por Criterio (Anexo 12 USICAMM)
                                        </h4>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                                                <thead>
                                                    <tr style={{ background: "#2E5F9A", color: "white" }}>
                                                        {["Criterio", "Pts Máx", "Pts Obtenidos", "Cumple", "Observación / Recomendación"].map(h => (
                                                            <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {p.resultadoJson.criterios.map((c, i) => (
                                                        <tr key={c.id} style={{ background: i % 2 === 0 ? "#EFF5FB" : "white" }}>
                                                            <td style={{ padding: "6px 8px", fontWeight: 500 }}>{c.criterio}</td>
                                                            <td style={{ padding: "6px 8px", textAlign: "center" }}>{c.puntajeMax}</td>
                                                            <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: c.cumple === "SI" ? "#16a34a" : c.cumple === "PARCIAL" ? "#d97706" : "#dc2626" }}>
                                                                {c.puntajeObtenido}
                                                            </td>
                                                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                                                <span style={{ background: c.cumple === "SI" ? "#dcfce7" : c.cumple === "PARCIAL" ? "#fef9c3" : "#fee2e2", color: c.cumple === "SI" ? "#16a34a" : c.cumple === "PARCIAL" ? "#d97706" : "#dc2626", borderRadius: "4px", padding: "2px 6px", fontWeight: 600, fontSize: "0.72rem" }}>
                                                                    {c.cumple === "SI" ? "✓ Sí" : c.cumple === "PARCIAL" ? "⚠ Parcial" : "✗ No"}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>
                                                                {c.observacion}
                                                                {c.recomendacion && c.cumple !== "SI" && (
                                                                    <div style={{ marginTop: "0.25rem", fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                                                        → {c.recomendacion}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Alineación PAEC-PEC */}
                                        {p.observacionesJson?.alineacionPaecPec && (
                                            <div style={{ marginTop: "1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.75rem" }}>
                                                <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "#166534", marginBottom: "0.35rem" }}>Alineación con el PAEC-PEC</h4>
                                                <p style={{ fontSize: "0.8rem", color: "#14532d", margin: 0, lineHeight: 1.5 }}>{p.observacionesJson.alineacionPaecPec}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
