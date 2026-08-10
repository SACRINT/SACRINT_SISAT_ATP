/**
 * GET    /api/admin/errores  — consultar lista paginada de ErrorLog por tenant
 * DELETE /api/admin/errores  — limpiar ErrorLog del tenant actual
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

type SessionUser = { id?: string; role?: string; organizacionId?: string; tenantId?: string };

// ── GET: Consultar errores ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
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

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

        const where = tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {};

        const [total, errores] = await Promise.all([
            prisma.errorLog.count({ where }),
            prisma.errorLog.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
        ]);

        return NextResponse.json({
            errores,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al obtener logs de error";
        const stack = error instanceof Error ? error.stack : undefined;
        await registrarError(tenantId, {
            ruta: "/api/admin/errores",
            metodo: "GET",
            mensaje: msg,
            stack,
            userId,
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ── DELETE: Limpiar errores ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    let tenantId: string | undefined;
    let userId: string | undefined;

    try {
        const session = await auth();
        const user = session?.user as SessionUser | undefined;
        userId = user?.id;
        tenantId = user?.organizacionId || user?.tenantId;

        if (!session || !["admin", "supervision"].includes(user?.role ?? "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const where = tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {};
        const deleted = await prisma.errorLog.deleteMany({ where });

        return NextResponse.json({
            success: true,
            mensaje: `Se eliminaron ${deleted.count} registros de error.`,
            count: deleted.count,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al limpiar logs de error";
        const stack = error instanceof Error ? error.stack : undefined;
        await registrarError(tenantId, {
            ruta: "/api/admin/errores",
            metodo: "DELETE",
            mensaje: msg,
            stack,
            userId,
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
