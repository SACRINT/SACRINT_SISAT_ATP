import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/ciclos/[id]/programas
// Devuelve todos los programas globalmente activos con tienePeriodos=true/false
// según si ya tienen PeriodoEntrega en este ciclo.
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id: cicloId } = await params;

        // Verificar que el ciclo exista
        const ciclo = await prisma.cicloEscolar.findUnique({ where: { id: cicloId } });
        if (!ciclo) {
            return NextResponse.json({ error: "Ciclo escolar no encontrado" }, { status: 404 });
        }

        // Obtener TODOS los programas (activos e inactivos globalmente)
        // El admin debe poder incluir cualquier programa en un ciclo,
        // independientemente de su estado global.
        const programas = await prisma.programa.findMany({
            orderBy: { orden: "asc" },
            select: { id: true, nombre: true, tipo: true, activo: true },
        });

        // Obtener qué programas ya tienen PeriodoEntrega en este ciclo
        const periodosExistentes = await prisma.periodoEntrega.findMany({
            where: { cicloEscolarId: cicloId },
            select: { programaId: true },
        });
        const conPeriodos = new Set(periodosExistentes.map((p) => p.programaId));

        const resultado = programas.map((p) => ({
            ...p,
            tienePeriodos: conPeriodos.has(p.id),
        }));

        return NextResponse.json({ programas: resultado });
    } catch (error: unknown) {
        console.error("Error fetching programas del ciclo:", error);
        return NextResponse.json(
            { error: "Error al cargar los programas del ciclo" },
            { status: 500 }
        );
    }
}
