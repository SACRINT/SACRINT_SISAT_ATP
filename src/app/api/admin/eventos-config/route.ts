import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/eventos-config
 * Returns the global events configuration + discipline catalog for admin management.
 */
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const config = await prisma.eventosConfig.upsert({
            where: { id: "singleton" },
            update: {},
            create: { id: "singleton", activo: false },
        });

        const categorias = await prisma.categoriaEvento.findMany({
            include: {
                disciplinas: { orderBy: { orden: "asc" } },
            },
            orderBy: { orden: "asc" },
        });

        // Count inscriptions
        const totalInscripciones = await prisma.inscripcionEvento2026.count();
        const totalEscuelas = await prisma.escuela.count();

        return NextResponse.json({
            activo: config.activo,
            categorias,
            totalInscripciones,
            totalEscuelas,
        });
    } catch (error: unknown) {
        console.error("Error GET eventos-config:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/eventos-config
 * Toggle the global events active flag.
 * Body: { activo: boolean }
 */
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { activo } = body;

        if (typeof activo !== "boolean") {
            return NextResponse.json({ error: "Campo 'activo' requerido (boolean)" }, { status: 400 });
        }

        await prisma.eventosConfig.upsert({
            where: { id: "singleton" },
            update: { activo },
            create: { id: "singleton", activo },
        });

        return NextResponse.json({ ok: true, activo });
    } catch (error: unknown) {
        console.error("Error PATCH eventos-config:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
