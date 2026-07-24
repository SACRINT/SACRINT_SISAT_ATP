import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { procesarComandoIA } from "@/lib/horarios/ai-assistant";
import { resolverHorario } from "@/lib/horarios/solver";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { horarioId, mensaje } = body;

    if (!horarioId || !mensaje) {
      return NextResponse.json({ error: "horarioId y mensaje son requeridos" }, { status: 400 });
    }

    // 1. Cargar horario actual y sus relaciones completas
    const horario = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId },
      include: {
        escuela: true,
        celdas: {
          include: {
            grupo: true,
            docente: true,
            asignatura: true,
            aula: true
          }
        }
      }
    });

    if (!horario) {
      return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
    }

    const escuelaId = horario.escuelaId;

    // Cargar datos de la escuela y cargas actuales
    const config = await prisma.horarioConfiguracion.findUnique({ where: { escuelaId } });
    const grupos = await prisma.horarioGrupo.findMany({ where: { escuelaId } });
    const docentes = await prisma.personal.findMany({ where: { escuelaId } });
    const materias = await prisma.horarioAsignaturaCatalogo.findMany({
      where: { OR: [{ escuelaId: null }, { escuelaId }] }
    });
    const cargas = await prisma.horarioCargaDocente.findMany({ where: { escuelaId } });

    // Calcular horas asignadas reales a cada docente para la validación de factibilidad
    const docentesConHoras = docentes.map((d) => {
      const hrsAsignadas = horario.celdas
        .filter((c) => c.docenteId === d.id)
        .length; // cada celda es 1 hora lectiva
      return {
        id: d.id,
        nombreCompleto: `${d.nombre} ${d.apellidoPaterno}`.trim(),
        horasAsignadas: hrsAsignadas
      };
    });

    // 2. Procesar comando con Gemini AI Assistant (incluyendo validación matemática de factibilidad)
    const respuestaIA = await procesarComandoIA(
      mensaje,
      {
        nombreEscuela: horario.escuela.nombre,
        horasPorDia: config?.horasPorDia || 6,
        diasLectivos: config?.diasLectivos || 5,
        grupos: grupos.map(g => ({ id: g.id, nombre: g.nombre })),
        docentes: docentesConHoras,
        materias: materias.map(m => ({ id: m.id, nombre: m.uacName })),
        celdasActuales: horario.celdas
      },
      escuelaId
    );

    // 3. Guardar mensaje del usuario
    await prisma.horarioChatMensaje.create({
      data: {
        horarioId,
        role: "user",
        content: mensaje
      }
    });

    // 4. Si la petición NO es factible, responder de inmediato con la explicación matemática
    if (!respuestaIA.factible) {
      await prisma.horarioChatMensaje.create({
        data: {
          horarioId,
          role: "assistant",
          content: respuestaIA.explicacion,
          accionAplicada: (respuestaIA.acciones as any) || undefined
        }
      });

      const horarioActualizado = await prisma.horarioGenerado.findUnique({
        where: { id: horarioId },
        include: {
          celdas: {
            include: {
              grupo: true,
              docente: true,
              asignatura: true,
              aula: true
            }
          },
          mensajesChat: {
            orderBy: { createdAt: "asc" }
          }
        }
      });

      return NextResponse.json({
        success: true,
        respuestaIA,
        horario: horarioActualizado
      });
    }

    // 5. Si es factible y requiere re-optimización mediante Solver
    let huboReGeneracion = false;

    if (respuestaIA.acciones && respuestaIA.acciones.length > 0) {
      for (const accion of respuestaIA.acciones) {
        if (accion.tipo === "REGENERAR_CON_RESTRICCIONES" && accion.bloqueosDocentes) {
          // Extraer las celdas fijadas/bloqueadas por el usuario (esBloqueado === true)
          const celdasFijasExistentes = horario.celdas
            .filter((c) => c.esBloqueado)
            .map((c) => ({
              diaSemana: c.diaSemana,
              periodo: c.periodo,
              grupoId: c.grupoId,
              docenteId: c.docenteId,
              asignaturaId: c.asignaturaId,
              aulaId: c.aulaId || undefined
            }));

          // Re-ejecutar el Motor Solver con las restricciones y celdas fijas bloqueadas por el usuario
          const resultadoSolver = resolverHorario({
            diasLectivos: config?.diasLectivos || 5,
            horasPorDia: config?.horasPorDia || 6,
            grupos: grupos.map(g => ({ id: g.id, nombre: g.nombre, semestre: g.semestre })),
            docentes: docentes.map(d => ({ id: d.id, nombreCompleto: `${d.nombre} ${d.apellidoPaterno}`.trim() })),
            aulas: [],
            cargas: cargas.map(c => ({
              id: c.id,
              docenteId: c.personalId,
              grupoId: c.grupoId,
              asignaturaId: c.asignaturaId,
              horasSemanales: c.horasSemanales,
              requiereAulaEspecial: c.requiereAulaEspecial
            })),
            celdasFijas: celdasFijasExistentes,
            restriccionesDocentes: accion.bloqueosDocentes
          });

          if (resultadoSolver.celdas && resultadoSolver.celdas.length > 0) {
            // Eliminar celdas anteriores del horario generado
            await prisma.horarioCelda.deleteMany({
              where: { horarioId }
            });

            // Re-insertar celdas re-optimizadas sin empalmes
            await prisma.horarioCelda.createMany({
              data: resultadoSolver.celdas.map(c => ({
                horarioId,
                diaSemana: c.diaSemana,
                periodo: c.periodo,
                grupoId: c.grupoId,
                docenteId: c.docenteId,
                asignaturaId: c.asignaturaId,
                aulaId: c.aulaId || null,
                cargaId: c.cargaId || null,
                esBloqueado: !!c.esBloqueado
              }))
            });

            huboReGeneracion = true;
          }
        }
      }
    }

    // 6. Guardar respuesta del asistente
    await prisma.horarioChatMensaje.create({
      data: {
        horarioId,
        role: "assistant",
        content: respuestaIA.explicacion,
        accionAplicada: (respuestaIA.acciones as any) || undefined
      }
    });

    // 7. Retornar el horario completamente actualizado en tiempo real
    const horarioActualizado = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId },
      include: {
        celdas: {
          include: {
            grupo: true,
            docente: true,
            asignatura: true,
            aula: true
          }
        },
        mensajesChat: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return NextResponse.json({
      success: true,
      respuestaIA,
      horario: horarioActualizado
    });
  } catch (error: any) {
    console.error("[api/horarios/chat] Error en POST:", error);
    return NextResponse.json({ error: "Error al procesar mensaje en el chat IA" }, { status: 500 });
  }
}
