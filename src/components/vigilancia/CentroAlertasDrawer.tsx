"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Archive,
  RefreshCw,
  Clock,
  School,
  ExternalLink,
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
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroTab, setFiltroTab] = useState<"TODAS" | "CRITICA" | "ADVERTENCIA" | "INFORMATIVA">("TODAS");
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [totalCriticas, setTotalCriticas] = useState(0);

  const cargarAlertas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vigilancia/alertas");
      if (res.ok) {
        const data = await res.json();
        setAlertas(data.alertas || []);
        setTotalNoLeidas(data.totalNoLeidas || 0);
        setTotalCriticas(data.totalCriticas || 0);
        if (onAlertasActualizadas) {
          onAlertasActualizadas(data.totalNoLeidas || 0, data.totalCriticas || 0);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Centro de Alertas</h2>
                <p className="text-xs text-slate-400">Vigilancia Proactiva Institucional</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cargarAlertas}
                title="Actualizar"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={onClose}
                title="Cerrar"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Banner de resumen si hay críticas */}
          {totalCriticas > 0 && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-xs font-semibold text-red-900 leading-tight">
                Se detectaron <span className="font-bold">{totalCriticas} alerta(s) crítica(s)</span> que requieren atención inmediata.
              </p>
            </div>
          )}

          {/* Tabs de Filtro */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1 text-xs font-medium">
            <button
              onClick={() => setFiltroTab("TODAS")}
              className={`pb-2 px-3 border-b-2 transition ${
                filtroTab === "TODAS"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Todas ({alertas.length})
            </button>
            <button
              onClick={() => setFiltroTab("CRITICA")}
              className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
                filtroTab === "CRITICA"
                  ? "border-red-600 text-red-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
              Críticas ({alertas.filter((a) => a.criticidad === "CRITICA").length})
            </button>
            <button
              onClick={() => setFiltroTab("ADVERTENCIA")}
              className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
                filtroTab === "ADVERTENCIA"
                  ? "border-amber-600 text-amber-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Advertencias ({alertas.filter((a) => a.criticidad === "ADVERTENCIA").length})
            </button>
            <button
              onClick={() => setFiltroTab("INFORMATIVA")}
              className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
                filtroTab === "INFORMATIVA"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              Info ({alertas.filter((a) => a.criticidad === "INFORMATIVA").length})
            </button>
          </div>

          {/* Listado de Alertas */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {loading && alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-xs">Escaneando estado institucional...</span>
              </div>
            ) : alertasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">¡Todo al día!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  No hay alertas {filtroTab !== "TODAS" ? `de tipo ${filtroTab.toLowerCase()}` : ""} pendientes de resolver.
                </p>
              </div>
            ) : (
              alertasFiltradas.map((alerta) => {
                const isCritica = alerta.criticidad === "CRITICA";
                const isAdv = alerta.criticidad === "ADVERTENCIA";

                const badgeBg = isCritica
                  ? "bg-red-50 text-red-700 border-red-200"
                  : isAdv
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200";

                const IconComponent = isCritica ? AlertOctagon : isAdv ? AlertTriangle : Info;

                return (
                  <div
                    key={alerta.id}
                    className={`rounded-xl border p-3.5 transition-all bg-white shadow-sm hover:shadow-md ${
                      !alerta.leida ? "border-l-4 border-l-indigo-600" : "border-slate-200 opacity-85"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                          <IconComponent className="w-3 h-3" />
                          {alerta.criticidad}
                        </span>
                        {!alerta.leida && (
                          <span className="inline-block w-2 h-2 rounded-full bg-indigo-600" title="No leída" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alerta.createdAt).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 mt-2 leading-tight">
                      {alerta.titulo}
                    </h4>
                    
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {alerta.descripcion}
                    </p>

                    {alerta.escuela && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{alerta.escuela.nombre} ({alerta.escuela.cct})</span>
                      </div>
                    )}

                    {/* Acciones de la Alerta */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {!alerta.leida ? (
                          <button
                            onClick={(e) => marcarComoLeida(alerta.id, e)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marcar leída
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Revisada
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => archivarAlerta(alerta.id, e)}
                        title="Archivar de la vista"
                        className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition"
                      >
                        <Archive className="w-3 h-3" />
                        Archivar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-100 border-t border-slate-200 text-center text-[11px] text-slate-500">
            Escaneo preventivo continuo cada hora • SISAT-ATP Zona 004
          </div>
        </div>
      </div>
    </div>
  );
}
