import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(req.url);
    const escuelaId = searchParams.get("escuelaId") || user.escuelaId || user.id;

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // Configuración de la escuela
    let config = await prisma.horarioConfiguracion.findUnique({
      where: { escuelaId }
    });

    if (!config) {
      config = await prisma.horarioConfiguracion.create({
        data: {
          escuelaId,
          diasLectivos: 5,
          horasPorDia: 6,
          horaInicio: "08:00",
          duracionMinutos: 50,
          recesoTrasPeriodo: 3,
          duracionReceso: 20
        }
      });
    }

    // Grupos
    const grupos = await prisma.horarioGrupo.findMany({
      where: { escuelaId },
      orderBy: { nombre: "asc" }
    });

    // Aulas
    const aulas = await prisma.horarioAula.findMany({
      where: { escuelaId },
      orderBy: { nombre: "asc" }
    });

    // Todo el personal de la escuela (Docentes, Responsables, Administrativos, Apoyo)
    const docentes = await prisma.personal.findMany({
      where: { escuelaId },
      orderBy: [{ apellidoPaterno: "asc" }, { nombre: "asc" }]
    });

    // Cargas docentes asignadas
    const cargas = await prisma.horarioCargaDocente.findMany({
      where: { escuelaId },
      include: {
        personal: true,
        grupo: true,
        asignatura: true
      }
    });

    // Cargar último horario generado si existe
    const ultimoHorario = await prisma.horarioGenerado.findFirst({
      where: { escuelaId },
      orderBy: { createdAt: "desc" },
      include: {
        celdas: {
          include: {
            grupo: true,
            docente: true,
            aula: true
          }
        },
        mensajesChat: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return NextResponse.json({
      config,
      grupos,
      aulas,
      docentes,
      cargas,
      horario: ultimoHorario
    });
  } catch (error: any) {
    console.error("[api/horarios/configuracion] Error en GET:", error);
    return NextResponse.json({ error: "Error al cargar configuración de horario" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { escuelaId: reqEscuelaId, config, grupos, aulas, cargas } = body;
    const escuelaId = reqEscuelaId || user.escuelaId || user.id;

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // 1. Guardar Configuración General
    if (config) {
      await prisma.horarioConfiguracion.upsert({
        where: { escuelaId },
        update: {
          diasLectivos: Number(config.diasLectivos) || 5,
          horasPorDia: Number(config.horasPorDia) || 6,
          horaInicio: config.horaInicio || "08:00",
          duracionMinutos: Number(config.duracionMinutos) || 50,
          recesoTrasPeriodo: Number(config.recesoTrasPeriodo) || 3,
          duracionReceso: Number(config.duracionReceso) || 20
        },
        create: {
          escuelaId,
          diasLectivos: Number(config.diasLectivos) || 5,
          horasPorDia: Number(config.horasPorDia) || 6,
          horaInicio: config.horaInicio || "08:00",
          duracionMinutos: Number(config.duracionMinutos) || 50,
          recesoTrasPeriodo: Number(config.recesoTrasPeriodo) || 3,
          duracionReceso: Number(config.duracionReceso) || 20
        }
      });
    }

    // Mapa para asociar IDs temporales o nombres con IDs reales de DB
    const mapaGrupoIds: Record<string, string> = {};

    // 2. Guardar/Sincronizar Grupos usando la restricción única (escuelaId, nombre)
    if (Array.isArray(grupos)) {
      for (const g of grupos) {
        const grupoDB = await prisma.horarioGrupo.upsert({
          where: {
            escuelaId_nombre: {
              escuelaId,
              nombre: g.nombre
            }
          },
          update: {
            semestre: Number(g.semestre),
            capacitacionNombre: g.capacitacionNombre || null,
            ffeOptativas: g.ffeOptativas || null,
            ffeoSocioemocional: g.ffeoSocioemocional || null
          },
          create: {
            escuelaId,
            nombre: g.nombre,
            semestre: Number(g.semestre),
            capacitacionNombre: g.capacitacionNombre || null,
            ffeOptativas: g.ffeOptativas || null,
            ffeoSocioemocional: g.ffeoSocioemocional || null
          }
        });

        if (g.id) mapaGrupoIds[g.id] = grupoDB.id;
        mapaGrupoIds[g.nombre] = grupoDB.id;
      }
    }

    // 3. Guardar/Sincronizar Aulas
    if (Array.isArray(aulas)) {
      for (const a of aulas) {
        if (a.id && !a.id.startsWith("temp_")) {
          await prisma.horarioAula.upsert({
            where: { id: a.id },
            update: { nombre: a.nombre, tipo: a.tipo || "REGULAR" },
            create: { escuelaId, nombre: a.nombre, tipo: a.tipo || "REGULAR" }
          });
        } else {
          await prisma.horarioAula.create({
            data: { escuelaId, nombre: a.nombre, tipo: a.tipo || "REGULAR" }
          });
        }
      }
    }

    // 4. Guardar Cargas Docentes
    if (Array.isArray(cargas)) {
      // Limpiar cargas anteriores de esta escuela para recrear la estructura limpia
      await prisma.horarioCargaDocente.deleteMany({
        where: { escuelaId }
      });

      for (const c of cargas) {
        if (c.personalId && c.grupoId) {
          const grupoRealId = mapaGrupoIds[c.grupoId] || c.grupoId;

          const grupoExiste = await prisma.horarioGrupo.findUnique({
            where: { id: grupoRealId }
          });

          if (!grupoExiste) {
            console.warn(`[api/horarios/configuracion] Grupo ID ${grupoRealId} no existe, omitiendo.`);
            continue;
          }

          // Resolver o crear Asignatura UAC en HorarioAsignaturaCatalogo
          let asignaturaId = c.asignaturaId;
          const uacNombreBusqueda = c.uacName || c.asignaturaNombre || "Asignatura UAC";

          let asignaturaDB = await prisma.horarioAsignaturaCatalogo.findFirst({
            where: {
              OR: [
                { id: asignaturaId },
                { uacName: { equals: uacNombreBusqueda, mode: "insensitive" } }
              ]
            }
          });

          if (!asignaturaDB) {
            asignaturaDB = await prisma.horarioAsignaturaCatalogo.create({
              data: {
                escuelaId: null,
                uacName: uacNombreBusqueda,
                semester: c.semestre || 1,
                component: c.tipo || "fundamental",
                horasSemanales: Number(c.horasSemanales) || 3
              }
            });
          }

          await prisma.horarioCargaDocente.create({
            data: {
              escuelaId,
              personalId: c.personalId,
              grupoId: grupoRealId,
              asignaturaId: asignaturaDB.id,
              horasSemanales: Number(c.horasSemanales) || 3,
              requiereAulaEspecial: !!c.requiereAulaEspecial,
              aulaEspecialId: c.aulaEspecialId || null
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Configuración guardada correctamente" });
  } catch (error: any) {
    console.error("[api/horarios/configuracion] Error en POST:", error);
    return NextResponse.json({ error: "Error al guardar configuración de horario" }, { status: 500 });
  }
}
