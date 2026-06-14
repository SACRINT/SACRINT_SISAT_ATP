import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Listar todas las escuelas registradas (solo admins)
export async function GET() {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;

    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const escuelas = await prisma.escuela.findMany({
        select: {
            id: true,
            cct: true,
            nombre: true,
            localidad: true,
            municipio: true,
        },
        orderBy: { nombre: "asc" },
    });

    return NextResponse.json(escuelas);
}
