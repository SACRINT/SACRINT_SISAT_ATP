/**
 * POST /api/admin/oficios/[id]/distribuir
 *
 * Asigna escuelas destinatarias a un oficio.
 * Body: { escuelas: [{ escuelaId?, escuelaNombre, emailDestino?, escuelaCCT? }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type UserSession = { role?: string; organizacionId?: string; tenantId?: string };

interface EscuelaDestinataria {
    escuelaId?: string;
    escuelaNombre: string;
    emailDestino?: string;
    escuelaCCT?: string;
}

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
        if (!oficio) {
            return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });
        }

        const body = (await req.json()) as { escuelas: EscuelaDestinataria[] };

        if (!body.escuelas?.length) {
            return NextResponse.json({ error: "Se requiere al menos una escuela" }, { status: 400 });
        }

        const results = [];
        for (const esc of body.escuelas) {
            const existente = await prisma.oficioDestinatario.findFirst({
                where: { oficioId: id, escuelaNombre: esc.escuelaNombre },
            });

            if (!existente) {
                const dest = await prisma.oficioDestinatario.create({
                    data: {
                        tenantId,
                        oficioId: id,
                        escuelaId: esc.escuelaId || null,
                        escuelaNombre: esc.escuelaNombre,
                        emailDestino: esc.emailDestino || null,
                        escuelaCCT: esc.escuelaCCT || null,
                    },
                });
                results.push({ accion: "creado", dest });
            } else {
                results.push({ accion: "existente", dest: existente });
            }
        }

        // Si el oficio era RECIBIDO y es para distribuir (se va a enviar), actualizar estado
        if (oficio.estado === "RECIBIDO" && oficio.esRecibido === false) {
            await prisma.oficio.update({ where: { id }, data: { estado: "ENVIADO" } });
        }

        return NextResponse.json({
            mensaje: `${results.filter((r) => r.accion === "creado").length} destinatarios agregados`,
            destinatarios: results,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al distribuir";
        console.error("[POST distribuir]", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
