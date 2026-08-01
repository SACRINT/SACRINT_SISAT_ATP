"use client";

import React, { useState, useEffect } from "react";
import WizardConfiguracion from "@/app/director/_componentes/horarios/WizardConfiguracion";
import EditorHorarios from "@/app/director/_componentes/horarios/EditorHorarios";
import ModalConfiguracionMapaCurricular from "@/components/ModalConfiguracionMapaCurricular";
import { Sparkles, Calendar, Building2, ArrowLeft, Settings, RotateCcw } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Props {
  escuelas: any[];
}

export default function AdminHorariosClient({ escuelas }: Props) {
  const [escuelaSeleccionadaId, setEscuelaSeleccionadaId] = useState<string>(escuelas[0]?.id || "");
  const [loading, setLoading] = useState<boolean>(true);
  const [modo, setModo] = useState<"WIZARD" | "EDITOR">("WIZARD");
  const [pasoActual, setPasoActual] = useState<number>(1);
  const [mapaModalAbierto, setMapaModalAbierto] = useState<boolean>(false);
  const [escuelaState, setEscuelaState] = useState<any>(escuelas[0] || null);

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

      if (data.escuela) {
        setEscuelaState(data.escuela);
        if (!data.escuela.mapaCurricularCompletado) {
          setMapaModalAbierto(true);
        }
      }
      if (data.config) setConfig(data.config);
      if (data.grupos) setGrupos(data.grupos);
      if (data.aulas) setAulas(data.aulas);
      if (data.docentes) setDocentes(data.docentes);
      if (data.cargas) setCargas(data.cargas);

      if (data.horario) {
        setHorario(data.horario);
        setModo("EDITOR");
        setPasoActual(4);
      } else {
        setModo("WIZARD");
        setPasoActual(1);
      }
    } catch (e) {
      console.error("Error cargando configuración de horarios de la escuela:", e);
      toast.error("Error al cargar datos del horario de la escuela");
    } finally {
      setLoading(false);
    }
  };

  const escuelaActual = escuelaState || escuelas.find((e) => e.id === escuelaSeleccionadaId);

  const handleReiniciarMapaCurricular = async () => {
    if (!escuelaActual) return;
    if (!confirm(`¿Estás SEGURO de reiniciar completamente el Mapa Curricular del plantel ${escuelaActual.nombre}? Se eliminará la configuración de grupos previa para que la escuela pueda volver a llenar el formulario desde cero.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/escuelas/${escuelaActual.id}/mapa-curricular`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Mapa curricular reiniciado correctamente.");
        setMapaModalAbierto(true);
        cargarDatosEscuela(escuelaActual.id);
      } else {
        toast.error(data.error || "Error al reiniciar el mapa curricular.");
      }
    } catch (e) {
      toast.error("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarHorarioIA = async () => {
    if (!escuelaActual) return;
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId: escuelaActual.id,
          nombreVersion: `Horario ${escuelaActual.cct} - ${new Date().toLocaleDateString("es-MX")}`
        })
      });

      const data = await res.json();
      if (data.success && data.horario) {
        setHorario(data.horario);
        setModo("EDITOR");
        setPasoActual(4);
        toast.success("¡Horario generado exitosamente con 0 empalmes!");
      } else {
        toast.error(data.error || "No se pudo generar el horario.");
      }
    } catch (e) {
      toast.error("Error al generar horario con IA");
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarHorario = async () => {
    if (!escuelaActual) return;
    if (!confirm(`¿Estás SEGURO de eliminar el horario generado para ${escuelaActual.nombre}? Volverá al asistente de configuración.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/generar?escuelaId=${escuelaActual.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Horario generado eliminado exitosamente.");
        setHorario(null);
        await cargarDatosEscuela(escuelaActual.id);
        setModo("WIZARD");
        setPasoActual(1);
      } else {
        toast.error(data.error || "No se pudo eliminar el horario.");
      }
    } catch (e) {
      toast.error("Error al eliminar horario");
    } finally {
      setLoading(false);
    }
  };

  const handleVolverAWizard = async () => {
    if (escuelaSeleccionadaId) {
      await cargarDatosEscuela(escuelaSeleccionadaId);
    }
    setModo("WIZARD");
    setPasoActual(1);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <Sparkles style={{ width: "40px", height: "40px", color: "var(--primary)", animation: "pulse 1.5s infinite", margin: "0 auto 1rem" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text)" }}>Cargando Panel Administrador de Horarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="horarios-container">
      {/* Header General Admin */}
      <div className="horario-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <Link
              href="/admin"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#334155",
                color: "#ffffff",
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "0.78125rem",
                textDecoration: "none"
              }}
            >
              ⬅️ VOLVER AL PANEL ADMINISTRADOR
            </Link>
            <span className="badge" style={{ background: "#fef3c7", color: "#d97706", fontSize: "0.6875rem", fontWeight: 800 }}>
              Supervisión Admin
            </span>
            <button
              onClick={() => setMapaModalAbierto(true)}
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#ffffff",
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "0.78125rem",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
            >
              ⚙️ Configurar Mapa Curricular
            </button>
            <button
              onClick={handleReiniciarMapaCurricular}
              style={{
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fca5a5",
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "0.78125rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
            >
              🔄 Reiniciar Configuración
            </button>
            <button
              onClick={async () => {
                if (!escuelaActual) return;
                if (!confirm(`⚠️ ¿Está seguro? Esto eliminará TODAS las cargas docentes y horarios generados para ${escuelaActual.nombre}.`)) return;
                setLoading(true);
                try {
                  const res = await fetch(`/api/horarios/configuracion?escuelaId=${escuelaActual.id}`, { method: "DELETE" });
                  const data = await res.json();
                  if (data.success) {
                    toast.success("✅ Cargas docentes limpiadas correctamente.");
                    await cargarDatosEscuela(escuelaActual.id);
                    setModo("WIZARD");
                    setPasoActual(1);
                  } else {
                    toast.error(data.error || "Error al limpiar datos");
                  }
                } catch (e) {
                  toast.error("Error de conexión al limpiar datos");
                } finally {
                  setLoading(false);
                }
              }}
              style={{
                background: "#fff7ed",
                color: "#c2410c",
                border: "1px solid #ffedd5",
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "0.78125rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
              title="Eliminar cargas docentes y horarios generados para empezar de cero"
            >
              🗑️ Limpiar Datos
            </button>
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <Building2 style={{ width: "26px", height: "26px", color: "var(--primary)" }} /> Gestión Central de Horarios
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Administración de Mapa Curricular y Generación de Horarios por Plantel
          </p>
        </div>

        {/* Selector de Escuela */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-secondary)" }}>Escuela Activa:</label>
            <select
              value={escuelaSeleccionadaId}
              onChange={(e) => setEscuelaSeleccionadaId(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontWeight: 700,
                fontSize: "0.875rem"
              }}
            >
              {escuelas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.cct} - {e.nombre}
                </option>
              ))}
            </select>
          </div>

          {horario && (
            <button
              onClick={handleEliminarHorario}
              style={{
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fca5a5",
                padding: "0.45rem 0.85rem",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "0.75rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                alignSelf: "flex-end"
              }}
            >
              🗑️ Eliminar Horario
            </button>
          )}
        </div>
      </div>

      {/* Stepper Principal Unificado de 4 Pasos */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "0.75rem 1.25rem",
        marginBottom: "1.25rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginRight: "0.5rem" }}>
            Navegación del Módulo:
          </span>
          {[
            { num: 1, label: "1. Estructura & Currículum" },
            { num: 2, label: "2. Plantilla Docente" },
            { num: 3, label: "3. Matriz por Semestre" },
            { num: 4, label: "4. Horario Generado (IA)" }
          ].map((step) => {
            const esActivo = pasoActual === step.num;
            const esCompletado = step.num < pasoActual || (step.num === 4 && !!horario);
            const esDeshabilitado = step.num === 4 && !horario;

            return (
              <button
                key={step.num}
                type="button"
                disabled={esDeshabilitado}
                onClick={() => {
                  if (step.num === 4) {
                    if (horario) {
                      setModo("EDITOR");
                      setPasoActual(4);
                    } else {
                      toast.error("Aún no se ha generado un horario. Complete los pasos 1-3 y haga clic en Generar.");
                    }
                  } else {
                    setModo("WIZARD");
                    setPasoActual(step.num);
                  }
                }}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "20px",
                  border: "none",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  cursor: esDeshabilitado ? "not-allowed" : "pointer",
                  background: esActivo ? "#2563eb" : esCompletado ? "#f1f5f9" : "transparent",
                  color: esActivo ? "#ffffff" : esDeshabilitado ? "#94a3b8" : "#334155",
                  opacity: esDeshabilitado ? 0.6 : 1,
                  transition: "all 0.2s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
              >
                {step.num === 4 && horario ? "✨ " : ""}{step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Renderizado del Módulo segun Paso */}
      {modo === "WIZARD" ? (
        <WizardConfiguracion
          escuelaId={escuelaActual.id}
          configInicial={config}
          gruposIniciales={grupos}
          aulasIniciales={aulas}
          docentesIniciales={docentes}
          cargasIniciales={cargas}
          onGenerarClick={handleGenerarHorarioIA}
          pasoInicial={pasoActual}
          onStepChange={(p) => setPasoActual(p)}
        />
      ) : (
        <EditorHorarios
          escuela={escuelaActual}
          horarioInicial={horario}
          grupos={grupos}
          docentes={docentes}
          aulas={aulas}
          cargas={cargas}
          onVolverAWizard={handleVolverAWizard}
          esAdmin={true}
        />
      )}

      {/* Modal de Configuración de Mapa Curricular */}
      {escuelaActual && (
        <ModalConfiguracionMapaCurricular
          escuela={escuelaActual}
          gruposIniciales={grupos}
          isOpen={mapaModalAbierto}
          onClose={() => setMapaModalAbierto(false)}
          onSaved={() => cargarDatosEscuela(escuelaActual.id)}
          forceObligatorio={escuelaState?.mapaCurricularCompletado === false}
        />
      )}
    </div>
  );
}
