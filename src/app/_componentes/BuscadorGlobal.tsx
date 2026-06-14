"use client";

import { useEffect, useState, useRef } from "react";
import { Search, X, School, User, BookOpen, Layers, Loader2 } from "lucide-react";

interface SearchResult {
    escuelas: Array<{ id: string; cct: string; nombre: string; localidad: string | null }>;
    personal: Array<{ id: string; nombre: string; apellidoPaterno: string; apellidoMaterno: string; curp: string | null; escuelaId: string; escuela?: { nombre: string } }>;
    programas: Array<{ id: string; nombre: string; tipo: string }>;
    recursos: Array<{ id: string; nombre: string; archivoDriveUrl: string | null; programa?: { nombre: string } }>;
}

interface BuscadorGlobalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (view: string, targetId?: string, extra?: any) => void;
    role: "admin" | "director";
}

export default function BuscadorGlobal({ isOpen, onClose, onNavigate, role }: BuscadorGlobalProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult>({ escuelas: [], personal: [], programas: [], recursos: [] });
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Flatten results for keyboard navigation
    const flatResults = [
        ...results.escuelas.map(item => ({ ...item, searchType: "escuela" as const })),
        ...results.personal.map(item => ({ ...item, searchType: "personal" as const })),
        ...results.programas.map(item => ({ ...item, searchType: "programa" as const })),
        ...results.recursos.map(item => ({ ...item, searchType: "recurso" as const })),
    ];

    // Toggle scroll lock on body
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            document.body.style.overflow = "";
            setQuery("");
            setResults({ escuelas: [], personal: [], programas: [], recursos: [] });
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Handle Ctrl+K shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Handle query search
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults({ escuelas: [], personal: [], programas: [], recursos: [] });
            setLoading(false);
            return;
        }

        setLoading(true);
        const delayDebounceFn = setTimeout(async () => {
            try {
                const res = await fetch(`/api/buscar?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                    setSelectedIndex(0);
                }
            } catch (error) {
                console.error("Error searching:", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (flatResults.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % flatResults.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const selectedItem = flatResults[selectedIndex];
            if (selectedItem) handleSelect(selectedItem);
        }
    };

    const handleSelect = (item: typeof flatResults[number]) => {
        onClose();
        if (item.searchType === "escuela") {
            onNavigate("escuelas", item.id, item);
        } else if (item.searchType === "personal") {
            onNavigate("expedientes", item.id, item);
        } else if (item.searchType === "programa") {
            onNavigate("programas", item.id, item);
        } else if (item.searchType === "recurso") {
            if (item.archivoDriveUrl) {
                window.open(item.archivoDriveUrl, "_blank");
            } else {
                onNavigate("recursos", item.id, item);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                zIndex: 99999,
                paddingTop: "10vh",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "14px",
                    width: "100%",
                    maxWidth: "600px",
                    boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "70vh",
                }}
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Search input header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "1rem 1.25rem",
                        borderBottom: "1px solid var(--border)",
                        gap: "0.75rem",
                        background: "var(--surface)",
                    }}
                >
                    <Search size={20} style={{ color: "var(--text-secondary)" }} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Busca por escuela, CCT, nombre del personal o recurso..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{
                            flex: 1,
                            border: "none",
                            background: "none",
                            fontSize: "1rem",
                            outline: "none",
                            color: "var(--text)",
                        }}
                    />
                    {loading ? (
                        <Loader2 size={18} className="spin" style={{ color: "var(--text-muted)" }} />
                    ) : query ? (
                        <button
                            onClick={() => setQuery("")}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                        >
                            <X size={18} />
                        </button>
                    ) : (
                        <kbd
                            style={{
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "4px",
                                color: "var(--text-muted)",
                            }}
                        >
                            ESC
                        </kbd>
                    )}
                </div>

                {/* Results list */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
                    {query.trim().length < 2 ? (
                        <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
                            <p style={{ margin: 0, fontSize: "0.875rem" }}>Escribe al menos 2 caracteres para buscar...</p>
                        </div>
                    ) : flatResults.length === 0 ? (
                        <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
                            <p style={{ margin: 0, fontSize: "0.875rem" }}>No se encontraron resultados para &quot;{query}&quot;</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {/* Escuelas */}
                            {results.escuelas.length > 0 && (
                                <div>
                                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", padding: "0.25rem 0.75rem" }}>
                                        Escuelas
                                    </div>
                                    {results.escuelas.map(item => {
                                        const idx = flatResults.findIndex(f => f.id === item.id && f.searchType === "escuela");
                                        const isActive = idx === selectedIndex;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelect({ ...item, searchType: "escuela" })}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.75rem",
                                                    padding: "0.625rem 0.75rem",
                                                    borderRadius: "8px",
                                                    background: isActive ? "var(--primary-bg)" : "transparent",
                                                    color: isActive ? "var(--primary)" : "var(--text)",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                <School size={16} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.nombre}</div>
                                                    <div style={{ fontSize: "0.75rem", color: isActive ? "var(--primary)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        CCT: {item.cct} {item.localidad ? `· ${item.localidad}` : ""}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Personal */}
                            {results.personal.length > 0 && (
                                <div>
                                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", padding: "0.25rem 0.75rem" }}>
                                        Personal
                                    </div>
                                    {results.personal.map(item => {
                                        const idx = flatResults.findIndex(f => f.id === item.id && f.searchType === "personal");
                                        const isActive = idx === selectedIndex;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelect({ ...item, searchType: "personal" })}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.75rem",
                                                    padding: "0.625rem 0.75rem",
                                                    borderRadius: "8px",
                                                    background: isActive ? "var(--primary-bg)" : "transparent",
                                                    color: isActive ? "var(--primary)" : "var(--text)",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                <User size={16} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                                                        {item.apellidoPaterno} {item.apellidoMaterno} {item.nombre}
                                                    </div>
                                                    <div style={{ fontSize: "0.75rem", color: isActive ? "var(--primary)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {item.escuela ? `Escuela: ${item.escuela.nombre}` : ""} {item.curp ? `· CURP: ${item.curp}` : ""}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Programas */}
                            {results.programas.length > 0 && (
                                <div>
                                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", padding: "0.25rem 0.75rem" }}>
                                        Programas
                                    </div>
                                    {results.programas.map(item => {
                                        const idx = flatResults.findIndex(f => f.id === item.id && f.searchType === "programa");
                                        const isActive = idx === selectedIndex;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelect({ ...item, searchType: "programa" })}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.75rem",
                                                    padding: "0.625rem 0.75rem",
                                                    borderRadius: "8px",
                                                    background: isActive ? "var(--primary-bg)" : "transparent",
                                                    color: isActive ? "var(--primary)" : "var(--text)",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                <Layers size={16} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.nombre}</div>
                                                    <div style={{ fontSize: "0.75rem", color: isActive ? "var(--primary)" : "var(--text-secondary)" }}>
                                                        Tipo: {item.tipo}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Recursos */}
                            {results.recursos.length > 0 && (
                                <div>
                                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", padding: "0.25rem 0.75rem" }}>
                                        Recursos y Formatos
                                    </div>
                                    {results.recursos.map(item => {
                                        const idx = flatResults.findIndex(f => f.id === item.id && f.searchType === "recurso");
                                        const isActive = idx === selectedIndex;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => handleSelect({ ...item, searchType: "recurso" })}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.75rem",
                                                    padding: "0.625rem 0.75rem",
                                                    borderRadius: "8px",
                                                    background: isActive ? "var(--primary-bg)" : "transparent",
                                                    color: isActive ? "var(--primary)" : "var(--text)",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                <BookOpen size={16} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.nombre}</div>
                                                    <div style={{ fontSize: "0.75rem", color: isActive ? "var(--primary)" : "var(--text-secondary)" }}>
                                                        {item.programa ? `Programa: ${item.programa.nombre}` : ""}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Keyboard shortcuts footer */}
                <div
                    style={{
                        padding: "0.625rem 1rem",
                        borderTop: "1px solid var(--border)",
                        background: "var(--bg)",
                        display: "flex",
                        gap: "1rem",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                    }}
                >
                    <div>
                        <kbd style={{ border: "1px solid var(--border)", borderRadius: "3px", padding: "1px 4px", marginRight: "3px", background: "white", boxShadow: "0 1px 0 rgba(0,0,0,0.1)" }}>↑↓</kbd> Navegar
                    </div>
                    <div>
                        <kbd style={{ border: "1px solid var(--border)", borderRadius: "3px", padding: "1px 4px", marginRight: "3px", background: "white", boxShadow: "0 1px 0 rgba(0,0,0,0.1)" }}>Enter</kbd> Seleccionar
                    </div>
                </div>
            </div>
        </div>
    );
}
