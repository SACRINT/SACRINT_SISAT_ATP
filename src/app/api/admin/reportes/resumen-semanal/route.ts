/**
 * POST /api/admin/reportes/resumen-semanal
 *
 * Disparo manual del Resumen Semanal de Supervisión al correo del supervisor/institucional.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generarYEnviarResumenSemanal } from "@/lib/resumen-semanal";
import { registrarError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

type SessionUser = { id?: string; role?: string; organizacionId?: string; tenantId?: string };

export async function POST(_req: NextRequest) {
    let tenantId: string | undefined;
    let userId: string | undefined;

    try {
        const session = await auth();
        const user = session?.user as SessionUser | undefined;
        userId = user?.id;
        tenantId = user?.organizacionId || user?.tenantId;

        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const resultado = await generarYEnviarResumenSemanal(tenantId);

        return NextResponse.json({
            success: true,
            mensaje: resultado.mensaje,
            resultado,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al enviar resumen semanal";
        const stack = error instanceof Error ? error.stack : undefined;
        await registrarError(tenantId, {
            ruta: "/api/admin/reportes/resumen-semanal",
            metodo: "POST",
            mensaje: msg,
            stack,
            userId,
        });
        console.error("[POST /api/admin/reportes/resumen-semanal]", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
