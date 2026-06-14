"use client";

import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

interface PdfViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
}

export default function PdfViewerModal({ isOpen, onClose, url, title }: PdfViewerModalProps) {
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleKeyDown);
        // Prevent body scroll when modal is open
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: "1rem",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    width: "100%",
                    maxWidth: "1000px",
                    height: "90vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "var(--shadow-lg)",
                    overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "1rem 1.25rem",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--surface)",
                    }}
                >
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: "1rem",
                                fontWeight: 700,
                                color: "var(--text)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {title}
                        </h3>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "1rem" }}>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                            style={{
                                padding: "0.375rem 0.75rem",
                                fontSize: "0.75rem",
                                minHeight: "auto",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                fontWeight: 600,
                            }}
                            title="Abrir en ventana nueva"
                        >
                            <ExternalLink size={14} />
                            <span>Abrir</span>
                        </a>
                        <button
                            onClick={onClose}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--text-secondary)",
                                padding: "0.375rem",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background 0.2s",
                            }}
                            title="Cerrar"
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, background: "#f1f5f9", position: "relative" }}>
                    <iframe
                        src={url}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                        }}
                        title={title}
                    />
                </div>
            </div>
        </div>
    );
}
