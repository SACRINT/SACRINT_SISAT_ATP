import { prisma } from "@/lib/db";
import { getInstitucion } from "@/lib/institucion";
import { responderConsultaNormativa } from "./rag-engine";
import type { CriticidadOficio, TipoFaseCte } from "@prisma/client";

export interface AgentSessionContext {
  userId: string;
  userEmail?: string;
  role: "admin" | "supervision" | "director";
  dbRole?: string;
  tenantId?: string;
  escuelaId?: string;
  nombreUsuario?: string;
}

export interface ToolExecutionResult {
  toolName: string;
  autorizada: boolean;
  data?: any;
  mensaje?: string;
  filasRetornadas: number;
}

/**
 * Declaraciones de herramientas en formato Gemini / OpenAPI para Function Calling.
 */
export const AGENT_TOOLS_DECLARATIONS = [
  {
    name: "consultarEstatusEntregas",
    description: "Consulta el estado de entrega y cumplimiento de programas oficiales (PAEC, PMC, Diagnósticos, etc.) en el ciclo escolar activo. Para directores consulta únicamente su plantel; para supervisores/admin consulta el resumen de la zona.",
    parameters: {
      type: "OBJECT",
      properties: {
        programaId: {
          type: "STRING",
          description: "ID o nombre opcional del programa a filtrar (ej. 'paec', 'pmc'). Si se omite, devuelve el consolidado de todos los programas."
        }
      }
    }
  },
  {
    name: "consultarCumplimientoZonal",
    description: "Consulta el ranking y porcentaje de cumplimiento de todas las escuelas de la zona escolar. EXCLUSIVO para Supervisión Escolar y Administradores.",
    parameters: {
      type: "OBJECT",
      properties: {
        limite: {
          type: "NUMBER",
          description: "Número máximo de escuelas a listar en el resumen de rezago o cumplimiento (por defecto 10)."
        }
      }
    }
  },
  {
    name: "consultarOficiosPendientes",
    description: "Consulta oficios, circulares institucionales y solicitudes urgentes activas. Permite filtrar por criticidad de semáforo de tiempo (ROJO: <= 24h, AMARILLO: <= 72h, VERDE: > 72h).",
    parameters: {
      type: "OBJECT",
      properties: {
        criticidad: {
          type: "STRING",
          enum: ["ROJO", "AMARILLO", "VERDE"],
          description: "Nivel de urgencia o criticidad del plazo del oficio."
        }
      }
    }
  },
  {
    name: "consultarResumen911",
    description: "Consulta el resumen estadístico oficial de matrícula (Formato 911 / SICEP), total de alumnos, docentes y estado de validación.",
    parameters: {
      type: "OBJECT",
      properties: {
        tipoCorte: {
          type: "STRING",
          enum: ["INICIO_DE_CURSOS", "FIN_DE_CURSOS"],
          description: "Periodo de corte estadístico."
        }
      }
    }
  },
  {
    name: "consultarSesionesCTE",
    description: "Consulta el calendario oficial de sesiones de Consejo Técnico Escolar (CTE), fechas límite de entrega de productos y guías de trabajo.",
    parameters: {
      type: "OBJECT",
      properties: {
        fase: {
          type: "STRING",
          enum: ["INTENSIVA", "ORDINARIA"],
          description: "Fase del Consejo Técnico Escolar."
        },
        numero: {
          type: "NUMBER",
          description: "Número de sesión ordinaria (ej. 1, 2, 3...)."
        }
      }
    }
  },
  {
    name: "consultarConvocatoriasUsicamm",
    description: "Consulta convocatorias vigentes de USICAMM (cambio de categoría, horas adicionales, reconocimientos) y sus fechas de vigencia.",
    parameters: {
      type: "OBJECT",
      properties: {
        tipo: {
          type: "STRING",
          description: "Tipo de proceso (ej. 'CONCURSO', 'PROMOCION', 'ACTUALIZACION')."
        }
      }
    }
  },
  {
    name: "consultarNormativasSEP",
    description: "Búsqueda en la biblioteca de normativas oficiales, circulares, planes de estudio y lineamientos de la SEP cargados en el sistema.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Pregunta o término normativo a buscar en los documentos oficiales."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "redactarBorradorOficio",
    description: "Genera una propuesta formal e institucional de redacción de oficio o circular oficial para la SEP Puebla / Supervisión Escolar con fundamentación en la Nueva Escuela Mexicana (NEM) y estructura oficial.",
    parameters: {
      type: "OBJECT",
      properties: {
        asunto: {
          type: "STRING",
          description: "Asunto principal o propósito administrativo/técnico-pedagógico del oficio."
        },
        destinatario: {
          type: "STRING",
          description: "Nombre o cargo del destinatario (ej. 'Directores de Escuelas de la Zona', 'C. Director de la Escuela Secundaria...')."
        },
        fundamentoLegal: {
          type: "STRING",
          description: "Fundamento normativo opcional a citar (ej. 'Artículo 3ro Constitucional', 'Acuerdo 08/08/23')."
        },
        instruccionesClave: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Puntos o indicaciones específicas que debe contener el cuerpo del oficio."
        },
        fechaLimite: {
          type: "STRING",
          description: "Fecha y hora límite de cumplimiento si aplica (ej. '20 de marzo de 2026 a las 14:00 hrs')."
        }
      },
      required: ["asunto", "destinatario"]
    }
  },
  {
    name: "validarCoherenciaEstadistica911",
    description: "Realiza una auditoría matemática y de consistencia lógica sobre la estadística 911 / SICEP (matrícula total, suma por género H+M, alumnos por grupo, relación alumnos/docente).",
    parameters: {
      type: "OBJECT",
      properties: {
        tipoCorte: {
          type: "STRING",
          enum: ["INICIO_DE_CURSOS", "FIN_DE_CURSOS"],
          description: "Corte estadístico a validar. Si se omite, valida el más reciente."
        }
      }
    }
  },
  {
    name: "orientarConvocatoriaUsicamm",
    description: "Proporciona orientación y requisitos detallados para procesos y convocatorias de USICAMM (Promoción Horizontal, Promoción Vertical, Admisión, Horas Adicionales, Cambios de Centro de Trabajo).",
    parameters: {
      type: "OBJECT",
      properties: {
        proceso: {
          type: "STRING",
          description: "Tipo de proceso USICAMM (ej. 'PROMOCION_HORIZONTAL', 'PROMOCION_VERTICAL', 'HORAS_ADICIONALES', 'ADMISION', 'RECONOCIMIENTO')."
        }
      },
      required: ["proceso"]
    }
  }
];

