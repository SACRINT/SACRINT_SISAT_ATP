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

  const handleEliminarHorario = async () => {
    if (!escuelaActual) return;
    if (!confirm(`¿Estás SEGURO de eliminar el horario generado para la escuela ${escuelaActual.nombre}? El horario volverá al asistente de configuración en borrador.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/generar?escuelaId=${escuelaActual.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Horario generado eliminado exitosamente.");
        setHorario(null);
        setModo("WIZARD");
      } else {
        toast.error(data.error || "No se pudo eliminar el horario.");
      }
    } catch (e) {
      toast.error("Error al eliminar el horario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="horarios-container">
      {/* Header General de Supervisión */}
      <div className="horario-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <Link
              href="/admin"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#ffffff",
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "0.78125rem",
                textDecoration: "none",
                boxShadow: "0 2px 6px rgba(37,99,235,0.25)"
              }}
            >
              ⬅️ VOLVER AL PORTAL PRINCIPAL SISAT-ATP
            </Link>
            <span className="badge" style={{ background: "#f3e8ff", color: "#7e22ce", fontSize: "0.6875rem", fontWeight: 800 }}>
              Supervisión / ATP Portal
            </span>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <Calendar style={{ width: "26px", height: "26px", color: "#7e22ce" }} /> Generador de Horarios Multiescuela
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Zona Escolar 004 | Bachilleratos Generales Estatales
          </p>
        </div>

        {/* Selector de Escuela */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Building2 style={{ width: "16px", height: "16px", color: "#7e22ce" }} /> Plantel:
          </label>
          <select
            value={escuelaSeleccionadaId}
            onChange={(e) => setEscuelaSeleccionadaId(e.target.value)}
            className="input"
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem", fontWeight: 700, minHeight: "auto" }}
          >
            {escuelas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.cct} - {e.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner de Métricas del Plantel Seleccionado */}
      {escuelaActual && (
        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "0.65rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", fontSize: "0.78125rem", fontWeight: 800 }}>
            <span style={{ color: horario ? "#16a34a" : "#d97706" }}>
              📊 Estado Horario: {horario ? "✅ Generado" : "⏳ Borrador (Sin Generar)"}
            </span>
            <span style={{ color: "#2563eb" }}>
              💬 Consultas Chat IA: {horario?.mensajesChat?.length || 0} preguntas realizadas
            </span>
          </div>

          {horario && (
            <button
              type="button"
              onClick={handleEliminarHorario}
              style={{
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fca5a5",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                fontWeight: 800,
                fontSize: "0.75rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
            >
              🗑️ Eliminar Horario Generado
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ background: "white", borderRadius: "16px", border: "1px solid var(--border)", padding: "3rem", textAlign: "center" }}>
          <Sparkles style={{ width: "32px", height: "32px", color: "#7e22ce", animation: "pulse 1.5s infinite", margin: "0 auto 0.5rem" }} />
          <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>Cargando horario del plantel...</p>
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
