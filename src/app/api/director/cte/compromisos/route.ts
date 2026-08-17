import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { consultarCompromisosZonales } from "@/lib/cte/cte-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/director/cte/compromisos
 * Consulta los compromisos de CTE aplicables a la escuela del director en sesión.
 */
export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const sesionId = url.searchParams.get("sesionId") || undefined;
    const categoria = url.searchParams.get("categoria") || undefined;

    // Directores aislados por su ID de escuela
    const escuelaId = user.role === "director" ? user.id : undefined;

    const { compromisos, kpis } = await consultarCompromisosZonales({
      tenantId,
      sesionId,
      categoria,
      escuelaId,
    });

    return NextResponse.json({
      success: true,
      compromisos,
      kpis,
    });
  } catch (error: any) {
    console.error("[api/director/cte/compromisos] Error GET:", error);
    return NextResponse.json(
      { error: error?.message || "Error al obtener compromisos de CTE" },
      { status: 500 }
    );
  }
}
