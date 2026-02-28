"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ChevronDown,
    ChevronUp,
    Save,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Music,
    Palette,
    BookOpen,
    Beaker,
    Cpu,
    Globe,
} from "lucide-react";

// ─── Types ───────────────────────────────────────

interface Disciplina {
    id: string;
    nombre: string;
    tipo: "simple" | "individual" | "equipo" | "grupo";
    minParticipantes: number;
    maxParticipantes: number;
    grupoExclusion: string | null;
    orden: number;
}

interface Categoria {
    id: string;
    nombre: string;
    color: string;
    orden: number;
    disciplinas: Disciplina[];
}

interface DatosDisciplina {
    participa: boolean;
    numParticipantes: number;
}

type FormData = Record<string, DatosDisciplina>;

// ─── Icon helper ─────────────────────────────────

function getCategoryIcon(nombre: string) {
    if (nombre.includes("Arte")) return <Palette size={18} />;
    if (nombre.includes("Humanidades")) return <BookOpen size={18} />;
    if (nombre.includes("Ciencia")) return <Beaker size={18} />;
    if (nombre.includes("Tech")) return <Cpu size={18} />;
    if (nombre.includes("Externo")) return <Globe size={18} />;
    return <Music size={18} />;
}

// ─── Component ───────────────────────────────────

