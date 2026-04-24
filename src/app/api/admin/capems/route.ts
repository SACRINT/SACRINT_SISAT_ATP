import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar CAPEMS del ciclo activo
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const ciclo = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
    if (!ciclo) return NextResponse.json([]);

    const capems = await prisma.capem.findMany({
        where: { cicloEscolarId: ciclo.id },
        orderBy: { orden: "asc" },
    });

    return NextResponse.json(capems);
}

// POST - Crear un CAPEM extra (solo admin)
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const ciclo = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
    if (!ciclo) {
        return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
    }

    const body = await req.json();
    const nombre = body.nombre?.trim();

    if (!nombre) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    // Obtener el orden máximo actual
    const maxOrden = await prisma.capem.aggregate({
        where: { cicloEscolarId: ciclo.id },
        _max: { orden: true },
    });
    const nextOrden = (maxOrden._max.orden ?? 0) + 1;

    try {
        const capem = await prisma.capem.create({
            data: {
                nombre,
                orden: nextOrden,
                cicloEscolarId: ciclo.id,
            },
        });
        return NextResponse.json(capem, { status: 201 });
    } catch (error: any) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "Ya existe un CAPEM con ese nombre en este ciclo" }, { status: 409 });
        }
        throw error;
    }
}
