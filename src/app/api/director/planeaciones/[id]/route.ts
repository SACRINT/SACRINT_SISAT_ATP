/**
 * GET    /api/director/planeaciones/[id]  → Detalles de una planeación específica
 * DELETE /api/director/planeaciones/[id]  → Eliminar una planeación
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function obtenerEscuelaId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.escuelaId) return user.escuelaId;
    if (user.id && (user.role === "director" || !user.role)) return user.id;
    if (user.cct) {
        const esc = await prisma.escuela.findUnique({ where: { cct: user.cct }, select: { id: true } });
        if (esc) return esc.id;
    }
    return user.id || null;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as any;
    const escuelaId = await obtenerEscuelaId(user);
    if (!escuelaId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;

    const planeacion = await prisma.planeacionDidactica.findFirst({
        where: { id, escuelaId },
    });

    if (!planeacion) {
        return NextResponse.json({ error: "Planeación no encontrada" }, { status: 404 });
    }

    return NextResponse.json(planeacion);
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as any;
    const escuelaId = await obtenerEscuelaId(user);
    if (!escuelaId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;

    const planeacion = await prisma.planeacionDidactica.findFirst({
        where: { id, escuelaId },
    });

    if (!planeacion) {
        return NextResponse.json({ error: "Planeación no encontrada" }, { status: 404 });
    }

    await prisma.planeacionDidactica.delete({ where: { id } });

    return NextResponse.json({ ok: true });
}
