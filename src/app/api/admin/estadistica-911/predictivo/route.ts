import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { registrarError } from "@/lib/error-log";
import { calcularProyeccionZonal } from "@/lib/estadistica-911-predictivo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string; id?: string };
        const tenantId = user.organizacionId || user.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        // Regla de Aislamiento: Los directores no pueden acceder al concentrado zonal predictivo
        if (user.role === "director") {
            return NextResponse.json(
                { error: "Acceso denegado. Los directores deben consultar únicamente la proyección de su plantel." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(req.url);
        const corteParam = searchParams.get("corte");
        const corteProyectar: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS" =
            corteParam === "FIN_DE_CURSOS" ? "FIN_DE_CURSOS" : "INICIO_DE_CURSOS";

        const escuelaIdParam = searchParams.get("escuelaId");

        const proyeccionZonal = await calcularProyeccionZonal(tenantId, corteProyectar);

        if (escuelaIdParam) {
            const escuelaProy = proyeccionZonal.escuelas.find(e => e.escuelaId === escuelaIdParam);
            if (!escuelaProy) {
                return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
            }
            return NextResponse.json({ success: true, proyeccion: escuelaProy });
        }

        return NextResponse.json({
            success: true,
            proyeccionZonal
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al calcular proyección 911";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/predictivo",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
