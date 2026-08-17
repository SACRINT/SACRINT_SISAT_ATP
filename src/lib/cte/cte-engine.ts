import { prisma } from "@/lib/db";
import { CteCompromisoZonal, CteSesionConfig } from "@prisma/client";

export type EstadoCompromiso = "PENDIENTE" | "EN_PROCESO" | "RESUELTO" | "VENCIDO";

export type CategoriaCompromiso =
  | "APRENDIZAJES"
  | "CONVIVENCIA"
  | "GESTION"
  | "FORMACION_DOCENTE"
  | "OTRO";

export interface CompromisoCalculado extends CteCompromisoZonal {
  estadoCalculado: EstadoCompromiso;
  diasRestantes?: number | null;
  diasVencido?: number | null;
  sesionNumero?: number;
  sesionFase?: string;
  sesionFecha?: string | null;
}

export interface KpisCteCompromisos {
  total: number;
  resueltos: number;
  enProceso: number;
  pendientes: number;
  vencidos: number;
  porcentajeCumplimiento: number;
}

/**
 * Calcula el estado dinámico de un compromiso contra el calendario de sesiones de CTE.
 */
export function calcularEstadoCompromiso(
  compromiso: CteCompromisoZonal,
  sesionActual?: CteSesionConfig | null,
  sesionesTodas: CteSesionConfig[] = [],
  ahora: Date = new Date()
): { estadoCalculado: EstadoCompromiso; diasRestantes: number | null; diasVencido: number | null } {
  // 1. Si está marcado como resuelto
  if (compromiso.resuelto || compromiso.estado === "RESUELTO") {
    return {
      estadoCalculado: "RESUELTO",
      diasRestantes: null,
      diasVencido: null,
    };
  }

  // 2. Determinar fecha límite aplicable
  let fechaLimiteEfectiva: Date | null = compromiso.fechaLimite;

  // Si no tiene fecha límite fija, buscar la fecha de la siguiente sesión de CTE
  if (!fechaLimiteEfectiva && sesionActual) {
    // Buscar la sesión cronológicamente siguiente
    const siguienteSesion = sesionesTodas
      .filter((s) => {
        if (s.fase === sesionActual.fase) {
          return s.numero > sesionActual.numero;
        }
        // Transición de INTENSIVA a ORDINARIA
        if (sesionActual.fase === "INTENSIVA" && s.fase === "ORDINARIA") {
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        if (a.fase === b.fase) return a.numero - b.numero;
        return a.fase === "INTENSIVA" ? -1 : 1;
      })[0];

    if (siguienteSesion?.fechaSesion) {
      fechaLimiteEfectiva = new Date(siguienteSesion.fechaSesion);
    } else if (sesionActual.fechaSesion) {
      // Fallback normativo: 30 días naturales posteriores a la sesión actual
      fechaLimiteEfectiva = new Date(
        sesionActual.fechaSesion.getTime() + 30 * 24 * 60 * 60 * 1000
      );
    }
  }

  // 3. Evaluar vencimiento contra la fecha límite efectiva
  if (fechaLimiteEfectiva) {
    const diffMs = fechaLimiteEfectiva.getTime() - ahora.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return {
        estadoCalculado: "VENCIDO",
        diasRestantes: 0,
        diasVencido: Math.abs(diffDias),
      };
    }

    // No está vencido pero tiene días restantes
    const estadoBase: EstadoCompromiso =
      compromiso.estado === "EN_PROCESO" || (compromiso.notasSeguimiento && compromiso.notasSeguimiento.trim().length > 0)
        ? "EN_PROCESO"
        : "PENDIENTE";

    return {
      estadoCalculado: estadoBase,
      diasRestantes: diffDias,
      diasVencido: null,
    };
  }

  // 4. Si no hay fechas disponibles para calcular
  const estadoBase: EstadoCompromiso =
    compromiso.estado === "EN_PROCESO" || (compromiso.notasSeguimiento && compromiso.notasSeguimiento.trim().length > 0)
      ? "EN_PROCESO"
      : "PENDIENTE";

  return {
    estadoCalculado: estadoBase,
    diasRestantes: null,
    diasVencido: null,
  };
}

/**
 * Calcula KPIs agregados de cumplimiento para una lista de compromisos calculados.
 */
export function calcularKpisCompromisos(compromisos: CompromisoCalculado[]): KpisCteCompromisos {
  const total = compromisos.length;
  const resueltos = compromisos.filter((c) => c.estadoCalculado === "RESUELTO").length;
  const enProceso = compromisos.filter((c) => c.estadoCalculado === "EN_PROCESO").length;
  const vencidos = compromisos.filter((c) => c.estadoCalculado === "VENCIDO").length;
  const pendientes = compromisos.filter((c) => c.estadoCalculado === "PENDIENTE").length;

  const porcentajeCumplimiento = total > 0 ? Math.round((resueltos / total) * 100) : 100;

  return {
    total,
    resueltos,
    enProceso,
    pendientes,
    vencidos,
    porcentajeCumplimiento,
  };
}

/**
 * Consulta y procesa los compromisos de una zona escolar con aislamiento de tenant y cálculo dinámico.
 */
export async function consultarCompromisosZonales({
  tenantId,
  sesionId,
  categoria,
  escuelaId,
}: {
  tenantId: string;
  sesionId?: string;
  categoria?: string;
  escuelaId?: string;
}): Promise<{ compromisos: CompromisoCalculado[]; kpis: KpisCteCompromisos }> {
  // 1. Obtener todas las sesiones de la zona para resolver fechas de vencimiento
  const sesiones = await prisma.cteSesionConfig.findMany({
    where: { tenantId },
    orderBy: [{ fase: "asc" }, { numero: "asc" }],
  });

  const sesionesMap = new Map(sesiones.map((s) => [s.id, s]));

  // 2. Construir filtro de búsqueda
  const whereClause: any = {
    tenantId,
  };

  if (sesionId) {
    whereClause.sesionId = sesionId;
  }

  if (categoria && categoria !== "TODAS") {
    whereClause.categoria = categoria;
  }

  // 3. Consultar compromisos
  const compromisosRaw = await prisma.cteCompromisoZonal.findMany({
    where: whereClause,
    orderBy: [{ prioridad: "desc" }, { createdAt: "desc" }],
  });

  const ahora = new Date();

  // 4. Calcular estado y filtrar por escuela si aplica
  let compromisosCalculados: CompromisoCalculado[] = compromisosRaw.map((comp) => {
    const sesion = sesionesMap.get(comp.sesionId);
    const { estadoCalculado, diasRestantes, diasVencido } = calcularEstadoCompromiso(
      comp,
      sesion,
      sesiones,
      ahora
    );

    return {
      ...comp,
      estadoCalculado,
      diasRestantes,
      diasVencido,
      sesionNumero: sesion?.numero,
      sesionFase: sesion?.fase,
      sesionFecha: sesion?.fechaSesion ? sesion.fechaSesion.toISOString() : null,
    };
  });

  // Si se solicitó aislamiento para una escuela específica (Director)
  if (escuelaId) {
    compromisosCalculados = compromisosCalculados.filter((c) => {
      if (!c.escuelasIds) return true; // Compromiso general aplica a todas
      try {
        const ids = Array.isArray(c.escuelasIds) ? (c.escuelasIds as string[]) : [];
        return ids.length === 0 || ids.includes(escuelaId);
      } catch {
        return true;
      }
    });
  }

  const kpis = calcularKpisCompromisos(compromisosCalculados);

  return {
    compromisos: compromisosCalculados,
    kpis,
  };
}
