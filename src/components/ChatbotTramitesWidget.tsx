"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  RefreshCw,
  BookOpen,
  HelpCircle,
  FileText,
  Trash2,
  ChevronDown,
  Volume2
} from "lucide-react";

export interface ChatMensajeTramite {
  role: "user" | "assistant";
  content: string;
  fuentes?: Array<{ id: string; titulo: string; categoria: string }>;
  createdAt?: string;
}

const PREGUNTAS_SUGERIDAS = [
  "¿Qué formato lleva la ficha CAPEMS para Matemáticas?",
  "¿Cuándo es la fecha límite del PAEC?",
  "¿Cuál es la rúbrica de Formación Laboral en USICAMM?",
  "¿Qué requisitos exige la Circular 03?"
];

export default function ChatbotTramitesWidget({ escuelaId }: { escuelaId?: string }) {
  const [abierto, setAbierto] = useState<boolean>(false);
  const [mensaje, setMensaje] = useState<string>("");
  const [cargando, setCargando] = useState<boolean>(false);
  const [historial, setHistorial] = useState<ChatMensajeTramite[]>([
    {
      role: "assistant",
      content: "👋 ¡Hola! Soy el **Asistente Virtual de Trámites y Normativa SEP** de la Supervisión Escolar.\n\nPuedes preguntarme a cualquier hora sobre fechas del PAEC/PEC, formatos CAPEMS, rúbricas USICAMM o circulares oficiales. ¿En qué te puedo ayudar hoy?"
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (abierto) {
      scrollToBottom();
    }
  }, [historial, abierto]);

  // Enviar consulta al backend RAG
  const handleEnviar = async (textoAEnviar?: string) => {
    const consulta = (textoAEnviar || mensaje).trim();
    if (!consulta || cargando) return;

    setMensaje("");
    setCargando(true);

    const nuevoHistorial: ChatMensajeTramite[] = [
      ...historial,
      { role: "user", content: consulta }
    ];
    setHistorial(nuevoHistorial);

    try {
      const res = await fetch("/api/tramites/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: consulta, escuelaId })
      });

      const data = await res.json();
      if (data.success) {
        setHistorial([
          ...nuevoHistorial,
          {
            role: "assistant",
            content: data.respuesta,
            fuentes: data.fuentes
          }
        ]);
      } else {
        setHistorial([
          ...nuevoHistorial,
          {
            role: "assistant",
            content: "⚠️ " + (data.error || "No fue posible procesar tu consulta en este momento.")
          }
        ]);
      }
    } catch (err) {
      setHistorial([
        ...nuevoHistorial,
        {
          role: "assistant",
          content: "⚠️ Error de conexión con el Asistente de Trámites SEP."
        }
      ]);
    } finally {
      setCargando(false);
    }
  };

  const handleLimpiar = () => {
    setHistorial([
      {
        role: "assistant",
        content: "👋 Historial reiniciado. ¿En qué trámite o normativa SEP puedo ayudarte?"
      }
    ]);
  };

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999, fontFamily: "inherit" }}>
      {/* Panel Deslizable del Chatbot */}
      {abierto && (
        <div
          style={{
            position: "absolute",
            bottom: "70px",
            right: 0,
            width: "380px",
            height: "560px",
            maxHeight: "calc(100vh - 100px)",
            background: "#0f172a",
            borderRadius: "20px",
            border: "1px solid #334155",
            boxShadow: "0 20px 35px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "all 0.3s ease"
          }}
        >
          {/* Header del Chatbot */}
          <div
            style={{
              padding: "1rem 1.25rem",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              borderBottom: "1px solid #334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  padding: "0.5rem",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 12px rgba(37, 99, 235, 0.4)"
                }}
              >
                <Sparkles style={{ width: "20px", height: "20px", color: "#ffffff" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#ffffff", margin: 0, lineHeight: 1.2 }}>
                  Asistente Trámites SEP
                </h3>
                <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }}></span>
                  Supervisión Escolar 24/7
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <button
                onClick={handleLimpiar}
                title="Limpiar conversación"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  color: "#94a3b8",
                  padding: "0.4rem",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                <Trash2 style={{ width: "16px", height: "16px" }} />
              </button>
              <button
                onClick={() => setAbierto(false)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  color: "#ffffff",
                  padding: "0.4rem",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>
          </div>

          {/* Historial de Conversación */}
          <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {historial.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem"
                }}
              >
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "#2563eb" : "#1e293b",
                    color: "#ffffff",
                    fontSize: "0.8125rem",
                    lineHeight: 1.5,
                    border: msg.role === "user" ? "none" : "1px solid #334155",
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {msg.content}
                </div>

                {msg.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => {
                      if ("speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(msg.content);
                        utterance.lang = "es-MX";
                        utterance.rate = 1.0;
                        window.speechSynthesis.speak(utterance);
                      }
                    }}
                    title="Escuchar respuesta"
                    style={{
                      alignSelf: "flex-start",
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: "0",
                      marginTop: "2px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.7rem"
                    }}
                  >
                    <Volume2 style={{ width: "14px", height: "14px" }} />
                    <span>Leer respuesta</span>
                  </button>
                )}

                {/* Fuentes oficial citadas si existen */}
                {msg.fuentes && msg.fuentes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.2rem" }}>
                    {msg.fuentes.map((f, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: "rgba(37, 99, 235, 0.15)",
                          color: "#60a5fa",
                          border: "1px solid rgba(96, 165, 250, 0.3)",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "6px",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem"
                        }}
                      >
                        <FileText style={{ width: "10px", height: "10px" }} /> {f.titulo}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {cargando && (
              <div style={{ alignSelf: "flex-start", background: "#1e293b", padding: "0.75rem 1rem", borderRadius: "16px", border: "1px solid #334155", display: "flex", alignItems: "center", gap: "0.5rem", color: "#60a5fa", fontSize: "0.8125rem" }}>
                <RefreshCw style={{ width: "15px", height: "15px", animation: "spin 1s linear infinite" }} />
                <span>Consultando normativas SEP...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Preguntas Sugeridas */}
          {historial.length <= 2 && (
            <div style={{ padding: "0.5rem 1rem", background: "rgba(15,23,42,0.9)", borderTop: "1px solid #1e293b" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#94a3b8", display: "block", marginBottom: "0.4rem" }}>
                💡 Preguntas frecuentes:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {PREGUNTAS_SUGERIDAS.map((preg, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEnviar(preg)}
                    style={{
                      textAlign: "left",
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#cbd5e1",
                      padding: "0.4rem 0.65rem",
                      borderRadius: "8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {preg}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Formulario */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEnviar();
            }}
            style={{ padding: "0.85rem", background: "#1e293b", borderTop: "1px solid #334155", display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="text"
              placeholder="Escribe tu duda sobre trámites SEP..."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              disabled={cargando}
              style={{
                flex: 1,
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "0.6rem 0.85rem",
                color: "#ffffff",
                fontSize: "0.8125rem",
                outline: "none"
              }}
            />
            <button
              type="submit"
              disabled={!mensaje.trim() || cargando}
              style={{
                background: mensaje.trim() && !cargando ? "#2563eb" : "#334155",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "0.65rem",
                cursor: mensaje.trim() && !cargando ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Send style={{ width: "16px", height: "16px" }} />
            </button>
          </form>
        </div>
      )}

      {/* Botón Flotante Principal */}
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          color: "#ffffff",
          border: "none",
          padding: "0.85rem 1.25rem",
          borderRadius: "50px",
          fontWeight: 800,
          fontSize: "0.875rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          boxShadow: "0 10px 25px rgba(37, 99, 235, 0.4)",
          transition: "transform 0.2s ease, boxShadow 0.2s ease"
        }}
      >
        <div style={{ position: "relative" }}>
          <Sparkles style={{ width: "20px", height: "20px" }} />
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "8px",
              height: "8px",
              background: "#22c55e",
              borderRadius: "50%",
              boxShadow: "0 0 6px #22c55e"
            }}
          ></span>
        </div>
        <span>{abierto ? "Cerrar Asistente SEP" : "🤖 Trámites IA SEP 24/7"}</span>
      </button>
    </div>
  );
}
