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
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <Sparkles style={{ width: "40px", height: "40px", color: "var(--primary)", animation: "pulse 1.5s infinite", margin: "0 auto 1rem" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>Cargando Generador Inteligente de Horarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="horarios-container">
      {/* Header General */}
      <div className="horario-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <Link href="/director" style={{ color: "var(--text-muted)", display: "flex" }}>
              <ArrowLeft style={{ width: "18px", height: "18px" }} />
            </Link>
            <span className="badge" style={{ background: "var(--primary-bg)", color: "var(--primary)", fontSize: "0.6875rem" }}>
              Módulo Inteligente
            </span>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <Calendar style={{ width: "26px", height: "26px", color: "var(--primary)" }} /> Generador de Horarios con IA
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {escuela.nombre} ({escuela.cct}) | Zona Escolar 004
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {modo === "EDITOR" && (
            <button
              onClick={() => setModo("WIZARD")}
              className="btn btn-outline"
              style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem", minHeight: "auto" }}
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
