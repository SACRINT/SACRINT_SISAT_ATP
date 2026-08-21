import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { horarioId, celdas, slotsLibresBloqueados, escuelaId: reqEscuelaId } = body;
    const escuelaId = reqEscuelaId || user.escuelaId || user.id;

    if (!horarioId || !Array.isArray(celdas)) {
      return NextResponse.json({ error: "horarioId y celdas son requeridos." }, { status: 400 });
    }

    // Verificar que el horario existe y pertenece a la escuela
    const horarioExistente = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId }
    });

    if (!horarioExistente) {
      return NextResponse.json({ error: "No se encontró el horario especificado." }, { status: 404 });
    }

    if (user.role !== "admin" && user.role !== "supervision") {
      const userEscuelaId = user.escuelaId || user.id;
      if (horarioExistente.escuelaId !== userEscuelaId) {
        return NextResponse.json({ error: "Acceso denegado a este horario." }, { status: 403 });
      }
    }

    // Actualizar celdas y metadata en la base de datos dentro de una transacción
    await prisma.$transaction(async (tx) => {
      for (const celda of celdas) {
        if (celda.id && !celda.id.startsWith("temp_")) {
          await tx.horarioCelda.update({
            where: { id: celda.id },
            data: {
              diaSemana: Number(celda.diaSemana),
              periodo: Number(celda.periodo),
              esBloqueado: Boolean(celda.esBloqueado)
            }
          });
        }
      }

      const currentScore = (horarioExistente.scoreMetricas as any) || {};
      const updatedScore = {
        ...currentScore,
        slotsLibresBloqueados: Array.isArray(slotsLibresBloqueados) ? slotsLibresBloqueados : currentScore.slotsLibresBloqueados || []
      };

      // Marcar el horario como actualizado y persisitir slots libres bloqueados
      await tx.horarioGenerado.update({
        where: { id: horarioId },
        data: {
          updatedAt: new Date(),
          scoreMetricas: updatedScore
        }
      });
    });

    // Retornar el horario completo actualizado con sus relaciones
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
      message: "Horario guardado permanentemente en la base de datos",
      horario: horarioActualizado
    });
  } catch (error: any) {
    console.error("[api/horarios/guardar] Error en POST:", error);
    return NextResponse.json(
      { error: "Error al guardar los cambios del horario en la base de datos." },
      { status: 500 }
    );
  }
}
