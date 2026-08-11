import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generarConsolidadoZonaExcel } from "@/lib/plantillas-sparh/sparh-engine";
import { registrarError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

export async function POST() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const excelBuffer = await generarConsolidadoZonaExcel(tenantId);
        const uint8Array = new Uint8Array(excelBuffer);

        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="CONSOLIDADO_SPARH_${tenantId}.xlsx"`
            }
        });
    } catch (err: unknown) {
        const session = await auth();
        const user = session?.user as { organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        const msg = err instanceof Error ? err.message : "Error al generar consolidado de zona";
        await registrarError(tenantId, {
            mensaje: msg,
            ruta: "/api/admin/plantillas/consolidar",
            metodo: "POST",
            stack: err instanceof Error ? err.stack : undefined
        });

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
