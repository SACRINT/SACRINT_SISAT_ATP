import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Lista disciplinas (activas para directores, todas para admin)
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string } | undefined;
    const isAdmin = user?.role === "admin";

    const disciplinas = await prisma.circular05Disciplina.findMany({
        where: isAdmin ? {} : { activo: true },
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    });

    return NextResponse.json(disciplinas);
}

// POST - Crear nueva disciplina (solo admin)
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, area } = body;

    if (!nombre || typeof nombre !== "string" || nombre.trim().length === 0) {
        return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    try {
        // Obtener el máximo orden actual
        const maxOrden = await prisma.circular05Disciplina.aggregate({ _max: { orden: true } });
        const nuevoOrden = (maxOrden._max.orden ?? 0) + 1;

        const disciplina = await prisma.circular05Disciplina.create({
            data: {
                nombre: nombre.trim().toUpperCase(),
                area: (area || "").trim(),
                orden: nuevoOrden,
            },
        });
        return NextResponse.json(disciplina, { status: 201 });
    } catch (err: any) {
        if (err.code === "P2002") {
            return NextResponse.json({ error: "Ya existe una disciplina con ese nombre" }, { status: 409 });
        }
        return NextResponse.json({ error: "Error al crear: " + err.message }, { status: 500 });
    }
}

// PATCH - Editar disciplina (solo admin)
export async function PATCH(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { id, nombre, area, activo, orden } = body;

    if (!id) {
        return NextResponse.json({ error: "ID es obligatorio" }, { status: 400 });
    }

    const updateData: any = {};
    if (nombre !== undefined) updateData.nombre = nombre.trim().toUpperCase();
    if (area !== undefined) updateData.area = area.trim();
    if (activo !== undefined) updateData.activo = activo;
    if (orden !== undefined) updateData.orden = orden;

    try {
        const disciplina = await prisma.circular05Disciplina.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(disciplina);
    } catch (err: any) {
        if (err.code === "P2002") {
            return NextResponse.json({ error: "Ya existe una disciplina con ese nombre" }, { status: 409 });
        }
        return NextResponse.json({ error: "Error al actualizar: " + err.message }, { status: 500 });
    }
}

// DELETE - Eliminar disciplina (solo admin)
export async function DELETE(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "ID es obligatorio" }, { status: 400 });
    }

    try {
        await prisma.circular05Disciplina.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: "Error al eliminar: " + err.message }, { status: 500 });
    }
}
