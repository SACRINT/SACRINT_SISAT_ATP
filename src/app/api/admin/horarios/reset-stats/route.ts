import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// ─── PATCH: Reiniciar contadores de uso de Horarios IA (solo ADMIN) ───
// El director NO puede llamar este endpoint; solo el administrador/supervisor.
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (!session?.user || userRole !== "admin") {
      return NextResponse.json({ error: "Solo el administrador puede reiniciar los contadores" }, { status: 403 });
    }

    const body = await req.json();
    const { escuelaId } = body;

    if (!escuelaId) {
      return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });
    }

    // Reiniciar los contadores a cero
    const stats = await prisma.horarioStats.upsert({
      where: { escuelaId },
      create: {
        escuelaId,
        totalUsos: 0,
        totalMensajesChat: 0,
        ultimoUso: new Date()
      },
      update: {
        totalUsos: 0,
        totalMensajesChat: 0
      }
    });

    return NextResponse.json({
      success: true,
      mensaje: "Contadores reiniciados correctamente",
      stats
    });
  } catch (error: any) {
    console.error("[api/admin/horarios/reset-stats] Error:", error);
    return NextResponse.json({ error: "Error al reiniciar contadores" }, { status: 500 });
  }
}

// ─── GET: Obtener estadísticas de uso por escuela (admin) ───
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (!session?.user || userRole !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const escuelaId = searchParams.get("escuelaId");

    if (escuelaId) {
      // Stats de una escuela específica
      const stats = await prisma.horarioStats.findUnique({
        where: { escuelaId },
        include: { escuela: { select: { nombre: true, cct: true } } }
      });
      return NextResponse.json({ success: true, stats });
    }

    // Todas las escuelas con sus stats
    const todasLasStats = await prisma.horarioStats.findMany({
      include: {
        escuela: { select: { nombre: true, cct: true } }
      },
      orderBy: { totalMensajesChat: "desc" }
    });

    return NextResponse.json({ success: true, stats: todasLasStats });
  } catch (error: any) {
    console.error("[api/admin/horarios/reset-stats] Error en GET:", error);
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
