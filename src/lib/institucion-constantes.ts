export interface InstitucionInfo {
    nombreSupervision: string;
    zona: string;
    cct: string;
    municipio: string;
    entidad: string;
    numeroOficioBase: string;
    emailReporteNivel: string;
    supervisor: string;
    supervisorRFC?: string;
    supervisorFecha?: string;
    supervisorClave?: string;
    coordinadorRegional: string;
    directorNivel: string;
    atp1Nombre?: string;
    atp2Nombre?: string;
    atp3Nombre?: string;
    atp4Nombre?: string;
}

export const INSTITUCION_FALLBACK: InstitucionInfo = {
    nombreSupervision: "SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES ZONA 004",
    zona: "004",
    cct: "21FMS0020X",
    municipio: "Venustiano Carranza",
    entidad: "Puebla",
    numeroOficioBase: "SEP-A/ZONA004/",
    emailReporteNivel: "dbepa.igualdad@seppue.gob.mx",
    supervisor: "C. SUPERVISOR(A)",
    coordinadorRegional: "C. COORDINADOR(A) REGIONAL",
    directorNivel: "C. DIRECTOR(A) DEL NIVEL",
};
