"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCw, Loader2, FileText, AlertCircle } from "lucide-react";

interface PdfViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Raw Cloudinary URL — used directly in iframe and as "Open in tab" */
    url: string;
    title: string;
    /** Proxy URL through our server — used for the Download button only */
    downloadUrl?: string;
    /** Optional filename to detect file type (more reliable than the URL) */
    fileName?: string;
}

/** Returns lowercase extension from a filename or URL. */
function getExt(str: string): string {
    if (!str) return "";
    try {
        // For proxy URLs: read the 'name' query param
        if (str.includes("?")) {
            const params = new URLSearchParams(str.slice(str.indexOf("?") + 1));
            const name = params.get("name");
            if (name) {
                const m = name.match(/\.([a-z0-9]+)$/i);
                if (m) return m[1].toLowerCase();
            }
        }
    } catch { /* ignore */ }
    const clean = str.split("?")[0];
    const match = clean.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : "";
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"]);
const PDF_EXTS   = new Set(["pdf"]);
const NO_PREVIEW = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods"]);

/**
 * Converts a Cloudinary URL to one that browsers will render inline.
 *
 * Cloudinary's CDN serves PDFs with Content-Type: application/pdf
 * and NO Content-Disposition: attachment — so browsers display them natively
 * in iframes without any proxy needed.
 *
 * We just need the raw Cloudinary URL (res.cloudinary.com/...).
 */
function toDirectViewUrl(cloudinaryUrl: string): string {
    // Already a direct Cloudinary URL — use as-is
    if (cloudinaryUrl.includes("res.cloudinary.com")) {
        return cloudinaryUrl;
    }
    // If it's our proxy URL, extract the original URL
    if (cloudinaryUrl.includes("/api/download")) {
        try {
            const params = new URLSearchParams(cloudinaryUrl.slice(cloudinaryUrl.indexOf("?") + 1));
            const orig = params.get("url");
            if (orig) return orig;
        } catch { /* ignore */ }
    }
    return cloudinaryUrl;
}

export default function PdfViewerModal({ isOpen, onClose, url, title, downloadUrl, fileName }: PdfViewerModalProps) {
    const [zoom, setZoom]           = useState(100);
    const [rotation, setRotation]   = useState(0);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError]   = useState(false);
    const [pdfError, setPdfError]   = useState(false);
    const [useGDocs, setUseGDocs]   = useState(false);

    // Detect file type: prefer fileName → downloadUrl name param → url
    const extSource = fileName || downloadUrl || url;
    const ext = getExt(extSource);

    // For the iframe: use the direct Cloudinary URL (no proxy, no timeouts)
    const directUrl = toDirectViewUrl(url);

    // Google Docs Viewer as fallback (works for PDFs and office docs)
    const gDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(directUrl)}&embedded=true`;

    // For downloads: use the proxy URL (sets correct filename via Content-Disposition)
    const dlUrl = downloadUrl || url;

    const isImage   = IMAGE_EXTS.has(ext);
    const isPdf     = PDF_EXTS.has(ext);
    const noPreview = NO_PREVIEW.has(ext);

    const renderAs: "image" | "pdf" | "no-preview" | "pdf-fallback" =
        noPreview ? "no-preview" :
        isImage   ? "image"      :
        isPdf     ? "pdf"        :
        "pdf-fallback";

    useEffect(() => {
        if (!isOpen) return;
        setZoom(100);
        setRotation(0);
        setImgLoaded(false);
        setImgError(false);
        setPdfError(false);
        setUseGDocs(false);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if ((e.key === "+" || e.key === "=") && renderAs === "image") setZoom(z => Math.min(z + 10, 300));
            if (e.key === "-" && renderAs === "image") setZoom(z => Math.max(z - 10, 20));
        };

        window.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose, url, renderAs]);

    if (!isOpen) return null;

    // Which URL goes in the iframe: direct Cloudinary first, Google Docs if user switches
    const iframeSrc = useGDocs ? gDocsUrl : directUrl;

    return (
        <div
            style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(10, 15, 30, 0.88)",
                backdropFilter: "blur(6px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 9999, padding: "0.75rem",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    width: "100%", maxWidth: "1100px",
                    height: "92vh",
                    display: "flex", flexDirection: "column",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
                    overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div style={{
                    padding: "0.75rem 1rem",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "var(--surface)", gap: "0.5rem", flexShrink: 0,
                }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{
                            margin: 0, fontSize: "0.9375rem", fontWeight: 700,
                            color: "var(--text)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }} title={title}>
                            {title}
                        </h3>
                        <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {ext.toUpperCase() || "Documento"}
                        </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
                        {/* Zoom — only for images */}
                        {renderAs === "image" && (
                            <>
                                <button onClick={() => setZoom(z => Math.max(z - 10, 20))} style={btnStyle} title="Alejar (−)">
                                    <ZoomOut size={16} />
                                </button>
                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", minWidth: "3rem", textAlign: "center" }}>
                                    {zoom}%
                                </span>
                                <button onClick={() => setZoom(z => Math.min(z + 10, 300))} style={btnStyle} title="Acercar (+)">
                                    <ZoomIn size={16} />
                                </button>
                                <button onClick={() => setRotation(r => (r + 90) % 360)} style={btnStyle} title="Rotar">
                                    <RotateCw size={16} />
                                </button>
                                <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 0.125rem" }} />
                            </>
                        )}

                        {/* Switch to Google Docs Viewer — for PDFs when direct load fails */}
                        {(renderAs === "pdf" || renderAs === "pdf-fallback") && pdfError && !useGDocs && (
                            <button
                                onClick={() => { setPdfError(false); setUseGDocs(true); }}
                                style={{ ...linkBtnStyle, color: "var(--primary)", borderColor: "var(--primary)" }}
                                title="Intentar con Google Docs Viewer"
                            >
                                <ExternalLink size={14} />
                                <span>Visor alternativo</span>
                            </button>
                        )}

                        {/* Download — uses proxy to set filename */}
                        <a
                            href={dlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            style={{ ...linkBtnStyle }}
                            title="Descargar"
                        >
                            <Download size={14} />
                            <span>Descargar</span>
                        </a>

                        {/* Open in new tab — direct Cloudinary URL */}
                        <a
                            href={directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...linkBtnStyle }}
                            title="Abrir en pestaña nueva"
                        >
                            <ExternalLink size={14} />
                            <span>Abrir</span>
                        </a>

                        {/* Close */}
                        <button onClick={onClose} style={{ ...btnStyle, color: "var(--text-muted)", padding: "0.375rem" }} title="Cerrar (Esc)">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ── Content ── */}
                <div style={{
                    flex: 1, overflow: "auto",
                    background: renderAs === "image" ? "#1a1a2e" : "#f1f5f9",
                    display: "flex",
                    alignItems: renderAs === "image" ? "center" : "stretch",
                    justifyContent: renderAs === "image" ? "center" : "stretch",
                    position: "relative",
                }}>

                    {/* IMAGE */}
                    {renderAs === "image" && (
                        <>
                            {!imgLoaded && !imgError && (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Loader2 size={36} style={{ color: "white", opacity: 0.7, animation: "spin 1s linear infinite" }} />
                                </div>
                            )}
                            {imgError ? (
                                <NoPreviewFallback viewUrl={dlUrl} message="No se pudo cargar la imagen." />
                            ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={directUrl}
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

                    {/* PDF / UNKNOWN → direct Cloudinary iframe (no proxy needed) */}
                    {(renderAs === "pdf" || renderAs === "pdf-fallback") && !pdfError && (
                        <iframe
                            key={iframeSrc}
                            src={iframeSrc}
                            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                            title={title}
                            onError={() => setPdfError(true)}
                        />
                    )}

                    {/* PDF failed — show fallback options */}
                    {(renderAs === "pdf" || renderAs === "pdf-fallback") && pdfError && (
                        <NoPreviewFallback
                            viewUrl={dlUrl}
                            directUrl={directUrl}
                            message="No se pudo cargar el documento en el visor."
                            onTryGDocs={!useGDocs ? () => { setPdfError(false); setUseGDocs(true); } : undefined}
                        />
                    )}

                    {/* NO PREVIEW (Word / Excel / etc.) */}
                    {renderAs === "no-preview" && (
                        <NoPreviewFallback
                            viewUrl={dlUrl}
                            directUrl={directUrl}
                            message={`Los archivos .${ext.toUpperCase()} no se pueden previsualizar en el navegador.`}
                            isOffice
                        />
                    )}
                </div>

                {/* ── Footer ── */}
                <div style={{
                    padding: "0.375rem 1rem",
                    borderTop: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    fontSize: "0.7rem", color: "var(--text-muted)",
                    display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0,
                }}>
                    <span>Presiona <kbd style={{ background: "var(--border)", padding: "1px 4px", borderRadius: "3px" }}>Esc</kbd> para cerrar</span>
                    {renderAs === "image" && (
                        <span>Usa <kbd style={{ background: "var(--border)", padding: "1px 4px", borderRadius: "3px" }}>+</kbd> / <kbd style={{ background: "var(--border)", padding: "1px 4px", borderRadius: "3px" }}>−</kbd> para zoom</span>
                    )}
                    {useGDocs && (
                        <span style={{ color: "var(--primary)" }}>Usando Google Docs Viewer</span>
                    )}
                    <span style={{ marginLeft: "auto" }}>{title}</span>
                </div>
            </div>
        </div>
    );
}

/** Fallback shown when preview is impossible */
function NoPreviewFallback({
    viewUrl,
    directUrl,
    message,
    isOffice,
    onTryGDocs,
}: {
    viewUrl: string;
    directUrl?: string;
    message: string;
    isOffice?: boolean;
    onTryGDocs?: () => void;
}) {
    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "1rem", padding: "3rem", textAlign: "center", flex: 1,
        }}>
            {isOffice
                ? <FileText size={56} style={{ color: "var(--primary)", opacity: 0.6 }} />
                : <AlertCircle size={56} style={{ color: "var(--warning, #e67e22)", opacity: 0.7 }} />
            }
            <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--text)" }}>
                Vista previa no disponible
            </p>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)", maxWidth: "360px" }}>
                {message}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
                {onTryGDocs && (
                    <button
                        onClick={onTryGDocs}
                        style={{
                            display: "inline-flex", alignItems: "center", gap: "0.5rem",
                            padding: "0.625rem 1.25rem",
                            background: "var(--primary)", color: "white",
                            border: "none", cursor: "pointer",
                            borderRadius: "8px", textDecoration: "none",
                            fontSize: "0.875rem", fontWeight: 600,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        }}
                    >
                        <ExternalLink size={16} />
                        Intentar con visor alternativo
                    </button>
                )}
                {directUrl && directUrl !== viewUrl && (
                    <a
                        href={directUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "inline-flex", alignItems: "center", gap: "0.5rem",
                            padding: "0.625rem 1.25rem",
                            background: "none", color: "var(--primary)",
                            border: "1px solid var(--primary)",
                            borderRadius: "8px", textDecoration: "none",
                            fontSize: "0.875rem", fontWeight: 600,
                        }}
                    >
                        <ExternalLink size={16} />
                        Abrir en nueva pestaña
                    </a>
                )}
                <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    style={{
                        display: "inline-flex", alignItems: "center", gap: "0.5rem",
                        padding: "0.625rem 1.25rem",
                        background: "var(--bg-secondary)", color: "var(--text)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px", textDecoration: "none",
                        fontSize: "0.875rem", fontWeight: 600,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                >
                    <Download size={16} />
                    Descargar archivo
                </a>
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    color: "var(--text-secondary)", padding: "0.375rem", borderRadius: "6px",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
};

const linkBtnStyle: React.CSSProperties = {
    ...btnStyle,
    textDecoration: "none",
    display: "inline-flex", alignItems: "center", gap: "0.25rem",
    fontSize: "0.75rem", fontWeight: 600,
    padding: "0.375rem 0.625rem",
    border: "1px solid var(--border)", borderRadius: "6px",
    color: "var(--text-secondary)",
};
