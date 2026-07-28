/**
 * GET    /api/director/planeaciones/[id]  → Detalles de una planeación específica
 * DELETE /api/director/planeaciones/[id]  → Eliminar una planeación
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as any;
    const escuelaId = user.escuelaId as string;
    if (!escuelaId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const planeacion = await prisma.planeacionDidactica.findFirst({
        where: { id: params.id, escuelaId },
    });

    if (!planeacion) {
        return NextResponse.json({ error: "Planeación no encontrada" }, { status: 404 });
    }

    return NextResponse.json(planeacion);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as any;
    const escuelaId = user.escuelaId as string;
    if (!escuelaId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const planeacion = await prisma.planeacionDidactica.findFirst({
        where: { id: params.id, escuelaId },
    });

    if (!planeacion) {
        return NextResponse.json({ error: "Planeación no encontrada" }, { status: 404 });
    }

    await prisma.planeacionDidactica.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
}
