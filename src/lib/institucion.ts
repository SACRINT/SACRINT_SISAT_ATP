import { prisma } from "@/lib/db";
import { InstitucionInfo, INSTITUCION_FALLBACK } from "@/lib/institucion-constantes";

export * from "@/lib/institucion-constantes";

/**
 * Obtiene la configuración institucional activa para el tenant desde AutoridadesConfig
 */
export async function getInstitucion(tenantId?: string): Promise<InstitucionInfo> {
    try {
        let config = await prisma.autoridadesConfig.findFirst({
            where: tenantId ? { tenantId } : { id: "singleton" },
        });

        if (!config && tenantId) {
            config = await prisma.autoridadesConfig.findUnique({
                where: { id: "singleton" },
            });
        }

        if (!config) {
            return INSTITUCION_FALLBACK;
        }

        return {
            nombreSupervision: config.nombreSupervision || INSTITUCION_FALLBACK.nombreSupervision,
            zona: config.zona || INSTITUCION_FALLBACK.zona,
            cct: config.cct || INSTITUCION_FALLBACK.cct,
            municipio: config.municipio || INSTITUCION_FALLBACK.municipio,
            entidad: config.entidad || INSTITUCION_FALLBACK.entidad,
            numeroOficioBase: config.numeroOficioBase || INSTITUCION_FALLBACK.numeroOficioBase,
            emailReporteNivel: config.emailReporteNivel || INSTITUCION_FALLBACK.emailReporteNivel,
            supervisor: config.supervisor || INSTITUCION_FALLBACK.supervisor,
            supervisorRFC: config.supervisorRFC,
            supervisorFecha: config.supervisorFecha,
            supervisorClave: config.supervisorClave,
            coordinadorRegional: config.coordinadorRegional || INSTITUCION_FALLBACK.coordinadorRegional,
            directorNivel: config.directorNivel || INSTITUCION_FALLBACK.directorNivel,
            atp1Nombre: config.atp1Nombre,
            atp2Nombre: config.atp2Nombre,
            atp3Nombre: config.atp3Nombre,
            atp4Nombre: config.atp4Nombre,
        };
    } catch (error) {
        console.error("Error al obtener datos de institución:", error);
        return INSTITUCION_FALLBACK;
    }
}
