/**
 * POST /api/admin/oficios/recordatorios
 *
 * Disparo manual de recordatorios de oficios para el tenant actual.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { procesarRecordatoriosOficio } from "@/lib/oficios/oficios-engine";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type SessionUser = { role?: string; organizacionId?: string; tenantId?: string };

export async function POST(_req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as SessionUser | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: "Sin tenant" }, { status: 401 });

        const resultado = await procesarRecordatoriosOficio(
            tenantId,
            async (to, asunto, html) => sendEmail({ to, subject: asunto, html })
        );

        return NextResponse.json({
            success: true,
            mensaje: `Procesados recordatorios: ${resultado.enviados} enviados, ${resultado.errores} errores.`,
            resultado,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al procesar recordatorios";
        console.error("[POST /api/admin/oficios/recordatorios]", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
