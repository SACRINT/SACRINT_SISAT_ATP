import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/vigilancia/alertas
 * Obtiene la lista de alertas activas para el usuario en sesión.
 * - Directores: Solo ven alertas de su propia escuela.
 * - Supervisión / Admin: Ven todas las alertas de la zona.
 */
export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const soloNoLeidas = url.searchParams.get("noLeidas") === "true";
    const criticidad = url.searchParams.get("criticidad");

    const whereClause: any = {
      tenantId,
      archivada: false,
    };

    if (userRole === "director") {
      whereClause.escuelaId = user.id;
    }

    if (soloNoLeidas) {
      whereClause.leida = false;
    }

    if (criticidad) {
      whereClause.criticidad = criticidad;
    }

    const PRIORIDAD_CRITICIDAD: Record<string, number> = {
      CRITICA: 1,
      ADVERTENCIA: 2,
      INFORMATIVA: 3,
    };

    const [alertasRaw, totalNoLeidas, totalCriticas] = await Promise.all([
      prisma.alertaProactiva.findMany({
        where: whereClause,
        include: {
          escuela: {
            select: {
              id: true,
              nombre: true,
              cct: true,
            },
          },
        },
        orderBy: [
          { createdAt: "desc" },
        ],
        take: 50,
      }),
      prisma.alertaProactiva.count({
        where: {
          ...whereClause,
          leida: false,
        },
      }),
      prisma.alertaProactiva.count({
        where: {
          ...whereClause,
          criticidad: "CRITICA",
          leida: false,
        },
      }),
    ]);

    // Ordenar con prioridad explícita: CRITICA (1) -> ADVERTENCIA (2) -> INFORMATIVA (3)
    const alertas = alertasRaw.sort((a, b) => {
      const pA = PRIORIDAD_CRITICIDAD[a.criticidad] ?? 99;
      const pB = PRIORIDAD_CRITICIDAD[b.criticidad] ?? 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      alertas,
      totalNoLeidas,
      totalCriticas,
    });
  } catch (error: any) {
    console.error("[api/vigilancia/alertas] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al obtener alertas" },
      { status: 500 }
    );
  }
}
