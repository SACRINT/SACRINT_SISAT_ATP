import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/cte/compromisos/[id]
 * Actualiza estado, prioridad, notas de seguimiento o fecha límite de un compromiso.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = (user.role || "director") as "admin" | "supervision" | "director";
    if (userRole === "director") {
      return NextResponse.json(
        { error: "No tiene permisos para modificar compromisos de CTE" },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const compromisoExistente = await prisma.cteCompromisoZonal.findUnique({
      where: { id },
    });

    if (!compromisoExistente || compromisoExistente.tenantId !== tenantId) {
      return NextResponse.json({ error: "Compromiso no encontrado" }, { status: 404 });
    }

    const dataToUpdate: any = {};

    if (typeof body.resuelto === "boolean") {
      dataToUpdate.resuelto = body.resuelto;
      dataToUpdate.estado = body.resuelto ? "RESUELTO" : (compromisoExistente.estado === "RESUELTO" ? "EN_PROCESO" : compromisoExistente.estado);
    }

    if (body.estado && ["PENDIENTE", "EN_PROCESO", "RESUELTO"].includes(body.estado)) {
      dataToUpdate.estado = body.estado;
      dataToUpdate.resuelto = body.estado === "RESUELTO";
    }

    if (body.texto && typeof body.texto === "string") {
      dataToUpdate.texto = body.texto.trim();
    }

    if (body.categoria) {
      dataToUpdate.categoria = String(body.categoria);
    }

    if (body.prioridad !== undefined) {
      dataToUpdate.prioridad = Number(body.prioridad) || 1;
    }

    if (body.fechaLimite !== undefined) {
      dataToUpdate.fechaLimite = body.fechaLimite ? new Date(body.fechaLimite) : null;
    }

    if (body.escuelasIds !== undefined) {
      dataToUpdate.escuelasIds = Array.isArray(body.escuelasIds) ? body.escuelasIds : Prisma.JsonNull;
    }

    if (body.notasSeguimiento !== undefined) {
      dataToUpdate.notasSeguimiento = body.notasSeguimiento ? String(body.notasSeguimiento).trim() : null;
    }

    const compromisoActualizado = await prisma.cteCompromisoZonal.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      compromiso: compromisoActualizado,
    });
  } catch (error: any) {
    console.error("[api/admin/cte/compromisos/[id]] Error PATCH:", error);
    return NextResponse.json(
      { error: error?.message || "Error al actualizar compromiso" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cte/compromisos/[id]
 * Elimina un compromiso zonal de CTE.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = (user.role || "director") as "admin" | "supervision" | "director";
    if (userRole === "director") {
      return NextResponse.json(
        { error: "No tiene permisos para eliminar compromisos de CTE" },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const { id } = await context.params;

    const compromisoExistente = await prisma.cteCompromisoZonal.findUnique({
      where: { id },
    });

    if (!compromisoExistente || compromisoExistente.tenantId !== tenantId) {
      return NextResponse.json({ error: "Compromiso no encontrado" }, { status: 404 });
    }

    await prisma.cteCompromisoZonal.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Compromiso eliminado correctamente",
    });
  } catch (error: any) {
    console.error("[api/admin/cte/compromisos/[id]] Error DELETE:", error);
    return NextResponse.json(
      { error: error?.message || "Error al eliminar compromiso" },
      { status: 500 }
    );
  }
}
