export const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const ESTADOS = ["PENDIENTE", "EN_REVISION", "REQUIERE_CORRECCION", "APROBADO", "NO_APROBADO", "NO_ENTREGADO"];

export const ESTADO_LABELS: Record<string, string> = {
    PENDIENTE: "Entregado",
    EN_REVISION: "En Revisión",
    REQUIERE_CORRECCION: "Req. Corrección",
    APROBADO: "Aprobado",
    NO_APROBADO: "No Aprobado",
    NO_ENTREGADO: "No Entregado",
};

export const ESTADO_COLORS: Record<string, string> = {
    PENDIENTE: "var(--warning)",
    EN_REVISION: "var(--primary)",
    REQUIERE_CORRECCION: "#e67e22",
    APROBADO: "var(--success)",
    NO_APROBADO: "var(--danger)",
    NO_ENTREGADO: "var(--text-muted)",
};

// ─── Expedientes de Personal ──────────────────────────

export const DOCUMENTOS_PREDETERMINADOS = [
    { tipo: "TITULO", label: "Título", multiple: true },
    { tipo: "CEDULA", label: "Cédula", multiple: true },
    { tipo: "ACTA_NACIMIENTO", label: "Acta de Nacimiento", multiple: false },
    { tipo: "CURP_DOC", label: "CURP", multiple: false },
    { tipo: "ORDEN_ADSCRIPCION", label: "Orden de Adscripción", multiple: true },
    { tipo: "MOVIMIENTO_PERSONAL", label: "Movimiento de Personal", multiple: true },
    { tipo: "COMPROBANTE_PAGO", label: "Comprobante de Pago", multiple: false },
    { tipo: "COMPROBANTE_FISCAL", label: "Comprobante Fiscal", multiple: false },
    { tipo: "INE", label: "INE", multiple: false },
    { tipo: "COMPROBANTE_DOMICILIO", label: "Comprobante de Domicilio", multiple: false },
] as const;

export const CARGOS_PERSONAL = [
    { value: "SUPERVISOR", label: "Supervisor de Zona" },
    { value: "ATP", label: "Apoyo Técnico Pedagógico (ATP)" },
    { value: "RESPONSABLE", label: "Responsable del Plantel" },
    { value: "DOCENTE", label: "Docente" },
    { value: "ADMINISTRATIVO", label: "Administrativo" },
    { value: "APOYO", label: "Personal de Apoyo" },
] as const;

export const GRADOS_ACADEMICOS = [
    { value: "BACHILLERATO", label: "Bachillerato" },
    { value: "LICENCIATURA", label: "Licenciatura" },
    { value: "MAESTRIA", label: "Maestría" },
    { value: "DOCTORADO", label: "Doctorado" },
    { value: "OTRO", label: "Otro" },
] as const;

export const SEXOS = [
    { value: "MASCULINO", label: "Masculino" },
    { value: "FEMENINO", label: "Femenino" },
] as const;

export const SECCIONES_PERMISOS = [
    // Monitoreo
    { key: "general", label: "Vista General" },
    { 
        key: "avances", 
        label: "Avance de Entregas",
        sub: [
            { key: "avances_programa", label: "Avance por Programa" },
            { key: "avances_escuela", label: "Avance por Escuela" },
            { key: "avances_capems", label: "Fichas CAPEMS" }
        ]
    },
    { key: "reportesNivel", label: "Reportes al Nivel" },
    // Configuración
    { key: "escuelas", label: "Escuelas" },
    { key: "programas", label: "Programas y Módulos" },
    { key: "fechas", label: "Periodos y Tareas" },
    { key: "ciclos", label: "Ciclos Escolares" },
    { key: "formatos", label: "Formatos y Plantillas" },
    { 
        key: "capems", 
        label: "Configuración CAPEMS",
        sub: [
            { key: "capems_fichas", label: "Gestión de Fichas" },
            { key: "capems_capems", label: "Gestión de CAPEMS" }
        ]
    },
    { key: "seguridad", label: "Accesos y Seguridad" },
    { key: "rubricas", label: "Herramientas de IA" },
    // Módulos Activos
    { key: "eventos", label: "Eventos Culturales" },
    { key: "circular05", label: "Circular 03" },
    { key: "olimpiada", label: "Olimpiada Matemáticas" },
    { key: "paec", label: "Encuentro PAEC" },
    { key: "expedientes", label: "Expedientes Personal" },
    { 
        key: "documentos", 
        label: "Documentos Admin",
        sub: [
            { key: "documentos_generar", label: "Generar Documento" },
            { key: "documentos_plantillas", label: "Gestión de Plantillas" },
            { key: "documentos_autoridades", label: "Autoridades Educativas" }
        ]
    },
];

export const DEFAULT_PERMISOS: Record<string, string> = {
    general: "LECTURA",
    avances: "LECTURA",
    avances_programa: "LECTURA",
    avances_escuela: "LECTURA",
    avances_capems: "LECTURA",
    reportesNivel: "NINGUNO",
    escuelas: "NINGUNO",
    programas: "NINGUNO",
    fechas: "NINGUNO",
    ciclos: "NINGUNO",
    formatos: "LECTURA",
    capems: "NINGUNO",
    capems_fichas: "NINGUNO",
    capems_capems: "NINGUNO",
    seguridad: "NINGUNO",
    rubricas: "NINGUNO",
    eventos: "LECTURA",
    circular05: "LECTURA",
    olimpiada: "LECTURA",
    paec: "LECTURA",
    expedientes: "NINGUNO",
    documentos: "NINGUNO",
    documentos_generar: "NINGUNO",
    documentos_plantillas: "NINGUNO",
    documentos_autoridades: "NINGUNO",
};
