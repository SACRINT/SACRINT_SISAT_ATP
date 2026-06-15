"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";

interface PdfViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
    downloadUrl?: string; // optional override for download (proxy URL)
}

/** Returns the lowercase extension of a URL or filename */
function getExt(url: string): string {
    try {
        const path = new URL(url).pathname;
        const match = path.match(/\.([a-z0-9]+)(\?|$)/i);
        return match ? match[1].toLowerCase() : "";
    } catch {
        const match = url.match(/\.([a-z0-9]+)(\?|$)/i);
        return match ? match[1].toLowerCase() : "";
    }
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"]);
const PDF_EXTS = new Set(["pdf"]);

export default function PdfViewerModal({ isOpen, onClose, url, title, downloadUrl }: PdfViewerModalProps) {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);

    const ext = getExt(url);
    const isImage = IMAGE_EXTS.has(ext);
    const isPdf = PDF_EXTS.has(ext);
    // For unknown types try to render as PDF (many browsers handle it)
    const renderAs: "image" | "pdf" | "iframe" = isImage ? "image" : isPdf ? "pdf" : "iframe";

    useEffect(() => {
        if (!isOpen) return;
        // Reset state on new file
        setZoom(100);
        setRotation(0);
        setImgLoaded(false);
        setImgError(false);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 10, 300));
            if (e.key === "-") setZoom(z => Math.max(z - 10, 20));
        };

        window.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose, url]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(10, 15, 30, 0.85)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "0.75rem",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    width: "100%",
                    maxWidth: "1100px",
                    height: "92vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
                    overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div
                    style={{
                        padding: "0.75rem 1rem",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--surface)",
                        gap: "0.5rem",
                        flexShrink: 0,
                    }}
                >
                    {/* Title */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: "0.9375rem",
                                fontWeight: 700,
                                color: "var(--text)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                            title={title}
                        >
                            {title}
                        </h3>
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {ext.toUpperCase() || "Documento"}
                        </span>
                    </div>

                    {/* Controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
                        {/* Zoom controls — only for images */}
                        {renderAs === "image" && (
                            <>
                                <button
                                    onClick={() => setZoom(z => Math.max(z - 10, 20))}
                                    style={btnStyle}
                                    title="Alejar (−)"
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", minWidth: "3rem", textAlign: "center" }}>
                                    {zoom}%
                                </span>
                                <button
                                    onClick={() => setZoom(z => Math.min(z + 10, 300))}
                                    style={btnStyle}
                                    title="Acercar (+)"
                                >
                                    <ZoomIn size={16} />
                                </button>
                                <button
                                    onClick={() => setRotation(r => (r + 90) % 360)}
                                    style={btnStyle}
                                    title="Rotar"
                                >
                                    <RotateCw size={16} />
                                </button>
                                <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.125rem" }} />
                            </>
                        )}

                        {/* Download */}
                        <a
                            href={downloadUrl || url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, padding: "0.375rem 0.625rem", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-secondary)" }}
                            title="Descargar"
                        >
                            <Download size={14} />
                            <span>Descargar</span>
                        </a>

                        {/* Open in new tab */}
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, padding: "0.375rem 0.625rem", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-secondary)" }}
                            title="Abrir en pestaña nueva"
                        >
                            <ExternalLink size={14} />
                            <span>Abrir</span>
                        </a>

                        {/* Close */}
                        <button
                            onClick={onClose}
                            style={{ ...btnStyle, color: "var(--text-muted)", padding: "0.375rem" }}
                            title="Cerrar (Esc)"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ── Content area ── */}
                <div
                    style={{
                        flex: 1,
                        overflow: "auto",
                        background: renderAs === "image" ? "#1a1a2e" : "#f1f5f9",
                        display: "flex",
                        alignItems: renderAs === "image" ? "center" : "stretch",
                        justifyContent: renderAs === "image" ? "center" : "stretch",
                        position: "relative",
                    }}
                >
                    {renderAs === "image" && (
                        <>
                            {!imgLoaded && !imgError && (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Loader2 size={36} style={{ color: "white", opacity: 0.7, animation: "spin 1s linear infinite" }} />
                                </div>
                            )}
                            {imgError ? (
                                <div style={{ color: "white", textAlign: "center", padding: "2rem" }}>
                                    <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.7 }}>No se pudo cargar la imagen.</p>
                                    <a href={url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", fontSize: "0.875rem" }}>
                                        Abrir en pestaña nueva
                                    </a>
                                </div>
                            ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={url}
                                    alt={title}
                                    onLoad={() => setImgLoaded(true)}
                                    onError={() => setImgError(true)}
                                    style={{
                                        maxWidth: "none",
                                        width: `${zoom}%`,
                                        height: "auto",
                                        transform: `rotate(${rotation}deg)`,
                                        transition: "transform 0.2s ease, width 0.2s ease",
                                        display: "block",
                                        margin: "1rem auto",
                                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                                        borderRadius: "4px",
                                        opacity: imgLoaded ? 1 : 0,
                                    }}
                                />
                            )}
                        </>
                    )}

                    {(renderAs === "pdf" || renderAs === "iframe") && (
                        <iframe
                            src={url}
                            style={{
                                width: "100%",
                                height: "100%",
                                border: "none",
                                display: "block",
                            }}
                            title={title}
                        />
                    )}
                </div>

                {/* ── Footer hint ── */}
                <div style={{
                    padding: "0.375rem 1rem",
                    borderTop: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexShrink: 0,
                }}>
                    <span>Presiona <kbd style={{ background: "var(--border)", padding: "1px 4px", borderRadius: "3px" }}>Esc</kbd> para cerrar</span>
                    {renderAs === "image" && (
                        <span>Usa <kbd style={{ background: "var(--border)", padding: "1px 4px", borderRadius: "3px" }}>+</kbd> / <kbd style={{ background: "var(--border)", padding: "1px 4px", borderRadius: "3px" }}>-</kbd> para zoom</span>
                    )}
                    <span style={{ marginLeft: "auto" }}>{title}</span>
                </div>
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-secondary)",
    padding: "0.375rem",
    borderRadius: "6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
};