/**
 * Retorna las declaraciones de herramientas filtradas por allowlist si se especifica.
 */
export function getAgentToolsDeclarations(allowlist?: string[]) {
  if (!allowlist || allowlist.length === 0) {
    return AGENT_TOOLS_DECLARATIONS;
  }
  const allowSet = new Set(allowlist);
  return AGENT_TOOLS_DECLARATIONS.filter(t => allowSet.has(t.name));
}

/**
 * Despachador seguro de herramientas del Agente con aislamiento Zero Trust y auditoría.
 */
export async function executeAgentTool(
  toolName: string,
  args: any,
  context: AgentSessionContext,
  mensajeUsuario: string
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  let result: ToolExecutionResult = {
    toolName,
    autorizada: false,
    filasRetornadas: 0
  };

  // Resiliencia de tenantId: auto-recuperar de la base de datos si falta en el contexto
  if (!context.tenantId) {
    if (context.userId) {
      try {
        const adm = await prisma.admin.findUnique({ where: { id: context.userId }, select: { organizacionId: true } });
        context.tenantId = adm?.organizacionId;
        if (!context.tenantId) {
          const esc = await prisma.escuela.findUnique({ where: { id: context.userId }, select: { zonaEscolar: true } });
          if (esc?.zonaEscolar) {
            context.tenantId = `zona${esc.zonaEscolar.replace(/^0+/, "").padStart(3, "0")}`;
          }
        }
      } catch {
        // ignore
      }
    }
    if (!context.tenantId) {
      context.tenantId = "zona004";
    }
  }

  try {
    switch (toolName) {
      case "consultarEstatusEntregas": {
        const { programaId } = args || {};
        
        // 1. Obtener ciclo escolar activo
        const cicloActivo = await prisma.cicloEscolar.findFirst({
          where: { activo: true }
        });

        if (!cicloActivo) {
          result = {
            toolName,
            autorizada: true,
            mensaje: "No hay un ciclo escolar activo configurado actualmente.",
            data: { total: 0, entregas: [] },
            filasRetornadas: 0
          };
          break;
        }

        if (context.role === "director") {
          // Vista restringida para Director: Forzado a su escuelaId
          const entregas = await prisma.entrega.findMany({
            where: {
              escuelaId: context.escuelaId || context.userId,
              periodoEntrega: {
                cicloEscolarId: cicloActivo.id,
                ...(programaId ? {
                  programa: {
                    OR: [
                      { id: programaId },
                      { nombre: { contains: programaId, mode: "insensitive" } }
                    ]
                  }
                } : {})
              }
            },
            include: {
              periodoEntrega: {
                include: { programa: true }
              }
            }
          });

          const resumen = {
            total: entregas.length,
            aprobadas: entregas.filter(e => e.estado === "APROBADO").length,
            pendientes: entregas.filter(e => e.estado === "PENDIENTE").length,
            enCorreccion: entregas.filter(e => e.estado === "REQUIERE_CORRECCION").length,
            noEntregadas: entregas.filter(e => e.estado === "NO_ENTREGADO").length,
            detalle: entregas.map(e => ({
              programa: e.periodoEntrega.programa.nombre,
              estado: e.estado,
              fechaLimite: e.periodoEntrega.fechaLimite,
              fechaSubida: e.fechaSubida,
              observacionesATP: e.observacionesATP
            }))
          };

          result = {
            toolName,
            autorizada: true,
            data: resumen,
            filasRetornadas: entregas.length
          };
        } else {
          // Vista Zonal para Supervisión / Admin
          const entregas = await prisma.entrega.findMany({
            where: {
              escuela: { esSupervision: false, esDePrueba: false },
              periodoEntrega: {
                cicloEscolarId: cicloActivo.id,
                ...(programaId ? {
                  programa: {
                    OR: [
                      { id: programaId },
                      { nombre: { contains: programaId, mode: "insensitive" } }
                    ]
                  }
                } : {})
              }
            },
            include: {
              escuela: { select: { id: true, nombre: true, cct: true } },
              periodoEntrega: { include: { programa: true } }
            }
          });

          const resumenZonal = {
            ciclo: cicloActivo.nombre,
            totalEntregasRegistradas: entregas.length,
            aprobadas: entregas.filter(e => e.estado === "APROBADO").length,
            pendientesRevision: entregas.filter(e => e.estado === "PENDIENTE").length,
            requiereCorreccion: entregas.filter(e => e.estado === "REQUIERE_CORRECCION").length,
            noEntregadas: entregas.filter(e => e.estado === "NO_ENTREGADO").length,
            escuelasConRezagos: Array.from(
              new Set(
                entregas
                  .filter(e => e.estado === "NO_ENTREGADO" || e.estado === "REQUIERE_CORRECCION")
                  .map(e => `${e.escuela.nombre} (${e.escuela.cct})`)
              )
            ).slice(0, 10)
          };

          result = {
            toolName,
            autorizada: true,
            data: resumenZonal,
            filasRetornadas: entregas.length
          };
        }
        break;
      }

      case "consultarCumplimientoZonal": {
        // Validación de permisos estricta
        if (context.role === "director") {
          result = {
            toolName,
            autorizada: false,
            mensaje: "Acceso denegado: Tu rol de Director solo tiene permisos para consultar la información de tu propio plantel escolar, no el ranking o cumplimiento zonal de otras escuelas.",
            filasRetornadas: 0
          };
          break;
        }

        const escuelas = await prisma.escuela.findMany({
          where: { esSupervision: false, esDePrueba: false },
          include: {
            entregas: {
              include: {
                periodoEntrega: {
                  include: { cicloEscolar: true }
                }
              }
            }
          }
        });

        const ranking = escuelas.map(esc => {
          const entregasCiclo = esc.entregas.filter(e => e.periodoEntrega?.cicloEscolar?.activo);
          const total = entregasCiclo.length;
          const aprobadas = entregasCiclo.filter(e => e.estado === "APROBADO").length;
          const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;
          return {
            nombre: esc.nombre,
            cct: esc.cct,
            total,
            aprobadas,
            pendientes: total - aprobadas,
            porcentajeCumplimiento: `${porcentaje}%`
          };
        }).sort((a, b) => b.aprobadas - a.aprobadas);

        const limite = args?.limite || 10;
        result = {
          toolName,
          autorizada: true,
          data: {
            totalEscuelasEvaluadas: escuelas.length,
            topCumplimiento: ranking.slice(0, limite),
            conMayorRezago: ranking.filter(r => r.pendientes > 0).sort((a, b) => b.pendientes - a.pendientes).slice(0, limite)
          },
          filasRetornadas: escuelas.length
        };
        break;
      }

      case "consultarOficiosPendientes": {
        const criticidadFiltro = args?.criticidad as CriticidadOficio | undefined;

        if (context.role === "director") {
          const destinatarios = await prisma.oficioDestinatario.findMany({
            where: {
              escuelaId: context.escuelaId || context.userId,
              acuseRecibido: false,
              oficio: {
                tenantId: context.tenantId,
                estado: { in: ["RECIBIDO", "ENVIADO"] },
                ...(criticidadFiltro ? { criticidad: criticidadFiltro } : {})
              }
            },
            include: {
              oficio: true
            },
            orderBy: {
              oficio: { fechaLimite: "asc" }
            }
          });

          result = {
            toolName,
            autorizada: true,
            data: {
              totalSinAcuse: destinatarios.length,
              oficios: destinatarios.map(d => ({
                numeroOficio: d.oficio.numeroOficio,
                asunto: d.oficio.asunto,
                criticidad: d.oficio.criticidad,
                fechaLimite: d.oficio.fechaLimite,
                remitente: d.oficio.remitenteNombre
              }))
            },
            filasRetornadas: destinatarios.length
          };
        } else {
          // Vista Supervisión / Admin
          const oficios = await prisma.oficio.findMany({
            where: {
              tenantId: context.tenantId,
              estado: { in: ["RECIBIDO", "ENVIADO"] },
              ...(criticidadFiltro ? { criticidad: criticidadFiltro } : {})
            },
            include: {
              destinatarios: {
                select: { id: true, acuseRecibido: true, escuelaNombre: true }
              }
            },
            orderBy: { fechaLimite: "asc" }
          });

          result = {
            toolName,
            autorizada: true,
            data: {
              totalOficiosActivos: oficios.length,
              oficiosRojos: oficios.filter(o => o.criticidad === "ROJO").length,
              oficiosAmarillos: oficios.filter(o => o.criticidad === "AMARILLO").length,
              oficiosVerdes: oficios.filter(o => o.criticidad === "VERDE").length,
              detalle: oficios.map(o => ({
                numeroOficio: o.numeroOficio,
                asunto: o.asunto,
                criticidad: o.criticidad,
                fechaLimite: o.fechaLimite,
                totalDestinatarios: o.destinatarios.length,
                acusesRecibidos: o.destinatarios.filter(d => d.acuseRecibido).length
              }))
            },
            filasRetornadas: oficios.length
          };
        }
        break;
      }

      case "consultarResumen911": {
        const { tipoCorte } = args || {};

        if (context.role === "director") {
          const registros = await prisma.estadistica911Registro.findMany({
            where: {
              tenantId: context.tenantId,
              escuelaId: context.escuelaId || context.userId,
              ...(tipoCorte ? { tipoCorte } : {})
            },
            orderBy: { createdAt: "desc" }
          });

          result = {
            toolName,
            autorizada: true,
            data: registros.map(r => ({
              tipoCorte: r.tipoCorte,
              totalAlumnos: r.totalAlumnos,
              hombres: r.totalHombres,
              mujeres: r.totalMujeres,
              totalGrupos: r.totalGrupos,
              totalDocentes: r.totalDocentes,
              estadoValidacion: r.estado
            })),
            filasRetornadas: registros.length
          };
        } else {
          // Vista Zonal
          const registrosZonales = await prisma.estadistica911Registro.findMany({
            where: {
              tenantId: context.tenantId,
              ...(tipoCorte ? { tipoCorte } : {})
            },
            include: {
              escuela: { select: { nombre: true, cct: true } }
            }
          });

          const totalAlumnos = registrosZonales.reduce((acc, r) => acc + r.totalAlumnos, 0);
          const totalDocentes = registrosZonales.reduce((acc, r) => acc + r.totalDocentes, 0);

          result = {
            toolName,
            autorizada: true,
            data: {
              totalPlantelesReportados: registrosZonales.length,
              matriculaTotalZona: totalAlumnos,
              docentesTotalZona: totalDocentes,
              validados: registrosZonales.filter(r => r.estado === "VALIDADO").length,
              conInconsistencias: registrosZonales.filter(r => r.estado === "CON_INCONSISTENCIAS").length,
              pendientes: registrosZonales.filter(r => r.estado === "PENDIENTE").length
            },
            filasRetornadas: registrosZonales.length
          };
        }
        break;
      }

      case "consultarSesionesCTE": {
        const { fase, numero } = args || {};
        const sesiones = await prisma.cteSesionConfig.findMany({
          where: {
            tenantId: context.tenantId,
            activo: true,
            ...(fase ? { fase: fase as TipoFaseCte } : {}),
            ...(numero ? { numero: Number(numero) } : {})
          },
          orderBy: { numero: "asc" }
        });

        result = {
          toolName,
          autorizada: true,
          data: sesiones.map(s => ({
            numeroSesion: s.numero,
            fase: s.fase,
            descripcion: s.descripcion,
            fechaSesion: s.fechaSesion,
            fechaLimiteProducto: s.fechaLimite,
            guiaUrl: s.guiaUrl
          })),
          filasRetornadas: sesiones.length
        };
        break;
      }

      case "consultarConvocatoriasUsicamm": {
        const { tipo } = args || {};
        const convocatorias = await prisma.convocatoriaUsicamm.findMany({
          where: {
            tenantId: context.tenantId,
            activo: true,
            ...(tipo ? { tipo: { contains: tipo, mode: "insensitive" } } : {})
          },
          orderBy: { fechaPublicacion: "desc" }
        });

        result = {
          toolName,
          autorizada: true,
          data: convocatorias.map(c => ({
            titulo: c.titulo,
            tipo: c.tipo,
            descripcion: c.descripcion,
            fechaPublicacion: c.fechaPublicacion,
            fechaVigencia: c.fechaVigencia,
            enlaceOficial: c.convocatoriaUrl
          })),
          filasRetornadas: convocatorias.length
        };
        break;
      }

      case "consultarNormativasSEP": {
        const { query } = args || {};
        if (!query || typeof query !== "string") {
          result = {
            toolName,
            autorizada: true,
            mensaje: "Se requiere un término de búsqueda para consultar las normativas.",
            filasRetornadas: 0
          };
          break;
        }

        const respuestaRAG = await responderConsultaNormativa(
          query,
          context.escuelaId
        );

        result = {
          toolName,
          autorizada: true,
          data: {
            respuesta: respuestaRAG.respuesta,
            fuentes: respuestaRAG.fuentes,
            huboFuentes: respuestaRAG.huboFuentes
          },
          filasRetornadas: respuestaRAG.fuentes.length
        };
        break;
      }

      case "redactarBorradorOficio": {
        const { asunto, destinatario, fundamentoLegal, instruccionesClave, fechaLimite } = args || {};

        if (!asunto || !destinatario) {
          result = {
            toolName,
            autorizada: false,
            mensaje: "Se requiere especificar 'asunto' y 'destinatario' para redactar el borrador.",
            filasRetornadas: 0
          };
          break;
        }

        const fechaHoy = new Date().toLocaleDateString("es-MX", {
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        const puntosTexto = Array.isArray(instruccionesClave) && instruccionesClave.length > 0
          ? instruccionesClave.map((p: string, idx: number) => `   ${idx + 1}. ${p}`).join("\n")
          : "   1. Dar cabal cumplimiento a las disposiciones administrativas y técnico-pedagógicas vigentes.\n   2. Remitir las evidencias correspondientes a través de la plataforma digital SISAT-ATP.";

        const inst = await getInstitucion(context.tenantId);
        const nombreSupervision = (inst.nombreSupervision || "SUPERVISIÓN ESCOLAR").toUpperCase();
        const zona = inst.zona;
        const municipio = inst.municipio;
        const entidad = (inst.entidad || "").toUpperCase();
        const numOficioBase = (inst.numeroOficioBase || `SEP-A/ZONA${zona}/`).replace(/\/$/, "");

        const fundamento = fundamentoLegal 
          ? `Con fundamento en ${fundamentoLegal}, así como en las directrices de la Nueva Escuela Mexicana y la normativa de la Secretaría de Educación Pública del Estado de ${inst.entidad || entidad}:`
          : `Con fundamento en la Ley General de Educación, los lineamientos pedagógicos de la Nueva Escuela Mexicana y las disposiciones oficiales de la Secretaría de Educación Pública del Estado de ${inst.entidad || entidad}:`;

        const borrador = `GOBIERNO DEL ESTADO DE ${entidad}
SECRETARÍA DE EDUCACIÓN PÚBLICA
DIRECCIÓN DE EDUCACIÓN SECUNDARIA
${nombreSupervision}

OFICIO No. ${numOficioBase}/${new Date().getFullYear()}/[NUM_FOLIO]
ASUNTO: ${asunto.toUpperCase()}
${municipio}, ${entidad}, a ${fechaHoy}.

PARA: ${destinatario.toUpperCase()}
PRESENTE.

${fundamento}

Por medio del presente conducto, me dirijo a usted de la manera más atenta y respetuosa para instruir y coordinar lo siguiente:

${puntosTexto}

${fechaLimite ? `Se establece como FECHA LÍMITE IMPRORROGABLE para la atención o entrega respectiva el día: **${fechaLimite}**.\n\n` : ""}Sin otro particular por el momento, agradezco de antemano su valiosa colaboración en beneficio de la comunidad escolar de nuestra zona, reiterándole la seguridad de mi más atenta y distinguida consideración.

ATENTAMENTE
"SUFRAGIO EFECTIVO. NO REELECCIÓN"

___________________________________________________
${nombreSupervision}
${inst.supervisor ? inst.supervisor.toUpperCase() : "SUPERVISIÓN ESCOLAR / DIRECCIÓN ESCOLAR"}`;

        result = {
          toolName,
          autorizada: true,
          data: {
            asunto,
            destinatario,
            borradorOficio: borrador,
            fechaGeneracion: fechaHoy
          },
          filasRetornadas: 1
        };
        break;
      }

      case "validarCoherenciaEstadistica911": {
        const { tipoCorte } = args || {};

        const registros = await prisma.estadistica911Registro.findMany({
          where: {
            tenantId: context.tenantId,
            ...(context.role === "director" ? { escuelaId: context.escuelaId || context.userId } : {}),
            ...(tipoCorte ? { tipoCorte } : {})
          },
          include: {
            escuela: { select: { nombre: true, cct: true } }
          },
          orderBy: { createdAt: "desc" }
        });

        const observaciones: string[] = [];
        let discrepanciasDetectadas = 0;

        const detalles = registros.map(r => {
          const plantel = r.escuela?.nombre || `Plantel ${r.escuelaId}`;
          const obsPlantel: string[] = [];

          // 1. Verificación Hombres + Mujeres = Total Alumnos
          const sumaGeneros = r.totalHombres + r.totalMujeres;
          if (sumaGeneros !== r.totalAlumnos) {
            obsPlantel.push(`Descuadre de género: Hombres (${r.totalHombres}) + Mujeres (${r.totalMujeres}) = ${sumaGeneros} != Total Alumnos (${r.totalAlumnos})`);
            discrepanciasDetectadas++;
          }

          // 2. Relación de Alumnos por Grupo
          const ratioGrupo = r.totalGrupos > 0 ? (r.totalAlumnos / r.totalGrupos) : 0;
          if (r.totalGrupos > 0 && (ratioGrupo < 15 || ratioGrupo > 40)) {
            obsPlantel.push(`Promedio alumnos/grupo atípico: ${ratioGrupo.toFixed(1)} alumnos por grupo (referencia normativa: 15-35)`);
          }

          // 3. Verificación de Docentes vs Alumnos
          if (r.totalAlumnos > 0 && r.totalDocentes === 0) {
            obsPlantel.push("Alumnos registrados sin plantilla docente reportada (0 docentes)");
            discrepanciasDetectadas++;
          }

          if (r.estado === "CON_INCONSISTENCIAS") {
            obsPlantel.push(`Estado oficial registrado como: CON_INCONSISTENCIAS`);
            discrepanciasDetectadas++;
          }

          return {
            plantel,
            cct: r.escuela?.cct || "N/A",
            tipoCorte: r.tipoCorte,
            totalAlumnos: r.totalAlumnos,
            hombres: r.totalHombres,
            mujeres: r.totalMujeres,
            totalGrupos: r.totalGrupos,
            totalDocentes: r.totalDocentes,
            promedioPorGrupo: ratioGrupo.toFixed(1),
            estado: r.estado,
            observaciones: obsPlantel
          };
        });

        const esCoherente = discrepanciasDetectadas === 0;
        if (!esCoherente) {
          observaciones.push(`Se detectaron ${discrepanciasDetectadas} inconsistencias aritméticas o de plantilla en los registros analizados.`);
        } else {
          observaciones.push(`Todos los registros estadísticos 911 analizados (${registros.length}) presentan coherencia aritmética (H+M = Total) y plantilla congruente.`);
        }

        result = {
          toolName,
          autorizada: true,
          data: {
            esCoherente,
            totalRegistrosAuditados: registros.length,
            discrepanciasDetectadas,
            observaciones,
            detalles
          },
          filasRetornadas: registros.length
        };
        break;
      }

      case "orientarConvocatoriaUsicamm": {
        const { proceso } = args || {};

        const convocatorias = await prisma.convocatoriaUsicamm.findMany({
          where: {
            tenantId: context.tenantId,
            activo: true,
            ...(proceso ? {
              OR: [
                { tipo: { contains: proceso, mode: "insensitive" } },
                { titulo: { contains: proceso, mode: "insensitive" } },
                { descripcion: { contains: proceso, mode: "insensitive" } }
              ]
            } : {})
          },
          orderBy: { fechaPublicacion: "desc" }
        });

        const requisitosComunes = [
          "Nombramiento definitivo (código 10 o equivalente) en la plaza correspondiente.",
          "Título o cédula profesional de nivel licenciatura afín al área pedagógica o asignatura.",
          "Mínimo 2 años de servicio ininterrumpido en la misma función (docente, directivo, ATP).",
          "Cuenta activa en el portal Proyecto Venus (plataforma oficial USICAMM).",
          "Constancias de actualización docente emitidas por catálogo oficial con validez oficial."
        ];

        result = {
          toolName,
          autorizada: true,
          data: {
            procesoConsultado: proceso || "TODOS",
            convocatoriasVigentesEncontradas: convocatorias.length,
            convocatorias: convocatorias.map(c => ({
              titulo: c.titulo,
              tipo: c.tipo,
              fechaPublicacion: c.fechaPublicacion,
              fechaVigencia: c.fechaVigencia,
              enlaceOficial: c.convocatoriaUrl
            })),
            requisitosGeneralesMarcoNEM: requisitosComunes,
            recomendacionPlataforma: "Acceder con CURP y contraseña a la Ventanilla Única de Servicios (Proyecto Venus) para generación de cita para revisión documental."
          },
          filasRetornadas: convocatorias.length
        };
        break;
      }

      default:
        result = {
          toolName,
          autorizada: false,
          mensaje: `Herramienta desconocida: "${toolName}". No está en la lista de funciones permitidas.`,
          filasRetornadas: 0
        };
    }
  } catch (err: any) {
    console.error(`[agentic-tools] Error ejecutando ${toolName}:`, err);
    result = {
      toolName,
      autorizada: false,
      mensaje: `Error interno al ejecutar la consulta: ${err.message}`,
      filasRetornadas: 0
    };
  }

  const durationMs = Date.now() - startTime;
  await registrarAuditoria(context, mensajeUsuario, toolName, args, result, durationMs);
  return result;
}

/**
 * Registra cada llamada a tool en la tabla ChatAuditoriaLog de PostgreSQL.
 */
async function registrarAuditoria(
  context: AgentSessionContext,
  mensajeUsuario: string,
  herramientaUsada: string,
  parametrosJson: any,
  resultado: ToolExecutionResult,
  duracionMs: number,
  errorMensaje?: string
) {
  try {
    await prisma.chatAuditoriaLog.create({
      data: {
        tenantId: context.tenantId!,
        usuarioId: context.userId,
        usuarioEmail: context.userEmail || null,
        rolUsuario: context.role,
        escuelaId: context.escuelaId || null,
        mensajeUsuario: mensajeUsuario.substring(0, 1000),
        herramientaUsada,
        parametrosJson: parametrosJson || null,
        filasRetornadas: resultado.filasRetornadas,
        duracionMs,
        exitoso: resultado.autorizada && !errorMensaje,
        errorMensaje: errorMensaje || (!resultado.autorizada ? resultado.mensaje : null)
      }
    });
  } catch (auditErr) {
    console.error("[agentic-tools] Error al registrar log de auditoría:", auditErr);
  }
}
