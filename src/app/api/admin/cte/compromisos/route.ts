import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { consultarCompromisosZonales } from "@/lib/cte/cte-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/cte/compromisos
 * Lista los compromisos de CTE de la zona con cálculo dinámico de estados y KPIs.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = (user.role || "director") as "admin" | "supervision" | "director";
    if (userRole === "director") {
      return NextResponse.json(
        { error: "No autorizado para consultar compromisos zonales desde la vista de administración" },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const url = new URL(req.url);
    const sesionId = url.searchParams.get("sesionId") || undefined;
    const categoria = url.searchParams.get("categoria") || undefined;

    const { compromisos, kpis } = await consultarCompromisosZonales({
      tenantId,
      sesionId,
      categoria,
    });

    return NextResponse.json({
      success: true,
      compromisos,
      kpis,
    });
  } catch (error: any) {
    console.error("[api/admin/cte/compromisos] Error GET:", error);
    return NextResponse.json(
      { error: error?.message || "Error al obtener compromisos de CTE" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cte/compromisos
 * Registra un nuevo compromiso zonal oficial de CTE.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = (user.role || "director") as "admin" | "supervision" | "director";
    if (userRole === "director") {
      return NextResponse.json(
        { error: "No tiene permisos para registrar compromisos zonales" },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const body = await req.json();
    const {
      sesionId,
      texto,
      categoria = "APRENDIZAJES",
      prioridad = 1,
      fechaLimite,
      escuelasIds,
      notasSeguimiento,
    } = body;

    if (!sesionId || !texto || typeof texto !== "string" || texto.trim().length === 0) {
      return NextResponse.json(
        { error: "sesionId y texto del compromiso son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que la sesión pertenezca al tenant del usuario
    const sesionExistente = await prisma.cteSesionConfig.findUnique({
      where: { id: sesionId },
    });

    if (!sesionExistente || sesionExistente.tenantId !== tenantId) {
      return NextResponse.json(
        { error: "Sesión de CTE no encontrada en este tenant" },
        { status: 404 }
      );
    }

    const nuevoCompromiso = await prisma.cteCompromisoZonal.create({
      data: {
        tenantId,
        sesionId,
        texto: texto.trim(),
        categoria,
        prioridad: Number(prioridad) || 1,
        estado: "PENDIENTE",
        resuelto: false,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        escuelasIds: Array.isArray(escuelasIds) ? escuelasIds : Prisma.JsonNull,
        notasSeguimiento: notasSeguimiento ? String(notasSeguimiento).trim() : null,
        origenIA: false,
        oficializado: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        compromiso: nuevoCompromiso,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/admin/cte/compromisos] Error POST:", error);
    return NextResponse.json(
      { error: error?.message || "Error al crear compromiso de CTE" },
      { status: 500 }
    );
  }
}
