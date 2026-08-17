import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/director/cte/compromisos/[id]/avance
 * Permite a una escuela reportar avance o evidencias sobre un compromiso de CTE.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { notaAvance } = body;

    if (!notaAvance || typeof notaAvance !== "string" || notaAvance.trim().length === 0) {
      return NextResponse.json(
        { error: "La descripción del avance es requerida" },
        { status: 400 }
      );
    }

    const compromiso = await prisma.cteCompromisoZonal.findUnique({
      where: { id },
    });

    if (!compromiso || compromiso.tenantId !== tenantId) {
      return NextResponse.json({ error: "Compromiso no encontrado" }, { status: 404 });
    }

    // Verificar si el compromiso aplica a esta escuela
    if (user.role === "director" && compromiso.escuelasIds) {
      try {
        const ids = Array.isArray(compromiso.escuelasIds) ? (compromiso.escuelasIds as string[]) : [];
        if (ids.length > 0 && !ids.includes(user.id)) {
          return NextResponse.json(
            { error: "Este compromiso no está asignado a su plantel" },
            { status: 403 }
          );
        }
      } catch {
        // En caso de parse error, permitir
      }
    }

    const fechaStr = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const autorStr = user.name || user.cct || "Plantel";
    const nuevaEntrada = `[${fechaStr} - ${autorStr}]: ${notaAvance.trim()}`;
    const notasActualizadas = compromiso.notasSeguimiento
      ? `${compromiso.notasSeguimiento}\n${nuevaEntrada}`
      : nuevaEntrada;

    const compromisoActualizado = await prisma.cteCompromisoZonal.update({
      where: { id },
      data: {
        notasSeguimiento: notasActualizadas,
        estado: compromiso.resuelto ? "RESUELTO" : "EN_PROCESO",
      },
    });

    return NextResponse.json({
      success: true,
      compromiso: compromisoActualizado,
    });
  } catch (error: any) {
    console.error("[api/director/cte/compromisos/[id]/avance] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al registrar avance de compromiso" },
      { status: 500 }
    );
  }
}
