"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Users, BookOpen, Clock, AlertCircle, ShieldCheck, UserCheck, Plus, Trash2, CheckCircle2, UserPlus, Layers, Search, Save } from "lucide-react";
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

// Asignaturas de Currículum Ampliado / Formación Socioemocional (FFEO) para 3º a 6º Semestre
const CURRICULUM_AMPLIADO_FFEO = [
  "Educación para la Salud III (2025)",
  "Educación Integral en Sexualidad y Género III (2025)",
  "Práctica y Colaboración Ciudadana III (2025)"
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

// Mapeo exhaustivo de las 15 Capacitaciones Laborales a sus 2 UACs de 3º semestre y 2 UACs de 5º semestre con Abreviaturas
const UACS_LABORALES_MAPA: Record<string, { sem3: { name: string; abrev: string }[]; sem5: { name: string; abrev: string }[] }> = {
  "Administracion": {
    sem3: [
      { name: "Entrega recursos materiales a otras áreas de una organización", abrev: "ENTR-REC" },
      { name: "Organiza recursos materiales a solicitud de un superior", abrev: "ORG-REC" }
    ],
    sem5: [
      { name: "Elabora trámites administrativos básicos de una organización", abrev: "TRAM-ADM" },
      { name: "Organiza expedientes y documentación interna de las diferentes áreas de una organización", abrev: "ORG-EXP" }
    ]
  },
  "Agricultura Sostenible de Traspatio": {
    sem3: [
      { name: "Construye huerto para la producción agrícola sostenible de traspatio", abrev: "CONST-HUERTO" },
      { name: "Planea huerto para la producción agrícola sostenible de traspatio", abrev: "PLAN-HUERTO" }
    ],
    sem5: [
      { name: "Aplica técnicas agroecológicas de conservación de suelo y agua, y de control de plagas y enfermedades", abrev: "TECN-AGROE" },
      { name: "Distingue técnicas agroecológicas de conservación de suelo y agua y de control de plagas y enfermedades", abrev: "DIST-AGROE" }
    ]
  },
  "Area de la Salud": {
    sem3: [
      { name: "Despacha medicamentos y material de curación de acuerdo con prescripciones médicas y productos farmacéuticos", abrev: "DESP-MED" },
      { name: "Lleva registro de recetas, inventarios de medicamentos y productos farmacéuticos", abrev: "REG-RECET" }
    ],
    sem5: [
      { name: "Asiste especialistas del área en las necesidades del paciente", abrev: "ASIST-PAC" },
      { name: "Asiste especialistas del área en las necesidades del paciente diagnosticado", abrev: "ASIST-DIAG" }
    ]
  },
  "Comunicacion Grafica": {
    sem3: [
      { name: "Elabora bocetos gráficos comprensibles y creativos a partir de las necesidades de comunicación gráfica requerida", abrev: "BOC-GRAF" },
      { name: "Ilustra dibujos en materiales artesanales o artísticos", abrev: "ILUS-DIB" }
    ],
    sem5: [
      { name: "Integra efectos visuales a imágenes y textos por medio de software o aplicaciones digitales de uso libre", abrev: "EFEC-VIS" },
      { name: "Utiliza técnicas de impresión para los diversos productos gráficos, artesanales, artísticos y publicitarios", abrev: "TECN-IMP" }
    ]
  },
  "Contabilidad": {
    sem3: [
      { name: "Opera programas de cómputo para efectuar el registro, cálculo, control y análisis de la información contable", abrev: "PROG-CONT" },
      { name: "Registra movimientos contables de una entidad económica, con base en documentos fuente", abrev: "REG-MOV" }
    ],
    sem5: [
      { name: "Realiza reportes básicos previos a los estados financieros", abrev: "REP-FIN" },
      { name: "Registra compras y ventas del sector comercial", abrev: "REG-COMP" }
    ]
  },
  "Domotica": {
    sem3: [
      { name: "Separa componentes electrónicos y mecánicos de uso doméstico y comercial", abrev: "COMP-ELEC" },
      { name: "Separa componentes eléctricos y domóticos de uso doméstico y comercial", abrev: "COMP-DOM" }
    ],
    sem5: [
      { name: "Asiste instalaciones de equipo de automatización y control para uso residencial y comercial", abrev: "ASIST-AUTO" },
      { name: "Opera equipo domótico en instalaciones residenciales y comerciales, bajo supervisión", abrev: "OP-DOM" }
    ]
  },
  "Instalaciones Residenciales": {
    sem3: [
      { name: "Interpreta croquis de diferentes instalaciones básicas de una vivienda", abrev: "INTERP-CROQ" },
      { name: "Prepara materiales en cantidad y calidad especificada para llevar a cabo diferentes tipos de mezclas bajo la supervisión del experto", abrev: "PREP-MEZC" }
    ],
    sem5: [
      { name: "Coloca elementos constructivos básicos de una vivienda", abrev: "ELEM-CONST" },
      { name: "Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda", abrev: "LIMP-TUB" }
    ]
  },
  "Mecanica Dental": {
    sem3: [
      { name: "Prepara modelos, moldes, porta impresiones, bloques o rodillos para realizar impresiones dentales parciales o totales", abrev: "PREP-MOLD" },
      { name: "Registra órdenes de trabajo siguiendo especificaciones y prescripciones para dispositivos y aparatos dentales", abrev: "REG-ORD" }
    ],
    sem5: [
      { name: "Modela alambres de diversos calibres para casos de aparatología ortodóntica", abrev: "MOD-ALAMB" },
      { name: "Realiza perfilado para prótesis dentales fijas y removibles", abrev: "PERF-PROT" }
    ]
  },
  "Preparacion de Alimentos Artesanales": {
    sem3: [
      { name: "Conserva frutas, verduras y legumbres a través de métodos tradicionales", abrev: "CONS-FRUT" },
      { name: "Transforma cereales y harinas para la elaboración de tortillas y productos afines", abrev: "TRANS-CER" }
    ],
    sem5: [
      { name: "Obtiene bebidas no alcohólicas mediante procedimientos simples", abrev: "OBT-BEB" },
      { name: "Prepara productos de carnes, derivados disponibles y sustitutos de proteína", abrev: "PREP-CARN" }
    ]
  },
  "Procesos Culinarios y Reposteria": {
    sem3: [
      { name: "Elabora productos de panificación siguiendo procesos establecidos", abrev: "PROD-PAN" },
      { name: "Emplea productos, utensilios y conceptos culinarios durante el proceso de transformación de alimentos", abrev: "TRANS-ALIM" }
    ],
    sem5: [
      { name: "Determina costos de producción en la elaboración de platillos", abrev: "COST-PLAT" },
      { name: "Prepara postres y productos de repostería básica", abrev: "PREP-POST" }
    ]
  },
  "Redes y Mantenimiento": {
    sem3: [
      { name: "Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante", abrev: "ACT-EQUIP" },
      { name: "Usa técnicas y estrategias de mantenimiento del equipo de cómputo", abrev: "MANT-COMP" }
    ],
    sem5: [
      { name: "Administra redes de acuerdo con las condiciones y requerimientos de una organización", abrev: "ADM-REDES" },
      { name: "Brinda soporte en software de aplicación y hardware según los requerimientos del usuario", abrev: "SOP-SOFT" }
    ]
  },
  "Servicios Ecosistemicos": {
    sem3: [
      { name: "Aplica técnicas de muestreo indicadas por el especialista", abrev: "TECN-MUEST" },
      { name: "Recopila muestras para las pruebas de niveles de contaminantes con guía del especialista", abrev: "RECOP-MUEST" }
    ],
    sem5: [
      { name: "Aplica técnicas para la siembra de diversas semillas forestales bajo supervisión", abrev: "SIEMB-FOR" },
      { name: "Realiza pruebas de suelos y fertilizantes para el mantenimiento del ecosistema forestal", abrev: "PRUEB-SUEL" }
    ]
  },
  "Sistemas Electricos": {
    sem3: [
      { name: "Elabora empalmes acordes con las características de los hilos", abrev: "ELAB-EMP" },
      { name: "Limpia áreas de trabajo, equipo, materiales y herramientas utilizadas durante la actividad", abrev: "LIMP-HERR" }
    ],
    sem5: [
      { name: "Ensambla componentes sobre tableros en perfocel para circuitos eléctricos básicos", abrev: "ENS-PERF" },
      { name: "Reconoce planos de sistemas eléctricos en servicios domésticos y comerciales", abrev: "PLAN-ELEC" }
    ]
  },
  "Tecnologia Informatica": {
    sem3: [
      { name: "Elabora documentos electrónicos en diferentes procesadores de texto, relacionados con la ofimática", abrev: "DOC-OFIM" },
      { name: "Utiliza aplicaciones ofimáticas en distintos sistemas operativos", abrev: "APL-OFIM" }
    ],
    sem5: [
      { name: "Elabora presentaciones electrónicas en diferentes aplicaciones relacionadas con la ofimática", abrev: "PRES-OFIM" },
      { name: "Opera dispositivos electrónicos multifuncionales en procesos administrativos", abrev: "OP-MULTIF" }
    ]
  },
  "Turismo": {
    sem3: [
      { name: "Explica procesos de expedición de documentos oficiales en las instituciones gubernamentales correspondientes para transitar o viajar", abrev: "DOC-TUR" },
      { name: "Muestra variedad de servicios que componen el catálogo de la planta turística", abrev: "SERV-TUR" }
    ],
    sem5: [
      { name: "Asiste usuarios en la selección, adquisición y utilización eficiente de servicios turísticos requeridos", abrev: "ASIST-TUR" },
      { name: "Promociona sitios alternativos de lugares a visitar según necesidades del turista", abrev: "PROM-TUR" }
    ]
  }
};

export default function WizardConfiguracion({
  escuelaId,
  configInicial,
  gruposIniciales,
  aulasIniciales,
  docentesIniciales,
  cargasIniciales,
  onGenerarClick
}: Props) {
  const STORAGE_KEY = `horarios_wizard_v2_${escuelaId}`;

  const [paso, setPaso] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Jornada Escolar predeterminada estrictamente a 6 Horas Diarias (30 hrs semanales)
  const [numPeriodos, setNumPeriodos] = useState<number>(6);
  const [horaInicio, setHoraInicio] = useState<string>("08:00");
  
  // Número abierto de grupos por grado (1, 2, 3, 4, 5, 10...)
  const [numGruposPorGrado, setNumGruposPorGrado] = useState<number>(
    gruposIniciales.length > 0 ? Math.max(1, Math.ceil(gruposIniciales.length / 3)) : 1
  );

  // Estado de Grupos
  const [grupos, setGrupos] = useState<any[]>([]);

  // Docentes activos en la plantilla del horario
  const [docentes, setDocentes] = useState<any[]>(docentesIniciales || []);
  const [horasDocentes, setHorasDocentes] = useState<Record<string, number>>({});

  // Cargas Docente-Materia-Grupo (Paso 3)
  const [cargas, setCargas] = useState<any[]>(cargasIniciales || []);

  // Modal para agregar nuevo docente
  const [mostrarModalDocente, setMostrarModalDocente] = useState<boolean>(false);
  const [tabModalDocente, setTabModalDocente] = useState<"PLATAFORMA" | "MANUAL">("PLATAFORMA");
  const [personalPlataforma, setPersonalPlataforma] = useState<any[]>([]);
  const [busquedaPersonal, setBusquedaPersonal] = useState<string>("");

  const [nuevoDocenteNombre, setNuevoDocenteNombre] = useState<string>("");
  const [nuevoDocentePaterno, setNuevoDocentePaterno] = useState<string>("");
  const [nuevoDocenteMaterno, setNuevoDocenteMaterno] = useState<string>("");
  const [nuevoDocenteHoras, setNuevoDocenteHoras] = useState<number>(20);

  // Recargar guardado previo desde localStorage si existe
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (parsed.paso) setPaso(parsed.paso);
        if (parsed.numGruposPorGrado) setNumGruposPorGrado(parsed.numGruposPorGrado);
        if (parsed.numPeriodos) setNumPeriodos(parsed.numPeriodos);
        if (parsed.grupos && parsed.grupos.length > 0) setGrupos(parsed.grupos);
        if (parsed.horasDocentes) setHorasDocentes(parsed.horasDocentes);
        if (parsed.cargas && parsed.cargas.length > 0) setCargas(parsed.cargas);
      }
    } catch (e) {
      console.warn("No se pudo cargar estado local previo", e);
    }
  }, [escuelaId]);

  // Guardar estado en localStorage en cada cambio para persistencia total al recargar la página
  const guardarProgresoLocal = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          paso,
          numGruposPorGrado,
          numPeriodos,
          grupos,
          horasDocentes,
          cargas
        })
      );
    } catch (e) {
      console.warn("Error al guardar en localStorage", e);
    }
  };

  useEffect(() => {
    guardarProgresoLocal();
  }, [paso, numGruposPorGrado, numPeriodos, grupos, horasDocentes, cargas]);

  useEffect(() => {
    cargarPersonalCompleto();
  }, [escuelaId]);

  useEffect(() => {
    if (docentesIniciales && docentesIniciales.length > 0 && docentes.length === 0) {
      setDocentes(docentesIniciales);
    }
  }, [docentesIniciales]);

  // Generar grupos según la cantidad de grupos por grado
  useEffect(() => {
    generarGruposSegunEstructura(numGruposPorGrado);
  }, [numGruposPorGrado]);

  // Inicializar mapa de horas por docente (0 hrs por defecto para Administrativos/Apoyo/Responsable, 20 hrs para Docentes)
  useEffect(() => {
    if (docentes.length > 0) {
      const mapaHoras: Record<string, number> = { ...horasDocentes };
      docentes.forEach((d) => {
        if (mapaHoras[d.id] === undefined) {
          const esDocentePuro = d.cargo === "DOCENTE";
          mapaHoras[d.id] = d.horasAsignadas !== undefined ? d.horasAsignadas : (esDocentePuro ? 20 : 0);
        }
      });
      setHorasDocentes(mapaHoras);
    }
  }, [docentes]);

  const cargarPersonalCompleto = async () => {
    try {
      const res = await fetch(`/api/expedientes/personal?escuelaId=${escuelaId}`);
      const data = await res.json();
      if (data.personal) {
        setPersonalPlataforma(data.personal);
      }
    } catch (e) {
      console.error("Error al cargar personal de la escuela:", e);
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
          ffeoSocioemocional: grupoExistente?.ffeoSocioemocional || (sem === 3 ? CURRICULUM_AMPLIADO_FFEO[0] : CURRICULUM_AMPLIADO_FFEO[1]),
          ffeOptativas: grupoExistente?.ffeOptativas || [
            FFE_RECURSO_SOCIOCOGNITIVO[0],
            FFE_RECURSO_SOCIOCOGNITIVO[1],
            FFE_AREA_CONOCIMIENTO[0],
            FFE_AREA_CONOCIMIENTO[1]
          ]
        });
      }
    }
    setGrupos(nuevosGrupos);
  };

  const handleActualizarConfigGrupo = (index: number, field: string, value: any) => {
    const copia = [...grupos];
    copia[index][field] = value;

    // Regla Anti-Duplicados de FFEO: Si se cambia 3er semestre, asegurar que 5to semestre no repita el mismo
    if (field === "ffeoSocioemocional" && copia[index].semestre === 3) {
      const letraGrupo = copia[index].nombre.split(" ")[1];
      const grupo5 = copia.find((g) => g.semestre === 5 && g.nombre.endsWith(letraGrupo));
      if (grupo5 && grupo5.ffeoSocioemocional === value) {
        const disponible = CURRICULUM_AMPLIADO_FFEO.find((item) => item !== value);
        if (disponible) grupo5.ffeoSocioemocional = disponible;
      }
    }

    setGrupos(copia);
  };

  const handleActualizarOptativaGrupo = (grupoIdx: number, optativaIdx: number, value: string) => {
    const copia = [...grupos];
    const optativas = [...(copia[grupoIdx].ffeOptativas || [])];
    optativas[optativaIdx] = value;
    copia[grupoIdx].ffeOptativas = optativas;
    setGrupos(copia);
  };

  const handleEliminarDocentePlantilla = (docenteId: string) => {
    setDocentes(docentes.filter((d) => d.id !== docenteId));
    const copiaHoras = { ...horasDocentes };
    delete copiaHoras[docenteId];
    setHorasDocentes(copiaHoras);
    setCargas(cargas.filter((c) => c.personalId !== docenteId));
    toast.success("Docente removido de la plantilla activa.");
  };

  const handleAgregarPersonalExistente = (persona: any) => {
    if (docentes.some((d) => d.id === persona.id)) {
      toast.error("El personal ya está en la plantilla.");
      return;
    }
    setDocentes([...docentes, persona]);
    const esDocentePuro = persona.cargo === "DOCENTE";
    setHorasDocentes({ ...horasDocentes, [persona.id]: esDocentePuro ? 20 : 0 });
    toast.success(`${persona.nombre} ${persona.apellidoPaterno} agregado.`);
    setMostrarModalDocente(false);
  };

  const handleCrearNuevoDocenteManual = async () => {
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
        toast.success(`Docente ${data.docente.nombre} ${data.docente.apellidoPaterno} registrado y agregado.`);
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

  const handleAsignarDocenteMatriz = (grupoId: string, uacObj: any, personalId: string) => {
    const asignaturaId = uacObj.id;
    const uacName = uacObj.uacName;
    const horasSemanales = uacObj.horasSemanales || 3;

    if (!personalId) {
      setCargas(cargas.filter((c) => !(c.grupoId === grupoId && (c.asignaturaId === asignaturaId || c.uacName === uacName))));
      return;
    }

    const idx = cargas.findIndex((c) => c.grupoId === grupoId && (c.asignaturaId === asignaturaId || c.uacName === uacName));
    if (idx >= 0) {
      const copia = [...cargas];
      copia[idx].personalId = personalId;
      copia[idx].uacName = uacName;
      copia[idx].horasSemanales = horasSemanales;
      setCargas(copia);
    } else {
      setCargas([
        ...cargas,
        {
          grupoId,
          asignaturaId,
          uacName,
          personalId,
          horasSemanales,
          requiereAulaEspecial: false
        }
      ]);
    }
  };

  const getDocenteAsignado = (grupoId: string, uacObj: any) => {
    const asignacion = cargas.find((c) => c.grupoId === grupoId && (c.asignaturaId === uacObj.id || c.uacName === uacObj.uacName));
    return asignacion?.personalId || "";
  };

  const getHorasConsumidasDocente = (docenteId: string) => {
    return cargas
      .filter((c) => c.personalId === docenteId)
      .reduce((sum, c) => sum + (c.horasSemanales || 3), 0);
  };

  // Guardar configuración completa en base de datos
  const handleGuardarConfiguracion = async () => {
    setLoading(true);

    // Auto-completar asignaciones por defecto si alguna UAC no tiene docente asignado para garantizar 100% de la carga
    const docentePredeterminadoId = docentes.find((d) => (horasDocentes[d.id] || 0) > 0)?.id || docentes[0]?.id || "";
    const cargasCompletas = [...cargas];

    grupos.forEach((g) => {
      const uacs = getUACsIndividualesGrupo(g);
      uacs.forEach((uac) => {
        const existe = cargasCompletas.some((c) => c.grupoId === g.id && (c.asignaturaId === uac.id || c.uacName === uac.uacName));
        if (!existe && docentePredeterminadoId) {
          cargasCompletas.push({
            grupoId: g.id,
            asignaturaId: uac.id,
            uacName: uac.uacName,
            personalId: docentePredeterminadoId,
            horasSemanales: uac.horasSemanales || 3,
            requiereAulaEspecial: false
          });
        }
      });
    });

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
          cargas: cargasCompletas
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
      toast.error("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  };

  // Métricas de Horas del Plantel
  const totalGrupos = grupos.length;
  const horasRequeridasPlantel = totalGrupos * 30; // 30 hrs por grupo
  const totalHorasPlantillaDocente = Object.values(horasDocentes).reduce((sum, h) => sum + Number(h || 0), 0);

  // Obtener UACs individuales para cada grupo con Abreviaturas destacadas
  const getUACsIndividualesGrupo = (grupo: any) => {
    const sem = grupo.semestre;

    if (sem === 1) {
      return [
        { id: `uac_1_1`, uacName: "La Materia y sus Interacciones", abrev: "MAT-INT", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_2`, uacName: "Pensamiento Matemático I", abrev: "PENS-MAT-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_3`, uacName: "Humanidades I", abrev: "HUM-I", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_1_4`, uacName: "Lenguaje y Comunicación I", abrev: "LENG-COM-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_5`, uacName: "Inglés I", abrev: "ING-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_6`, uacName: "Cultura Digital I", abrev: "CULT-DIG-I", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_7`, uacName: "Laboratorio de Investigación", abrev: "LAB-INV", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_1_8`, uacName: "Ciencias Sociales I", abrev: "CS-SOC-I", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_1_9`, uacName: "Actividades Artísticas y Culturales I", abrev: "ART-CULT-I", tipo: "UNIVERSAL", horasSemanales: 2 },
        { id: `uac_1_10`, uacName: "Actividades Físicas y Deportivas I", abrev: "ACT-FIS-I", tipo: "UNIVERSAL", horasSemanales: 2 }
      ];
    }

    if (sem === 3) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem3 || [
        { name: `Asignatura 1 de ${capNombre}`, abrev: "LAB-1" },
        { name: `Asignatura 2 de ${capNombre}`, abrev: "LAB-2" }
      ];

      return [
        { id: `uac_3_1`, uacName: "Ecosistemas: Interacciones, Energía y Dinámica", abrev: "ECOSIST", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_3_2`, uacName: "Pensamiento Matemático III", abrev: "PENS-MAT-III", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_3_3`, uacName: "Humanidades III", abrev: "HUM-III", tipo: "UNIVERSAL", horasSemanales: 5 },
        { id: `uac_3_4`, uacName: "Taller de Ciencias II", abrev: "TALL-CIEN-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_5`, uacName: grupo.ffeoSocioemocional || "Educación para la Salud III (2025)", abrev: "CURR-AMP-3", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_3_6`, uacName: "Lengua y Comunicación III", abrev: "LENG-COM-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_7`, uacName: "Inglés III", abrev: "ING-III", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_3_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_3_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    if (sem === 5) {
      const capNombre = grupo.capacitacionNombre || FORMACIONES_LABORALES[0];
      const uacsLabInfo = UACS_LABORALES_MAPA[capNombre]?.sem5 || [
        { name: `Asignatura 1 de ${capNombre}`, abrev: "LAB-1" },
        { name: `Asignatura 2 de ${capNombre}`, abrev: "LAB-2" }
      ];
      const opts = grupo.ffeOptativas || [
        FFE_RECURSO_SOCIOCOGNITIVO[0],
        FFE_RECURSO_SOCIOCOGNITIVO[1],
        FFE_AREA_CONOCIMIENTO[0],
        FFE_AREA_CONOCIMIENTO[1]
      ];

      return [
        { id: `uac_5_1`, uacName: "La Energía en los Procesos de la Vida Diaria", abrev: "ENERG-VIDA", tipo: "UNIVERSAL", horasSemanales: 4 },
        { id: `uac_5_2`, uacName: "Conciencia Histórica II. México Durante el Expansionismo Capitalista", abrev: "CONC-HIST-II", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_5_3`, uacName: "Taller de Habilidades del Pensamiento", abrev: "TALL-HAB-PENS", tipo: "UNIVERSAL", horasSemanales: 3 },
        { id: `uac_5_ffe_1`, uacName: opts[0], abrev: "FFE-REC-A", tipo: "FFE_REC_A", horasSemanales: 3 },
        { id: `uac_5_ffe_2`, uacName: opts[1], abrev: "FFE-REC-B", tipo: "FFE_REC_B", horasSemanales: 3 },
        { id: `uac_5_ffe_3`, uacName: opts[2], abrev: "FFE-AREA-A", tipo: "FFE_AREA_A", horasSemanales: 3 },
        { id: `uac_5_ffe_4`, uacName: opts[3], abrev: "FFE-AREA-B", tipo: "FFE_AREA_B", horasSemanales: 3 },
        { id: `uac_5_5`, uacName: grupo.ffeoSocioemocional || "Práctica y Colaboración Ciudadana III (2025)", abrev: "CURR-AMP-5", tipo: "AMPLIADO", horasSemanales: 2 },
        { id: `uac_5_lab_a`, uacName: uacsLabInfo[0].name, abrev: uacsLabInfo[0].abrev, capNombre, tipo: "LABORAL_A", horasSemanales: 3 },
        { id: `uac_5_lab_b`, uacName: uacsLabInfo[1].name, abrev: uacsLabInfo[1].abrev, capNombre, tipo: "LABORAL_B", horasSemanales: 3 }
      ];
    }

    return [];
  };

  const personalDisponibleModal = personalPlataforma.filter((p) => {
    return busquedaPersonal === "" || `${p.nombre} ${p.apellidoPaterno} ${p.cargo}`.toLowerCase().includes(busquedaPersonal.toLowerCase());
  });

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", maxWidth: "1250px", margin: "0 auto" }}>
      {/* Encabezado del Wizard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <Sparkles style={{ width: "22px", height: "22px", color: "#2563eb" }} /> Asistente de Configuración de Horario (SEP Puebla)
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem", margin: 0 }}>
            Defina la estructura libre de grupos, cargas laborales/optativas y asigne docentes por grupo
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
                Escriba el número de grupos por grado (1, 2, 3, 4, 5, 10...). Se autogenera la letra oficial.
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
                <option value={5}>5 Horas diarias (25 hrs semanales)</option>
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
              {grupos.map((g, idx) => {
                const letraGrupo = g.nombre.split(" ")[1];
                const grupo3Correspondiente = grupos.find((g3) => g3.semestre === 3 && g3.nombre.endsWith(letraGrupo));
                const ffeoSocio3erSem = grupo3Correspondiente?.ffeoSocioemocional || "";

                return (
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

                    {/* Currículum Ampliado / Formación Socioemocional (FFEO) para 3° y 5° semestre */}
                    {g.semestre >= 3 && (
                      <div style={{ marginBottom: "0.75rem" }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#334155", marginBottom: "0.25rem" }}>
                          Currículum Ampliado / Formación Socioemocional (FFEO)
                        </label>
                        <select
                          value={g.ffeoSocioemocional || (g.semestre === 3 ? CURRICULUM_AMPLIADO_FFEO[0] : CURRICULUM_AMPLIADO_FFEO[1])}
                          onChange={(e) => handleActualizarConfigGrupo(idx, "ffeoSocioemocional", e.target.value)}
                          style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "6px", border: "1px solid #94a3b8", fontSize: "0.75rem", fontWeight: 700, color: "#0f172a" }}
                        >
                          {CURRICULUM_AMPLIADO_FFEO.map((ffeo) => {
                            const esRepetida5to = g.semestre === 5 && ffeo === ffeoSocio3erSem;
                            return (
                              <option key={ffeo} value={ffeo} disabled={esRepetida5to}>
                                {ffeo} {esRepetida5to ? "[Elegida en 3° Semestre]" : ""}
                              </option>
                            );
                          })}
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
                );
              })}
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
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <UserCheck style={{ width: "18px", height: "18px", color: "#2563eb" }} /> Carga Horaria de la Plantilla Docente Frente a Grupo
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem", margin: 0 }}>
                Administrativos, Apoyo y Responsables inician con 0 hrs. Asigne únicamente las horas frente a grupo reales.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
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
                <UserPlus style={{ width: "16px", height: "16px" }} /> + Agregar Docente / Personal a Plantilla
              </button>
            </div>
          </div>

          {docentes.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: "12px" }}>
              <AlertCircle style={{ width: "32px", height: "32px", color: "#94a3b8", margin: "0 auto 0.5rem" }} />
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>No se encontraron docentes activos en la plantilla del horario.</p>
              <button
                onClick={() => setMostrarModalDocente(true)}
                style={{ marginTop: "0.75rem", background: "#2563eb", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.8125rem", border: "none", cursor: "pointer" }}
              >
                + Agregar Personal a la Plantilla
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "0.85rem" }}>
              {docentes.map((d) => (
                <div key={d.id} style={{ padding: "0.85rem", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ flex: 1, paddingRight: "0.5rem" }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                      {d.apellidoPaterno} {d.apellidoMaterno || ""} {d.nombre}
                    </p>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: d.cargo === "DOCENTE" ? "#2563eb" : "#d97706", background: "#f8fafc", padding: "0.1rem 0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
                      {d.cargo || "DOCENTE"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0)}
                        onChange={(e) => setHorasDocentes({ ...horasDocentes, [d.id]: Math.max(0, Number(e.target.value)) })}
                        style={{ width: "60px", padding: "0.35rem", borderRadius: "6px", border: "2px solid #3b82f6", fontWeight: 800, textAlign: "center", fontSize: "0.875rem", color: "#1e293b" }}
                      />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>hrs</span>
                    </div>

                    <button
                      type="button"
                      title="Remover docente de la plantilla activa"
                      onClick={() => handleEliminarDocentePlantilla(d.id)}
                      style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5", padding: "0.4rem", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      <Trash2 style={{ width: "16px", height: "16px" }} />
                    </button>
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
         PASO 3: Matriz Tabular Específica por Grupo (Basada en Ejemplo tabla por grupo.docx)
         ========================================================================= */}
      {paso === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BookOpen style={{ width: "20px", height: "20px", color: "#2563eb" }} /> Matriz de Asignación Docente por Grupo (UACs Específicas)
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
              Tablas organizadas por grupo individual con nombres destacados y abreviaturas para el horario generado.
            </p>
          </div>

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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
                  {gruposSemestre.map((g) => {
                    const uacsEspecificas = getUACsIndividualesGrupo(g);

                    return (
                      <div key={g.id} style={{ border: "1px solid #cbd5e1", borderRadius: "10px", overflow: "hidden", background: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <div style={{ background: "#eff6ff", padding: "0.75rem 1rem", borderBottom: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.9375rem", fontWeight: 900, color: "#1d4ed8" }}>
                            Grupo {g.nombre}
                          </span>
                          {g.capacitacionNombre && (
                            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#2563eb", background: "#ffffff", padding: "0.2rem 0.6rem", borderRadius: "6px", border: "1px solid #bfdbfe" }}>
                              {g.capacitacionNombre}
                            </span>
                          )}
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78125rem" }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                              <th style={{ padding: "0.5rem 0.625rem", textAlign: "left", fontWeight: 800, color: "#334155", width: "55%" }}>Materia (UAC)</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#2563eb", width: "15%" }}>Horas</th>
                              <th style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#1e293b", width: "30%" }}>Docente Asignado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uacsEspecificas.map((uac, uacIdx) => {
                              const docenteActualId = getDocenteAsignado(g.id, uac);

                              return (
                                <tr key={uac.id || uacIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                  <td style={{ padding: "0.5rem 0.625rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.35 }}>
                                    {uac.tipo?.startsWith("LABORAL") ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#64748b", display: "block" }}>
                                          Formación Laboral {uac.tipo === "LABORAL_A" ? '"A"' : '"B"'} ({uac.capNombre})
                                        </span>
                                        <span style={{ color: "#d97706", fontWeight: 900, fontSize: "0.8125rem" }}>
                                          {uac.uacName}
                                        </span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#2563eb", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    ) : uac.tipo === "AMPLIADO" ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#0284c7", display: "block" }}>
                                          Currículum Ampliado (FFEO)
                                        </span>
                                        <span style={{ color: "#0369a1", fontWeight: 800 }}>
                                          {uac.uacName}
                                        </span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    ) : uac.tipo?.startsWith("FFE_") ? (
                                      <div>
                                        <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#7c3aed", display: "block" }}>
                                          Formación Fundamental Extendida (Optativa FFE)
                                        </span>
                                        <span style={{ color: "#6d28d9", fontWeight: 800 }}>
                                          {uac.uacName}
                                        </span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <span>{uac.uacName}</span>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", marginLeft: "0.35rem" }}>
                                          ({uac.abrev})
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: 800, color: "#2563eb" }}>
                                    {uac.horasSemanales || 3}h
                                  </td>
                                  <td style={{ padding: "0.35rem" }}>
                                    <select
                                      value={docenteActualId}
                                      onChange={(e) => handleAsignarDocenteMatriz(g.id, uac, e.target.value)}
                                      style={{
                                        width: "100%",
                                        padding: "0.4rem 0.5rem",
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
                                        const hrsMax = horasDocentes[d.id] !== undefined ? horasDocentes[d.id] : (d.cargo === "DOCENTE" ? 20 : 0);
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

      {/* MODAL ENHANCED: SELECCIONAR PERSONAL DE LA PLATAFORMA O REGISTRAR MANUALMENTE */}
      {mostrarModalDocente && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "1.5rem", maxWidth: "520px", width: "100%", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                Agregar Personal a la Plantilla Horaria
              </h3>
              <button
                onClick={() => setMostrarModalDocente(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "1.25rem" }}>
              <button
                onClick={() => setTabModalDocente("PLATAFORMA")}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "PLATAFORMA" ? "3px solid #2563eb" : "none",
                  color: tabModalDocente === "PLATAFORMA" ? "#2563eb" : "#64748b",
                  cursor: "pointer"
                }}
              >
                1. Personal de la Escuela ({personalPlataforma.length})
              </button>
              <button
                onClick={() => setTabModalDocente("MANUAL")}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                  border: "none",
                  background: "none",
                  borderBottom: tabModalDocente === "MANUAL" ? "3px solid #2563eb" : "none",
                  color: tabModalDocente === "MANUAL" ? "#2563eb" : "#64748b",
                  cursor: "pointer"
                }}
              >
                2. Registrar Nuevo Docente Manual
              </button>
            </div>

            {tabModalDocente === "PLATAFORMA" ? (
              <div>
                <div style={{ position: "relative", marginBottom: "0.85rem" }}>
                  <Search style={{ width: "16px", height: "16px", position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o cargo (Docente, Administrativo...)..."
                    value={busquedaPersonal}
                    onChange={(e) => setBusquedaPersonal(e.target.value)}
                    style={{ width: "100%", padding: "0.45rem 0.6rem 0.45rem 2.2rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div style={{ maxHeight: "240px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", paddingRight: "0.25rem" }}>
                  {personalDisponibleModal.length === 0 ? (
                    <p style={{ fontSize: "0.8125rem", color: "#64748b", textAlign: "center", padding: "1rem" }}>
                      No se encontró personal coincidente en los expedientes de la escuela.
                    </p>
                  ) : (
                    personalDisponibleModal.map((p) => {
                      const yaEstaAgregado = docentes.some((d) => d.id === p.id);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "8px", background: yaEstaAgregado ? "#f8fafc" : "#ffffff" }}>
                          <div>
                            <p style={{ fontSize: "0.8125rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                              {p.apellidoPaterno} {p.apellidoMaterno || ""} {p.nombre}
                            </p>
                            <span style={{ fontSize: "0.6875rem", color: p.cargo === "DOCENTE" ? "#2563eb" : "#d97706", fontWeight: 700 }}>
                              {p.cargo || "DOCENTE"}
                            </span>
                          </div>

                          {yaEstaAgregado ? (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "0.2rem 0.5rem", borderRadius: "6px" }}>
                              ✓ En Plantilla
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAgregarPersonalExistente(p)}
                              style={{ background: "#2563eb", color: "#ffffff", padding: "0.35rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, border: "none", cursor: "pointer" }}
                            >
                              + Agregar
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
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
                    min={0}
                    max={30}
                    value={nuevoDocenteHoras}
                    onChange={(e) => setNuevoDocenteHoras(Number(e.target.value))}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "2px solid #2563eb", fontSize: "0.875rem", fontWeight: 800 }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setMostrarModalDocente(false)}
                    style={{ background: "#f1f5f9", color: "#1e293b", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCrearNuevoDocenteManual}
                    style={{ background: "#2563eb", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}
                  >
                    Guardar Docente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
