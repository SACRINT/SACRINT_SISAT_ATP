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
    escuela: { id: string; cct: string; nombre: string; localidad: string; total: number; esSupervision?: boolean; esDePrueba?: boolean };
    cvd?: string | null;
    firmaDigital?: string | null;
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
    etiquetasArchivos?: string[];
    orden: number;
    esParaSupervision?: boolean;
    periodos: PeriodoAdmin[];
}

export interface EscuelaAdmin {
    id: string;
    cct: string;
    nombre: string;
    localidad: string;
    municipio?: string | null;
    zonaEscolar?: string | null;
    director?: string | null;
    email?: string | null;
    ultimoIngreso?: string | Date | null;
    esDePrueba?: boolean;
    esSupervision?: boolean;
    permisos?: any;
    directorExpediente?: {
        id?: string;
        rfc?: string | null;
        curp?: string | null;
        clavePresupuestal?: string | null;
        fechaIngreso?: Date | string | null;
    } | null;
    // Personal con cargo RESPONSABLE (el director lo captura en Expedientes)
    personal?: {
        id: string;
        nombre: string;
        apellidoPaterno: string;
        apellidoMaterno: string;
        curp?: string | null;
        rfc?: string | null;
        clavePresupuestal?: string | null;
        fechaIngreso?: Date | string | null;
        telefono?: string | null;
        correoElectronico?: string | null;
    }[];
    total: number;
    entregas: {
        id: string;
        estado: string;
        fechaSubida: string | null;
        archivos: Archivo[];
        correcciones: CorreccionAdmin[];
        periodoEntrega: { programa: { nombre: string }; mes: number | null; semestre: number | null };
        cvd?: string | null;
        firmaDigital?: string | null;
    }[];
}

export interface ZonaStat {
    zona: string;
    total: number;
    aprobadas: number;
    entregadas: number;
    escuelas: number;
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
