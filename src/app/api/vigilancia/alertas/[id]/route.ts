import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/vigilancia/alertas/[id]
 * Actualiza el estado de una alerta (marcar como leída o archivar).
 * Directores solo pueden modificar alertas de su escuela o zonales generales.
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
    const tenantId = user.tenantId || user.organizacionId;

    if (!tenantId) {
      return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const { id } = await context.params;

    // Verificar existencia y aislamiento por tenant
    const alertaExistente = await prisma.alertaProactiva.findUnique({
      where: { id },
    });

    if (!alertaExistente || alertaExistente.tenantId !== tenantId) {
      return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
    }

    // Verificación de pertenencia: director solo sobre alertas de su escuela o generales
    if (userRole === "director") {
      if (alertaExistente.escuelaId !== null && alertaExistente.escuelaId !== user.id) {
        return NextResponse.json(
          { error: "No tiene permisos para modificar esta alerta" },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const { leida, archivada } = body;

    const dataToUpdate: any = {};
    if (typeof leida === "boolean") {
      dataToUpdate.leida = leida;
      dataToUpdate.fechaLeida = leida ? new Date() : null;
    }
    if (typeof archivada === "boolean") {
      dataToUpdate.archivada = archivada;
    }

    const alerta = await prisma.alertaProactiva.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      alerta,
    });
  } catch (error: any) {
    console.error("[api/vigilancia/alertas/[id]] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al actualizar alerta" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vigilancia/alertas/[id]
 * Archiva la alerta para que no aparezca en la lista activa.
 * Directores solo pueden archivar alertas de su escuela o zonales generales.
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
    const tenantId = user.tenantId || user.organizacionId;

    if (!tenantId) {
      return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const { id } = await context.params;

    // Verificar existencia y aislamiento por tenant
    const alertaExistente = await prisma.alertaProactiva.findUnique({
      where: { id },
    });

    if (!alertaExistente || alertaExistente.tenantId !== tenantId) {
      return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
    }

    // Verificación de pertenencia: director solo sobre alertas de su escuela o generales
    if (userRole === "director") {
      if (alertaExistente.escuelaId !== null && alertaExistente.escuelaId !== user.id) {
        return NextResponse.json(
          { error: "No tiene permisos para archivar esta alerta" },
          { status: 403 }
        );
      }
    }

    const alerta = await prisma.alertaProactiva.update({
      where: { id },
      data: { archivada: true },
    });

    return NextResponse.json({
      success: true,
      alerta,
    });
  } catch (error: any) {
    console.error("[api/vigilancia/alertas/[id]] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al archivar alerta" },
      { status: 500 }
    );
  }
}
