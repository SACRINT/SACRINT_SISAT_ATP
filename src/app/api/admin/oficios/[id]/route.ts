/**
 * GET    /api/admin/oficios/[id]  — detalle completo de un oficio
 * PATCH  /api/admin/oficios/[id]  — actualizar campos del oficio
 * DELETE /api/admin/oficios/[id]  — cancelar (soft) el oficio
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
    getOficioConfig,
    calcularCriticidad,
} from "@/lib/oficios/oficios-engine";

export const dynamic = "force-dynamic";

type UserSession = { role?: string; organizacionId?: string; tenantId?: string };

interface RouteContext {
    params: Promise<{ id: string }>;
}

// ── GET: Detalle ──────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const session = await auth();
        const user = session?.user as UserSession | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: "Sin tenant" }, { status: 401 });

        const { id } = await ctx.params;

        const oficio = await prisma.oficio.findFirst({
            where: { id, tenantId },
            include: {
                destinatarios: true,
                recordatorios: {
                    orderBy: { enviadoEn: "desc" },
                    take: 20,
                },
            },
        });

        if (!oficio) {
            return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ oficio });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ── PATCH: Actualizar ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const session = await auth();
        const user = session?.user as UserSession | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: "Sin tenant" }, { status: 401 });

        const { id } = await ctx.params;

        const body = (await req.json()) as {
            asunto?: string;
            fechaLimite?: string | null;
            estado?: string;
            notas?: string;
            remitenteNombre?: string;
            remitenteEmail?: string;
        };

        const existing = await prisma.oficio.findFirst({ where: { id, tenantId } });
        if (!existing) {
            return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });
        }

        const fechaLimite = body.fechaLimite !== undefined
            ? (body.fechaLimite ? new Date(body.fechaLimite) : null)
            : existing.fechaLimite;

        const config = await getOficioConfig(tenantId);
        const criticidad = calcularCriticidad(
            fechaLimite,
            config.umbralRojoHoras,
            config.umbralAmarilloHoras
        );

        const oficio = await prisma.oficio.update({
            where: { id },
            data: {
                ...(body.asunto !== undefined ? { asunto: body.asunto.trim() } : {}),
                ...(body.fechaLimite !== undefined ? { fechaLimite } : {}),
                ...(body.estado !== undefined ? { estado: body.estado as "RECIBIDO" | "ENVIADO" | "ACUSADO" | "VENCIDO" | "CANCELADO" } : {}),
                ...(body.notas !== undefined ? { notas: body.notas } : {}),
                ...(body.remitenteNombre !== undefined ? { remitenteNombre: body.remitenteNombre } : {}),
                ...(body.remitenteEmail !== undefined ? { remitenteEmail: body.remitenteEmail } : {}),
                criticidad,
            },
        });

        return NextResponse.json({ oficio });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al actualizar";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ── DELETE: Cancelar (soft) ───────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    try {
        const session = await auth();
        const user = session?.user as UserSession | undefined;
        if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: "Sin tenant" }, { status: 401 });

        const { id } = await ctx.params;

        const existing = await prisma.oficio.findFirst({ where: { id, tenantId } });
        if (!existing) {
            return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });
        }

        const oficio = await prisma.oficio.update({
            where: { id },
            data: { estado: "CANCELADO" },
        });

        return NextResponse.json({ oficio, mensaje: "Oficio cancelado" });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al cancelar";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
