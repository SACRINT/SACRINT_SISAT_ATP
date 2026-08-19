"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Archive,
  RefreshCw,
  Clock,
  School,
  ShieldAlert,
} from "lucide-react";

export interface AlertaItem {
  id: string;
  tenantId: string;
  reglaCodigo: string;
  criticidad: "CRITICA" | "ADVERTENCIA" | "INFORMATIVA";
  escuelaId?: string | null;
  titulo: string;
  descripcion: string;
  metadata?: any;
  leida: boolean;
  fechaLeida?: string | null;
  archivada: boolean;
  notificadaEmail: boolean;
  notificadan8n: boolean;
  createdAt: string;
  escuela?: {
    id: string;
    nombre: string;
    cct: string;
  } | null;
}

interface CentroAlertasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertasActualizadas?: (totalNoLeidas: number, totalCriticas: number) => void;
}

export default function CentroAlertasDrawer({
  isOpen,
  onClose,
  onAlertasActualizadas,
}: CentroAlertasDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroTab, setFiltroTab] = useState<"TODAS" | "CRITICA" | "ADVERTENCIA" | "INFORMATIVA">("TODAS");
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [totalCriticas, setTotalCriticas] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cargarAlertas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vigilancia/alertas");
      if (res.ok) {
        const data = await res.json();
        const items: AlertaItem[] = data.alertas || [];
        setAlertas(items);
        const noLeidas = data.totalNoLeidas || 0;
        const criticas = data.totalCriticas || 0;
        setTotalNoLeidas(noLeidas);
        setTotalCriticas(criticas);
        if (onAlertasActualizadas) {
          onAlertasActualizadas(noLeidas, criticas);
        }
      }
    } catch (err) {
      console.error("Error al cargar alertas:", err);
    } finally {
      setLoading(false);
    }
  }, [onAlertasActualizadas]);

  useEffect(() => {
    if (isOpen) {
      cargarAlertas();
    }
  }, [isOpen, cargarAlertas]);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const marcarComoLeida = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/vigilancia/alertas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leida: true }),
      });
      if (res.ok) {
        setAlertas((prev) =>
          prev.map((a) => (a.id === id ? { ...a, leida: true, fechaLeida: new Date().toISOString() } : a))
        );
        const nuevasNoLeidas = Math.max(0, totalNoLeidas - 1);
        setTotalNoLeidas(nuevasNoLeidas);
        if (onAlertasActualizadas) onAlertasActualizadas(nuevasNoLeidas, totalCriticas);
      }
    } catch (err) {
      console.error("Error al marcar alerta como leída:", err);
    }
  };

  const archivarAlerta = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/vigilancia/alertas/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAlertas((prev) => prev.filter((a) => a.id !== id));
        cargarAlertas();
      }
    } catch (err) {
      console.error("Error al archivar alerta:", err);
    }
  };

  const alertasFiltradas = alertas.filter((a) => {
    if (filtroTab === "TODAS") return true;
    return a.criticidad === filtroTab;
  });

  const countCriticas = alertas.filter((a) => a.criticidad === "CRITICA").length;
  const countAdvertencias = alertas.filter((a) => a.criticidad === "ADVERTENCIA").length;
  const countInformativas = alertas.filter((a) => a.criticidad === "INFORMATIVA").length;

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="centro-alertas-title"
    >
      <div
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #334155",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                color: "#fbbf24",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2
                id="centro-alertas-title"
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: 0,
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                }}
              >
                Centro de Alertas
              </h2>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  margin: "0.2rem 0 0 0",
                  fontWeight: 500,
                }}
              >
                Vigilancia Proactiva Institucional • Zona 004
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={cargarAlertas}
              title="Actualizar alertas"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#cbd5e1",
                cursor: "pointer",
                padding: "0.5rem",
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
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>

            <button
              onClick={onClose}
              title="Cerrar panel"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#cbd5e1",
                cursor: "pointer",
                padding: "0.5rem",
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
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Banner de alertas críticas */}
        {totalCriticas > 0 && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              borderBottom: "1px solid #fee2e2",
              padding: "0.875rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertOctagon size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#991b1b",
                  margin: 0,
                  lineHeight: 1.35,
                }}
              >
                Se detectaron{" "}
                <strong style={{ fontWeight: 800 }}>
                  {totalCriticas} alerta(s) crítica(s)
                </strong>{" "}
                que requieren atención inmediata.
              </p>
            </div>
          </div>
        )}

        {/* Tabs de Filtro */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            padding: "0.5rem 1rem 0 1rem",
            display: "flex",
            gap: "0.375rem",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          {[
            { id: "TODAS", label: `Todas (${alertas.length})`, dot: null },
            { id: "CRITICA", label: `Críticas (${countCriticas})`, dot: "#dc2626" },
            { id: "ADVERTENCIA", label: `Advertencias (${countAdvertencias})`, dot: "#d97706" },
            { id: "INFORMATIVA", label: `Info (${countInformativas})`, dot: "#2563eb" },
          ].map((tab) => {
            const isActive = filtroTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFiltroTab(tab.id as any)}
                style={{
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#0f172a" : "#64748b",
                  backgroundColor: isActive ? "#ffffff" : "transparent",
                  borderTop: isActive ? "2px solid #2563eb" : "2px solid transparent",
                  borderLeft: isActive ? "1px solid #e2e8f0" : "1px solid transparent",
                  borderRight: isActive ? "1px solid #e2e8f0" : "1px solid transparent",
                  borderBottom: isActive ? "1px solid #ffffff" : "1px solid transparent",
                  borderTopLeftRadius: "6px",
                  borderTopRightRadius: "6px",
                  marginBottom: isActive ? "-1px" : "0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.dot && (
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: tab.dot,
                      display: "inline-block",
                    }}
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Listado de Alertas */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            backgroundColor: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
          }}
        >
          {loading && alertas.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "3rem 1rem",
                color: "#64748b",
                gap: "0.75rem",
              }}
            >
              <RefreshCw size={24} style={{ color: "#2563eb", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                Escaneando estado institucional...
              </span>
            </div>
          ) : alertasFiltradas.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "4rem 1.5rem",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                margin: "auto 0",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "#ecfdf5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "0 0 0.25rem 0",
                }}
              >
                ¡Todo al día!
              </h3>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "#64748b",
                  margin: 0,
                  maxWidth: "280px",
                  lineHeight: 1.45,
                }}
              >
                {filtroTab === "TODAS"
                  ? "No hay alertas pendientes de resolver en la zona escolar."
                  : `No hay alertas en la categoría ${filtroTab.toLowerCase()}.`}
              </p>
            </div>
          ) : (
            alertasFiltradas.map((alerta) => {
              const isCritica = alerta.criticidad === "CRITICA";
              const isAdv = alerta.criticidad === "ADVERTENCIA";

              const badgeColors = isCritica
                ? { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", dot: "#dc2626", leftBorder: "#dc2626" }
                : isAdv
                ? { bg: "#fffbeb", text: "#b45309", border: "#fde68a", dot: "#d97706", leftBorder: "#d97706" }
                : { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#2563eb", leftBorder: "#2563eb" };

              const IconComponent = isCritica ? AlertOctagon : isAdv ? AlertTriangle : Info;

              return (
                <div
                  key={alerta.id}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    borderLeft: `4px solid ${badgeColors.leftBorder}`,
                    padding: "1rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                    transition: "box-shadow 0.2s ease, transform 0.15s ease",
                  }}
                >
                  {/* Top row: Criticidad + Fecha */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          backgroundColor: badgeColors.bg,
                          color: badgeColors.text,
                          border: `1px solid ${badgeColors.border}`,
                          padding: "0.2rem 0.5rem",
                          borderRadius: "999px",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                        }}
                      >
                        <IconComponent size={12} />
                        {alerta.criticidad}
                      </span>

                      {!alerta.leida && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            backgroundColor: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "999px",
                            fontSize: "0.625rem",
                            fontWeight: 700,
                          }}
                        >
                          <span
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              backgroundColor: "#2563eb",
                            }}
                          />
                          Nueva
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: "0.6875rem",
                        color: "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontWeight: 500,
                      }}
                    >
                      <Clock size={12} />
                      {new Date(alerta.createdAt).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Título de la alerta */}
                  <h4
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                      lineHeight: 1.35,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {alerta.titulo}
                  </h4>

                  {/* Descripción detallada */}
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "#334155",
                      margin: 0,
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {alerta.descripcion}
                  </p>

                  {/* Plantel / Escuela Asociada */}
                  {alerta.escuela && (
                    <div
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        padding: "0.4rem 0.625rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: 600,
                      }}
                    >
                      <School size={14} style={{ color: "#64748b", flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {alerta.escuela.nombre}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          color: "#64748b",
                          backgroundColor: "#ffffff",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        {alerta.escuela.cct}
                      </span>
                    </div>
                  )}

                  {/* Botones de acción inferiores */}
                  <div
                    style={{
                      marginTop: "0.25rem",
                      paddingTop: "0.625rem",
                      borderTop: "1px solid #f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      {!alerta.leida ? (
                        <button
                          onClick={(e) => marcarComoLeida(alerta.id, e)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#2563eb",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.2rem 0",
                            transition: "color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#1d4ed8")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#2563eb")}
                        >
                          <CheckCircle2 size={14} />
                          Marcar como leída
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#059669",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Revisada
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => archivarAlerta(alerta.id, e)}
                      title="Archivar esta alerta"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.2rem 0.4rem",
                        borderRadius: "4px",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#dc2626";
                        e.currentTarget.style.background = "#fef2f2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#94a3b8";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <Archive size={13} />
                      Archivar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer institucional */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            backgroundColor: "#f1f5f9",
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: "0.6875rem",
            color: "#64748b",
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          Escaneo preventivo continuo cada hora • SISAT-ATP Zona 004
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
