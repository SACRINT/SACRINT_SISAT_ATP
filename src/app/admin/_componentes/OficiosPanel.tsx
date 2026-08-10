"use client";

/**
 * ATP-MOD-01 — Panel "Gestión de Oficios y Plazos"
 *
 * Características:
 * - Semáforo de criticidad (ROJO / AMARILLO / VERDE) con umbrales configurables
 * - Carga de PDF + extracción IA de metadatos
 * - Registro manual de oficios
 * - Tabla paginada con filtros por estado y criticidad
 * - Vista de detalle con destinatarios y botón de acuse
 * - Tab de Configuración (OficioConfig)
 *
 * Reglas de diseño:
 * - Cero hardcodes: tenantId desde useSession; umbrales desde BD
 * - Estilo: igual que AuditoriaInteligentePanel (Tailwind + lucide-react + react-hot-toast)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
    FileText,
    Upload,
    Plus,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Clock,
    XCircle,
    Eye,
    Settings,
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    Building2,
    Send,
    Check,
    Sliders,
    Bot,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type CriticidadOficio = "VERDE" | "AMARILLO" | "ROJO";
type EstadoOficio = "RECIBIDO" | "ENVIADO" | "ACUSADO" | "VENCIDO" | "CANCELADO";

interface OficioDestinatario {
    id: string;
    escuelaNombre: string;
    emailDestino: string | null;
    acuseRecibido: boolean;
    confirmadoATP: boolean;
    fechaAcuse: string | null;
}

interface Oficio {
    id: string;
    numeroOficio: string;
    asunto: string;
    remitenteNombre: string | null;
    remitenteEmail: string | null;
    fechaLimite: string | null;
    criticidad: CriticidadOficio;
    estado: EstadoOficio;
    esRecibido: boolean;
    notas: string | null;
    iaProcessed: boolean;
    createdAt: string;
    _count?: { destinatarios: number };
    destinatarios?: OficioDestinatario[];
}

interface OficioConfig {
    umbralRojoHoras: number;
    umbralAmarilloHoras: number;
    recordatorios48h: boolean;
    recordatorios12h: boolean;
    horaIngesta: string | null;
    cuentaRemitente: string | null;
}

// ── Helpers visuales ──────────────────────────────────────────────────────────

const CRITICIDAD_STYLES: Record<CriticidadOficio, { bg: string; text: string; dot: string; label: string }> = {
    ROJO: { bg: "bg-red-500/20", text: "text-red-300", dot: "bg-red-500", label: "Urgente" },
    AMARILLO: { bg: "bg-yellow-500/20", text: "text-yellow-300", dot: "bg-yellow-500", label: "Próximo" },
    VERDE: { bg: "bg-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-500", label: "En tiempo" },
};

const ESTADO_STYLES: Record<EstadoOficio, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    RECIBIDO: { bg: "bg-blue-500/20", text: "text-blue-300", label: "Recibido", icon: <FileText className="w-3 h-3" /> },
    ENVIADO: { bg: "bg-purple-500/20", text: "text-purple-300", label: "Enviado", icon: <Send className="w-3 h-3" /> },
    ACUSADO: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "Acusado", icon: <CheckCircle className="w-3 h-3" /> },
    VENCIDO: { bg: "bg-red-500/20", text: "text-red-300", label: "Vencido", icon: <XCircle className="w-3 h-3" /> },
    CANCELADO: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Cancelado", icon: <XCircle className="w-3 h-3" /> },
};

function diasRestantes(fechaLimite: string | null): string {
    if (!fechaLimite) return "—";
    const diff = new Date(fechaLimite).getTime() - Date.now();
    if (diff < 0) return "Vencido";
    const horas = Math.floor(diff / (1000 * 60 * 60));
    if (horas < 24) return `${horas}h restantes`;
    const dias = Math.floor(horas / 24);
    return `${dias} día${dias !== 1 ? "s" : ""}`;
}

// ── Componente Principal ──────────────────────────────────────────────────────

export default function OficiosPanel() {
    const { data: session } = useSession();
    const [tab, setTab] = useState<"lista" | "nuevo" | "config">("lista");
    const [oficios, setOficios] = useState<Oficio[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<OficioConfig | null>(null);

    // Filtros
    const [filtroEstado, setFiltroEstado] = useState("");
    const [filtroCriticidad, setFiltroCriticidad] = useState("");
    const [busqueda, setBusqueda] = useState("");

    // Detalle
    const [detalle, setDetalle] = useState<Oficio | null>(null);

    // Cargar oficios
    const cargarOficios = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "20",
                ...(filtroEstado ? { estado: filtroEstado } : {}),
                ...(filtroCriticidad ? { criticidad: filtroCriticidad } : {}),
                ...(busqueda ? { q: busqueda } : {}),
            });
            const res = await fetch(`/api/admin/oficios?${params}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setOficios(data.oficios);
            setTotal(data.total);
            setTotalPages(data.totalPages);
            if (data.config) setConfig(data.config);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al cargar oficios");
        } finally {
            setLoading(false);
        }
    }, [page, filtroEstado, filtroCriticidad, busqueda]);

    useEffect(() => {
        cargarOficios();
    }, [cargarOficios]);

    const abrirDetalle = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/oficios/${id}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setDetalle(data.oficio);
        } catch {
            toast.error("Error al cargar detalle");
        }
    };

    const registrarAcuse = async (oficioId: string, destinatarioId: string) => {
        try {
            const res = await fetch(`/api/admin/oficios/${oficioId}/acusar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ destinatarioId }),
            });
            if (!res.ok) throw new Error();
            toast.success("Acuse registrado");
            await abrirDetalle(oficioId);
            cargarOficios();
        } catch {
            toast.error("Error al registrar acuse");
        }
    };

    // Resumen estadístico rápido
    const urgentes = oficios.filter((o) => o.criticidad === "ROJO" && o.estado !== "CANCELADO").length;
    const proximos = oficios.filter((o) => o.criticidad === "AMARILLO" && o.estado !== "CANCELADO").length;

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        Gestión de Oficios y Plazos
                    </h2>
                    <p className="text-sm text-white/50 mt-0.5">
                        Módulo ATP-MOD-01 · {total} oficio{total !== 1 ? "s" : ""} registrados
                    </p>
                </div>
                {/* Resumen semáforo */}
                <div className="flex gap-2">
                    {urgentes > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            {urgentes} urgente{urgentes !== 1 ? "s" : ""}
                        </span>
                    )}
                    {proximos > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-300 text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            {proximos} próximo{proximos !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
                {(["lista", "nuevo", "config"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            tab === t
                                ? "bg-indigo-600 text-white"
                                : "text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                    >
                        {t === "lista" && <><FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Lista</>}
                        {t === "nuevo" && <><Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Registrar</>}
                        {t === "config" && <><Sliders className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Configuración</>}
                    </button>
                ))}
            </div>

            {/* ════════════ TAB: LISTA ════════════ */}
            {tab === "lista" && (
                <div className="space-y-3">
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                placeholder="Buscar número, asunto, remitente…"
                                value={busqueda}
                                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-indigo-400"
                            />
                        </div>
                        <select
                            value={filtroEstado}
                            onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="">Todos los estados</option>
                            <option value="RECIBIDO">Recibido</option>
                            <option value="ENVIADO">Enviado</option>
                            <option value="ACUSADO">Acusado</option>
                            <option value="VENCIDO">Vencido</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>
                        <select
                            value={filtroCriticidad}
                            onChange={(e) => { setFiltroCriticidad(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="">Toda criticidad</option>
                            <option value="ROJO">🔴 Urgente</option>
                            <option value="AMARILLO">🟡 Próximo</option>
                            <option value="VERDE">🟢 En tiempo</option>
                        </select>
                        <button
                            onClick={cargarOficios}
                            disabled={loading}
                            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white/80 hover:bg-white/20 transition-colors"
                            title="Actualizar"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    {/* Tabla */}
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        {loading ? (
                            <div className="py-16 text-center text-white/40">
                                <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                                Cargando oficios…
                            </div>
                        ) : oficios.length === 0 ? (
                            <div className="py-16 text-center text-white/40">
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p>Sin oficios que mostrar</p>
                                <button
                                    onClick={() => setTab("nuevo")}
                                    className="mt-3 text-sm text-indigo-400 hover:text-indigo-300"
                                >
                                    + Registrar el primero
                                </button>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-white/50 text-xs">
                                        <th className="text-left px-4 py-3 font-medium">Sem.</th>
                                        <th className="text-left px-4 py-3 font-medium">Número / Asunto</th>
                                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Remitente</th>
                                        <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Plazo</th>
                                        <th className="text-left px-4 py-3 font-medium">Estado</th>
                                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Escuelas</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {oficios.map((oficio) => {
                                        const crit = CRITICIDAD_STYLES[oficio.criticidad];
                                        const est = ESTADO_STYLES[oficio.estado];
                                        return (
                                            <tr
                                                key={oficio.id}
                                                className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                                            >
                                                {/* Semáforo */}
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${crit.bg} ${crit.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${crit.dot} ${oficio.criticidad === "ROJO" ? "animate-pulse" : ""}`} />
                                                        {crit.label}
                                                    </span>
                                                </td>
                                                {/* Número / Asunto */}
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-white">{oficio.numeroOficio}</p>
                                                    <p className="text-white/50 text-xs truncate max-w-[200px]">{oficio.asunto}</p>
                                                    {oficio.iaProcessed && (
                                                        <span className="inline-flex items-center gap-0.5 text-xs text-indigo-400/80 mt-0.5">
                                                            <Bot className="w-3 h-3" /> IA
                                                        </span>
                                                    )}
                                                </td>
                                                {/* Remitente */}
                                                <td className="px-4 py-3 hidden md:table-cell text-white/60 text-xs">
                                                    {oficio.remitenteNombre || oficio.remitenteEmail || "—"}
                                                </td>
                                                {/* Plazo */}
                                                <td className="px-4 py-3 hidden lg:table-cell">
                                                    {oficio.fechaLimite ? (
                                                        <div>
                                                            <p className="text-white/70 text-xs">
                                                                {new Date(oficio.fechaLimite).toLocaleDateString("es-MX")}
                                                            </p>
                                                            <p className={`text-xs ${oficio.criticidad === "ROJO" ? "text-red-400" : oficio.criticidad === "AMARILLO" ? "text-yellow-400" : "text-emerald-400"}`}>
                                                                {diasRestantes(oficio.fechaLimite)}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-white/30 text-xs">Sin plazo</span>
                                                    )}
                                                </td>
                                                {/* Estado */}
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${est.bg} ${est.text}`}>
                                                        {est.icon}
                                                        {est.label}
                                                    </span>
                                                </td>
                                                {/* Escuelas */}
                                                <td className="px-4 py-3 hidden md:table-cell text-white/50 text-xs">
                                                    {oficio._count?.destinatarios ?? 0} dest.
                                                </td>
                                                {/* Acción */}
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => abrirDetalle(oficio.id)}
                                                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs flex items-center gap-1 ml-auto transition-colors"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        Ver
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm text-white/50">
                            <span>Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}</span>
                            <div className="flex gap-1">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="px-2 py-1 rounded bg-white/10 disabled:opacity-30 hover:bg-white/20 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-3 py-1 bg-white/5 rounded">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="px-2 py-1 rounded bg-white/10 disabled:opacity-30 hover:bg-white/20 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Modal de Detalle ── */}
                    {detalle && (
                        <DetalleOficioModal
                            oficio={detalle}
                            onClose={() => setDetalle(null)}
                            onAcuse={registrarAcuse}
                            onRefresh={() => { cargarOficios(); if (detalle) abrirDetalle(detalle.id); }}
                        />
                    )}
                </div>
            )}

            {/* ════════════ TAB: NUEVO ════════════ */}
            {tab === "nuevo" && (
                <RegistrarOficioPanel onSuccess={() => { setTab("lista"); cargarOficios(); }} />
            )}

            {/* ════════════ TAB: CONFIGURACIÓN ════════════ */}
            {tab === "config" && (
                <ConfigOficiosPanel initialConfig={config} onSaved={() => cargarOficios()} />
            )}
        </div>
    );
}

/**
 * Comprime imágenes en el cliente si su tamaño excede 3 MB.
 * Reencoda usando <canvas> a máx 2048 px por lado mayor y calidad JPEG 0.8.
 */
async function comprimirImagenCliente(file: File): Promise<{ file: File; comprimido: boolean; origMb: string; nuevoMb: string }> {
    const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|tiff|heic)$/i.test(file.name);
    const LIMIT_3MB = 3 * 1024 * 1024;

    if (!isImage || file.size <= LIMIT_3MB) {
        return { file, comprimido: false, origMb: "", nuevoMb: "" };
    }

    const origMb = (file.size / (1024 * 1024)).toFixed(2);

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let { width, height } = img;
                const maxDim = 2048;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
                            return;
                        }
                        const newName = file.name.replace(/\.[^/.]+$/, ".jpg");
                        const compressedFile = new File([blob], newName, {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        });
                        const nuevoMb = (compressedFile.size / (1024 * 1024)).toFixed(2);
                        console.log(`[Cliente] Imagen comprimida de ${origMb}MB a ${nuevoMb}MB (${width}x${height}px)`);
                        resolve({ file: compressedFile, comprimido: true, origMb, nuevoMb });
                    },
                    "image/jpeg",
                    0.8
                );
            };
            img.onerror = () => resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
            img.src = e.target?.result as string;
        };
        reader.onerror = () => resolve({ file, comprimido: false, origMb: "", nuevoMb: "" });
        reader.readAsDataURL(file);
    });
}

