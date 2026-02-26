
export interface ArchivoDirector {
    id: string;
    nombre: string;
    driveId: string | null;
    driveUrl: string | null;
    etiqueta: string | null;
    tipo: string;
    subidoPor: string;
    createdAt: string;
}

export interface CorreccionDirector {
    id: string;
    texto: string | null;
    archivo: ArchivoDirector | null;
    admin: { nombre: string };
    createdAt: string;
}

export interface PeriodoEntregaDirector {
    id: string;
    mes: number | null;
    semestre: number | null;
    fechaLimite?: string | null;
    programa: { id: string; nombre: string; numArchivos: number; tipo: string };
}

export interface EntregaDirector {
    id: string;
    estado: string;
    fechaSubida: string | null;
    observacionesATP: string | null;
    periodoEntrega: PeriodoEntregaDirector;
    archivos: ArchivoDirector[];
    correcciones: CorreccionDirector[];
}

export interface ProgramaGroup {
    programa: { id: string; nombre: string; numArchivos: number; tipo: string };
    entregas: EntregaDirector[];
}

export interface RecursoDirector {
    id: string;
    titulo: string;
    descripcion: string | null;
    archivoNombre: string;
    archivoDriveUrl: string | null;
    programa: { nombre: string } | null;
}
