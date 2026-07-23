import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { procesarComandoIA } from "@/lib/horarios/ai-assistant";

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

    // 1. Cargar horario actual y sus relaciones
    const horario = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId },
      include: {
        escuela: true,
        celdas: {
          include: {
            grupo: true,
            docente: true
          }
        }
      }
    });

    if (!horario) {
      return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
    }

    // Cargar listas de catálogo para dar contexto a la IA
    const grupos = await prisma.horarioGrupo.findMany({ where: { escuelaId: horario.escuelaId } });
    const docentes = await prisma.personal.findMany({ where: { escuelaId: horario.escuelaId } });
    const materias = await prisma.horarioAsignaturaCatalogo.findMany({
      where: { OR: [{ escuelaId: null }, { escuelaId: horario.escuelaId }] }
    });

    // 2. Procesar comando con Gemini AI Assistant
    const respuestaIA = await procesarComandoIA(
      mensaje,
      {
        nombreEscuela: horario.escuela.nombre,
        grupos: grupos.map(g => ({ id: g.id, nombre: g.nombre })),
        docentes: docentes.map(d => ({ id: d.id, nombreCompleto: `${d.nombre} ${d.apellidoPaterno}` })),
        materias: materias.map(m => ({ id: m.id, nombre: m.uacName })),
        celdasActuales: horario.celdas.map(c => ({
          diaSemana: c.diaSemana,
          periodo: c.periodo,
          grupoId: c.grupoId,
          docenteId: c.docenteId,
          asignaturaId: c.asignaturaId
        }))
      },
      horario.escuelaId
    );

    // 3. Guardar mensaje del usuario
    await prisma.horarioChatMensaje.create({
      data: {
        horarioId,
        role: "user",
        content: mensaje
      }
    });

    // 4. Aplicar acciones a las celdas si existen
    if (respuestaIA.acciones && respuestaIA.acciones.length > 0) {
      for (const accion of respuestaIA.acciones) {
        if (accion.tipo === "MOVER_CELDA" && accion.diaOrigen && accion.periodoOrigen && accion.diaDestino && accion.periodoDestino) {
          const celdaOrigen = horario.celdas.find(
            c => c.diaSemana === accion.diaOrigen && c.periodo === accion.periodoOrigen && (accion.grupoId ? c.grupoId === accion.grupoId : true)
          );

          if (celdaOrigen) {
            await prisma.horarioCelda.update({
              where: { id: celdaOrigen.id },
              data: {
                diaSemana: accion.diaDestino,
                periodo: accion.periodoDestino
              }
            });
          }
        }
      }
    }

    // 5. Guardar respuesta del asistente
    const mensajeAsistente = await prisma.horarioChatMensaje.create({
      data: {
        horarioId,
        role: "assistant",
        content: respuestaIA.explicacion,
        accionAplicada: (respuestaIA.acciones as any) || undefined
      }
    });

    // Cargar celdas actualizadas
    const horarioActualizado = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId },
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
      success: true,
      respuestaIA,
      horario: horarioActualizado
    });
  } catch (error: any) {
    console.error("[api/horarios/chat] Error en POST:", error);
    return NextResponse.json({ error: "Error al procesar mensaje en el chat IA" }, { status: 500 });
  }
}
