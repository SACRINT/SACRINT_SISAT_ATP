import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/cte/[id]
 * Actualiza la información de una sesión de CAPEMS y permite al admin confirmar/editar temas y acuerdos sugeridos por la IA.
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
        { error: "No tiene permisos para modificar la configuración de sesiones CAPEMS" },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID || "zona004";
    const { id } = await context.params;

    const sesionExistente = await prisma.cteSesionConfig.findUnique({
      where: { id },
    });

    if (!sesionExistente || sesionExistente.tenantId !== tenantId) {
      return NextResponse.json({ error: "Sesión de CAPEMS no encontrada" }, { status: 404 });
    }

    const body = await req.json();
    const dataToUpdate: any = {};

    if (body.descripcion !== undefined) {
      dataToUpdate.descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    }

    if (body.fechaSesion !== undefined) {
      dataToUpdate.fechaSesion = body.fechaSesion ? new Date(body.fechaSesion) : null;
    }

    if (body.fechaLimite !== undefined) {
      dataToUpdate.fechaLimite = body.fechaLimite ? new Date(body.fechaLimite) : null;
    }

    if (body.guiaUrl !== undefined) {
      dataToUpdate.guiaUrl = body.guiaUrl ? String(body.guiaUrl).trim() : null;
    }

    if (typeof body.activo === "boolean") {
      dataToUpdate.activo = body.activo;
    }

    if (body.temasIA !== undefined) {
      if (Array.isArray(body.temasIA)) {
        dataToUpdate.temasIA = body.temasIA;
      } else if (body.temasIA === null) {
        dataToUpdate.temasIA = [];
      }
    }

    if (body.acuerdosSugeridosIA !== undefined) {
      if (Array.isArray(body.acuerdosSugeridosIA)) {
        dataToUpdate.acuerdosSugeridosIA = body.acuerdosSugeridosIA;
      } else if (body.acuerdosSugeridosIA === null) {
        dataToUpdate.acuerdosSugeridosIA = [];
      }
    }

    const sesionActualizada = await prisma.cteSesionConfig.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      sesion: sesionActualizada,
    });
  } catch (error: any) {
    console.error("[api/admin/cte/[id]] Error PATCH:", error);
    return NextResponse.json(
      { error: error?.message || "Error al actualizar sesión CAPEMS" },
      { status: 500 }
    );
  }
}