// ── Sub-componente: Registrar Oficio ─────────────────────────────────────────

function RegistrarOficioPanel({ onSuccess }: { onSuccess: () => void }) {
    const [modo, setModo] = useState<"archivo" | "manual">("archivo");
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Campos formulario
    const [numeroOficio, setNumeroOficio] = useState("");
    const [asunto, setAsunto] = useState("");
    const [fechaLimite, setFechaLimite] = useState("");
    const [remitente, setRemitente] = useState("");
    const [notas, setNotas] = useState("");
    const [usarIA, setUsarIA] = useState(true);
    const [archivo, setArchivo] = useState<File | null>(null);
    const [iaPreview, setIaPreview] = useState<Record<string, unknown> | null>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (modo === "archivo" && !archivo) {
            toast.error("Selecciona un archivo PDF o imagen");
            return;
        }
        if (!numeroOficio.trim()) { toast.error("Número de oficio requerido"); return; }

        setUploading(true);
        try {
            let res: Response;
            if (modo === "archivo" && archivo) {
                let archivoSubir = archivo;

                // Compresión cliente para imágenes > 3 MB
                if (archivo.size > 3 * 1024 * 1024 && (archivo.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|tiff|heic)$/i.test(archivo.name))) {
                    toast(`Optimizando imagen pesada (${(archivo.size / (1024 * 1024)).toFixed(2)} MB)...`);
                    const resComp = await comprimirImagenCliente(archivo);
                    if (resComp.comprimido) {
                        archivoSubir = resComp.file;
                        toast.success(`Imagen comprimida a ${resComp.nuevoMb} MB (máx 2048px, JPEG 0.8)`);
                    }
                }

                const fd = new FormData();
                fd.append("archivo", archivoSubir);
                fd.append("numeroOficio", numeroOficio.trim());
                if (asunto) fd.append("asunto", asunto);
                if (fechaLimite) fd.append("fechaLimite", fechaLimite);
                fd.append("usarIA", String(usarIA));
                res = await fetch("/api/admin/oficios/upload", { method: "POST", body: fd });
            } else {
                if (!asunto.trim()) { toast.error("Asunto requerido"); setUploading(false); return; }
                res = await fetch("/api/admin/oficios", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        numeroOficio: numeroOficio.trim(),
                        asunto: asunto.trim(),
                        remitenteNombre: remitente.trim() || undefined,
                        fechaLimite: fechaLimite || undefined,
                        notas: notas.trim() || undefined,
                        esRecibido: true,
                    }),
                });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al registrar");

            if (data.metadatosIA) setIaPreview(data.metadatosIA as Record<string, unknown>);
            toast.success(`Oficio ${numeroOficio} registrado correctamente`);
            onSuccess();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al registrar oficio");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-2xl space-y-5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Registrar Oficio
            </h3>

            {/* Modo */}
            <div className="flex gap-2">
                {(["archivo", "manual"] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => setModo(m)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            modo === m
                                ? "bg-indigo-600 border-indigo-500 text-white"
                                : "bg-white/5 border-white/20 text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                    >
                        {m === "archivo" ? <><Upload className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Subir PDF / Imagen</> : <><FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Registro Manual</>}
                    </button>
                ))}
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
                {/* Número de oficio */}
                <div>
                    <label className="block text-xs font-medium text-white/60 mb-1">Número de oficio *</label>
                    <input
                        type="text"
                        value={numeroOficio}
                        onChange={(e) => setNumeroOficio(e.target.value)}
                        placeholder="Ej. SEPPUE/DGEMS/ATP/0123/2025"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-400"
                        required
                    />
                </div>

                {/* Archivo (modo archivo) */}
                {modo === "archivo" && (
                    <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Archivo PDF / Imagen *</label>
                        <div
                            className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                            onClick={() => fileRef.current?.click()}
                        >
                            {archivo ? (
                                <p className="text-emerald-400 text-sm font-medium">{archivo.name} ({(archivo.size / (1024 * 1024)).toFixed(2)} MB)</p>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 mx-auto text-white/30 mb-2" />
                                    <p className="text-white/50 text-sm">Click para seleccionar o arrastra aquí</p>
                                    <p className="text-white/30 text-xs mt-1">PDF, JPG, PNG, TIFF, HEIC — máx 25 MB (imágenes &gt; 3 MB se optimizan automáticamente)</p>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.tiff,.heic"
                            className="hidden"
                            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                        />
                        {/* Opción IA */}
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={usarIA}
                                onChange={(e) => setUsarIA(e.target.checked)}
                                className="rounded border-white/30 bg-white/10 text-indigo-500"
                            />
                            <span className="text-xs text-white/60 flex items-center gap-1">
                                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                                Extraer metadatos con IA (Gemini)
                            </span>
                        </label>
                    </div>
                )}

                {/* Asunto */}
                <div>
                    <label className="block text-xs font-medium text-white/60 mb-1">
                        Asunto {modo === "manual" ? "*" : "(opcional, IA lo detecta)"}
                    </label>
                    <input
                        type="text"
                        value={asunto}
                        onChange={(e) => setAsunto(e.target.value)}
                        placeholder="Asunto del oficio…"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-400"
                        required={modo === "manual"}
                    />
                </div>

                {/* Remitente (manual) */}
                {modo === "manual" && (
                    <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Remitente</label>
                        <input
                            type="text"
                            value={remitente}
                            onChange={(e) => setRemitente(e.target.value)}
                            placeholder="Nombre del firmante o área emisora"
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-400"
                        />
                    </div>
                )}

                {/* Fecha límite */}
                <div>
                    <label className="block text-xs font-medium text-white/60 mb-1">Fecha límite (opcional)</label>
                    <input
                        type="date"
                        value={fechaLimite}
                        onChange={(e) => setFechaLimite(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-400"
                    />
                </div>

                {/* Notas */}
                <div>
                    <label className="block text-xs font-medium text-white/60 mb-1">Notas internas</label>
                    <textarea
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        rows={2}
                        placeholder="Observaciones, instrucciones especiales…"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={uploading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                    {uploading ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Registrando{usarIA && modo === "archivo" ? " + extrayendo con IA" : ""}…</>
                    ) : (
                        <><Check className="w-4 h-4" /> Registrar Oficio</>
                    )}
                </button>
            </form>
        </div>
    );
}

// ── Sub-componente: Detalle Modal ────────────────────────────────────────────

function DetalleOficioModal({
    oficio,
    onClose,
    onAcuse,
    onRefresh,
}: {
    oficio: Oficio;
    onClose: () => void;
    onAcuse: (oficioId: string, destinatarioId: string) => void;
    onRefresh: () => void;
}) {
    const crit = CRITICIDAD_STYLES[oficio.criticidad];
    const est = ESTADO_STYLES[oficio.estado];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">{oficio.numeroOficio}</h3>
                        <p className="text-white/60 text-sm mt-0.5">{oficio.asunto}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/40 hover:text-white transition-colors p-1"
                    >
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${crit.bg} ${crit.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${crit.dot}`} /> {crit.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${est.bg} ${est.text}`}>
                        {est.icon} {est.label}
                    </span>
                    {oficio.iaProcessed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-indigo-500/20 text-indigo-300">
                            <Bot className="w-3 h-3" /> Metadatos por IA
                        </span>
                    )}
                </div>

                {/* Datos */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    {oficio.remitenteNombre && (
                        <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-white/40 text-xs mb-0.5">Remitente</p>
                            <p className="text-white font-medium">{oficio.remitenteNombre}</p>
                            {oficio.remitenteEmail && <p className="text-white/50 text-xs">{oficio.remitenteEmail}</p>}
                        </div>
                    )}
                    {oficio.fechaLimite && (
                        <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-white/40 text-xs mb-0.5">Fecha límite</p>
                            <p className="text-white font-medium">
                                {new Date(oficio.fechaLimite).toLocaleDateString("es-MX", { dateStyle: "long" })}
                            </p>
                            <p className={`text-xs mt-0.5 ${oficio.criticidad === "ROJO" ? "text-red-400" : oficio.criticidad === "AMARILLO" ? "text-yellow-400" : "text-emerald-400"}`}>
                                {diasRestantes(oficio.fechaLimite)}
                            </p>
                        </div>
                    )}
                    {oficio.notas && (
                        <div className="bg-white/5 rounded-lg p-3 col-span-2">
                            <p className="text-white/40 text-xs mb-0.5">Notas</p>
                            <p className="text-white/80 text-xs">{oficio.notas}</p>
                        </div>
                    )}
                </div>

                {/* Destinatarios */}
                {oficio.destinatarios && oficio.destinatarios.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-indigo-400" />
                            Escuelas destinatarias ({oficio.destinatarios.length})
                        </h4>
                        <div className="space-y-2">
                            {oficio.destinatarios.map((dest) => (
                                <div
                                    key={dest.id}
                                    className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                                >
                                    <div>
                                        <p className="text-white text-sm font-medium">{dest.escuelaNombre}</p>
                                        {dest.emailDestino && (
                                            <p className="text-white/40 text-xs">{dest.emailDestino}</p>
                                        )}
                                        {dest.fechaAcuse && (
                                            <p className="text-emerald-400 text-xs mt-0.5">
                                                Acuse: {new Date(dest.fechaAcuse).toLocaleDateString("es-MX")}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {dest.acuseRecibido ? (
                                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                                                <CheckCircle className="w-3.5 h-3.5" /> Acusado
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => onAcuse(oficio.id, dest.id)}
                                                className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded text-xs flex items-center gap-1 transition-colors"
                                            >
                                                <Check className="w-3 h-3" /> Registrar acuse
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Sub-componente: Configuración ────────────────────────────────────────────

function ConfigOficiosPanel({
    initialConfig,
    onSaved,
}: {
    initialConfig: OficioConfig | null;
    onSaved: () => void;
}) {
    const [config, setConfig] = useState<OficioConfig>(
        initialConfig ?? {
            umbralRojoHoras: 48,
            umbralAmarilloHoras: 120,
            recordatorios48h: true,
            recordatorios12h: true,
            horaIngesta: null,
            cuentaRemitente: null,
        }
    );
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/admin/oficios/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al guardar");
            toast.success("Configuración guardada");
            onSaved();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al guardar config");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-lg space-y-5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Configuración de Oficios
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
                {/* Umbrales de semáforo */}
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-white/80 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        Umbrales del semáforo
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-white/50 mb-1">🔴 Umbral ROJO (horas)</label>
                            <input
                                type="number"
                                min={1}
                                value={config.umbralRojoHoras}
                                onChange={(e) => setConfig((c) => ({ ...c, umbralRojoHoras: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-red-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1">🟡 Umbral AMARILLO (horas)</label>
                            <input
                                type="number"
                                min={1}
                                value={config.umbralAmarilloHoras}
                                onChange={(e) => setConfig((c) => ({ ...c, umbralAmarilloHoras: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-400"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-white/30">
                        ROJO: ≤ {config.umbralRojoHoras}h · AMARILLO: ≤ {config.umbralAmarilloHoras}h · VERDE: &gt; {config.umbralAmarilloHoras}h
                    </p>
                </div>

                {/* Recordatorios */}
                <div className="bg-white/5 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-white/80 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        Recordatorios automáticos
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.recordatorios48h}
                            onChange={(e) => setConfig((c) => ({ ...c, recordatorios48h: e.target.checked }))}
                            className="rounded border-white/30 bg-white/10 text-indigo-500"
                        />
                        <span className="text-sm text-white/70">Recordatorio 48 horas antes del plazo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.recordatorios12h}
                            onChange={(e) => setConfig((c) => ({ ...c, recordatorios12h: e.target.checked }))}
                            className="rounded border-white/30 bg-white/10 text-indigo-500"
                        />
                        <span className="text-sm text-white/70">Recordatorio 12 horas antes del plazo</span>
                    </label>
                </div>

                {/* Cuenta remitente */}
                <div>
                    <label className="block text-xs font-medium text-white/60 mb-1">Cuenta remitente (SMTP)</label>
                    <input
                        type="email"
                        value={config.cuentaRemitente ?? ""}
                        onChange={(e) => setConfig((c) => ({ ...c, cuentaRemitente: e.target.value || null }))}
                        placeholder="correo@supervision.edu.mx"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-400"
                    />
                    <p className="text-xs text-white/30 mt-1">
                        Deja vacío para usar SMTP_USER del entorno. El envío real de correos requiere configuración SMTP en variables de entorno.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                    {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando…</> : <><Check className="w-4 h-4" /> Guardar Configuración</>}
                </button>
            </form>
        </div>
    );
}
