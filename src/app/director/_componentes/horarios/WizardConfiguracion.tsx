"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Plus, Trash2, CheckCircle2, Building2, Users, BookOpen, Layers, Clock, AlertCircle, Wand2, ShieldCheck } from "lucide-react";
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

  // Configuración de la jornada
  const [numPeriodos, setNumPeriodos] = useState<number>(configInicial?.horasPorDia || 7);
  const [horaInicio, setHoraInicio] = useState<string>(configInicial?.horaInicio || "08:00");
  const [capacitacionSeleccionada, setCapacitacionSeleccionada] = useState<string>("Tecnologías de la Información y Comunicación");

  const [grupos, setGrupos] = useState<any[]>(
    gruposIniciales.length > 0
      ? gruposIniciales
      : [
          { nombre: "1° A", semestre: 1 },
          { nombre: "3° A", semestre: 3 },
          { nombre: "5° A", semestre: 5 }
        ]
  );

  const [aulas, setAulas] = useState<any[]>(
    aulasIniciales.length > 0
      ? aulasIniciales
      : [
          { nombre: "Aula 1° A", tipo: "REGULAR" },
          { nombre: "Laboratorio de Cómputo", tipo: "LABORATORIO" }
        ]
  );

  const [cargas, setCargas] = useState<any[]>(cargasIniciales || []);
  const [catalogAsignaturas, setCatalogAsignaturas] = useState<any[]>([]);

  // Modal para agregar materia personalizada
  const [mostrarModalMateria, setMostrarModalMateria] = useState<boolean>(false);
  const [nuevaMateriaNombre, setNuevaMateriaNombre] = useState<string>("");
  const [nuevaMateriaSemestre, setNuevaMateriaSemestre] = useState<number>(1);
  const [nuevaMateriaHoras, setNuevaMateriaHoras] = useState<number>(48);

  useEffect(() => {
    cargarCatalogos();
  }, [escuelaId]);

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

  // Función de Precarga Automática Inteligente basada en Reglas MCCEMS SEP Puebla
  const handlePrecargaInteligenteAsignaturas = () => {
    if (catalogAsignaturas.length === 0) {
      toast.error("El catálogo de asignaturas no se ha cargado aún.");
      return;
    }

    const docenteDefaultId = docentesIniciales[0]?.id;
    if (!docenteDefaultId) {
      toast.error("Debe existir al menos un docente registrado en la plantilla del plantel.");
      return;
    }

    const nuevasCargas: any[] = [];

    for (const g of grupos) {
      const sem = g.semestre;
      const gId = g.id || g.nombre;

      // 1. Filtrar asignaturas del catálogo oficial para este semestre
      const uacsSemestre = catalogAsignaturas.filter((a) => a.semester === sem);

      for (const uac of uacsSemestre) {
        // Regla: Si es componente laboral, filtrar solo la Capacitación seleccionada por la escuela
        if (uac.component === "laboral") {
          const uacLower = uac.uacName.toLowerCase();
          const capLower = capacitacionSeleccionada.toLowerCase();

          // Palabras clave de coincidencia para la capacitación seleccionada
          const esDeCapacitacion =
            capLower.includes("tecnolog") ? uacLower.includes("cómputo") || uacLower.includes("procesadores") || uacLower.includes("mantenimiento") || uacLower.includes("ofimática") || uacLower.includes("redes")
            : capLower.includes("salud") ? uacLower.includes("medicamentos") || uacLower.includes("paciente") || uacLower.includes("recetas")
            : capLower.includes("administra") ? uacLower.includes("recursos") || uacLower.includes("trámites") || uacLower.includes("organización")
            : true;

          if (!esDeCapacitacion) continue;
        }

        // Regla: No agregar duplicados
        const yaExiste = cargas.some((c) => c.grupoId === gId && c.asignaturaId === uac.id);
        if (!yaExiste) {
          nuevasCargas.push({
            personalId: docenteDefaultId,
            grupoId: gId,
            asignaturaId: uac.id,
            horasSemanales: uac.horasSemanales || 3,
            requiereAulaEspecial: uac.component === "laboral"
          });
        }
      }
    }

    setCargas([...cargas, ...nuevasCargas]);
    toast.success(`¡Precargadas ${nuevasCargas.length} asignaturas oficiales (Total por escuela: 60 UACs distribuidas en 10, 10, 9, 11, 10 y 10 materias por semestre)!`);
  };

  const handleCrearMateriaPersonalizada = async () => {
    if (!nuevaMateriaNombre.trim()) {
      toast.error("Ingrese el nombre de la asignatura");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/horarios/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uacName: nuevaMateriaNombre.trim(),
          semester: nuevaMateriaSemestre,
          totalHours: nuevaMateriaHoras,
          escuelaId
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Materia "${nuevaMateriaNombre}" agregada correctamente`);
        setNuevaMateriaNombre("");
        setMostrarModalMateria(false);
        cargarCatalogos();
      } else {
        toast.error(data.error || "Error al crear materia");
      }
    } catch (e) {
      toast.error("Error de conexión al agregar materia");
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarGrupo = () => {
    setGrupos([...grupos, { nombre: `${grupos.length + 1}° A`, semestre: 1 }]);
  };

  const handleEliminarGrupo = (index: number) => {
    setGrupos(grupos.filter((_, i) => i !== index));
  };

  const handleAgregarAula = () => {
    setAulas([...aulas, { nombre: `Aula ${aulas.length + 1}`, tipo: "REGULAR" }]);
  };

  const handleEliminarAula = (index: number) => {
    setAulas(aulas.filter((_, i) => i !== index));
  };

  const handleAgregarCarga = () => {
    if (docentesIniciales.length === 0 || grupos.length === 0 || catalogAsignaturas.length === 0) {
      toast.error("Debe tener al menos 1 docente, 1 grupo y asignaturas disponibles.");
      return;
    }
    setCargas([
      ...cargas,
      {
        personalId: docentesIniciales[0]?.id,
        grupoId: grupos[0]?.id || grupos[0]?.nombre,
        asignaturaId: catalogAsignaturas[0]?.id,
        horasSemanales: 3,
        requiereAulaEspecial: false
      }
    ]);
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
          aulas,
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-5xl mx-auto">
      {/* Encabezado del Wizard */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" /> Asistente de Configuración de Horario (MCCEMS SEP Puebla)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Capture los datos del plantel y la Formación Laboral para autocompletar la carga curricular oficial
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                paso === step
                  ? "bg-blue-600 text-white ring-4 ring-blue-100"
                  : paso > step
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {paso > step ? "✓" : step}
            </div>
          ))}
        </div>
      </div>

      {/* PASO 1: Jornada y Capacitación Laboral */}
      {paso === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Horas/Periodos por Día
              </label>
              <select
                value={numPeriodos}
                onChange={(e) => setNumPeriodos(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium text-sm"
              >
                <option value={5}>5 Horas por día</option>
                <option value={6}>6 Horas por día</option>
                <option value={7}>7 Horas por día (Matutino Estándar)</option>
                <option value={8}>8 Horas por día</option>
              </select>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" /> Formación Laboral (Capacitación del Plantel)
              </label>
              <select
                value={capacitacionSeleccionada}
                onChange={(e) => setCapacitacionSeleccionada(e.target.value)}
                className="w-full p-2.5 bg-white border border-blue-300 rounded-lg text-blue-950 font-bold text-sm shadow-sm"
              >
                {FORMACIONES_LABORALES.map((cap) => (
                  <option key={cap} value={cap}>
                    {cap} (8 Asignaturas - 3° a 6° Sem)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Grupos del Plantel
              </h3>
              <button
                type="button"
                onClick={handleAgregarGrupo}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium text-xs flex items-center gap-1 transition"
              >
                <Plus className="w-4 h-4" /> Agregar Grupo
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {grupos.map((g, idx) => (
                <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
                  <div className="flex-1 mr-2">
                    <input
                      type="text"
                      value={g.nombre}
                      onChange={(e) => {
                        const newG = [...grupos];
                        newG[idx].nombre = e.target.value;
                        setGrupos(newG);
                      }}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-sm font-bold text-slate-800"
                    />
                  </div>
                  <select
                    value={g.semestre}
                    onChange={(e) => {
                      const newG = [...grupos];
                      newG[idx].semestre = Number(e.target.value);
                      setGrupos(newG);
                    }}
                    className="p-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 mr-2"
                  >
                    <option value={1}>1° Semestre</option>
                    <option value={2}>2° Semestre</option>
                    <option value={3}>3° Semestre</option>
                    <option value={4}>4° Semestre</option>
                    <option value={5}>5° Semestre</option>
                    <option value={6}>6° Semestre</option>
                  </select>
                  <button
                    onClick={() => handleEliminarGrupo(idx)}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setPaso(2)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-500/20"
            >
              Siguiente: Aulas y Espacios →
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Aulas y Espacios */}
      {paso === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" /> Aulas y Laboratorios Compartidos
            </h3>
            <button
              type="button"
              onClick={handleAgregarAula}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium text-xs flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" /> Agregar Espacio
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aulas.map((a, idx) => (
              <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
                <input
                  type="text"
                  value={a.nombre}
                  onChange={(e) => {
                    const newA = [...aulas];
                    newA[idx].nombre = e.target.value;
                    setAulas(newA);
                  }}
                  className="w-1/2 p-1.5 bg-white border border-slate-300 rounded text-sm font-semibold text-slate-800 mr-2"
                />
                <select
                  value={a.tipo}
                  onChange={(e) => {
                    const newA = [...aulas];
                    newA[idx].tipo = e.target.value;
                    setAulas(newA);
                  }}
                  className="w-1/3 p-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 mr-2"
                >
                  <option value="REGULAR">Aula Regular</option>
                  <option value="LABORATORIO">Laboratorio</option>
                  <option value="TALLER">Taller</option>
                  <option value="DEPORTIVO">Espacio Deportivo</option>
                </select>
                <button
                  onClick={() => handleEliminarAula(idx)}
                  className="text-rose-500 hover:text-rose-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setPaso(1)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
            >
              ← Atrás
            </button>
            <button
              onClick={() => setPaso(3)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-500/20"
            >
              Siguiente: Carga Académica →
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Carga Académica Docente */}
      {paso === 3 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" /> Carga Académica (Docente - Materia - Grupo)
              </h3>
              <p className="text-xs text-slate-500">
                Desglose Oficial (60 UACs totales por plantel): <strong>10 (1°), 10 (2°), 9 (3°), 11 (4°), 10 (5°) y 10 (6°)</strong>. Capacitación: <strong>{capacitacionSeleccionada}</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrecargaInteligenteAsignaturas}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
              >
                <Wand2 className="w-4 h-4" /> Auto-Precargar Plan Oficial MCCEMS
              </button>

              <button
                type="button"
                onClick={() => setMostrarModalMateria(true)}
                className="px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-medium text-xs flex items-center gap-1 border border-purple-200 transition"
              >
                <Plus className="w-4 h-4" /> + Materia Personalizada
              </button>

              <button
                type="button"
                onClick={handleAgregarCarga}
                className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium text-xs flex items-center gap-1 transition"
              >
                <Plus className="w-4 h-4" /> Asignar Carga
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {cargas.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-700 font-bold">No se han registrado asignaciones de materias.</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Haga clic en <strong className="text-emerald-600 font-bold">"Auto-Precargar Plan Oficial MCCEMS"</strong> para autocompletar automáticamente el 100% de las materias requeridas por la SEP Puebla para sus grupos.
                </p>
              </div>
            ) : (
              cargas.map((c, idx) => (
                <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">DOCENTE</label>
                    <select
                      value={c.personalId}
                      onChange={(e) => {
                        const newC = [...cargas];
                        newC[idx].personalId = e.target.value;
                        setCargas(newC);
                      }}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800"
                    >
                      {docentesIniciales.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre} {d.apellidoPaterno}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">ASIGNATURA (UAC)</label>
                    <select
                      value={c.asignaturaId}
                      onChange={(e) => {
                        const newC = [...cargas];
                        newC[idx].asignaturaId = e.target.value;
                        setCargas(newC);
                      }}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800"
                    >
                      {catalogAsignaturas.map((a) => (
                        <option key={a.id} value={a.id}>
                          Sem {a.semester}: {a.uacName} ({a.horasSemanales}h/sem)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">GRUPO</label>
                    <select
                      value={c.grupoId}
                      onChange={(e) => {
                        const newC = [...cargas];
                        newC[idx].grupoId = e.target.value;
                        setCargas(newC);
                      }}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800"
                    >
                      {grupos.map((g) => (
                        <option key={g.id || g.nombre} value={g.id || g.nombre}>
                          {g.nombre} (Sem {g.semestre})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">HORAS/SEM</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={c.horasSemanales}
                        onChange={(e) => {
                          const newC = [...cargas];
                          newC[idx].horasSemanales = Number(e.target.value);
                          setCargas(newC);
                        }}
                        className="w-16 p-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                      />
                    </div>
                    <button
                      onClick={() => setCargas(cargas.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setPaso(2)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
            >
              ← Atrás
            </button>

            <button
              disabled={loading}
              onClick={handleGuardarConfiguracion}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-xl shadow-blue-500/25 flex items-center gap-2"
            >
              {loading ? "Generando Matriz..." : "🚀 Generar Horario con IA"}
            </button>
          </div>
        </div>
      )}

      {/* Modal para Materia Personalizada */}
      {mostrarModalMateria && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Agregar Asignatura Personalizada</h3>
            <p className="text-xs text-slate-500">
              Si la materia requerida por su plantel no se encuentra en el catálogo oficial de 203 UACs, regístrela aquí.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Asignatura</label>
              <input
                type="text"
                placeholder="Ej. Taller de Robótica Avanzada"
                value={nuevaMateriaNombre}
                onChange={(e) => setNuevaMateriaNombre(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Semestre</label>
                <select
                  value={nuevaMateriaSemestre}
                  onChange={(e) => setNuevaMateriaSemestre(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <option key={s} value={s}>{s}° Semestre</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Horas Totales (Ciclo)</label>
                <input
                  type="number"
                  value={nuevaMateriaHoras}
                  onChange={(e) => setNuevaMateriaHoras(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMostrarModalMateria(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearMateriaPersonalizada}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold"
              >
                Guardar Materia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
