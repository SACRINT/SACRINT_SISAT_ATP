"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import CentroAlertasDrawer from "./CentroAlertasDrawer";

interface AlertaBadgeProps {
  className?: string;
}

export default function AlertaBadge({ className = "" }: AlertaBadgeProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [totalCriticas, setTotalCriticas] = useState(0);

  const consultarConteoAlertas = useCallback(async () => {
    try {
      const res = await fetch("/api/vigilancia/alertas?noLeidas=true");
      if (res.ok) {
        const data = await res.json();
        setTotalNoLeidas(data.totalNoLeidas || 0);
        setTotalCriticas(data.totalCriticas || 0);
      }
    } catch (err) {
      // Silencioso para no romper UI
    }
  }, []);

  useEffect(() => {
    consultarConteoAlertas();
    // Polling ligero cada 60 segundos
    const interval = setInterval(consultarConteoAlertas, 60000);
    return () => clearInterval(interval);
  }, [consultarConteoAlertas]);

  const handleAlertasActualizadas = (noLeidas: number, criticas: number) => {
    setTotalNoLeidas(noLeidas);
    setTotalCriticas(criticas);
  };

  const hasCriticas = totalCriticas > 0;
  const hasNoLeidas = totalNoLeidas > 0;

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className={`relative p-2 rounded-xl border transition-all flex items-center justify-center ${
          hasCriticas
            ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 animate-pulse"
            : hasNoLeidas
            ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
        } ${className}`}
        title={`Centro de Alertas (${totalNoLeidas} pendientes)`}
      >
        <Bell className="w-4 h-4" />
        {hasNoLeidas && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm ${
              hasCriticas ? "bg-red-600" : "bg-amber-500"
            }`}
          >
            {totalNoLeidas > 99 ? "99+" : totalNoLeidas}
          </span>
        )}
      </button>

      <CentroAlertasDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAlertasActualizadas={handleAlertasActualizadas}
      />
    </>
  );
}