export default function InscripcionEventos() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [formData, setFormData] = useState<FormData>({});
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activo, setActivo] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // ─── Fetch data on mount ─────────────────────

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/inscripciones-eventos");
            if (!res.ok) throw new Error("Error cargando datos");
            const data = await res.json();

            setActivo(data.activo);
            setCategorias(data.categorias || []);

            // Initialize form data
            const initial: FormData = {};
            const saved = data.inscripcion || {};

            for (const cat of data.categorias || []) {
                for (const disc of cat.disciplinas) {
                    initial[disc.id] = saved[disc.id] || { participa: false, numParticipantes: disc.minParticipantes };
                }
            }
            setFormData(initial);

            if (data.updatedAt) {
                setLastSaved(new Date(data.updatedAt).toLocaleString("es-MX"));
            }

            // Expand all categories by default
            setExpandedCats(new Set((data.categorias || []).map((c: Categoria) => c.id)));
        } catch (err) {
            console.error(err);
            setMessage({ type: "error", text: "Error al cargar las disciplinas" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Handlers ────────────────────────────────

    function toggleCategory(catId: string) {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    }

    function handleToggleParticipa(disc: Disciplina) {
        setFormData(prev => {
            const next = { ...prev };
            const current = next[disc.id];
            const newParticipa = !current.participa;

            next[disc.id] = {
                participa: newParticipa,
                numParticipantes: newParticipa ? disc.minParticipantes : disc.minParticipantes,
            };

            // If this is part of an exclusion group, deactivate the other option
            if (disc.grupoExclusion && newParticipa) {
                const allDiscs = categorias.flatMap(c => c.disciplinas);
                const sameGroup = allDiscs.filter(d => d.grupoExclusion === disc.grupoExclusion && d.id !== disc.id);
                for (const otherDisc of sameGroup) {
                    next[otherDisc.id] = { participa: false, numParticipantes: otherDisc.minParticipantes };
                }
            }

            return next;
        });
    }

    function handleNumChange(discId: string, value: number, min: number, max: number) {
        const clamped = Math.max(min, Math.min(max, value));
        setFormData(prev => ({
            ...prev,
            [discId]: { ...prev[discId], numParticipantes: clamped },
        }));
    }

    async function handleSave() {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/inscripciones-eventos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ datos: formData }),
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "¡Inscripción guardada exitosamente!" });
                setLastSaved(new Date().toLocaleString("es-MX"));
            } else {
                const errorText = data.details
                    ? data.details.join("\n")
                    : data.error || "Error al guardar";
                setMessage({ type: "error", text: errorText });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setSaving(false);
        }
    }

    // ─── Helper: is the other option in a group active? ──

    function isGroupPartnerActive(disc: Disciplina): boolean {
        if (!disc.grupoExclusion) return false;
        const allDiscs = categorias.flatMap(c => c.disciplinas);
        return allDiscs.some(
            d => d.grupoExclusion === disc.grupoExclusion && d.id !== disc.id && formData[d.id]?.participa
        );
    }

    // ─── Count active disciplines ────────────────

    function countActive(cat: Categoria): number {
        return cat.disciplinas.filter(d => formData[d.id]?.participa).length;
    }

    // ─── Render ──────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Loader2 size={32} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            </div>
        );
    }

    if (!activo) {
        return (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                <AlertTriangle size={48} style={{ color: "var(--warning)", margin: "0 auto 1rem" }} />
                <h3 style={{ marginBottom: "0.5rem" }}>Inscripciones No Disponibles</h3>
                <p style={{ color: "var(--text-muted)", margin: 0 }}>
                    Las inscripciones a Eventos Culturales 2026 no están activas en este momento.
                    <br />Contacte a la supervisión para más información.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header */}
            <div className="card" style={{
                background: "linear-gradient(135deg, #1f4e78 0%, #2e75b6 100%)",
                color: "white", border: "none",
            }}>
                <h2 style={{ marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Palette size={24} /> Inscripción PAEC 2026
                </h2>
                <p style={{ opacity: 0.85, fontSize: "0.875rem", margin: 0 }}>
                    Seleccione las disciplinas en las que participará su escuela.
                </p>
                {lastSaved && (
                    <p style={{ opacity: 0.7, fontSize: "0.75rem", margin: "0.5rem 0 0" }}>
                        Último guardado: {lastSaved}
                    </p>
                )}
            </div>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}
                    style={{ whiteSpace: "pre-wrap" }}>
                    {message.text}
                    <button onClick={() => setMessage(null)}
                        style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
                </div>
            )}

            {/* Categories */}
            {categorias.map(cat => {
                const isExpanded = expandedCats.has(cat.id);
                const activeCount = countActive(cat);

                return (
                    <div key={cat.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                        {/* Category Header */}
                        <button
                            onClick={() => toggleCategory(cat.id)}
                            style={{
                                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "1rem 1.25rem", border: "none", cursor: "pointer",
                                background: `linear-gradient(135deg, ${cat.color}18, ${cat.color}08)`,
                                borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div style={{
                                    width: "36px", height: "36px", borderRadius: "10px",
                                    background: cat.color, color: "white",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    {getCategoryIcon(cat.nombre)}
                                </div>
                                <div style={{ textAlign: "left" }}>
                                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{cat.nombre}</div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        {cat.disciplinas.length} disciplinas
                                        {activeCount > 0 && (
                                            <span style={{ color: "var(--success)", fontWeight: 600 }}>
                                                {" "}• {activeCount} seleccionada{activeCount !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>

                        {/* Disciplines */}
                        {isExpanded && (
                            <div style={{ padding: "0.5rem 0" }}>
                                {cat.disciplinas.map(disc => {
                                    const entry = formData[disc.id];
                                    if (!entry) return null;
                                    const partnerActive = isGroupPartnerActive(disc);

                                    return (
                                        <div key={disc.id} style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "0.75rem 1.25rem",
                                            borderBottom: "1px solid var(--border)",
                                            opacity: partnerActive ? 0.45 : 1,
                                            transition: "opacity 0.2s",
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                                                    {disc.nombre}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                                    {disc.tipo === "simple" && "1 participante"}
                                                    {disc.tipo === "individual" && `Individual • ${disc.minParticipantes} participante`}
                                                    {disc.tipo === "equipo" && `Equipo • ${disc.minParticipantes}-${disc.maxParticipantes} participantes`}
                                                    {disc.tipo === "grupo" && `${disc.minParticipantes}-${disc.maxParticipantes} participantes`}
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                                                {/* Participant count input for grupo and equipo types */}
                                                {entry.participa && (disc.tipo === "grupo" || disc.tipo === "equipo") && disc.maxParticipantes > disc.minParticipantes && (
                                                    <input
                                                        type="number"
                                                        min={disc.minParticipantes}
                                                        max={disc.maxParticipantes}
                                                        value={entry.numParticipantes}
                                                        onChange={e => handleNumChange(disc.id, parseInt(e.target.value) || disc.minParticipantes, disc.minParticipantes, disc.maxParticipantes)}
                                                        style={{
                                                            width: "60px", padding: "0.4rem", textAlign: "center",
                                                            borderRadius: "8px", border: "1px solid var(--border)",
                                                            fontSize: "0.875rem", fontWeight: 600,
                                                        }}
                                                    />
                                                )}

                                                {/* Toggle button */}
                                                <button
                                                    onClick={() => handleToggleParticipa(disc)}
                                                    disabled={partnerActive}
                                                    style={{
                                                        padding: "0.4rem 1rem",
                                                        borderRadius: "20px",
                                                        border: entry.participa ? "2px solid var(--success)" : "2px solid var(--border)",
                                                        background: entry.participa ? "var(--success)" : "transparent",
                                                        color: entry.participa ? "white" : "var(--text-muted)",
                                                        fontWeight: 600,
                                                        fontSize: "0.8125rem",
                                                        cursor: partnerActive ? "not-allowed" : "pointer",
                                                        transition: "all 0.2s",
                                                        minWidth: "60px",
                                                    }}
                                                >
                                                    {entry.participa ? "Sí" : "No"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Save Button */}
            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{
                    padding: "1rem",
                    fontSize: "1rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                }}
            >
                {saving ? (
                    <>
                        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                        Guardando...
                    </>
                ) : (
                    <>
                        <Save size={20} />
                        Guardar Inscripción
                    </>
                )}
            </button>

            {/* Spin animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
