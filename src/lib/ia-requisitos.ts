/**
 * Utilidad compartida para verificar si una escuela puede usar los módulos IA.
 * Centraliza la lógica de restricciones para no duplicarla en cada ruta.
 */
import { prisma } from "@/lib/db";

export interface RequisitosIA {
  moduloHabilitado: boolean;
  tieneApiKey: boolean;
  tienePaecPec: boolean;
  requierePaecPec: boolean;
  requiereApiKey: boolean;
  puedeUsar: boolean;
  motivoBloqueo: string | null;
  modoSinRestricciones: boolean;
  entregaPaecPec: any;
}

/**
 * Verifica si la escuela cumple todos los requisitos para usar el módulo de
 * Planeaciones Didácticas IA.
 */
export async function verificarRequisitosPlaneaciones(escuelaId: string): Promise<RequisitosIA> {
  const [config, escuela, entregaPaec] = await Promise.all([
    prisma.planeacionesConfig.findUnique({ where: { id: "singleton" } }),
    prisma.escuela.findUnique({
      where: { id: escuelaId },
      select: { geminiApiKey: true, permisos: true, esDePrueba: true },
    }),
    prisma.entrega.findFirst({
      where: {
        escuelaId,
        estado: { in: ["APROBADO", "EN_REVISION", "REQUIERE_CORRECCION", "ENTREGADO_FISICO"] },
        periodoEntrega: { programa: { nombre: { contains: "PAEC", mode: "insensitive" } } },
      },
      select: {
        id: true,
        estado: true,
        periodoEntrega: { select: { programa: { select: { nombre: true } } } },
      },
    }),
  ]);

  // ── Modo Sin Restricciones o escuela de prueba ──
  const modoSinRestricciones = config ? config.modoSinRestricciones : false;
  if (escuela?.esDePrueba || modoSinRestricciones) {
    return {
      moduloHabilitado: true,
      tieneApiKey: true,
      tienePaecPec: true,
      requierePaecPec: false,
      requiereApiKey: false,
      puedeUsar: true,
      motivoBloqueo: null,
      entregaPaecPec: entregaPaec,
      modoSinRestricciones: true,
    };
  }

  const globalActivo = config ? config.activoGlobal : true;
  const requierePaecPec = config ? config.requierePaecPec : true;
  const requiereApiKey = config ? config.requiereApiKey : true;

  const permisos = escuela?.permisos as any;
  const moduloHabilitado = permisos?.planeacionesDesactivado !== true && globalActivo;

  // ✅ CORRECCIÓN: tieneApiKey solo es true si REALMENTE tiene la clave en BD
  const tieneApiKey = !!(escuela?.geminiApiKey && String(escuela.geminiApiKey).trim().length > 10);
  const tienePaecPec = !!entregaPaec;

  const puedeUsar =
    moduloHabilitado &&
    (!requiereApiKey || tieneApiKey) &&
    (!requierePaecPec || tienePaecPec);

  const motivoBloqueo = !moduloHabilitado
    ? "El módulo de Revisión de Planeaciones no está habilitado actualmente por la supervisión."
    : requierePaecPec && !tienePaecPec
    ? "Para usar la Revisión de Planeaciones Didácticas es obligatorio haber subido el PAEC-PEC de tu escuela. Dirígete al apartado de entregas y sube tu PAEC-PEC primero."
    : requiereApiKey && !tieneApiKey
    ? "Se requiere una API Key activa de Gemini para usar este módulo. Configúrala en 'Ajustes de API IA' en el menú lateral."
    : null;

  return {
    moduloHabilitado,
    tieneApiKey,
    tienePaecPec,
    requierePaecPec,
    requiereApiKey,
    puedeUsar,
    motivoBloqueo,
    entregaPaecPec: entregaPaec,
    modoSinRestricciones: false,
  };
}

/**
 * Verifica si la escuela cumple todos los requisitos para usar el módulo de
 * Generador de Horarios IA.
 */
export async function verificarRequisitosHorarios(escuelaId: string): Promise<{
  moduloHabilitado: boolean;
  tieneApiKey: boolean;
  modoSinRestricciones: boolean;
  puedeUsar: boolean;
  motivoBloqueo: string | null;
}> {
  const [preRevisionConfig, escuela] = await Promise.all([
    // modoSinRestriccionesHorarios vive en PreRevisionConfig
    prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } }).catch(() => null),
    prisma.escuela.findUnique({
      where: { id: escuelaId },
      select: { geminiApiKey: true, permisos: true, esDePrueba: true },
    }),
  ]);

  const modoSinRestricciones = (preRevisionConfig as any)?.modoSinRestriccionesHorarios ?? false;

  if (escuela?.esDePrueba || modoSinRestricciones) {
    return { moduloHabilitado: true, tieneApiKey: true, modoSinRestricciones: true, puedeUsar: true, motivoBloqueo: null };
  }

  const permisos = escuela?.permisos as any;
  const moduloHabilitado = permisos?.horariosDesactivado !== true;

  // tieneApiKey solo es true si la escuela REALMENTE tiene clave configurada en BD
  const tieneApiKey = !!(escuela?.geminiApiKey && String(escuela.geminiApiKey).trim().length > 10);

  // El pool del sistema se usa como fallback → no bloqueamos por API Key en Horarios
  // Solo bloqueamos si el permiso individual del módulo está desactivado
  const puedeUsar = moduloHabilitado;

  const motivoBloqueo = !moduloHabilitado
    ? "El módulo de Generador de Horarios IA no está habilitado para tu escuela. Contacta a la supervisión de zona."
    : null;

  return { moduloHabilitado, tieneApiKey, modoSinRestricciones: false, puedeUsar, motivoBloqueo };
}

