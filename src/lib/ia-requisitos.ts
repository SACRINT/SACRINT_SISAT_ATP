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

  const modoSinRestricciones = config ? config.modoSinRestricciones : false;
  const permisos = escuela?.permisos as any;

  // Exención legacy (todo junto) — mantener por compatibilidad hacia atrás
  const exentoLegacyTodo = permisos?.planeacionesSinRequisitos === true;
  // Exenciones granulares individuales (nueva lógica)
  const exentoApiKey = permisos?.planeacionesSinApiKey === true;
  const exentoPaec  = permisos?.planeacionesSinPaec    === true;

  if (escuela?.esDePrueba || modoSinRestricciones || exentoLegacyTodo) {
    return {
      moduloHabilitado: true,
      tieneApiKey: true,
      tienePaecPec: true,
      requierePaecPec: false,
      requiereApiKey: false,
      puedeUsar: true,
      motivoBloqueo: null,
      entregaPaecPec: entregaPaec,
      modoSinRestricciones: modoSinRestricciones || exentoLegacyTodo,
    };
  }

  const globalActivo   = config ? config.activoGlobal : true;
  // Los requisitos globales siguen activos; la exención por escuela los anula individualmente
  const requierePaecPec = (config ? config.requierePaecPec : true) && !exentoPaec;
  const requiereApiKey  = (config ? config.requiereApiKey  : true) && !exentoApiKey;
  const moduloHabilitado = permisos?.planeacionesDesactivado !== true && globalActivo;

  // ✅ tieneApiKey solo es true si REALMENTE tiene la clave en BD
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
  tieneExpedientes: boolean;
  modoSinRestricciones: boolean;
  puedeUsar: boolean;
  motivoBloqueo: string | null;
}> {
  const [preRevisionConfig, escuela, totalPersonal] = await Promise.all([
    prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } }).catch(() => null),
    prisma.escuela.findUnique({
      where: { id: escuelaId },
      select: { geminiApiKey: true, permisos: true, esDePrueba: true },
    }),
    prisma.personal.count({ where: { escuelaId } }),
  ]);

  // Interruptores globales
  const activoGlobalHorarios      = (preRevisionConfig as any)?.activoGlobalHorarios      ?? true;
  const modoSinRestricciones      = (preRevisionConfig as any)?.modoSinRestriccionesHorarios ?? false;
  const requiereApiKeyHorarios    = (preRevisionConfig as any)?.requiereApiKeyHorarios    ?? true;
  const requiereExpedientesHorarios = (preRevisionConfig as any)?.requiereExpedientesHorarios ?? true;

  const permisos = escuela?.permisos as any;

  // Exención legacy (todo junto) — mantener por compatibilidad hacia atrás
  const exentoLegacyTodo    = permisos?.horariosSinRequisitos   === true;
  // Exenciones granulares individuales (nueva lógica)
  const exentoApiKey        = permisos?.horariosSinApiKey        === true;
  const exentoExpedientes   = permisos?.horariosSinExpedientes   === true;

  if (escuela?.esDePrueba || modoSinRestricciones || exentoLegacyTodo) {
    return {
      moduloHabilitado: true,
      tieneApiKey: true,
      tieneExpedientes: true,
      modoSinRestricciones: modoSinRestricciones || exentoLegacyTodo,
      puedeUsar: true,
      motivoBloqueo: null,
    };
  }

  // Módulo habilitado: combinación del interruptor global + permiso individual de la escuela
  const moduloHabilitado = activoGlobalHorarios && permisos?.horariosDesactivado !== true;

  // tieneApiKey solo es true si la escuela REALMENTE tiene clave configurada en BD
  const tieneApiKey = !!(escuela?.geminiApiKey && String(escuela.geminiApiKey).trim().length > 10);
  // tieneExpedientes: la escuela ha registrado al menos un miembro del personal
  const tieneExpedientes = totalPersonal > 0;

  // Los requisitos globales siguen activos; la exención por escuela los anula individualmente
  const apiKeyRequerida     = requiereApiKeyHorarios     && !exentoApiKey;
  const expedientesRequeridos = requiereExpedientesHorarios && !exentoExpedientes;

  const puedeUsar =
    moduloHabilitado &&
    (!apiKeyRequerida     || tieneApiKey) &&
    (!expedientesRequeridos || tieneExpedientes);

  const motivoBloqueo = !activoGlobalHorarios
    ? "El módulo de Generador de Horarios IA está desactivado globalmente por la supervisión."
    : !moduloHabilitado
    ? "El módulo de Generador de Horarios IA no está habilitado para tu escuela. Contacta a la supervisión de zona."
    : apiKeyRequerida && !tieneApiKey
    ? "Se requiere una API Key activa de Gemini para usar este módulo. Configúrala en 'Ajustes de API IA' en el menú lateral."
    : expedientesRequeridos && !tieneExpedientes
    ? "Para usar el Generador de Horarios IA es obligatorio haber registrado el Expediente de Personal de tu escuela. Dirígete al apartado 'Expedientes' y registra al personal primero."
    : null;

  return {
    moduloHabilitado,
    tieneApiKey,
    tieneExpedientes,
    modoSinRestricciones: false,
    puedeUsar,
    motivoBloqueo,
  };
}
