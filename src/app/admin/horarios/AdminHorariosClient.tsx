"use client";

import React, { useState, useEffect } from "react";
import WizardConfiguracion from "@/app/director/_componentes/horarios/WizardConfiguracion";
import EditorHorarios from "@/app/director/_componentes/horarios/EditorHorarios";
import { Sparkles, Calendar, Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Props {
  escuelas: any[];
}

export default function AdminHorariosClient({ escuelas }: Props) {
  const [escuelaSeleccionadaId, setEscuelaSeleccionadaId] = useState<string>(escuelas[0]?.id || "");
  const [loading, setLoading] = useState<boolean>(true);
  const [modo, setModo] = useState<"WIZARD" | "EDITOR">("WIZARD");

  const [config, setConfig] = useState<any>(null);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [cargas, setCargas] = useState<any[]>([]);
  const [horario, setHorario] = useState<any>(null);

  useEffect(() => {
    if (escuelaSeleccionadaId) {
      cargarDatosEscuela(escuelaSeleccionadaId);
    }
  }, [escuelaSeleccionadaId]);

  const cargarDatosEscuela = async (eId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/configuracion?escuelaId=${eId}`);
      const data = await res.json();

      if (data.config) setConfig(data.config);
      if (data.grupos) setGrupos(data.grupos);
      if (data.aulas) setAulas(data.aulas);
      if (data.docentes) setDocentes(data.docentes);
      if (data.cargas) setCargas(data.cargas);

      if (data.horario) {
        setHorario(data.horario);
        setModo("EDITOR");
      } else {
        setModo("WIZARD");
      }
    } catch (e) {
      console.error("Error cargando configuración de horarios de la escuela:", e);
      toast.error("Error al cargar datos del horario de la escuela");
    } finally {
      setLoading(false);
    }
  };

  const escuelaActual = escuelas.find((e) => e.id === escuelaSeleccionadaId);

  const handleGenerarHorarioIA = async () => {
    if (!escuelaActual) return;
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId: escuelaActual.id,
          nombreVersion: `Horario ${escuelaActual.cct} - Admin ${new Date().toLocaleDateString("es-MX")}`
        })
      });

      const data = await res.json();
      if (data.success && data.horario) {
        setHorario(data.horario);
        setModo("EDITOR");
        toast.success("¡Horario generado por la Supervisión exitosamente!");
      } else {
        toast.error(data.error || "No se pudo generar el horario.");
      }
    } catch (e) {
      toast.error("Error al generar horario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      {/* Header General de Supervisión */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-slate-400 hover:text-slate-600 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 font-extrabold text-[11px] rounded-full uppercase">
              Supervisión / ATP Portal
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-purple-600" /> Generador de Horarios Multiescuela
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Zona Escolar 004 | Bachilleratos Generales Estatales
          </p>
        </div>

        {/* Selector de Escuela */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Building2 className="w-4 h-4 text-purple-600" /> Plantel:
          </label>
          <select
            value={escuelaSeleccionadaId}
            onChange={(e) => setEscuelaSeleccionadaId(e.target.value)}
            className="p-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-purple-500"
          >
            {escuelas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.cct} - {e.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Cargando horario del plantel...</p>
        </div>
      ) : escuelaActual ? (
        modo === "WIZARD" ? (
          <WizardConfiguracion
            escuelaId={escuelaActual.id}
            configInicial={config}
            gruposIniciales={grupos}
            aulasIniciales={aulas}
            docentesIniciales={docentes}
            cargasIniciales={cargas}
            onGenerarClick={handleGenerarHorarioIA}
          />
        ) : (
          <EditorHorarios
            escuela={escuelaActual}
            horarioInicial={horario}
            grupos={grupos}
            docentes={docentes}
            aulas={aulas}
            cargas={cargas}
            onVolverAWizard={() => setModo("WIZARD")}
          />
        )
      ) : null}
    </div>
  );
}
