"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Users, BookOpen, Clock, AlertCircle, ShieldCheck, UserCheck, Plus, Trash2, CheckCircle2, UserPlus } from "lucide-react";
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

// 15 Capacitaciones Laborales Oficiales BGE 2023 (Nombres Exactos)
const FORMACIONES_LABORALES = [
  "Administracion",
  "Agricultura Sostenible de Traspatio",
  "Area de la Salud",
  "Comunicacion Grafica",
  "Contabilidad",
  "Domotica",
  "Instalaciones Residenciales",
  "Mecanica Dental",
  "Preparacion de Alimentos Artesanales",
  "Procesos Culinarios y Reposteria",
  "Redes y Mantenimiento",
  "Servicios Ecosistemicos",
  "Sistemas Electricos",
  "Tecnologia Informatica",
  "Turismo"
];

// Opciones FFE Optativas MCCEMS 2025-2026 (Puebla)
const FFE_RECURSO_SOCIOCOGNITIVO = [
  "Comunicación y Sociedad I",
  "Raíces Etimológicas del Español I",
  "Inglés V",
  "Taller de Pensamiento Variacional I",
  "Dibujo Técnico I",
  "Pensamiento Matemático Aplicado a las Finanzas I",
  "Taller de Probabilidad y Estadística I"
];

