"use client";

import React, { useState, useEffect } from "react";
import WizardConfiguracion from "../_componentes/horarios/WizardConfiguracion";
import EditorHorarios from "../_componentes/horarios/EditorHorarios";
import { Sparkles, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Props {
  escuela: any;
}

export default function HorariosClient({ escuela }: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [modo, setModo] = useState<"WIZARD" | "EDITOR">("WIZARD");
  
  const [config, setConfig] = useState<any>(null);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [cargas, setCargas] = useState<any[]>([]);
  const [horario, setHorario] = useState<any>(null);

  useEffect(() => {
    cargarDatos();
  }, [escuela.id]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/configuracion?escuelaId=${escuela.id}`);
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
      console.error("Error cargando configuración de horarios:", e);
      toast.error("Error al cargar datos del horario");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarHorarioIA = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId: escuela.id,
          nombreVersion: `Horario ${escuela.cct} - ${new Date().toLocaleDateString("es-MX")}`
        })
      });

      const data = await res.json();
      if (data.success && data.horario) {
        setHorario(data.horario);
        setModo("EDITOR");
        toast.success("¡Horario generado exitosamente con 0 empalmes!");
      } else {
        toast.error(data.error || "No se pudo generar el horario. Verifique la carga docente.");
      }
    } catch (e) {
      toast.error("Error al generar horario con IA");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Sparkles className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Cargando Generador Inteligente de Horarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      {/* Header General */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/director" className="text-slate-400 hover:text-slate-600 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-extrabold text-[11px] rounded-full uppercase">
              Módulo Inteligente
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" /> Generador de Horarios con IA
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {escuela.nombre} ({escuela.cct}) | Zona Escolar 004
          </p>
        </div>

        <div className="flex items-center gap-2">
          {modo === "EDITOR" && (
            <button
              onClick={() => setModo("WIZARD")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              ⚙️ Wizard de Configuración
            </button>
          )}
        </div>
      </div>

      {/* Renderizado de Modo */}
      {modo === "WIZARD" ? (
        <WizardConfiguracion
          escuelaId={escuela.id}
          configInicial={config}
          gruposIniciales={grupos}
          aulasIniciales={aulas}
          docentesIniciales={docentes}
          cargasIniciales={cargas}
          onGenerarClick={handleGenerarHorarioIA}
        />
      ) : (
        <EditorHorarios
          escuela={escuela}
          horarioInicial={horario}
          grupos={grupos}
          docentes={docentes}
          aulas={aulas}
          cargas={cargas}
          onVolverAWizard={() => setModo("WIZARD")}
        />
      )}
    </div>
  );
}
