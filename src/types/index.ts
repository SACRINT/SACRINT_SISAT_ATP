export interface Archivo {
    id: string;
    nombre: string;
    etiqueta: string | null;
    tipo: string;
    createdAt?: string | Date;
    driveUrl?: string | null;
    driveId?: string | null;
}

export interface CorreccionAdmin {
    id: string;
    texto: string | null;
    createdAt: string;
    admin: { nombre: string };
    archivo?: { nombre: string; driveUrl: string | null; driveId?: string | null } | null;
}

export interface EntregaAdmin {
    id: string;
    estado: string;
    fechaSubida: string | null;
    observacionesATP: string | null;
    archivos: Archivo[];
    correcciones: CorreccionAdmin[];
    escuela: { id: string; cct: string; nombre: string; localidad: string; total: number };
}

export interface PeriodoAdmin {
    id: string;
    mes: number | null;
    semestre: number | null;
    activo: boolean;
    fechaLimite?: Date | string | null;
    entregas: EntregaAdmin[];
}

export interface ProgramaAdmin {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: string;
    numArchivos: number;
    orden: number;
    periodos: PeriodoAdmin[];
}

export interface EscuelaAdmin {
    id: string;
    cct: string;
    nombre: string;
    localidad: string;
    director?: string | null;
    email?: string | null;
    ultimoIngreso?: string | Date | null;
    total: number;
    entregas: {
        id: string;
        estado: string;
        fechaSubida: string | null;
        archivos: Archivo[];
        correcciones: CorreccionAdmin[];
        periodoEntrega: { programa: { nombre: string }; mes: number | null; semestre: number | null };
    }[];
}

export interface Stats {
    totalEntregas: number;
    aprobadas: number;
    pendientes: number;
    enRevision: number;
    requiereCorreccion: number;
    noAprobado: number;
    noEntregadas: number;
}