const FFE_AREA_CONOCIMIENTO = [
  "Salud Integral I",
  "Análisis de Fenómenos y Procesos Biológicos",
  "Análisis de Fenómenos Físicos I",
  "Organización del Flujo de Materia y Energía en los Organismos I",
  "Fundamentos de Administración I",
  "Procesos Contables I",
  "Derecho y Sociedad I",
  "Economía I. La Función de los Agentes Económicos en la Sociedad",
  "Temas Selectos de Ciencias Sociales I",
  "Psicología I",
  "Arte y Cultura I",
  "Lógica y Pensamiento Crítico",
  "Pensamiento Filosófico I"
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

  // Configuración de Jornada (Predeterminada 6 hrs diarias)
  const [numPeriodos, setNumPeriodos] = useState<number>(configInicial?.horasPorDia || 6);
  const [horaInicio, setHoraInicio] = useState<string>(configInicial?.horaInicio || "08:00");
  
  // Número abierto de grupos por grado (1, 2, 3, 4, 5, 10...)
  const [numGruposPorGrado, setNumGruposPorGrado] = useState<number>(
    gruposIniciales.length > 0 ? Math.max(1, Math.ceil(gruposIniciales.length / 3)) : 1
  );

  // Estado de Grupos con su Configuración Curricular Específica
  const [grupos, setGrupos] = useState<any[]>([]);

  // Docentes (locales + plantilla inicial)
  const [docentes, setDocentes] = useState<any[]>(docentesIniciales || []);
  const [horasDocentes, setHorasDocentes] = useState<Record<string, number>>({});

  // Cargas Docente-Materia-Grupo (Paso 3)
  const [cargas, setCargas] = useState<any[]>(cargasIniciales || []);
  const [catalogAsignaturas, setCatalogAsignaturas] = useState<any[]>([]);

  // Modal para agregar nuevo docente
  const [mostrarModalDocente, setMostrarModalDocente] = useState<boolean>(false);
  const [nuevoDocenteNombre, setNuevoDocenteNombre] = useState<string>("");
  const [nuevoDocentePaterno, setNuevoDocentePaterno] = useState<string>("");
  const [nuevoDocenteMaterno, setNuevoDocenteMaterno] = useState<string>("");
  const [nuevoDocenteHoras, setNuevoDocenteHoras] = useState<number>(20);

  useEffect(() => {
    cargarCatalogos();
  }, [escuelaId]);

  useEffect(() => {
    setDocentes(docentesIniciales || []);
  }, [docentesIniciales]);

  // Generar grupos según la cantidad de grupos por grado (sin límite rígido)
  useEffect(() => {
    generarGruposSegunEstructura(numGruposPorGrado);
  }, [numGruposPorGrado]);

  // Inicializar mapa de horas por docente
  useEffect(() => {
    if (docentes.length > 0) {
      const mapaHoras: Record<string, number> = { ...horasDocentes };
      docentes.forEach((d) => {
        if (!mapaHoras[d.id]) {
          mapaHoras[d.id] = d.horasAsignadas || 20;
        }
      });
      setHorasDocentes(mapaHoras);
    }
  }, [docentes]);

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

  const generarGruposSegunEstructura = (nGrupos: number) => {
    const letras = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const nuevosGrupos: any[] = [];

    for (let sem of [1, 3, 5]) {
      for (let i = 0; i < nGrupos; i++) {
        const letra = letras[i] || `G${i + 1}`;
        const nombreGrupo = `${sem}° ${letra}`;

        const grupoExistente = grupos.find((g) => g.nombre === nombreGrupo);

        nuevosGrupos.push({
          id: grupoExistente?.id || `temp_${sem}_${letra}`,
          nombre: nombreGrupo,
          semestre: sem,
          capacitacionNombre: grupoExistente?.capacitacionNombre || FORMACIONES_LABORALES[i % FORMACIONES_LABORALES.length],
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

  // Filtrado estricto anti-duplicados para optativas FFE de cada grupo
  const handleActualizarOptativaGrupo = (grupoIdx: number, optativaIdx: number, value: string) => {
    const copia = [...grupos];
    const optativas = [...(copia[grupoIdx].ffeOptativas || [])];
    optativas[optativaIdx] = value;
    copia[grupoIdx].ffeOptativas = optativas;
    setGrupos(copia);
  };

  // Crear nuevo docente y añadirlo a la plantilla del plantel
  const handleCrearNuevoDocente = async () => {
    if (!nuevoDocenteNombre.trim() || !nuevoDocentePaterno.trim()) {
      toast.error("El nombre y apellido paterno son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "CREAR_DOCENTE",
          escuelaId,
          nombre: nuevoDocenteNombre.trim(),
          apellidoPaterno: nuevoDocentePaterno.trim(),
          apellidoMaterno: nuevoDocenteMaterno.trim(),
          sexo: "MASCULINO"
        })
      });
      const data = await res.json();
      if (data.success && data.docente) {
        toast.success(`Docente ${data.docente.nombre} ${data.docente.apellidoPaterno} agregado a la plantilla.`);
        setDocentes([...docentes, data.docente]);
        setHorasDocentes({ ...horasDocentes, [data.docente.id]: nuevoDocenteHoras });
        setNuevoDocenteNombre("");
        setNuevoDocentePaterno("");
        setNuevoDocenteMaterno("");
        setMostrarModalDocente(false);
      } else {
        toast.error(data.error || "Error al registrar docente.");
      }
    } catch (e) {
      toast.error("Error de conexión al agregar docente.");
    } finally {
      setLoading(false);
    }
  };

  // Asignar docente en la matriz tabular del Paso 3
  const handleAsignarDocenteMatriz = (grupoId: string, asignaturaId: string, personalId: string, horasSemanales: number) => {
    if (!personalId) {
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

  const getDocenteAsignado = (grupoId: string, asignaturaId: string) => {
    const asignacion = cargas.find((c) => c.grupoId === grupoId && c.asignaturaId === asignaturaId);
    return asignacion?.personalId || "";
  };

  // Calcular horas consumidas por cada docente en las asignaciones de la matriz
  const getHorasConsumidasDocente = (docenteId: string) => {
    return cargas
      .filter((c) => c.personalId === docenteId)
      .reduce((sum, c) => sum + (c.horasSemanales || 3), 0);
  };

  // Guardar configuración completa y proceder a generar horario
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

  // Métricas de Horas del Plantel
  const totalGrupos = grupos.length;
  const horasRequeridasPlantel = totalGrupos * 30; // 30 hrs por grupo
  const totalHorasPlantillaDocente = Object.values(horasDocentes).reduce((sum, h) => sum + Number(h || 0), 0);

  // Obtener UACs específicas para un grupo según su semestre, capacitación y optativas FFE
  const getAsignaturasEspecificasGrupo = (grupo: any) => {
    const sem = grupo.semestre;
    let uacs = catalogAsignaturas.filter((a) => a.semester === sem);

    if (sem === 1) {
      return uacs; // Universal
    }

    if (sem === 3) {
      // Regla: 7 Fundamental + 2 Laboral del grupo
      const capNombre = (grupo.capacitacionNombre || "").toLowerCase();
      return uacs.filter((uac) => {
        if (uac.component === "laboral") {
          const uacLower = uac.uacName.toLowerCase();
          if (capNombre.includes("tecnolog") || capNombre.includes("informatica")) return uacLower.includes("cómputo") || uacLower.includes("procesadores") || uacLower.includes("mantenimiento") || uacLower.includes("ofimática") || uacLower.includes("redes") || uacLower.includes("gráficos");
          if (capNombre.includes("salud")) return uacLower.includes("medicamentos") || uacLower.includes("paciente") || uacLower.includes("recetas") || uacLower.includes("salud");
          if (capNombre.includes("administra")) return uacLower.includes("recursos") || uacLower.includes("trámites") || uacLower.includes("organización");
          if (capNombre.includes("grafica")) return uacLower.includes("bocetos") || uacLower.includes("impresión") || uacLower.includes("efectos") || uacLower.includes("gráficos");
          return true;
        }
        return true;
      });
    }

    if (sem === 5) {
      // Regla: 3 Fundamental + 1 FFEO + 2 Laboral + 4 FFE Optativas seleccionadas
      const capNombre = (grupo.capacitacionNombre || "").toLowerCase();
      const ffeElegidas = grupo.ffeOptativas || [];

      return uacs.filter((uac) => {
        if (uac.component === "laboral") {
          const uacLower = uac.uacName.toLowerCase();
          if (capNombre.includes("tecnolog") || capNombre.includes("informatica")) return uacLower.includes("cómputo") || uacLower.includes("procesadores") || uacLower.includes("mantenimiento") || uacLower.includes("ofimática") || uacLower.includes("redes");
          if (capNombre.includes("salud")) return uacLower.includes("medicamentos") || uacLower.includes("paciente") || uacLower.includes("recetas");
          if (capNombre.includes("administra")) return uacLower.includes("recursos") || uacLower.includes("trámites") || uacLower.includes("organización");
          return true;
        }
        if (uac.component === "ext_optativo") {
          return ffeElegidas.some((opt: string) => uac.uacName.toLowerCase().includes(opt.toLowerCase()) || opt.toLowerCase().includes(uac.uacName.toLowerCase()));
        }
        return true;
      });
    }

    return uacs;
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", maxWidth: "1250px", margin: "0 auto" }}>
      {/* Encabezado del Wizard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <Sparkles style={{ width: "22px", height: "22px", color: "#2563eb" }} /> Asistente de Configuración de Horario (SEP Puebla)
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", margin: 0 }}>
            Defina la cantidad libre de grupos, cargas laborales/optativas y asigne docentes en la matriz por grupo
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
         PASO 1: Estructura Abierta de Grupos y Selección Curricular por Grupo
         ========================================================================= */}
      {paso === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Fila superior: Cantidad abierta de grupos e Jornada escolar (Predeterminada 6 hrs) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
            <div style={{ background: "#eff6ff", padding: "1.25rem", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>
                <Users style={{ width: "16px", height: "16px", color: "#2563eb", display: "inline", marginRight: "6px" }} />
                Número de Grupos por Grado / Año
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numGruposPorGrado}
                  onChange={(e) => setNumGruposPorGrado(Math.max(1, Number(e.target.value)))}
                  style={{ width: "90px", padding: "0.625rem", borderRadius: "8px", border: "2px solid #2563eb", fontWeight: 800, textAlign: "center", fontSize: "1.125rem", color: "#1e293b" }}
                />
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1d4ed8" }}>
                  = {numGruposPorGrado * 3} Grupos Totales ({numGruposPorGrado} de 1°, {numGruposPorGrado} de 3°, {numGruposPorGrado} de 5°)
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.35rem", margin: 0 }}>
                Escriba la cantidad de grupos por año (1, 2, 3, 4, 5, 10...). Se autogenera la letra alfabética.
              </p>
            </div>

            <div style={{ background: "#f0fdf4", padding: "1.25rem", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>
                <Clock style={{ width: "16px", height: "16px", color: "#16a34a", display: "inline", marginRight: "6px" }} />
                Jornada Escolar (Predeterminada BGE: 6 Hrs Diarias)
              </label>
              <select
                value={numPeriodos}
                onChange={(e) => setNumPeriodos(Number(e.target.value))}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "8px", border: "2px solid #22c55e", background: "#ffffff", fontWeight: 800, fontSize: "0.9375rem", color: "#1e293b" }}
              >
                <option value={6}>6 Horas diarias (30 hrs semanales - Estándar BGE Predeterminado)</option>
                <option value={7}>7 Horas diarias (35 hrs semanales)</option>
                <option value={8}>8 Horas diarias (40 hrs semanales)</option>
              </select>
            </div>
          </div>

          {/* Configuración Curricular Individual por Grupo */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", background: "#f8fafc" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ShieldCheck style={{ width: "18px", height: "18px", color: "#2563eb" }} /> Configuración Curricular Individual por Grupo
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1.25rem" }}>
              {grupos.map((g, idx) => (
                <div key={idx} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#1d4ed8" }}>
                      Grupo {g.nombre} ({g.semestre}° Semestre)
                    </span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#eff6ff", color: "#2563eb", padding: "0.25rem 0.5rem", borderRadius: "6px" }}>
                      {g.semestre === 1 ? "Universal (10 UACs)" : g.semestre === 3 ? "Laboral (9 UACs)" : "Laboral + FFE (10 UACs)"}
                    </span>
                  </div>

                  {/* Formación Laboral (para 3° y 5° semestre) */}
                  {g.semestre >= 3 && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#334155", marginBottom: "0.25rem" }}>
                        Formación Laboral (Capacitación del Grupo)
                      </label>
                      <select
                        value={g.capacitacionNombre || FORMACIONES_LABORALES[0]}
                        onChange={(e) => handleActualizarConfigGrupo(idx, "capacitacionNombre", e.target.value)}
                        style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}
                      >
                        {FORMACIONES_LABORALES.map((cap) => (
                          <option key={cap} value={cap}>
                            {cap}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* FFE Optativas (para 5° semestre) con filtrado anti-duplicados */}
                  {g.semestre === 5 && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#334155", marginBottom: "0.35rem" }}>
                        Optativas FFE (2 Recurso Sociocognitivo + 2 Área de Conocimiento)
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                        {/* Cuadro 1: Recurso Sociocognitivo */}
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", display: "block" }}>Cuadro 1 (Recurso)</span>
                          <select
                            value={g.ffeOptativas?.[0] || FFE_RECURSO_SOCIOCOGNITIVO[0]}
                            onChange={(e) => handleActualizarOptativaGrupo(idx, 0, e.target.value)}
                            style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.7rem", fontWeight: 700 }}
                          >
                            {FFE_RECURSO_SOCIOCOGNITIVO.map((rec) => (
                              <option key={rec} value={rec}>{rec}</option>
                            ))}
                          </select>
                        </div>

                        {/* Cuadro 2: Recurso Sociocognitivo (Filtrado para no repetir Cuadro 1) */}
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", display: "block" }}>Cuadro 2 (Recurso sin repetir)</span>
                          <select
                            value={g.ffeOptativas?.[1] || FFE_RECURSO_SOCIOCOGNITIVO[1]}
                            onChange={(e) => handleActualizarOptativaGrupo(idx, 1, e.target.value)}
                            style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.7rem", fontWeight: 700 }}
                          >
                            {FFE_RECURSO_SOCIOCOGNITIVO
                              .filter((rec) => rec !== g.ffeOptativas?.[0])
                              .map((rec) => (
                                <option key={rec} value={rec}>{rec}</option>
                              ))}
                          </select>
                        </div>

                        {/* Cuadro 3: Área de Conocimiento */}
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", display: "block" }}>Cuadro 3 (Área)</span>
                          <select
                            value={g.ffeOptativas?.[2] || FFE_AREA_CONOCIMIENTO[0]}
                            onChange={(e) => handleActualizarOptativaGrupo(idx, 2, e.target.value)}
                            style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.7rem", fontWeight: 700 }}
                          >
                            {FFE_AREA_CONOCIMIENTO.map((area) => (
                              <option key={area} value={area}>{area}</option>
                            ))}
                          </select>
                        </div>

                        {/* Cuadro 4: Área de Conocimiento (Filtrado para no repetir Cuadro 3) */}
                        <div>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#64748b", display: "block" }}>Cuadro 4 (Área sin repetir)</span>
                          <select
                            value={g.ffeOptativas?.[3] || FFE_AREA_CONOCIMIENTO[1]}
                            onChange={(e) => handleActualizarOptativaGrupo(idx, 3, e.target.value)}
                            style={{ width: "100%", padding: "0.35rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.7rem", fontWeight: 700 }}
                          >
                            {FFE_AREA_CONOCIMIENTO
                              .filter((area) => area !== g.ffeOptativas?.[2])
                              .map((area) => (
                                <option key={area} value={area}>{area}</option>
                              ))}
                          </select>
                        </div>
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
         PASO 2: Plantilla Docente & Contador de Horas del Plantel
         ========================================================================= */}
      {paso === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Fila superior: Resumen de Métricas de Horas del Plantel y Botón Agregar Docente */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <UserCheck style={{ width: "18px", height: "18px", color: "#2563eb" }} /> Carga Horaria de la Plantilla Docente Frente a Grupo
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem", margin: 0 }}>
                Ingrese la carga horaria semanal (1 a 30 hrs) contratada para cada docente.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {/* Stat box de Horas */}
              <div style={{ background: "#ffffff", padding: "0.5rem 1rem", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "right" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Plantilla Contratada</div>
                <div style={{ fontSize: "1.125rem", fontWeight: 900, color: totalHorasPlantillaDocente >= horasRequeridasPlantel ? "#16a34a" : "#d97706" }}>
                  {totalHorasPlantillaDocente} / {horasRequeridasPlantel} hrs
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMostrarModalDocente(true)}
                style={{ background: "#2563eb", color: "#ffffff", padding: "0.625rem 1.25rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.8125rem", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <UserPlus style={{ width: "16px", height: "16px" }} /> + Agregar Docente a Plantilla
              </button>
            </div>
          </div>

          {docentes.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: "12px" }}>
              <AlertCircle style={{ width: "32px", height: "32px", color: "#94a3b8", margin: "0 auto 0.5rem" }} />
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>No se encontraron docentes registrados en la plantilla de este plantel.</p>
              <button
                onClick={() => setMostrarModalDocente(true)}
                style={{ marginTop: "0.75rem", background: "#2563eb", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", border: "none", cursor: "pointer" }}
              >
                + Registrar Primer Docente
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
              {docentes.map((d) => (
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
         PASO 3: Matriz Tabular Específica por Grupo (3° y 5° Semestre)
         ========================================================================= */}
      {paso === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BookOpen style={{ width: "20px", height: "20px", color: "#2563eb" }} /> Matriz de Asignación Docente por Grupo (UACs Específicas)
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
              Cada grupo muestra únicamente sus UACs correspondientes a su Formación Laboral y Optativas FFE seleccionadas.
            </p>
          </div>

          {/* RENDERIZADO DE TABLAS POR GRUPO INDIVIDUAL PARA EVITAR MEZCLAS */}
          {[1, 3, 5].map((sem) => {
            const gruposSemestre = grupos.filter((g) => g.semestre === sem);
            if (gruposSemestre.length === 0) return null;

            return (
              <div key={sem} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                <div style={{ background: "#1e293b", color: "#ffffff", padding: "0.625rem 1rem", borderRadius: "8px", fontWeight: 800, fontSize: "0.875rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{sem === 1 ? "1er Semestre (1er Año - 10 UACs Universales)" : sem === 3 ? "3er Semestre (2º Año - 9 UACs por Grupo)" : "5to Semestre (3er Año - 10 UACs por Grupo)"}</span>
                  <span style={{ fontSize: "0.75rem", background: "#334155", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                    {gruposSemestre.length} Grupo(s) activo(s)
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.25rem" }}>
                  {gruposSemestre.map((g) => {
                    const uacsEspecificas = getAsignaturasEspecificasGrupo(g);

                    return (
                      <div key={g.id} style={{ border: "1px solid #cbd5e1", borderRadius: "10px", overflow: "hidden", background: "#ffffff" }}>
                        <div style={{ background: "#eff6ff", padding: "0.625rem 0.85rem", borderBottom: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 900, color: "#1d4ed8" }}>
                            Grupo {g.nombre}
                          </span>
                          {g.capacitacionNombre && (
                            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#2563eb", background: "#ffffff", padding: "0.15rem 0.5rem", borderRadius: "4px", border: "1px solid #bfdbfe" }}>
                              {g.capacitacionNombre}
                            </span>
                          )}
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78125rem" }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                              <th style={{ padding: "0.5rem", textAlign: "left", fontWeight: 800, color: "#334155", width: "55%" }}>Asignatura (UAC)</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#2563eb", width: "15%" }}>Horas</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#1e293b", width: "30%" }}>Docente Asignado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uacsEspecificas.map((uac, uacIdx) => {
                              const docenteActualId = getDocenteAsignado(g.id, uac.id);

                              return (
                                <tr key={uac.id || uacIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                  <td style={{ padding: "0.45rem 0.5rem", fontWeight: 700, color: "#1e293b" }}>
                                    {uac.uacName}
                                  </td>
                                  <td style={{ padding: "0.45rem", textAlign: "center", fontWeight: 800, color: "#2563eb" }}>
                                    {uac.horasSemanales || 3}h
                                  </td>
                                  <td style={{ padding: "0.35rem" }}>
                                    <select
                                      value={docenteActualId}
                                      onChange={(e) => handleAsignarDocenteMatriz(g.id, uac.id, e.target.value, uac.horasSemanales || 3)}
                                      style={{
                                        width: "100%",
                                        padding: "0.35rem 0.4rem",
                                        borderRadius: "6px",
                                        border: "1px solid " + (docenteActualId ? "#16a34a" : "#cbd5e1"),
                                        background: docenteActualId ? "#f0fdf4" : "#ffffff",
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        color: docenteActualId ? "#15803d" : "#64748b",
                                        outline: "none"
                                      }}
                                    >
                                      <option value="">-- Sin Asignar --</option>
                                      {docentes.map((d) => {
                                        const hrsMax = horasDocentes[d.id] || 20;
                                        const hrsConsumidas = getHorasConsumidasDocente(d.id);
                                        const esSeleccionado = docenteActualId === d.id;
                                        const estaLleno = hrsConsumidas >= hrsMax && !esSeleccionado;

                                        return (
                                          <option key={d.id} value={d.id} disabled={estaLleno}>
                                            {d.apellidoPaterno} {d.nombre} ({hrsConsumidas}/{hrsMax}h) {estaLleno ? "[LLENO]" : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
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

      {/* MODAL PARA AGREGAR NUEVO DOCENTE A LA PLANTILLA */}
      {mostrarModalDocente && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "1.5rem", maxWidth: "450px", width: "100%", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.25rem" }}>
              Registrar Nuevo Docente en Plantilla
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "1rem" }}>
              Agregue el nombre y las horas contratadas del profesor para incluirlo en el horario.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.25rem" }}>Nombre(s)</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Manuel"
                  value={nuevoDocenteNombre}
                  onChange={(e) => setNuevoDocenteNombre(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.25rem" }}>Apellido Paterno</label>
                  <input
                    type="text"
                    placeholder="Ej. Pérez"
                    value={nuevoDocentePaterno}
                    onChange={(e) => setNuevoDocentePaterno(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.25rem" }}>Apellido Materno</label>
                  <input
                    type="text"
                    placeholder="Ej. Gómez"
                    value={nuevoDocenteMaterno}
                    onChange={(e) => setNuevoDocenteMaterno(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.25rem" }}>Horas Frente a Grupo Contratadas</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={nuevoDocenteHoras}
                  onChange={(e) => setNuevoDocenteHoras(Number(e.target.value))}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "2px solid #2563eb", fontSize: "0.875rem", fontWeight: 800 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setMostrarModalDocente(false)}
                style={{ background: "#f1f5f9", color: "#1e293b", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCrearNuevoDocente}
                style={{ background: "#2563eb", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
              >
                Guardar Docente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
