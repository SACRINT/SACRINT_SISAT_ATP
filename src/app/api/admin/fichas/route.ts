import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar fichas
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string } | undefined;
    const isAdmin = user?.role === "admin";

    const fichas = await prisma.ficha.findMany({
        where: isAdmin ? {} : { activo: true },
        orderBy: { orden: "asc" },
    });

    return NextResponse.json(fichas);
}

// POST - Crear nueva ficha (solo admin)
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { nombre } = body;

    if (!nombre || !nombre.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    // Obtener el orden máximo actual
    const maxOrden = await prisma.ficha.aggregate({ _max: { orden: true } });
    const nextOrden = (maxOrden._max.orden ?? 0) + 1;

    try {
        const ficha = await prisma.ficha.create({
            data: {
                nombre: nombre.trim(),
                orden: nextOrden,
            },
        });
        return NextResponse.json(ficha, { status: 201 });
    } catch (error: any) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "Ya existe una ficha con ese nombre" }, { status: 409 });
        }
        throw error;
    }
}
