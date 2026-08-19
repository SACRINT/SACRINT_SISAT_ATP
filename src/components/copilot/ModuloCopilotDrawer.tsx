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
            className="text-indigo-400 hover:text-indigo-300 underline break-all font-medium"
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
          <strong className="font-semibold text-slate-100">{matchClaveValor[1]}</strong>
          <span>{renderizarLinks(matchClaveValor[2])}</span>
        </span>
      );
    }

    return renderizarLinks(sinAsteriscos);
  };

  return (
    <div className="flex flex-col gap-2">
      {bloques.map((b, idx) => {
        if (b.tipo === "encabezado") {
          return (
            <div
              key={idx}
              className="font-bold text-indigo-300 text-xs sm:text-sm mt-1 mb-0.5"
            >
              {renderTextoEnLinea(b.contenido as string)}
            </div>
          );
        }
        if (b.tipo === "lista") {
          return (
            <ul
              key={idx}
              className="my-0.5 pl-4 flex flex-col gap-1.5 list-disc"
            >
              {(b.contenido as string[]).map((item, itemIdx) => (
                <li key={itemIdx} className="leading-relaxed">
                  {renderTextoEnLinea(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="m-0 leading-relaxed">
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
        }}
      >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  {titulo}
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-normal">
                    IA NEM
                  </span>
                </h3>
                {subtitulo && (
                  <p className="text-xs text-slate-400 truncate max-w-xs">{subtitulo}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setExpandido(!expandido)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title={expandido ? "Reducir panel" : "Expandir panel"}
              >
                {expandido ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Cerrar panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Acciones Rápidas (Chips de 1 Clic) */}
          {accionesSugeridas.length > 0 && (
            <div className="p-3 bg-slate-950/40 border-b border-slate-800/80 overflow-x-auto">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Acciones Rápidas Sugeridas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {accionesSugeridas.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => enviarMensaje(acc.prompt)}
                    disabled={cargando}
                    className="text-xs bg-slate-800/90 hover:bg-indigo-600/30 hover:border-indigo-500/40 text-slate-200 border border-slate-700/70 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-left disabled:opacity-50"
                  >
                    <span>{acc.etiqueta}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm scrollbar-thin scrollbar-thumb-slate-700">
            {mensajes.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl p-3.5 shadow-md ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-none"
                    }`}
                  >
                    <div className="font-sans text-xs sm:text-sm">
                      <FormateadorTextoCopilot texto={m.content} />
                    </div>

                    {/* Acciones para mensajes del Asistente */}
                    {!isUser && (
                      <div className="mt-3 pt-2 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copiarAlPortapapeles(m.content, idx)}
                            className="flex items-center gap-1 text-slate-400 hover:text-indigo-300 transition-colors"
                          >
                            {copiadoIdx === idx ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>

                          {onInsertarTexto && (
                            <button
                              onClick={() => onInsertarTexto(m.content)}
                              className="flex items-center gap-1 text-slate-400 hover:text-emerald-300 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Insertar en formulario</span>
                            </button>
                          )}
                        </div>

                        {m.herramientasEjecutadas && m.herramientasEjecutadas.length > 0 && (
                          <span className="text-[10px] text-slate-500 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800">
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
              <div className="flex items-center gap-2 text-slate-400 text-xs p-3 bg-slate-800/50 rounded-xl w-fit border border-slate-700/40">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Analizando datos normativos y generando propuesta...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Footer / Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensaje(inputTexto);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputTexto}
                onChange={(e) => setInputTexto(e.target.value)}
                placeholder="Escribe una instrucción o pregunta al Copiloto..."
                disabled={cargando}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputTexto.trim() || cargando}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="mt-2 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
              <span>Zero-Trust | Datos PII protegidos conforme a la Regla 7</span>
            </div>
          </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
