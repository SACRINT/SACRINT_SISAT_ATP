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
    { key: "showDashboard", label: "Dashboard (Avance de Entregas)" },
    { key: "showGestionEscuelas", label: "Gestión de Escuelas (Solo ver y editar configuraciones de archivos, no crear)" },
    { key: "showEvaluacion", label: "Revisión de Documentos (Evaluación)" },
    { key: "showOlimpiada", label: "Olimpiada Matemáticas" },
    { key: "showPAEC", label: "Encuentro PAEC" },
    { key: "showCapems", label: "Fichas CAPEMS" },
    { key: "showExpedientes", label: "Expedientes de Personal" },
    { key: "showDocumentosGenerar", label: "Generación de Constancias" },
    { key: "showDirectorio", label: "Directorio" },
] as const;

export const DEFAULT_PERMISOS: Record<string, string> = {
    showDashboard: "LECTURA",
    showGestionEscuelas: "NINGUNO",
    showEvaluacion: "LECTURA",
    showOlimpiada: "LECTURA",
    showPAEC: "LECTURA",
    showCapems: "LECTURA",
    showExpedientes: "NINGUNO",
    showDocumentosGenerar: "NINGUNO",
    showDirectorio: "LECTURA",
};
