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
