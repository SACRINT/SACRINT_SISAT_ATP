"use client";

import { useMemo } from "react";
import { BookOpen, FileText, FileImage, Film, Table2, FileArchive, Download, ExternalLink } from "lucide-react";
import { RecursoDirector } from "@/types/director";
import { getDownloadUrl } from "@/lib/download-url";

// ─── Helpers ───────────────────────────────────────────────

function getFileIcon(nombre: string | null) {
    if (!nombre) return <FileText size={20} />;
    const ext = nombre.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(ext)) return <FileText size={20} style={{ color: "#ef4444" }} />;
    if (["doc", "docx"].includes(ext)) return <FileText size={20} style={{ color: "#3b82f6" }} />;
    if (["xls", "xlsx", "csv"].includes(ext)) return <Table2 size={20} style={{ color: "#22c55e" }} />;
    if (["ppt", "pptx"].includes(ext)) return <FileText size={20} style={{ color: "#f97316" }} />;
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return <FileImage size={20} style={{ color: "#8b5cf6" }} />;
    if (["mp4", "avi", "mov", "mkv"].includes(ext)) return <Film size={20} style={{ color: "#ec4899" }} />;
    if (["zip", "rar", "7z"].includes(ext)) return <FileArchive size={20} style={{ color: "#6b7280" }} />;
    return <FileText size={20} style={{ color: "var(--primary)" }} />;
}

function formatDate(dateStr?: string) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Component ─────────────────────────────────────────────

export default function RecursosListado({ recursos }: { recursos: RecursoDirector[] }) {

    // Group by programa; resources without a program go under "General"
    const grupos = useMemo(() => {
        const map = new Map<string, { nombre: string; items: RecursoDirector[] }>();

        for (const rec of recursos) {
            const key = rec.programa?.id || "__general__";
            const nombre = rec.programa?.nombre || "Generales";
            if (!map.has(key)) map.set(key, { nombre, items: [] });
            map.get(key)!.items.push(rec);
        }

        // Sort: named programs first (alphabetical), then General
        return Array.from(map.entries())
            .sort(([a], [b]) => {
                if (a === "__general__") return 1;
                if (b === "__general__") return -1;
                return (map.get(a)!.nombre).localeCompare(map.get(b)!.nombre);
            })
            .map(([, group]) => group);
    }, [recursos]);

    if (recursos.length === 0) {
        return (
            <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", color: "var(--text-muted)" }}>
                <BookOpen size={48} style={{ margin: "0 auto 1rem", opacity: 0.25, display: "block" }} />
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>Sin recursos disponibles</h3>
                <p style={{ margin: 0, fontSize: "0.875rem" }}>
                    Cuando la supervisión suba manuales, lineamientos o formatos, aparecerán aquí agrupados por programa.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {grupos.map(grupo => (
                <div key={grupo.nombre}>
                    {/* Group header */}
                    <div style={{
                        fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.07em", color: "var(--text-muted)",
                        marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                        {grupo.nombre}
                        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                    </div>

                    {/* Resource cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {grupo.items.map(rec => (
                            <div
                                key={rec.id}
                                className="card"
                                style={{
                                    display: "flex", alignItems: "center", gap: "0.875rem",
                                    padding: "0.875rem 1rem",
                                    transition: "box-shadow 0.15s ease, transform 0.15s ease",
                                }}
                            >
                                {/* File type icon */}
                                <div style={{
                                    width: "40px", height: "40px", borderRadius: "10px",
                                    background: "var(--bg-secondary)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    {getFileIcon(rec.archivoNombre)}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", wordBreak: "break-word" }}>
                                        {rec.titulo}
                                    </div>
                                    {rec.descripcion && (
                                        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.125rem", wordBreak: "break-word" }}>
                                            {rec.descripcion}
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: "0.7rem", color: "var(--text-muted)",
                                        display: "flex", alignItems: "center", gap: "0.375rem",
                                        marginTop: "0.25rem", flexWrap: "wrap",
                                    }}>
                                        {rec.archivoNombre && (
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                                <FileText size={11} /> {rec.archivoNombre}
                                            </span>
                                        )}
                                        {rec.createdAt && (
                                            <span>· {formatDate(rec.createdAt)}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Download button */}
                                {rec.archivoDriveUrl && (
                                    <a
                                        href={getDownloadUrl(rec.archivoDriveUrl, rec.archivoNombre || undefined, rec.archivoDriveId || undefined) || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-primary"
                                        style={{ padding: "0.5rem 0.875rem", minHeight: "auto", flexShrink: 0, fontSize: "0.8125rem" }}
                                        title={`Descargar: ${rec.titulo}`}
                                    >
                                        <Download size={15} />
                                        Descargar
                                    </a>
                                )}
                                {!rec.archivoDriveUrl && rec.externalUrl && (
                                    <a
                                        href={rec.externalUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-outline"
                                        style={{ padding: "0.5rem 0.875rem", minHeight: "auto", flexShrink: 0, fontSize: "0.8125rem" }}
                                    >
                                        <ExternalLink size={15} />
                                        Ver
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
