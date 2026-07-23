"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Users, BookOpen, Clock, AlertCircle, Wand2, ShieldCheck, UserCheck, Plus, Trash2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  escuelaId: string;
  configInicial: any;
  gruposIniciales: any[];
  aulasIniciales: any[];
  docentesIniciales: any[];
  cargasIniciales: any[];
  onGenerarClick: () => void;
}

const FORMACIONES_LABORALES = [
  "Administración",
  "Agricultura Sostenible de Traspatio",
  "Área de la Salud",
  "Comunicación Gráfica",
  "Desarrollo Comunitario",
  "Diseño y Elaboración de Prendas de Vestir",
  "Enfermería",
  "Gestión Turística",
  "Industria Alimentaria",
  "Mantenimiento Industrial",
  "Nutrición",
  "Producción Agropecuaria",
  "Promoción Social",
  "Servicios de Hospedaje",
  "Tecnologías de la Información y Comunicación"
];

// Opciones FFE Optativas MCCEMS SEP Puebla
const FFE_RECURSO_SOCIOCOGNITIVO = [
  "Taller de Pensamiento Variacional I",
  "Comunicación y Sociedad I",
  "Raíces etimológicas del español I",
  "Dibujo Técnico I",
  "Habilidades del Pensamiento II"
];

const FFE_AREA_CONOCIMIENTO = [
  "Psicología I",
  "Análisis de Fenómenos Físicos I",
  "Pensamiento Filosófico I",
  "Análisis de Fenómenos y Procesos Biológicos",
  "Sociología I",
  "Economía I"
];

