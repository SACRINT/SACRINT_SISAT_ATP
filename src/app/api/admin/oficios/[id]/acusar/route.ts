/**
 * POST /api/admin/oficios/[id]/acusar
 *
 * Registra el acuse de recibo de un destinatario.
 * Body: { destinatarioId: string, rutaAcuse?: string, confirmadoATP?: boolean }
 *
 * Si todos acusaron → oficio → ACUSADO.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type UserSession = { role?: string; organizacionId?: string; tenantId?: string };

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const session = await auth();
        const user = session?.user as UserSession | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: "Sin tenant" }, { status: 401 });

        const { id } = await ctx.params;
        const oficio = await prisma.oficio.findFirst({ where: { id, tenantId } });
        if (!oficio) return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });

        const body = (await req.json()) as {
            destinatarioId: string;
            rutaAcuse?: string;
            confirmadoATP?: boolean;
        };

        if (!body.destinatarioId) {
            return NextResponse.json({ error: "destinatarioId requerido" }, { status: 400 });
        }

        const destinatario = await prisma.oficioDestinatario.findFirst({
            where: { id: body.destinatarioId, oficioId: id, tenantId },
        });
        if (!destinatario) {
            return NextResponse.json({ error: "Destinatario no encontrado" }, { status: 404 });
        }

        const ahora = new Date();
        const actualizado = await prisma.oficioDestinatario.update({
            where: { id: body.destinatarioId },
            data: {
                acuseRecibido: true,
                rutaAcuse: body.rutaAcuse || null,
                fechaAcuse: ahora,
                confirmadoATP: body.confirmadoATP ?? false,
                ...(body.confirmadoATP ? { fechaConfirmacionATP: ahora } : {}),
            },
        });

        // ¿Todos acusaron?
        const sinAcuse = await prisma.oficioDestinatario.count({
            where: { oficioId: id, tenantId, acuseRecibido: false },
        });

        if (sinAcuse === 0) {
            await prisma.oficio.update({ where: { id }, data: { estado: "ACUSADO" } });
        }

        return NextResponse.json({
            destinatario: actualizado,
            todosAcusaron: sinAcuse === 0,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al registrar acuse";
        console.error("[POST acusar]", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
