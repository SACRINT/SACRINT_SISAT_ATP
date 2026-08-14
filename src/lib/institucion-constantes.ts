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

const envZona = process.env.ZONA_ESCOLAR || "004";
const envZonaPadded = envZona.padStart(3, "0");

export const INSTITUCION_FALLBACK: InstitucionInfo = {
    nombreSupervision: process.env.NOMBRE_SUPERVISION || `SUPERVISIÓN ESCOLAR DE BACHILLERATOS GENERALES ZONA ${envZonaPadded}`,
    zona: envZonaPadded,
    cct: process.env.CCT_SUPERVISION || "21FMS0020X",
    municipio: process.env.MUNICIPIO_SUPERVISION || "Venustiano Carranza",
    entidad: process.env.ENTIDAD_FEDERATIVA || "Puebla",
    numeroOficioBase: `SEP-A/ZONA${envZonaPadded}/`,
    emailReporteNivel: process.env.EMAIL_REPORTE_NIVEL || "dbepa.igualdad@seppue.gob.mx",
    supervisor: process.env.SUPERVISOR_NOMBRE || "C. SUPERVISOR(A)",
    coordinadorRegional: "C. COORDINADOR(A) REGIONAL",
    directorNivel: "C. DIRECTOR(A) DEL NIVEL",
};