export default function WizardConfiguracion({
  escuelaId,
  configInicial,
  gruposIniciales,
  aulasIniciales,
  docentesIniciales,
  cargasIniciales,
  onGenerarClick
}: Props) {
  const [paso, setPaso] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Configuración de Jornada
  const [numPeriodos, setNumPeriodos] = useState<number>(configInicial?.horasPorDia || 7);
  const [horaInicio, setHoraInicio] = useState<string>(configInicial?.horaInicio || "08:00");
  const [estructuraGrupos, setEstructuraGrupos] = useState<number>(
    gruposIniciales.length > 0 ? Math.ceil(gruposIniciales.length / 3) : 1
  );

  // Estado de Grupos con su Configuración Curricular Específica
  const [grupos, setGrupos] = useState<any[]>([]);

  // Horas por Docente (Paso 2)
  const [horasDocentes, setHorasDocentes] = useState<Record<string, number>>({});

  // Cargas Docente-Materia-Grupo (Paso 3)
  const [cargas, setCargas] = useState<any[]>(cargasIniciales || []);
  const [catalogAsignaturas, setCatalogAsignaturas] = useState<any[]>([]);

  useEffect(() => {
    cargarCatalogos();
  }, [escuelaId]);

  // Inicializar grupos según la estructura seleccionada (1=A, 2=A,B, 3=A,B,C...)
  useEffect(() => {
    generarGruposSegunEstructura(estructuraGrupos);
  }, [estructuraGrupos]);

  // Inicializar horas de docentes
  useEffect(() => {
    if (docentesIniciales.length > 0) {
      const mapaHoras: Record<string, number> = {};
      docentesIniciales.forEach((d) => {
        mapaHoras[d.id] = d.horasAsignadas || 20;
      });
      setHorasDocentes(mapaHoras);
    }
  }, [docentesIniciales]);

  const cargarCatalogos = async () => {
    try {
      const res = await fetch(`/api/horarios/catalogos?escuelaId=${escuelaId}`);
      const data = await res.json();
      if (data.asignaturas) {
        setCatalogAsignaturas(data.asignaturas);
      }
    } catch (e) {
      console.error("Error al cargar asignaturas:", e);
    }
  };

  const generarGruposSegunEstructura = (numGruposPorGrado: number) => {
    const letras = ["A", "B", "C", "D", "E"];
    const nuevosGrupos: any[] = [];

    for (let sem of [1, 3, 5]) {
      for (let i = 0; i < numGruposPorGrado; i++) {
        const letra = letras[i] || `G${i + 1}`;
        const nombreGrupo = `${sem}° ${letra}`;

        // Buscar si ya existía para mantener su configuración
        const grupoExistente = grupos.find((g) => g.nombre === nombreGrupo);

        nuevosGrupos.push({
          id: grupoExistente?.id || `temp_${sem}_${letra}`,
          nombre: nombreGrupo,
          semestre: sem,
          capacitacionNombre: grupoExistente?.capacitacionNombre || (i === 1 ? "Área de la Salud" : i === 2 ? "Comunicación Gráfica" : "Tecnologías de la Información y Comunicación"),
          ffeOptativas: grupoExistente?.ffeOptativas || [
            FFE_RECURSO_SOCIOCOGNITIVO[0],
            FFE_RECURSO_SOCIOCOGNITIVO[1],
            FFE_AREA_CONOCIMIENTO[0],
            FFE_AREA_CONOCIMIENTO[1]
          ],
          ffeoSocioemocional: grupoExistente?.ffeoSocioemocional || "Actividades Artísticas y Culturales"
        });
      }
    }
    setGrupos(nuevosGrupos);
  };

  const handleActualizarConfigGrupo = (index: number, field: string, value: any) => {
    const copia = [...grupos];
    copia[index][field] = value;
    setGrupos(copia);
  };

  const handleActualizarOptativaGrupo = (grupoIdx: number, optativaIdx: number, value: string) => {
    const copia = [...grupos];
    const optativas = [...(copia[grupoIdx].ffeOptativas || [])];
    optativas[optativaIdx] = value;
    copia[grupoIdx].ffeOptativas = optativas;
    setGrupos(copia);
  };

  // Obtener la asignatura docente asignada para una celda de la tabla en el Paso 3
  const getDocenteAsignado = (grupoId: string, asignaturaId: string) => {
    const asignacion = cargas.find((c) => c.grupoId === grupoId && c.asignaturaId === asignaturaId);
    return asignacion?.personalId || "";
  };

  const handleAsignarDocenteMatriz = (grupoId: string, asignaturaId: string, personalId: string, horasSemanales: number) => {
    if (!personalId) {
      // Eliminar asignación
      setCargas(cargas.filter((c) => !(c.grupoId === grupoId && c.asignaturaId === asignaturaId)));
      return;
    }

    const idx = cargas.findIndex((c) => c.grupoId === grupoId && c.asignaturaId === asignaturaId);
    if (idx >= 0) {
      const copia = [...cargas];
      copia[idx].personalId = personalId;
      setCargas(copia);
    } else {
      setCargas([
        ...cargas,
        {
          grupoId,
          asignaturaId,
          personalId,
          horasSemanales: horasSemanales || 3,
          requiereAulaEspecial: false
        }
      ]);
    }
  };

  const handleGuardarConfiguracion = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escuelaId,
          config: {
            diasLectivos: 5,
            horasPorDia: numPeriodos,
            horaInicio
          },
          grupos,
          aulas: aulasIniciales.length > 0 ? aulasIniciales : [{ nombre: "Aula General", tipo: "REGULAR" }],
          cargas
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Configuración guardada correctamente");
        onGenerarClick();
      } else {
        toast.error(data.error || "Error al guardar configuración");
      }
    } catch (e) {
      toast.error("Error al comunicarse con el servidor");
    } finally {
      setLoading(false);
    }
  };

  // Obtener asignaturas filtradas por semestre para el Paso 3
  const getAsignaturasSemestre = (semestre: number, grupo: any) => {
    let uacs = catalogAsignaturas.filter((a) => a.semester === semestre);

    // Para 3° y 5° semestre, ajustar Formación Laboral y Optativas según lo elegido para el grupo
    if (semestre === 3 || semestre === 5) {
      // Filtrar la formación laboral por el nombre elegido para el grupo
      const capNombre = (grupo.capacitacionNombre || "").toLowerCase();
      uacs = uacs.filter((uac) => {
        if (uac.component === "laboral") {
          const uacLower = uac.uacName.toLowerCase();
          if (capNombre.includes("tecnolog")) return uacLower.includes("cómputo") || uacLower.includes("procesadores") || uacLower.includes("mantenimiento") || uacLower.includes("ofimática") || uacLower.includes("redes") || uacLower.includes("gráficos");
          if (capNombre.includes("salud")) return uacLower.includes("medicamentos") || uacLower.includes("paciente") || uacLower.includes("recetas") || uacLower.includes("salud");
          if (capNombre.includes("administra")) return uacLower.includes("recursos") || uacLower.includes("trámites") || uacLower.includes("organización");
          return true;
        }
        return true;
      });
    }

    return uacs;
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Encabezado del Wizard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <Sparkles style={{ width: "22px", height: "22px", color: "#2563eb" }} /> Asistente de Configuración de Horario (SEP Puebla)
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", margin: 0 }}>
            Defina la estructura de grupos, cargas laborales/optativas y asigne docentes en la matriz tabular
          </p>
        </div>

        {/* Indicador de Pasos */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {[
            { num: 1, label: "1. Estructura & Currícu" },
            { num: 2, label: "2. Plantilla Docente" },
            { num: 3, label: "3. Matriz por Semestre" }
          ].map((step) => (
            <div
              key={step.num}
              onClick={() => setPaso(step.num)}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "10px",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                background: paso === step.num ? "#2563eb" : paso > step.num ? "#16a34a" : "#f1f5f9",
                color: paso >= step.num ? "#ffffff" : "#64748b",
                border: "1px solid " + (paso === step.num ? "#1d4ed8" : "#cbd5e1")
              }}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
         PASO 1: Estructura de Grupos y Selección Curricular por Grupo
         ========================================================================= */}
      {paso === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Fila superior: Estructura de Grupos e Horas por Día */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
            <div style={{ background: "#eff6ff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>
                <Users style={{ width: "16px", height: "16px", color: "#2563eb", display: "inline", marginRight: "6px" }} />
                Estructura de Grupos del Plantel
              </label>
              <select
                value={estructuraGrupos}
                onChange={(e) => setEstructuraGrupos(Number(e.target.value))}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "8px", border: "2px solid #3b82f6", background: "#ffffff", fontWeight: 800, fontSize: "0.9375rem", color: "#1e293b" }}
              >
                <option value={1}>Estructura 1-1-1 (3 Grupos: 1A, 3A, 5A)</option>
                <option value={2}>Estructura 2-2-2 (6 Grupos: 1A, 1B, 3A, 3B, 5A, 5B)</option>
                <option value={3}>Estructura 3-3-3 (9 Grupos: 1A, 1B, 1C, 3A, 3B, 3C...)</option>
                <option value={4}>Estructura 4-4-4 (12 Grupos: A, B, C, D)</option>
              </select>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.35rem", margin: 0 }}>
                Genera automáticamente la nomenclatura oficial de la SEP en orden alfabético.
              </p>
            </div>

            <div style={{ background: "#f0fdf4", padding: "1.25rem", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>
                <Clock style={{ width: "16px", height: "16px", color: "#16a34a", display: "inline", marginRight: "6px" }} />
                Jornada Escolar (Horas/Periodos por Día)
              </label>
              <select
                value={numPeriodos}
                onChange={(e) => setNumPeriodos(Number(e.target.value))}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "8px", border: "2px solid #22c55e", background: "#ffffff", fontWeight: 800, fontSize: "0.9375rem", color: "#1e293b" }}
              >
                <option value={6}>6 Horas diarias (30 hrs semanales)</option>
                <option value={7}>7 Horas diarias (35 hrs semanales - Estándar BGE)</option>
                <option value={8}>8 Horas diarias (40 hrs semanales)</option>
              </select>
            </div>
          </div>

          {/* Configuración Curricular Individual por Grupo */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", background: "#f8fafc" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldCheck style={{ width: "18px", height: "18px", color: "#2563eb" }} /> Configuración de Formación Laboral y Optativas por Grupo
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
              {grupos.map((g, idx) => (
                <div key={idx} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#1d4ed8" }}>
                      Grupo {g.nombre} ({g.semestre}° Semestre)
                    </span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#eff6ff", color: "#2563eb", padding: "0.25rem 0.5rem", borderRadius: "6px" }}>
                      {g.semestre === 1 ? "Universal" : g.semestre === 3 ? "Laboral" : "Laboral + FFE"}
                    </span>
                  </div>

                  {/* Formación Laboral (para 3° y 5° semestre) */}
                  {g.semestre >= 3 && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                        Formación Laboral (Capacitación del Grupo)
                      </label>
                      <select
                        value={g.capacitacionNombre || ""}
                        onChange={(e) => handleActualizarConfigGrupo(idx, "capacitacionNombre", e.target.value)}
                        style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}
                      >
                        {FORMACIONES_LABORALES.map((cap) => (
                          <option key={cap} value={cap}>
                            {cap}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* FFE Optativas (para 5° semestre) */}
                  {g.semestre === 5 && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.35rem" }}>
                        Optativas FFE (2 Recurso + 2 Área)
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                        {[0, 1].map((optIdx) => (
                          <select
                            key={optIdx}
                            value={g.ffeOptativas?.[optIdx] || ""}
                            onChange={(e) => handleActualizarOptativaGrupo(idx, optIdx, e.target.value)}
                            style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.7rem" }}
                          >
                            {FFE_RECURSO_SOCIOCOGNITIVO.map((rec) => (
                              <option key={rec} value={rec}>{rec}</option>
                            ))}
                          </select>
                        ))}
                        {[2, 3].map((optIdx) => (
                          <select
                            key={optIdx}
                            value={g.ffeOptativas?.[optIdx] || ""}
                            onChange={(e) => handleActualizarOptativaGrupo(idx, optIdx, e.target.value)}
                            style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.7rem" }}
                          >
                            {FFE_AREA_CONOCIMIENTO.map((area) => (
                              <option key={area} value={area}>{area}</option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </div>
                  )}

                  {g.semestre === 1 && (
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0, fontStyle: "italic" }}>
                      1er Semestre lleva el Currículum Fundamental 100% universal para todos los Bachilleratos de Puebla.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "1rem" }}>
            <button
              onClick={() => setPaso(2)}
              style={{ background: "#2563eb", color: "#ffffff", padding: "0.75rem 1.75rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.9375rem", border: "none", cursor: "pointer" }}
            >
              Siguiente: Plantilla Docente →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
         PASO 2: Horas de la Plantilla Docente
         ========================================================================= */}
      {paso === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <UserCheck style={{ width: "18px", height: "18px", color: "#2563eb" }} /> Horas Asignadas a la Plantilla Docente Frente a Grupo
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
              Ingrese la carga horaria semanal (de 1 a 30 horas) contratada para cada profesor del plantel.
            </p>
          </div>

          {docentesIniciales.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: "12px" }}>
              <AlertCircle style={{ width: "32px", height: "32px", color: "#94a3b8", margin: "0 auto 0.5rem" }} />
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>No se encontraron docentes registrados en la plantilla de este plantel.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
              {docentesIniciales.map((d) => (
                <div key={d.id} style={{ padding: "0.85rem", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                      {d.apellidoPaterno} {d.apellidoMaterno || ""} {d.nombre}
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "#64748b", margin: 0 }}>{d.cargo || "Docente Frente a Grupo"}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={horasDocentes[d.id] || 20}
                      onChange={(e) => setHorasDocentes({ ...horasDocentes, [d.id]: Number(e.target.value) })}
                      style={{ width: "65px", padding: "0.4rem", borderRadius: "6px", border: "2px solid #3b82f6", fontWeight: 800, textAlign: "center", fontSize: "0.875rem", color: "#1e293b" }}
                    />
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>hrs/sem</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1rem" }}>
            <button
              onClick={() => setPaso(1)}
              style={{ background: "#f1f5f9", color: "#1e293b", padding: "0.75rem 1.5rem", borderRadius: "10px", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              ← Atrás
            </button>
            <button
              onClick={() => setPaso(3)}
              style={{ background: "#2563eb", color: "#ffffff", padding: "0.75rem 1.75rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.9375rem", border: "none", cursor: "pointer" }}
            >
              Siguiente: Matriz por Semestre →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
         PASO 3: Matriz Tabular de Asignación por Semestre (Estilo SEM A Horario 2025-2026.pdf)
         ========================================================================= */}
      {paso === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BookOpen style={{ width: "20px", height: "20px", color: "#2563eb" }} /> Matriz de Asignación Docente por Semestre y Grupo
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
              Seleccione el docente de la lista desplegable para cada asignatura y grupo (basado en la plantilla oficial).
            </p>
          </div>

          {/* TABLAS ORGANIZADAS POR SEMESTRE (1er, 3er, 5to Semestre) */}
          {[1, 3, 5].map((sem) => {
            const gruposSemestre = grupos.filter((g) => g.semestre === sem);
            if (gruposSemestre.length === 0) return null;

            // Tomar el primer grupo para extraer la lista base de asignaturas del semestre
            const uacsBase = getAsignaturasSemestre(sem, gruposSemestre[0]);

            return (
              <div key={sem} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1rem", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", overflowX: "auto" }}>
                <div style={{ background: "#1e293b", color: "#ffffff", padding: "0.625rem 1rem", borderRadius: "8px", fontWeight: 800, fontSize: "0.875rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{sem === 1 ? "1er Semestre (1er Año - Universal)" : sem === 3 ? "3er Semestre (2º Año - Formación Laboral)" : "5to Semestre (3er Año - Formación Laboral + FFE Optativas)"}</span>
                  <span style={{ fontSize: "0.75rem", background: "#334155", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                    {gruposSemestre.length} Grupo(s): {gruposSemestre.map((g) => g.nombre).join(", ")}
                  </span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "0.625rem", textAlign: "left", fontWeight: 800, color: "#1e293b", width: "35%" }}>Asignatura (UAC)</th>
                      <th style={{ padding: "0.625rem", textAlign: "center", fontWeight: 800, color: "#1e293b", width: "10%" }}>Horas</th>
                      {gruposSemestre.map((g) => (
                        <th key={g.id} style={{ padding: "0.625rem", textAlign: "center", fontWeight: 800, color: "#1d4ed8", background: "#eff6ff" }}>
                          Grupo {g.nombre}
                          {g.capacitacionNombre && (
                            <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "#2563eb", marginTop: "2px" }}>
                              {g.capacitacionNombre}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uacsBase.map((uac, uacIdx) => (
                      <tr key={uac.id || uacIdx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "0.5rem 0.625rem", fontWeight: 700, color: "#334155" }}>
                          {uac.uacName}
                        </td>
                        <td style={{ padding: "0.5rem 0.625rem", textAlign: "center", fontWeight: 800, color: "#2563eb" }}>
                          {uac.horasSemanales || 3} hrs
                        </td>
                        {gruposSemestre.map((g) => {
                          const docenteActualId = getDocenteAsignado(g.id, uac.id);
                          return (
                            <td key={g.id} style={{ padding: "0.35rem", textAlign: "center", background: "#ffffff" }}>
                              <select
                                value={docenteActualId}
                                onChange={(e) => handleAsignarDocenteMatriz(g.id, uac.id, e.target.value, uac.horasSemanales || 3)}
                                style={{
                                  width: "100%",
                                  padding: "0.4rem 0.5rem",
                                  borderRadius: "6px",
                                  border: "1px solid " + (docenteActualId ? "#16a34a" : "#cbd5e1"),
                                  background: docenteActualId ? "#f0fdf4" : "#ffffff",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  color: docenteActualId ? "#15803d" : "#64748b",
                                  outline: "none"
                                }}
                              >
                                <option value="">-- Sin Asignar --</option>
                                {docentesIniciales.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.apellidoPaterno} {d.nombre} ({horasDocentes[d.id] || 20}h)
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1rem" }}>
            <button
              onClick={() => setPaso(2)}
              style={{ background: "#f1f5f9", color: "#1e293b", padding: "0.75rem 1.5rem", borderRadius: "10px", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              ← Atrás
            </button>

            <button
              disabled={loading}
              onClick={handleGuardarConfiguracion}
              style={{ background: "#16a34a", color: "#ffffff", padding: "0.75rem 2.25rem", borderRadius: "12px", fontWeight: 800, fontSize: "1rem", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)" }}
            >
              {loading ? "Generando Matriz..." : "🚀 Generar Horarios con IA (0 Empalmes)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
