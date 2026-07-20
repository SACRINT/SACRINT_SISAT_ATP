"use client";

import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, Info, ExternalLink, HelpCircle } from "lucide-react";

export default function AjustesApiPanel({ escuela }: { escuela: any }) {
    const [apiKey, setApiKey] = useState("");
    const [originalKeyMasked, setOriginalKeyMasked] = useState("");
    const [hasKey, setHasKey] = useState(false);
    const [showKey, setShowKey] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Cargar la configuración actual al montar
    useEffect(() => {
        async function fetchConfig() {
            try {
                const res = await fetch("/api/director/configuracion-api");
                if (res.ok) {
                    const data = await res.json();
                    if (data.hasKey) {
                        setApiKey(data.geminiApiKey);
                        setOriginalKeyMasked(data.geminiApiKey);
                        setHasKey(true);
                    }
                }
            } catch (err) {
                console.error("Error al cargar configuración de API:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchConfig();
    }, []);

    // Probar la conexión de la clave API con Google
    const handleTestConnection = async () => {
        if (!apiKey || apiKey.trim() === "") {
            setStatusMessage({ type: "error", text: "Ingrese una clave de API antes de probar la conexión." });
            return;
        }

        // Si la clave ingresada es el enmascaramiento original, no necesitamos probarla (ya sabemos que es la guardada)
        if (hasKey && apiKey === originalKeyMasked) {
            setStatusMessage({ type: "success", text: "La clave guardada ya está activa." });
            return;
        }

        setTesting(true);
        setStatusMessage(null);

        try {
            const res = await fetch("/api/director/probar-api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ geminiApiKey: apiKey })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setStatusMessage({ type: "success", text: "¡Prueba de conexión exitosa! La clave es válida y lista para usarse." });
            } else {
                setStatusMessage({ type: "error", text: data.error || "La clave es inválida o no cuenta con cuota gratuita." });
            }
        } catch (err: any) {
            setStatusMessage({ type: "error", text: "Error de red al intentar validar la clave." });
        } finally {
            setTesting(false);
        }
    };

    // Guardar los ajustes en la base de datos
    const handleSaveSettings = async () => {
        // Si no ha cambiado nada, no hacer nada
        if (hasKey && apiKey === originalKeyMasked) {
            setStatusMessage({ type: "success", text: "No hay cambios para guardar." });
            return;
        }

        setSaving(true);
        setStatusMessage(null);

        try {
            const res = await fetch("/api/director/configuracion-api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ geminiApiKey: apiKey })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setOriginalKeyMasked(data.geminiApiKey);
                setHasKey(data.hasKey);
                setApiKey(data.geminiApiKey);
                setStatusMessage({ type: "success", text: data.message });
            } else {
                setStatusMessage({ type: "error", text: data.error || "No se pudo guardar la configuración." });
            }
        } catch (err) {
            setStatusMessage({ type: "error", text: "Error de red al intentar guardar los ajustes." });
        } finally {
            setSaving(false);
        }
    };

    // Eliminar la clave para volver a usar el pool general
    const handleClearKey = async () => {
        if (!confirm("¿Está seguro de eliminar su clave de API? Al hacerlo, volverá a utilizar el pool de claves compartido de la supervisión.")) {
            return;
        }

        setSaving(true);
        setStatusMessage(null);

        try {
            const res = await fetch("/api/director/configuracion-api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ geminiApiKey: "" })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setApiKey("");
                setOriginalKeyMasked("");
                setHasKey(false);
                setStatusMessage({ type: "success", text: data.message });
            } else {
                setStatusMessage({ type: "error", text: data.error || "No se pudo eliminar la clave." });
            }
        } catch (err) {
            setStatusMessage({ type: "error", text: "Error de red al eliminar la clave." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
                <Loader2 className="animate-spin" size={24} color="var(--primary)" />
                <span style={{ marginLeft: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>Cargando ajustes...</span>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%", maxWidth: "900px" }}>
            
            {/* Panel Principal */}
            <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    <div style={{ background: "var(--primary-bg)", borderRadius: "8px", padding: "6px", display: "flex" }}>
                        <Key size={18} color="var(--primary)" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Clave de API Personal</h3>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Configura tu propia clave gratuita de Google Gemini o MorphLLM para usar el chat y las evaluaciones sin límites compartidos.
                        </p>
                    </div>
                </div>

                {/* Input de Clave */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1.25rem" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                        Google Gemini o MorphLLM API Key
                    </label>
                    <div style={{ display: "flex", gap: "0.5rem", position: "relative" }}>
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={hasKey ? "Clave API configurada (Oculta)" : "Ingresa tu API Key (ej. AIzaSy...)"}
                            disabled={saving}
                            style={{
                                flex: 1,
                                padding: "0.625rem 2.5rem 0.625rem 0.75rem",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "var(--bg)",
                                color: "var(--text)",
                                fontSize: "0.85rem",
                                outline: "none"
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            disabled={saving}
                            style={{
                                position: "absolute",
                                right: "6.5rem",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                display: "flex"
                            }}
                        >
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>

                        <button
                            onClick={handleTestConnection}
                            disabled={testing || saving || !apiKey}
                            className="btn btn-outline"
                            style={{
                                padding: "0.5rem 0.75rem",
                                minHeight: "auto",
                                fontSize: "0.8rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem"
                            }}
                        >
                            {testing ? <Loader2 className="animate-spin" size={14} /> : null}
                            Probar Conexión
                        </button>
                    </div>
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                    {hasKey && (
                        <button
                            onClick={handleClearKey}
                            disabled={saving}
                            className="btn"
                            style={{
                                background: "var(--danger-bg, #fee2e2)",
                                color: "var(--danger, #ef4444)",
                                border: "none",
                                padding: "0.5rem 1rem",
                                fontSize: "0.8rem"
                            }}
                        >
                            Eliminar Clave
                        </button>
                    )}
                    <button
                        onClick={handleSaveSettings}
                        disabled={saving || testing || (hasKey && apiKey === originalKeyMasked)}
                        className="btn btn-primary"
                        style={{
                            padding: "0.5rem 1.25rem",
                            fontSize: "0.8rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem"
                        }}
                    >
                        {saving ? <Loader2 className="animate-spin" size={14} /> : null}
                        Guardar Ajustes
                    </button>
                </div>

                {/* Mensaje de Estado */}
                {statusMessage && (
                    <div
                        className={`alert ${statusMessage.type === "success" ? "alert-success" : "alert-error"}`}
                        style={{
                            marginTop: "1rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.8rem",
                            padding: "0.75rem 1rem"
                        }}
                    >
                        {statusMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        <span>{statusMessage.text}</span>
                    </div>
                )}
            </div>

            {/* Guía Visual Paso a Paso */}
            <div className="card" style={{ padding: "1.5rem", background: "linear-gradient(to bottom, var(--card-bg), var(--bg-secondary))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                    <div style={{ background: "#e0f2fe", borderRadius: "8px", padding: "6px", display: "flex" }}>
                        <HelpCircle size={18} color="#0284c7" />
                    </div>
                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>¿Cómo obtener tu clave API de Gemini o MorphLLM?</h4>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    
                    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <div style={{ background: "var(--primary)", color: "white", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                            1
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700 }}>Accede a tu plataforma preferida</h5>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                Puedes usar Google AI Studio o MorphLLM Dashboard:
                                <br />
                                <a 
                                    href="https://aistudio.google.com/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ color: "var(--primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem", marginRight: "0.5rem" }}
                                >
                                    Google AI Studio <ExternalLink size={12} />
                                </a>
                                <a 
                                    href="https://www.morphllm.com/" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ color: "var(--primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                >
                                    MorphLLM Dashboard <ExternalLink size={12} />
                                </a>
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <div style={{ background: "var(--primary)", color: "white", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                            2
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700 }}>Crea tu Clave de API</h5>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                Haz clic en el botón azul **"Get API key"** (Obtener clave de API) en la esquina superior izquierda. Luego presiona **"Create API key"** (Crear clave de API). 
                                *Consejo: Si te aparece una lista, selecciona "Create API key in new project" (Crear en un proyecto nuevo) para evitar conflictos.*
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <div style={{ background: "var(--primary)", color: "white", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                            3
                        </div>
                        <div>
                            <h5 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700 }}>Copia y Pega aquí</h5>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                Copia la clave generada (empieza por **AIzaSy**), pégala en el recuadro superior, haz clic en **"Probar Conexión"** para verificarla y finalmente presiona **"Guardar Ajustes"**.
                            </p>
                        </div>
                    </div>

                </div>

                <div 
                    style={{ 
                        marginTop: "1.25rem", 
                        background: "#f0f9ff", 
                        border: "1px solid #bae6fd", 
                        borderRadius: "8px", 
                        padding: "0.75rem", 
                        display: "flex", 
                        alignItems: "flex-start", 
                        gap: "0.5rem" 
                    }}
                >
                    <Info size={16} color="#0284c7" style={{ marginTop: "2px", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.75rem", color: "#0369a1", lineHeight: 1.4 }}>
                        **Nota de Privacidad y Costo**: Las claves generadas en Google AI Studio son 100% **gratuitas** y personales. Tu clave nunca será compartida con otras escuelas ni visible para terceros; se almacena de forma aislada y encriptada en la base de datos para uso exclusivo del portal de tu plantel.
                    </span>
                </div>
            </div>

        </div>
    );
}
