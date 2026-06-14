import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Listar todos los ciclos escolares (solo admins)
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const ciclos = await prisma.cicloEscolar.findMany({
            orderBy: { inicio: "desc" },
        });

        return NextResponse.json(ciclos);
    } catch (error: unknown) {
        console.error("Error fetching ciclos:", error);
        return NextResponse.json({ error: "Error al cargar los ciclos escolares" }, { status: 500 });
    }
}

// POST - Crear un nuevo ciclo escolar (solo admins)
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { nombre, inicio, fin } = await request.json();

        if (!nombre || !inicio || !fin) {
            return NextResponse.json({ error: "Campos incompletos" }, { status: 400 });
        }

        // Check if name already exists
        const exists = await prisma.cicloEscolar.findUnique({
            where: { nombre },
        });
        if (exists) {
            return NextResponse.json({ error: "El ciclo escolar ya existe" }, { status: 400 });
        }

        const nuevoCiclo = await prisma.cicloEscolar.create({
            data: {
                nombre,
                inicio: new Date(inicio),
                fin: new Date(fin),
                activo: false,
            },
        });

        return NextResponse.json({ success: true, ciclo: nuevoCiclo });
    } catch (error: unknown) {
        console.error("Error creating ciclo:", error);
        return NextResponse.json({ error: "Error al crear el ciclo escolar" }, { status: 500 });
    }
}

// PATCH - Activar un ciclo escolar específico (solo admins)
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: "ID de ciclo no proporcionado" }, { status: 400 });
        }

        // Verify cycle exists
        const targetCiclo = await prisma.cicloEscolar.findUnique({
            where: { id },
        });
        if (!targetCiclo) {
            return NextResponse.json({ error: "El ciclo escolar no existe" }, { status: 404 });
        }

        // Transaction to set all other active to false, and target to true
        await prisma.$transaction([
            prisma.cicloEscolar.updateMany({
                where: { id: { not: id } },
                data: { activo: false },
            }),
            prisma.cicloEscolar.update({
                where: { id },
                data: { activo: true },
            }),
        ]);

        return NextResponse.json({ success: true, message: `Ciclo ${targetCiclo.nombre} activado` });
    } catch (error: unknown) {
        console.error("Error activating ciclo:", error);
        return NextResponse.json({ error: "Error al activar el ciclo escolar" }, { status: 500 });
    }
}
