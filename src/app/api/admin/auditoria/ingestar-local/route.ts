import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ingestarCorpusLocal } from "@/lib/discovery/local-ingestor";
import { registrarError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

// POST - Ejecutar la ingesta local del corpus
export async function POST(request: NextRequest) {
    let tenantId: string | undefined;
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        tenantId = user.organizacionId || user.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Usuario sin organización / tenant asignado" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        let { cuentaId, directorioCorpus } = body;

        // Si no se provee cuentaId, buscar la cuenta del tenant
        if (!cuentaId) {
            const cuenta = await prisma.cuentaAuditoria.findFirst({
                where: { tenantId },
            });
            if (!cuenta) {
                return NextResponse.json({
                    error: "No existe una CuentaAuditoria configurada para este tenant. Por favor configúrela primero.",
                }, { status: 400 });
            }
            cuentaId = cuenta.id;
        }

        console.log(`[API INGESTA] Iniciando ingesta para cuentaId: ${cuentaId}, tenantId: ${tenantId}...`);
        const resultado = await ingestarCorpusLocal({
            cuentaId,
            tenantId,
            directorioCorpus,
        });

        return NextResponse.json(resultado);
    } catch (error: any) {
        console.error("Error en API ingesta local:", error);
        await registrarError(tenantId, {
            ruta: "/api/admin/auditoria/ingestar-local",
            metodo: "POST",
            mensaje: error?.message || "Error durante la ingesta del corpus",
            stack: error?.stack,
        });
        return NextResponse.json({
            error: error?.message || "Error durante la ingesta del corpus",
        }, { status: 500 });
    }
}
