"use client";

import React, { useState, useEffect } from "react";
import WizardConfiguracion from "../_componentes/horarios/WizardConfiguracion";
import EditorHorarios from "../_componentes/horarios/EditorHorarios";
import { Sparkles, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import ModalConfiguracionMapaCurricular from "@/components/ModalConfiguracionMapaCurricular";

interface Props {
  escuela: any;
}

export default function HorariosClient({ escuela }: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [modo, setModo] = useState<"WIZARD" | "EDITOR">("WIZARD");
  const [pasoActual, setPasoActual] = useState<number>(1);
  const [mapaModalAbierto, setMapaModalAbierto] = useState<boolean>(false);
  const [escuelaState, setEscuelaState] = useState<any>(escuela);

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

      if (data.escuela) {
        setEscuelaState(data.escuela);
        if (data.escuela.mapaCurricularCompletado === false) {
          setMapaModalAbierto(true);
        }
      }
      if (data.config) setConfig(data.config);
      if (data.grupos) setGrupos(data.grupos);
      if (data.aulas) setAulas(data.aulas);
      if (data.docentes) setDocentes(data.docentes);
      
      // Normalizar cargas de la DB al formato interno del frontend:
      if (data.cargas) {
        const cargasNormalizadas = data.cargas.map((c: any) => ({
          grupoId: c.grupoId,
          asignaturaId: c.asignaturaId,
          uacName: c.asignatura?.uacName || "",
          personalId: c.personalId,
          horasSemanales: c.horasSemanales,
          requiereAulaEspecial: c.requiereAulaEspecial || false
        }));
        setCargas(cargasNormalizadas);
      }

      if (data.horario) {
        setHorario(data.horario);
        setModo("EDITOR");
        setPasoActual(4);
      } else {
        setModo("WIZARD");
        setPasoActual(1);
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
        setPasoActual(4);
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

  const handleEliminarHorario = async () => {
    if (!confirm(`¿Estás SEGURO de eliminar el horario generado para ${escuela.nombre}? Volverá al asistente de configuración en borrador.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/generar?escuelaId=${escuela.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Horario generado eliminado exitosamente.");
        setHorario(null);
        await cargarDatos();
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
    await cargarDatos();
    setModo("WIZARD");
    setPasoActual(1);
  };

  const handleReiniciarMapaCurricular = async () => {
    if (!confirm("¿Estás SEGURO de reiniciar completamente el Mapa Curricular de tu plantel? Se borrará la estructura de grupos previa para poder rellenarla desde cero.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/escuelas/${escuelaState?.id || escuela.id}/mapa-curricular`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Configuración del mapa curricular reiniciada correctamente.");
        try {
          localStorage.removeItem(`horarios_wizard_v4_${escuelaState?.id || escuela.id}`);
        } catch (err) {}
        setEscuelaState((prev: any) => ({ ...prev, mapaCurricularCompletado: false }));
        setMapaModalAbierto(true);
        cargarDatos();
      } else {
        toast.error(data.error || "Error al reiniciar la configuración.");
      }
    } catch (e) {
      toast.error("Error al conectar con el servidor.");
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <Link
              href="/director"
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
            <span className="badge" style={{ background: "var(--primary-bg)", color: "var(--primary)", fontSize: "0.6875rem", fontWeight: 800 }}>
              Módulo Inteligente
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
                if (!confirm("⚠️ ¿Está seguro? Esto eliminará TODAS las cargas docentes y horarios generados de esta escuela para empezar la asignación de cero.")) return;
                setLoading(true);
                try {
                  const res = await fetch(`/api/horarios/configuracion?escuelaId=${escuelaState?.id || escuela.id}`, { method: "DELETE" });
                  const data = await res.json();
                  if (data.success) {
                    toast.success("✅ Cargas docentes limpiadas correctamente.");
                    await cargarDatos();
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
            <Calendar style={{ width: "26px", height: "26px", color: "var(--primary)" }} /> Generador de Horarios con IA
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            {escuelaState?.nombre || escuela.nombre} ({escuelaState?.cct || escuela.cct}) | Zona Escolar 004
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                gap: "0.35rem"
              }}
            >
              🗑️ Eliminar Horario Generado
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

      {/* Renderizado de Modo segun Paso */}
      {modo === "WIZARD" ? (
        <WizardConfiguracion
          escuelaId={escuela.id}
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
          escuela={escuela}
          horarioInicial={horario}
          grupos={grupos}
          docentes={docentes}
          aulas={aulas}
          cargas={cargas}
          onVolverAWizard={handleVolverAWizard}
        />
      )}

      {/* Modal de Configuración de Mapa Curricular */}
      <ModalConfiguracionMapaCurricular
        escuela={escuelaState || escuela}
        gruposIniciales={grupos}
        isOpen={mapaModalAbierto}
        onClose={() => setMapaModalAbierto(false)}
        onSaved={cargarDatos}
        forceObligatorio={escuelaState?.mapaCurricularCompletado === false}
      />
    </div>
  );
}
