"use client";

import { useState, useEffect } from "react";
import { 
    Key, 
    Plus, 
    Trash2, 
    Check, 
    X, 
    Cpu, 
    Loader2, 
    ToggleLeft, 
    ToggleRight, 
    Sparkles, 
    AlertCircle,
    RotateCw,
    FlaskConical
} from "lucide-react";

interface ApiKeyData {
    id: string;
    provider: string;
    label: string;
    key: string;
    active: boolean;
    errorCount: number;
    isPremium: boolean;
    usageCount?: number;
    lastUsedAt?: string;
    lastModel?: string;
    createdAt: string;
}

interface ConfigData {
    activoDirectores: boolean;
    limiteIntentos: number;
    providerDefault: string;
    modelDefault: string;
    providerPremium: string;
    modelPremium: string;
}

const PROVIDERS = [
    { value: "gemini", label: "Google Gemini" },
    { value: "openai", label: "OpenAI GPT" },
    { value: "claude", label: "Anthropic Claude" },
    { value: "deepseek", label: "DeepSeek" },
    { value: "openrouter", label: "OpenRouter" },
    { value: "morphllm", label: "MorphLLM" }
];

const MODELS: Record<string, { value: string; label: string }[]> = {
    gemini: [
        { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Recomendado Estándar - 1,500 RPD)" },
        { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Cuota Gratuita Limitada - 20 RPD)" },
        { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Cuentas Pro / Pay-As-You-Go)" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Recomendado Premium ATP)" },
        { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" }
    ],
    openai: [
        { value: "gpt-4o-mini", label: "GPT-4o Mini" },
        { value: "gpt-4o", label: "GPT-4o" }
    ],
    claude: [
        { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" }
    ],
    deepseek: [
        { value: "deepseek-chat", label: "DeepSeek-V3" },
        { value: "deepseek-reasoner", label: "DeepSeek-R1 (Razonamiento)" }
    ],
    openrouter: [
        { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash via OpenRouter" },
        { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro via OpenRouter" },
        { value: "openai/gpt-4o-mini", label: "GPT-4o Mini via OpenRouter" },
        { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet via OpenRouter" },
        { value: "deepseek/deepseek-chat", label: "DeepSeek-V3 via OpenRouter" }
    ],
    morphllm: [
        { value: "morph-glm52-744b", label: "GLM-5.2 744B" },
        { value: "morph-minimax3-428b", label: "MiniMax M3 428B" },
        { value: "morph-minimax27-230b", label: "MiniMax M2.7 230B" },
        { value: "morph-dsv4flash", label: "DeepSeek V4 Flash" },
        { value: "morph-qwen36-27b", label: "Qwen 3.6 27B" }
    ]
};

export default function GestionLlavesIA({ onSetMessage, readOnly = false }: { onSetMessage?: (msg: { type: "success" | "error"; text: string } | null) => void; readOnly?: boolean }) {
    const [config, setConfig] = useState<ConfigData>({
        activoDirectores: false,
        limiteIntentos: 3,
        providerDefault: "gemini",
        modelDefault: "gemini-2.5-flash",
        providerPremium: "gemini",
        modelPremium: "gemini-2.5-pro"
    });
    
    const [keys, setKeys] = useState<ApiKeyData[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingConfig, setSavingConfig] = useState(false);
    const [submittingKey, setSubmittingKey] = useState(false);

    // Form states
    const [newProvider, setNewProvider] = useState("gemini");
    const [newLabel, setNewLabel] = useState("");
    const [newKeyString, setNewKeyString] = useState("");
    const [newIsPremium, setNewIsPremium] = useState(false);

    // Testing states
    const [testResults, setTestResults] = useState<Record<string, { status: string; message: string; loading?: boolean }>>({});
    const [testingAll, setTestingAll] = useState(false);

    const handleTestSingleKey = async (id: string) => {
        setTestResults(prev => ({ ...prev, [id]: { status: "", message: "", loading: true } }));
        try {
            const res = await fetch("/api/admin/api-keys/probar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setTestResults(prev => ({
                    ...prev,
                    [id]: { status: data.result.status, message: data.result.message, loading: false }
                }));
            } else {
                setTestResults(prev => ({
                    ...prev,
                    [id]: { status: "ERROR", message: `⚠️ ${data.error || "Error al probar la llave"}`, loading: false }
                }));
            }
        } catch (e: any) {
            setTestResults(prev => ({
                ...prev,
                [id]: { status: "ERROR", message: `⚠️ Error de conexión: ${e.message}`, loading: false }
            }));
        }
    };

    const handleTestAllKeys = async () => {
        setTestingAll(true);
        try {
            const res = await fetch("/api/admin/api-keys/probar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testAll: true }),
            });
            const data = await res.json();
            if (res.ok && data.success && Array.isArray(data.results)) {
                const newResults: Record<string, { status: string; message: string; loading?: boolean }> = {};
                for (const r of data.results) {
                    newResults[r.id] = { status: r.status, message: r.message, loading: false };
                }
                setTestResults(newResults);
                showMsg("Diagnóstico de todas las llaves completado");
            } else {
                showMsg(data.error || "Error al diagnosticar llaves", "error");
            }
        } catch (e: any) {
            showMsg(`Error de conexión: ${e.message}`, "error");
        } finally {
            setTestingAll(false);
        }
    };

    const showMsg = (text: string, type: "success" | "error" = "success") => {
        if (onSetMessage) {
            onSetMessage({ type, text });
            setTimeout(() => onSetMessage(null), 5000);
        } else {
            alert(text);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Config
            const configRes = await fetch("/api/admin/pre-revision-config");
            if (configRes.ok) {
                const configData = await configRes.json();
                setConfig(configData);
            }

            // Fetch Keys
            const keysRes = await fetch("/api/admin/api-keys");
            if (keysRes.ok) {
                const keysData = await keysRes.json();
                setKeys(keysData);
            }
        } catch (e: any) {
            showMsg("Error al obtener la configuración de IA", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingConfig(true);
        try {
            const res = await fetch("/api/admin/pre-revision-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (res.ok) {
                const updated = await res.json();
                setConfig(updated);
                showMsg("Configuración de modelos de IA guardada con éxito");
            } else {
                const err = await res.json();
                showMsg(err.error || "Error al guardar configuración", "error");
            }
        } catch (e) {
            showMsg("Error de conexión al guardar configuración", "error");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleAddKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLabel.trim() || !newKeyString.trim()) {
            showMsg("Por favor llena todos los campos de la clave de API", "error");
            return;
        }

        setSubmittingKey(true);
        try {
            const res = await fetch("/api/admin/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: newProvider,
                    label: newLabel,
                    key: newKeyString,
                    isPremium: newIsPremium
                }),
            });

            if (res.ok) {
                const created = await res.json();
                setKeys([created, ...keys]);
                setNewLabel("");
                setNewKeyString("");
                setNewIsPremium(false);
                showMsg("Clave de API registrada con éxito");
            } else {
                const err = await res.json();
                showMsg(err.error || "Error al registrar la clave", "error");
            }
        } catch (e) {
            showMsg("Error de conexión al registrar la clave", "error");
        } finally {
            setSubmittingKey(false);
        }
    };

    const handleToggleKey = async (id: string, currentActive: boolean) => {
        try {
            const res = await fetch(`/api/admin/api-keys/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !currentActive }),
            });

            if (res.ok) {
                const updated = await res.json();
                setKeys(keys.map(k => k.id === id ? { ...k, active: updated.active } : k));
                showMsg(updated.active ? "Clave activada" : "Clave desactivada");
            }
        } catch (e) {
            showMsg("Error al alternar estado de la clave", "error");
        }
    };

    const handleTogglePremiumKey = async (id: string, currentPremium: boolean) => {
        try {
            const res = await fetch(`/api/admin/api-keys/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPremium: !currentPremium }),
            });

            if (res.ok) {
                const updated = await res.json();
                setKeys(keys.map(k => k.id === id ? { ...k, isPremium: updated.isPremium } : k));
                showMsg(updated.isPremium ? "Clave configurada para Uso Exclusivo ATP" : "Clave configurada para Uso General");
            }
        } catch (e) {
            showMsg("Error al alternar exclusividad de la clave", "error");
        }
    };

    const handleDeleteKey = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar esta clave del pool?")) return;

        try {
            const res = await fetch(`/api/admin/api-keys/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setKeys(keys.filter(k => k.id !== id));
                showMsg("Clave de API eliminada con éxito");
            } else {
                const err = await res.json();
                showMsg(err.error || "Error al eliminar la clave", "error");
            }
        } catch (e) {
            showMsg("Error de conexión al eliminar la clave", "error");
        }
    };

    const handleResetErrorCount = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/api-keys/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "" }), // vacio indica solo resetear errores y reactivar
            });

            if (res.ok) {
                const updated = await res.json();
                setKeys(keys.map(k => k.id === id ? { ...k, errorCount: 0, active: true } : k));
                showMsg("Errores reiniciados y clave reactivada");
            }
        } catch (e) {
            showMsg("Error al restablecer errores de la clave", "error");
        }
    };

    const [resettingAll, setResettingAll] = useState(false);
    const handleResetAllKeys = async (provider: string = "gemini") => {
        if (!confirm(`¿Reactivar y limpiar errores de TODAS las llaves de ${provider}? Esto restablece el pool completo.`)) return;
        setResettingAll(true);
        try {
            const res = await fetch("/api/admin/api-keys", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider }),
            });
            if (res.ok) {
                const data = await res.json();
                showMsg(`✅ Reset de emergencia: ${data.reactivadas} llaves de ${provider} reactivadas y errores limpiados`);
                await fetchData();
            } else {
                const err = await res.json();
                showMsg(err.error || "Error en reset de emergencia", "error");
            }
        } catch (e) {
            showMsg("Error de conexión en reset de emergencia", "error");
        } finally {
            setResettingAll(false);
        }
    };


    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
                <Loader2 className="spin" size={32} />
                <span style={{ marginLeft: "0.5rem" }}>Cargando pool de claves...</span>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
            
            {/* Header */}
            <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                    🔑 Orquestador Multiproveedor y Pool de API Keys
                </h2>
                <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    Administra las llaves de API disponibles y configura qué modelos de IA procesan las autoevaluaciones.
                </p>
            </div>

            {/* Alerta de emergencia si hay llaves fallando */}
            {keys.some(k => !k.active || k.errorCount > 0) && (
                <div style={{
                    padding: "0.75rem 1rem", borderRadius: "8px",
                    background: "#fef2f2", border: "2px solid #fca5a5",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
                    flexWrap: "wrap"
                }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: "#991b1b", fontSize: "0.875rem" }}>
                            ⚠️ {keys.filter(k => !k.active).length} llaves inactivas · {keys.filter(k => k.errorCount > 0).length} con errores acumulados.
                        </p>
                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#7f1d1d" }}>
                            Si las evaluaciones están fallando con "Todas las llaves fallaron", usa el botón de reset.
                        </p>
                    </div>
                    {!readOnly && (
                        <button
                            onClick={() => handleResetAllKeys("gemini")}
                            disabled={resettingAll}
                            style={{
                                padding: "0.5rem 1rem", borderRadius: "6px",
                                background: resettingAll ? "#fee2e2" : "#dc2626", color: "white",
                                border: "none", cursor: resettingAll ? "not-allowed" : "pointer",
                                fontWeight: 700, fontSize: "0.8125rem",
                                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                                whiteSpace: "nowrap", flexShrink: 0
                            }}
                        >
                            {resettingAll ? (
                                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Reseteando...</>
                            ) : (
                                <><RotateCw size={14} /> 🆘 Reset de Emergencia (Reactivar Todas)</>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Model Configuration */}
            <div className="card" style={{ background: "white", padding: "1.5rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Cpu size={20} style={{ color: "var(--primary)" }} /> Modelos Activos por Perfil
                </h3>

                <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                        
                        {/* Standard Model for Directors */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem", borderRadius: "8px", background: "var(--bg-secondary)" }}>
                            <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                👤 Asistente del Director (Uso Estándar)
                            </h4>
                            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Usado para la autoevaluación inicial de directores (PMC/PAEC/Informe Final).
                            </p>
                            
                            <div style={{ marginTop: "0.5rem" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Proveedor</label>
                                <select 
                                    className="form-control"
                                    value={config.providerDefault}
                                    onChange={(e) => {
                                        const prov = e.target.value;
                                        const defaultModel = MODELS[prov]?.[0]?.value || "";
                                        setConfig({ ...config, providerDefault: prov, modelDefault: defaultModel });
                                    }}
                                    style={{ width: "100%", padding: "0.375rem" }}
                                    disabled={readOnly}
                                >
                                    {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Modelo</label>
                                <select 
                                    className="form-control"
                                    value={config.modelDefault}
                                    onChange={(e) => setConfig({ ...config, modelDefault: e.target.value })}
                                    style={{ width: "100%", padding: "0.375rem" }}
                                    disabled={readOnly}
                                >
                                    {(MODELS[config.providerDefault] || []).map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Premium Model for ATP */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem", borderRadius: "8px", background: "var(--bg-secondary)" }}>
                            <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <Sparkles size={14} style={{ color: "#f39c12" }} /> Revisión Oficial ATP (Uso Premium)
                            </h4>
                            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Usado opcionalmente por supervisores para análisis profundos o revisiones premium.
                            </p>

                            <div style={{ marginTop: "0.5rem" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Proveedor</label>
                                <select 
                                    className="form-control"
                                    value={config.providerPremium}
                                    onChange={(e) => {
                                        const prov = e.target.value;
                                        const defaultModel = MODELS[prov]?.[0]?.value || "";
                                        setConfig({ ...config, providerPremium: prov, modelPremium: defaultModel });
                                    }}
                                    style={{ width: "100%", padding: "0.375rem" }}
                                    disabled={readOnly}
                                >
                                    {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Modelo</label>
                                <select 
                                    className="form-control"
                                    value={config.modelPremium}
                                    onChange={(e) => setConfig({ ...config, modelPremium: e.target.value })}
                                    style={{ width: "100%", padding: "0.375rem" }}
                                    disabled={readOnly}
                                >
                                    {(MODELS[config.providerPremium] || []).map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                    </div>

                    {!readOnly && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                            <button 
                                type="submit" 
                                className="btn btn-primary" 
                                disabled={savingConfig}
                                style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
                            >
                                {savingConfig && <Loader2 size={16} className="spin" />}
                                Guardar Configuración de Modelos
                            </button>
                        </div>
                    )}
                </form>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
                
                {/* API Keys List */}
                <div className="card" style={{ background: "white", padding: "1.5rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Key size={20} style={{ color: "var(--primary)" }} /> Pool de Claves de API registradas
                        </h3>
                        {keys.length > 0 && !readOnly && (
                            <button
                                onClick={handleTestAllKeys}
                                disabled={testingAll}
                                className="btn btn-outline"
                                style={{
                                    padding: "0.375rem 0.75rem",
                                    fontSize: "0.8125rem",
                                    fontWeight: 600,
                                    borderColor: "var(--primary)",
                                    color: "var(--primary)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem"
                                }}
                            >
                                {testingAll ? <Loader2 size={14} className="spin" /> : <FlaskConical size={14} />}
                                {testingAll ? "Probando llaves..." : "🧪 Probar Todas las Llaves"}
                            </button>
                        )}
                    </div>

                    {keys.length === 0 ? (
                        <div style={{ padding: "2rem", textAlign: "center", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                            <AlertCircle size={36} style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }} />
                            <p style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)" }}>No hay claves de API registradas en la base de datos.</p>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                El orquestador usará las claves por defecto declaradas en las variables de entorno (.env).
                            </p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Proveedor</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Etiqueta</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Clave (Enmascarada)</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Uso Exclusivo ATP</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>📊 Usos Exitosos</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>🤖 Último Modelo</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Errores Recientes</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Estado</th>
                                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {keys.map(k => {
                                        const isInactiveDueToErrors = k.errorCount >= 5;
                                        const tRes = testResults[k.id];
                                        const formattedLastUsed = k.lastUsedAt
                                            ? new Date(k.lastUsedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                                            : "Sin uso";

                                        return (
                                            <>
                                                <tr key={k.id} style={{ borderBottom: tRes?.message ? "none" : "1px solid var(--border)", background: isInactiveDueToErrors ? "#fff5f5" : "inherit" }}>
                                                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>
                                                        {PROVIDERS.find(p => p.value === k.provider)?.label || k.provider}
                                                    </td>
                                                    <td style={{ padding: "0.5rem 0.75rem" }}>{k.label}</td>
                                                    <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace" }}>{k.key}</td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                        <button
                                                            onClick={() => handleTogglePremiumKey(k.id, k.isPremium)}
                                                            disabled={readOnly}
                                                            style={{
                                                                background: "none",
                                                                border: "none",
                                                                cursor: readOnly ? "default" : "pointer",
                                                                display: "inline-flex",
                                                                alignItems: "center"
                                                            }}
                                                            title={k.isPremium ? "Hacer de Uso General" : "Hacer de Uso Exclusivo ATP"}
                                                        >
                                                            {k.isPremium ? (
                                                                <span style={{ background: "#fef9c3", color: "#854d0e", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600 }}>
                                                                    ⭐ Sí
                                                                </span>
                                                            ) : (
                                                                <span style={{ background: "#f3f4f6", color: "#4b5563", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 500 }}>
                                                                    General
                                                                </span>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                        <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                                                            {k.usageCount || 0}
                                                        </span>
                                                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                                            {formattedLastUsed}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                        {k.lastModel ? (
                                                            <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600 }}>
                                                                {k.lastModel}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                        {k.errorCount > 0 ? (
                                                            <span style={{ color: k.errorCount >= 5 ? "var(--error)" : "var(--warning)", fontWeight: 700 }}>
                                                                ⚠️ {k.errorCount} {k.errorCount >= 5 ? "(Bloqueada)" : ""}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "var(--success)" }}>0 (Sin errores)</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                        <button
                                                            onClick={() => handleToggleKey(k.id, k.active)}
                                                            disabled={readOnly}
                                                            style={{ background: "none", border: "none", cursor: readOnly ? "default" : "pointer", color: k.active ? "var(--success)" : "var(--text-muted)", display: "inline-flex" }}
                                                        >
                                                            {k.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                                        </button>
                                                    </td>
                                                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                                                        {readOnly ? (
                                                            <span style={{ color: "var(--text-muted)" }}>-</span>
                                                        ) : (
                                                            <div style={{ display: "flex", justifyContent: "center", gap: "0.25rem" }}>
                                                                <button
                                                                    onClick={() => handleTestSingleKey(k.id)}
                                                                    disabled={tRes?.loading}
                                                                    className="btn btn-outline"
                                                                    style={{ padding: "2px 8px", fontSize: "0.7rem", color: "var(--primary)", borderColor: "var(--primary)" }}
                                                                    title="Probar validez y cuotas de esta llave"
                                                                >
                                                                    {tRes?.loading ? (
                                                                        <Loader2 size={12} className="spin" />
                                                                    ) : (
                                                                        <><FlaskConical size={12} /> Probar</>
                                                                    )}
                                                                </button>
                                                                {k.errorCount > 0 && (
                                                                    <button
                                                                        onClick={() => handleResetErrorCount(k.id)}
                                                                        className="btn btn-outline"
                                                                        style={{ padding: "2px 6px", fontSize: "0.7rem", color: "var(--warning)", borderColor: "var(--warning)" }}
                                                                        title="Reiniciar contador de errores y reactivar clave"
                                                                    >
                                                                        <RotateCw size={12} /> Reiniciar
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteKey(k.id)}
                                                                    className="btn btn-outline"
                                                                    style={{ padding: "2px 6px", color: "var(--error)", borderColor: "var(--error)" }}
                                                                    title="Eliminar clave"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {tRes?.message && (
                                                    <tr style={{ borderBottom: "1px solid var(--border)", background: "#fafafa" }}>
                                                        <td colSpan={9} style={{ padding: "0.35rem 0.75rem 0.5rem 0.75rem" }}>
                                                            <div style={{
                                                                fontSize: "0.75rem",
                                                                fontWeight: 600,
                                                                padding: "0.35rem 0.75rem",
                                                                borderRadius: "6px",
                                                                background: tRes.status === "OK_PRO" ? "#ecfdf5" : tRes.status === "OK_FREE" ? "#f0fdf4" : tRes.status === "QUOTA_EXHAUSTED" ? "#fef2f2" : tRes.status === "RATE_LIMITED" ? "#fffbebe" : "#fef2f2",
                                                                color: tRes.status === "OK_PRO" || tRes.status === "OK_FREE" ? "#15803d" : tRes.status === "QUOTA_EXHAUSTED" || tRes.status === "INVALID_KEY" ? "#b91c1c" : "#b45309",
                                                                border: `1px solid ${tRes.status === "OK_PRO" || tRes.status === "OK_FREE" ? "#bbf7d0" : tRes.status === "QUOTA_EXHAUSTED" || tRes.status === "INVALID_KEY" ? "#fca5a5" : "#fde68a"}`
                                                            }}>
                                                                {tRes.message}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {!readOnly && (
                    <div className="card" style={{ background: "white", padding: "1.5rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
                        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <Plus size={20} style={{ color: "var(--primary)" }} /> Registrar Nueva Clave de API
                        </h3>

                        <form onSubmit={handleAddKey} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", alignItems: "end" }}>
                            
                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Proveedor de IA</label>
                                <select
                                    className="form-control"
                                    value={newProvider}
                                    onChange={(e) => setNewProvider(e.target.value)}
                                    style={{ width: "100%", padding: "0.375rem" }}
                                >
                                    {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Etiqueta Descriptiva</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="ej. Gemini Cuenta Gratuita 1"
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    style={{ width: "100%", padding: "0.375rem" }}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Clave de API (Key)</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    placeholder="Pegar clave de API"
                                    value={newKeyString}
                                    onChange={(e) => setNewKeyString(e.target.value)}
                                    style={{ width: "100%", padding: "0.375rem" }}
                                    required
                                />
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", height: "38px" }}>
                                <input
                                    type="checkbox"
                                    id="isPremiumKey"
                                    checked={newIsPremium}
                                    onChange={(e) => setNewIsPremium(e.target.checked)}
                                    style={{ width: "16px", height: "16px" }}
                                />
                                <label htmlFor="isPremiumKey" style={{ fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                                    ⭐ Usar solo para ATP (Premium)
                                </label>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submittingKey}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", width: "100%", justifyContent: "center" }}
                                >
                                    {submittingKey ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                                    Registrar Clave
                                </button>
                            </div>

                        </form>
                    </div>
                )}

            </div>

        </div>
    );
}
