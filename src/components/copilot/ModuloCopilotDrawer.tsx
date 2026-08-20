"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  X,
  Send,
  RefreshCw,
  Copy,
  Check,
  FileText,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Maximize2,
  Minimize2
} from "lucide-react";

export interface AccionSugerida {
  id: string;
  etiqueta: string;
  prompt: string;
  descripcion?: string;
}

export interface ModuloCopilotDrawerProps {
  modulo: "oficios" | "estadistica_911" | "usicamm" | "expedientes_personal";
  titulo: string;
  subtitulo?: string;
  isOpen: boolean;
  onClose: () => void;
  accionesSugeridas?: AccionSugerida[];
  onInsertarTexto?: (texto: string) => void;
}

interface Mensaje {
  role: "user" | "assistant";
  content: string;
  fuentes?: string[];
  herramientasEjecutadas?: string[];
}

function FormateadorTextoCopilot({ texto }: { texto: string }) {
  if (!texto) return null;

  const lineas = texto.split("\n");
  const bloques: Array<{ tipo: "parrafo" | "lista" | "encabezado"; contenido: string | string[] }> = [];
  let listaActual: string[] = [];

  const flushLista = () => {
    if (listaActual.length > 0) {
      bloques.push({ tipo: "lista", contenido: [...listaActual] });
      listaActual = [];
    }
  };

  for (let i = 0; i < lineas.length; i++) {
    const rawLinea = lineas[i];
    const linea = rawLinea.trim();

    if (!linea) {
      flushLista();
      continue;
    }

    const matchPunto = /^[•\-\*]\s+(.*)$/.exec(linea);
    const matchNumero = /^(\d+[\.\)])\s+(.*)$/.exec(linea);

    if (matchPunto) {
      listaActual.push(matchPunto[1]);
    } else if (matchNumero) {
      listaActual.push(`${matchNumero[1]} ${matchNumero[2]}`);
    } else if (linea.startsWith("#")) {
      flushLista();
      const encabezado = linea.replace(/^#+\s*/, "");
      bloques.push({ tipo: "encabezado", contenido: encabezado });
    } else {
      flushLista();
      bloques.push({ tipo: "parrafo", contenido: linea });
    }
  }

  flushLista();

  const renderizarLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s\)]+)/g;
    const partes = text.split(urlRegex);
    return partes.map((parte, idx) => {
      if (parte.match(urlRegex)) {
        return (
          <a
            key={idx}
            href={parte}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#818cf8",
              textDecoration: "underline",
              wordBreak: "break-all",
              fontWeight: 500,
            }}
          >
            {parte}
          </a>
        );
      }
      return parte;
    });
  };

  const renderTextoEnLinea = (str: string) => {
    const sinAsteriscos = str
      .replace(/\*\*\*([^\*\n]+)\*\*\*/g, "$1")
      .replace(/\*\*([^\*\n]+)\*\*/g, "$1")
      .replace(/__([^_\n]+)__/g, "$1")
      .replace(/\*([^\*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1")
      .replace(/\*+/g, "");

    const matchClaveValor = /^([^:]{2,45}:\s*)(.*)$/.exec(sinAsteriscos);
    if (matchClaveValor && !sinAsteriscos.startsWith("http") && !sinAsteriscos.startsWith("Estimado") && !sinAsteriscos.startsWith("Conforme") && !sinAsteriscos.startsWith("Saludos")) {
      return (
        <span>
          <strong style={{ fontWeight: 700, color: "#ffffff" }}>{matchClaveValor[1]}</strong>
          <span>{renderizarLinks(matchClaveValor[2])}</span>
        </span>
      );
    }

    return renderizarLinks(sinAsteriscos);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {bloques.map((b, idx) => {
        if (b.tipo === "encabezado") {
          return (
            <div
              key={idx}
              style={{
                fontWeight: 700,
                color: "#a5b4fc",
                fontSize: "0.875rem",
                marginTop: "0.4rem",
                marginBottom: "0.2rem",
                lineHeight: 1.4,
              }}
            >
              {renderTextoEnLinea(b.contenido as string)}
            </div>
          );
        }
        if (b.tipo === "lista") {
          return (
            <ul
              key={idx}
              style={{
                margin: "0.25rem 0",
                paddingLeft: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                listStyleType: "disc",
              }}
            >
              {(b.contenido as string[]).map((item, itemIdx) => (
                <li key={itemIdx} style={{ lineHeight: 1.5, fontSize: "0.85rem" }}>
                  {renderTextoEnLinea(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} style={{ margin: 0, lineHeight: 1.55, fontSize: "0.85rem" }}>
            {renderTextoEnLinea(b.contenido as string)}
          </p>
        );
      })}
    </div>
  );
}

export default function ModuloCopilotDrawer({
  modulo,
  titulo,
  subtitulo,
  isOpen,
  onClose,
  accionesSugeridas = [],
  onInsertarTexto
}: ModuloCopilotDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [inputTexto, setInputTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const [expandido, setExpandido] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Cargar mensaje de bienvenida contextual cuando se abre
  useEffect(() => {
    if (isOpen && mensajes.length === 0) {
      let bienvenida = "";
      if (modulo === "oficios") {
        bienvenida = "¡Hola! Soy tu Copiloto de Oficios y Circulares. Puedo redactar propuestas institucionales con fundamento en la NEM, resumir oficios largos o verificar los plazos de entrega de la zona.";
      } else if (modulo === "estadistica_911") {
        bienvenida = "¡Hola! Soy tu Copiloto de Estadística 911. Puedo auditar la coherencia aritmética de tu matrícula (H+M = Total), revisar alumnos por grupo y comparar cortes estadísticos.";
      } else if (modulo === "usicamm") {
        bienvenida = "¡Hola! Soy tu Copiloto de USICAMM. Puedo orientarte sobre los requisitos de promoción vertical/horizontal, horas adicionales, fechas en plataforma Venus y normativas aplicables.";
      } else if (modulo === "expedientes_personal") {
        bienvenida = "¡Hola! Soy tu Copiloto de Expedientes de Personal. Puedo informarte sobre la plantilla de docentes, directivos y administrativos, auditar la integración de los 10 documentos obligatorios e identificar faltantes.";
      } else {
        bienvenida = "¡Hola! Soy tu Asistente Inteligente especializado en este módulo. ¿En qué puedo apoyarte hoy?";
      }

      setMensajes([
        {
          role: "assistant",
          content: bienvenida
        }
      ]);
    }
  }, [isOpen, modulo, mensajes.length]);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes, isOpen]);

  const enviarMensaje = async (texto: string) => {
    if (!texto.trim() || cargando) return;

    const nuevoMensajeUsuario: Mensaje = { role: "user", content: texto.trim() };
    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    setInputTexto("");
    setCargando(true);

    try {
      const res = await fetch("/api/tramites/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: texto.trim(),
          modulo
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMensajes((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.respuesta,
            fuentes: data.fuentes,
            herramientasEjecutadas: data.herramientasEjecutadas
          }
        ]);
      } else {
        setMensajes((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Ocurrió un error al procesar tu consulta con el asistente."
          }
        ]);
      }
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "No fue posible conectar con el servicio de IA. Verifica tu conexión e intenta nuevamente."
        }
      ]);
    } finally {
      setCargando(false);
    }
  };

  const copiarAlPortapapeles = (texto: string, idx: number) => {
    navigator.clipboard.writeText(texto);
    setCopiadoIdx(idx);
    setTimeout(() => setCopiadoIdx(null), 2500);
  };

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-drawer-title"
    >
      <div
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: expandido ? "760px" : "480px",
          background: "#0f172a",
          color: "#ffffff",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          transition: "max-width 0.3s ease",
          boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.4)",
          borderLeft: "1px solid #334155",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid #334155",
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
            <div
              style={{
                padding: "0.5rem",
                borderRadius: "10px",
                backgroundColor: "rgba(99, 102, 241, 0.18)",
                color: "#818cf8",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                id="copilot-drawer-title"
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  lineHeight: 1.25,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    backgroundColor: "rgba(99, 102, 241, 0.2)",
                    color: "#a5b4fc",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    border: "1px solid rgba(99, 102, 241, 0.35)",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  IA NEM
                </span>
              </h3>
              {subtitulo && (
                <p
                  style={{
                    margin: "0.2rem 0 0 0",
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {subtitulo}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
            <button
              onClick={() => setExpandido(!expandido)}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#cbd5e1",
                cursor: "pointer",
                padding: "0.45rem",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "#cbd5e1";
              }}
              title={expandido ? "Reducir panel" : "Expandir panel"}
            >
              {expandido ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#cbd5e1",
                cursor: "pointer",
                padding: "0.45rem",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "#cbd5e1";
              }}
              title="Cerrar panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Acciones Rápidas (Chips de 1 Clic) */}
        {accionesSugeridas.length > 0 && (
          <div
            className="copilot-scroll"
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "#0b0f19",
              borderBottom: "1px solid #1e293b",
              overflowX: "auto",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <Sparkles size={12} style={{ color: "#818cf8" }} /> Acciones Rápidas Sugeridas
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {accionesSugeridas.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => enviarMensaje(acc.prompt)}
                  disabled={cargando}
                  style={{
                    fontSize: "0.75rem",
                    backgroundColor: "#1e293b",
                    color: "#e2e8f0",
                    border: "1px solid #334155",
                    padding: "0.4rem 0.65rem",
                    borderRadius: "8px",
                    cursor: cargando ? "not-allowed" : "pointer",
                    opacity: cargando ? 0.5 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!cargando) {
                      e.currentTarget.style.backgroundColor = "rgba(79, 70, 229, 0.25)";
                      e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
                      e.currentTarget.style.color = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!cargando) {
                      e.currentTarget.style.backgroundColor = "#1e293b";
                      e.currentTarget.style.borderColor = "#334155";
                      e.currentTarget.style.color = "#e2e8f0";
                    }
                  }}
                >
                  <span>{acc.etiqueta}</span>
                  <ArrowRight size={12} style={{ color: "#94a3b8" }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Historial de Mensajes */}
        <div
          className="copilot-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            background: "#090d16",
          }}
        >
          {mensajes.map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: isUser ? "85%" : "95%",
                    padding: "0.875rem 1rem",
                    borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                    background: isUser
                      ? "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)"
                      : "#1e293b",
                    color: isUser ? "#ffffff" : "#f1f5f9",
                    border: isUser ? "none" : "1px solid #334155",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <div style={{ fontFamily: "inherit" }}>
                    <FormateadorTextoCopilot texto={m.content} />
                  </div>

                  {/* Acciones para mensajes del Asistente */}
                  {!isUser && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        paddingTop: "0.5rem",
                        borderTop: "1px solid rgba(51, 65, 85, 0.7)",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <button
                          onClick={() => copiarAlPortapapeles(m.content, idx)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            background: "none",
                            border: "none",
                            color: copiadoIdx === idx ? "#34d399" : "#94a3b8",
                            cursor: "pointer",
                            padding: "0.2rem 0.4rem",
                            borderRadius: "4px",
                            fontWeight: 500,
                            transition: "color 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (copiadoIdx !== idx) e.currentTarget.style.color = "#a5b4fc";
                          }}
                          onMouseLeave={(e) => {
                            if (copiadoIdx !== idx) e.currentTarget.style.color = "#94a3b8";
                          }}
                        >
                          {copiadoIdx === idx ? (
                            <>
                              <Check size={14} style={{ color: "#34d399" }} />
                              <span style={{ color: "#34d399", fontWeight: 600 }}>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        {onInsertarTexto && (
                          <button
                            onClick={() => onInsertarTexto(m.content)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              background: "none",
                              border: "none",
                              color: "#94a3b8",
                              cursor: "pointer",
                              padding: "0.2rem 0.4rem",
                              borderRadius: "4px",
                              fontWeight: 500,
                              transition: "color 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#6ee7b7";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#94a3b8";
                            }}
                          >
                            <FileText size={14} />
                            <span>Insertar en formulario</span>
                          </button>
                        )}
                      </div>

                      {m.herramientasEjecutadas && m.herramientasEjecutadas.length > 0 && (
                        <span
                          style={{
                            fontSize: "0.625rem",
                            color: "#64748b",
                            backgroundColor: "rgba(15, 23, 42, 0.8)",
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            border: "1px solid #1e293b",
                          }}
                        >
                          ⚡ {m.herramientasEjecutadas.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {cargando && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#94a3b8",
                fontSize: "0.75rem",
                padding: "0.75rem 1rem",
                backgroundColor: "rgba(30, 41, 59, 0.7)",
                borderRadius: "12px",
                width: "fit-content",
                border: "1px solid rgba(51, 65, 85, 0.5)",
              }}
            >
              <RefreshCw size={16} style={{ color: "#818cf8", animation: "spin 1s linear infinite" }} />
              <span>Analizando datos normativos y generando propuesta...</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Footer / Input */}
        <div
          style={{
            padding: "0.875rem 1rem",
            borderTop: "1px solid #1e293b",
            backgroundColor: "#0b0f19",
            flexShrink: 0,
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviarMensaje(inputTexto);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <input
              type="text"
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              placeholder="Escribe una instrucción o pregunta al Copiloto..."
              disabled={cargando}
              style={{
                flex: 1,
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "0.65rem 0.85rem",
                fontSize: "0.85rem",
                color: "#ffffff",
                outline: "none",
                transition: "border-color 0.15s ease",
                opacity: cargando ? 0.6 : 1,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#334155";
              }}
            />
            <button
              type="submit"
              disabled={!inputTexto.trim() || cargando}
              style={{
                padding: "0.65rem 0.85rem",
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                cursor: !inputTexto.trim() || cargando ? "not-allowed" : "pointer",
                opacity: !inputTexto.trim() || cargando ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (inputTexto.trim() && !cargando) {
                  e.currentTarget.style.backgroundColor = "#4338ca";
                }
              }}
              onMouseLeave={(e) => {
                if (inputTexto.trim() && !cargando) {
                  e.currentTarget.style.backgroundColor = "#4f46e5";
                }
              }}
            >
              <Send size={16} />
            </button>
          </form>
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.625rem",
              color: "#64748b",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.25rem",
            }}
          >
            <span>Zero-Trust | Datos PII protegidos conforme a la Regla 7</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

