import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { horarioId, celdas } = body;

    if (!horarioId || !Array.isArray(celdas)) {
      return NextResponse.json(
        { error: "horarioId y arreglo de celdas son requeridos" },
        { status: 400 }
      );
    }

    // 1. Verificar existencia del horario
    const horarioExistente = await prisma.horarioGenerado.findUnique({
      where: { id: horarioId }
    });

    if (!horarioExistente) {
      return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
    }

    // 2. Transacción en base de datos: eliminar celdas previas y re-insertar actualizadas
    await prisma.$transaction(async (tx) => {
      // Eliminar celdas anteriores
      await tx.horarioCelda.deleteMany({
        where: { horarioId }
      });

      // Insertar celdas actualizadas (sanitizando campos nulos/undefined)
      if (celdas.length > 0) {
        await tx.horarioCelda.createMany({
          data: celdas.map((c: any) => ({
            horarioId,
            diaSemana: Number(c.diaSemana),
            periodo: Number(c.periodo),
            grupoId: String(c.grupoId),
            docenteId: String(c.docenteId),
            asignaturaId: String(c.asignaturaId),
            aulaId: c.aulaId || null,
            cargaId: c.cargaId || null,
            esBloqueado: Boolean(c.esBloqueado)
          }))
        });
      }

      // Actualizar fecha de modificación del horario generado
      await tx.horarioGenerado.update({
        where: { id: horarioId },
        data: { updatedAt: new Date() }
      });
    });

    // 3. Cargar el horario completo con relaciones actualizadas
    const horarioActualizado = await prisma.horarioGenerado.findUnique({
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
        },
        mensajesChat: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    return NextResponse.json({
      success: true,
      horario: horarioActualizado,
      message: "Horario guardado correctamente en la base de datos"
    });
  } catch (error: any) {
    console.error("Error al guardar horario manual:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno al guardar los cambios del horario" },
      { status: 500 }
    );
  }
}
