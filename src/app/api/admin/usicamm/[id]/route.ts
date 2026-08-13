import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/** PATCH /api/admin/usicamm/[id] — Actualizar convocatoria USICAMM */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { titulo, descripcion, tipo, fechaVigencia, convocatoriaUrl, activo } = body;

    const conv = await prisma.convocatoriaUsicamm.update({
        where: { id },
        data: {
            ...(titulo && { titulo }),
            ...(descripcion !== undefined && { descripcion }),
            ...(tipo && { tipo }),
            ...(fechaVigencia !== undefined && { fechaVigencia: fechaVigencia ? new Date(fechaVigencia) : null }),
            ...(convocatoriaUrl !== undefined && { convocatoriaUrl }),
            ...(activo !== undefined && { activo }),
        },
    });

    return NextResponse.json(conv);
}

/** DELETE /api/admin/usicamm/[id] — Desactivar convocatoria USICAMM */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    await prisma.convocatoriaUsicamm.update({
        where: { id },
        data: { activo: false },
    });

    return NextResponse.json({ ok: true });
}
