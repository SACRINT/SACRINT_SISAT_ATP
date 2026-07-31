/**
 * Utilidades para la estructura de grupos por año/grado y asignaturas oficiales del MCCEMS 2025-2026
 */

export interface EscuelaEstructuraGrupos {
  gruposPrimerAno: number;   // 1er Año (1º o 2º Semestre)
  gruposSegundoAno: number;  // 2º Año (3º o 4º Semestre)
  gruposTercerAno: number;   // 3er Año (5º o 6º Semestre)
}

export interface GrupoDefinicion {
  id: string;
  nombre: string;         // Ej: "1° A", "3° A", "5° A"
  semestre: number;       // 1, 2, 3, 4, 5, 6
  gradoAno: number;       // 1, 2, 3
  letra: string;          // "A", "B", "C"...
}

const LETRAS_GRUPO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/**
 * 15 Capacitaciones Laborales Oficiales BGE Puebla (MCCEMS 2025-2026)
 */
export const FORMACIONES_LABORALES = [
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

/**
 * Mapeo oficial de Nombres de Submódulos por Capacitación Laboral
 */
export const UACS_LABORALES_MAPA: Record<string, { sem3: { name: string; abrev: string }[]; sem5: { name: string; abrev: string }[] }> = {
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
      { name: "Utiliza herramientas de programación estructurada para solución de problemas simples", abrev: "PROG-ESTR" },
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

/**
 * Optativas FFE Categorizadas por Cuadros (MCCEMS 2025-2026 Puebla)
 */
export const FFE_RECURSOS_SOCIOCOGNITIVOS = [
  "Comunicación y Sociedad I",
  "Raíces Etimológicas del Español I",
  "Inglés V (Avanzado)",
  "Taller de Pensamiento Variacional I",
  "Dibujo Técnico I",
  "Pensamiento Matemático Aplicado a las Finanzas I",
  "Taller de Probabilidad y Estadística I"
];

export const FFE_AREAS_CONOCIMIENTO = [
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

/**
 * Catálogo Oficial Completo de Optativas FFE MCCEMS 2025-2026
 */
export const FFE_OPTATIVAS_CATALOGO = [
  ...FFE_RECURSOS_SOCIOCOGNITIVOS,
  ...FFE_AREAS_CONOCIMIENTO
];

/**
 * Genera la lista de grupos oficiales de una escuela basándose en su estructura (ej: 2-1-1)
 */
export function generarGruposPorEstructura(
  escuela: { gruposPrimerAno?: number; gruposSegundoAno?: number; gruposTercerAno?: number },
  periodoSemestral: "SEMESTRE_A" | "SEMESTRE_B" = "SEMESTRE_A"
): GrupoDefinicion[] {
  const g1 = Math.max(1, escuela.gruposPrimerAno ?? 1);
  const g2 = Math.max(1, escuela.gruposSegundoAno ?? 1);
  const g3 = Math.max(1, escuela.gruposTercerAno ?? 1);

  const grupos: GrupoDefinicion[] = [];
  const semestres = periodoSemestral === "SEMESTRE_A" ? [1, 3, 5] : [2, 4, 6];

  for (let i = 0; i < g1; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[0]}-${letra}`, nombre: `${semestres[0]}° ${letra}`, semestre: semestres[0], gradoAno: 1, letra });
  }

  for (let i = 0; i < g2; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[1]}-${letra}`, nombre: `${semestres[1]}° ${letra}`, semestre: semestres[1], gradoAno: 2, letra });
  }

  for (let i = 0; i < g3; i++) {
    const letra = LETRAS_GRUPO[i] || `${i + 1}`;
    grupos.push({ id: `g-${semestres[2]}-${letra}`, nombre: `${semestres[2]}° ${letra}`, semestre: semestres[2], gradoAno: 3, letra });
  }

  return grupos;
}

/**
 * Catálogo Oficial Nombres Exactos de Formación Socioemocional (Currículum Ampliado / FFEO)
 * Nombres oficiales según MCCEMS BGE Puebla:
 * 1. Educación para la Salud
 * 2. Educación Integral en Sexualidad y Género
 * 3. Práctica y Colaboración Ciudadana
 */
export const FORMACIONES_SOCIOEMOCIONALES = [
  "Educación para la Salud",
  "Educación Integral en Sexualidad y Género",
  "Práctica y Colaboración Ciudadana"
];

/**
 * Resuelve las Asignaturas/UACs oficiales exactas para un Grupo según su Semestre y Capacitaciones
 */
export function obtenerAsignaturasParaGrupo(
  semestre: number,
  capacitacionNombre: string = "Administracion",
  ffeOptativasArr: string[] = [],
  ffeoSocioemocional?: string
): { nombre: string; tipo: "FUNDAMENTAL" | "LABORAL" | "EXTENDIDO" | "SOCIOEMOCIONAL"; horas: number }[] {

  if (semestre === 1) {
    return [
      { nombre: "La Materia y sus Interacciones", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades I", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lenguaje y Comunicación I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Cultura Digital I", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Laboratorio de Investigación", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales I", tipo: "FUNDAMENTAL", horas: 2 },
      { nombre: "Actividades Artísticas y Culturales I", tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: "Actividades Físicas y Deportivas I", tipo: "SOCIOEMOCIONAL", horas: 2 },
    ];
  }

  if (semestre === 2) {
    return [
      { nombre: "Conservación de la Materia y sus Interacciones con la Energía", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades II", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lenguaje y Comunicación II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Cultura Digital II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales II", tipo: "FUNDAMENTAL", horas: 2 },
      { nombre: "Actividades Artísticas y Culturales II", tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: "Actividades Físicas y Deportivas II", tipo: "SOCIOEMOCIONAL", horas: 2 },
    ];
  }

  if (semestre === 3) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem3 || UACS_LABORALES_MAPA["Administracion"].sem3;
    const socioNombre = ffeoSocioemocional || "Educación para la Salud III (2025)";

    return [
      { nombre: "Ecosistemas: Interacciones, Energía y Dinámica", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático III", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Humanidades III", tipo: "FUNDAMENTAL", horas: 5 },
      { nombre: "Taller de Ciencias II", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Lengua y Comunicación III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: `Socioemocional: ${socioNombre}`, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: `Formación Laboral (${capacitacionNombre}): ${labInfo[0].name}`, tipo: "LABORAL", horas: 3 },
      { nombre: `Formación Laboral (${capacitacionNombre}): ${labInfo[1].name}`, tipo: "LABORAL", horas: 3 },
    ];
  }

  if (semestre === 4) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem3 || UACS_LABORALES_MAPA["Administracion"].sem3;
    const socioNombre = ffeoSocioemocional || "Educación para la Salud IV";

    return [
      { nombre: "Reacciones Químicas y Procesos Biológicos", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Pensamiento Matemático IV", tipo: "FUNDAMENTAL", horas: 4 },
      { nombre: "Lengua y Comunicación IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés IV", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Ciencias Sociales III", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: `Socioemocional: ${socioNombre}`, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: `Formación Laboral (${capacitacionNombre}): Submódulo 3`, tipo: "LABORAL", horas: 3 },
      { nombre: `Formación Laboral (${capacitacionNombre}): Submódulo 4`, tipo: "LABORAL", horas: 3 },
    ];
  }

  if (semestre === 5) {
    const labInfo = UACS_LABORALES_MAPA[capacitacionNombre]?.sem5 || UACS_LABORALES_MAPA["Administracion"].sem5;
    
    // 4 Optativas FFE predeterminadas si no vienen definidas
    const ffe1 = ffeOptativasArr[0] || "Análisis de Fenómenos y Procesos Biológicos";
    const ffe2 = ffeOptativasArr[1] || "Pensamiento Matemático Aplicado a las Finanzas I";
    const ffe3 = ffeOptativasArr[2] || "Fundamentos de Administración I";
    const ffe4 = ffeOptativasArr[3] || "Lógica y Pensamiento Crítico";
    const socioNombre = ffeoSocioemocional || "Educación Financiera y Emprendimiento Social";

    return [
      { nombre: "La Conciencia Histórica II (Historia de México)", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Lengua y Comunicación V", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Inglés V", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: "Pensamiento Filosófico I (Humanidades)", tipo: "FUNDAMENTAL", horas: 3 },
      { nombre: `Socioemocional: ${socioNombre}`, tipo: "SOCIOEMOCIONAL", horas: 2 },
      { nombre: `Formación Laboral (${capacitacionNombre}): ${labInfo[0].name}`, tipo: "LABORAL", horas: 3 },
      { nombre: `Formación Laboral (${capacitacionNombre}): ${labInfo[1].name}`, tipo: "LABORAL", horas: 3 },
      { nombre: `Optativa FFE 1: ${ffe1}`, tipo: "EXTENDIDO", horas: 3 },
      { nombre: `Optativa FFE 2: ${ffe2}`, tipo: "EXTENDIDO", horas: 3 },
      { nombre: `Optativa FFE 3: ${ffe3}`, tipo: "EXTENDIDO", horas: 3 },
      { nombre: `Optativa FFE 4: ${ffe4}`, tipo: "EXTENDIDO", horas: 3 },
    ];
  }

  // Semestre 6
  const ffe1 = ffeOptativasArr[0] || "Análisis de Fenómenos Físicos I";
  const ffe2 = ffeOptativasArr[1] || "Taller de Probabilidad y Estadística I";
  const ffe3 = ffeOptativasArr[2] || "Derecho y Sociedad I";
  const ffe4 = ffeOptativasArr[3] || "Psicología I";

  return [
    { nombre: "La Conciencia Histórica III (Historia Universal)", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Lengua y Comunicación VI", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Inglés VI", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Ética y Sociedad", tipo: "FUNDAMENTAL", horas: 3 },
    { nombre: "Formación Laboral Submódulo 3", tipo: "LABORAL", horas: 3 },
    { nombre: "Formación Laboral Submódulo 4", tipo: "LABORAL", horas: 3 },
    { nombre: `Optativa FFE 1: ${ffe1}`, tipo: "EXTENDIDO", horas: 3 },
    { nombre: `Optativa FFE 2: ${ffe2}`, tipo: "EXTENDIDO", horas: 3 },
    { nombre: `Optativa FFE 3: ${ffe3}`, tipo: "EXTENDIDO", horas: 3 },
    { nombre: `Optativa FFE 4: ${ffe4}`, tipo: "EXTENDIDO", horas: 4 },
  ];
}
