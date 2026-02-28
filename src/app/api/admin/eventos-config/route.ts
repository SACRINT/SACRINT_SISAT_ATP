import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/eventos-config
 * Returns the global events configuration + discipline catalog + school list for admin management.
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

        // Get all schools
        const escuelas = await prisma.escuela.findMany({
            select: {
                id: true,
                cct: true,
                nombre: true,
                email: true,
                inscripcionEvento: {
                    select: {
                        id: true,
                        datos: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: { nombre: "asc" },
        });

        // Build school list with status
        const escuelasConEstado = escuelas.map(esc => {
            const inscripcion = esc.inscripcionEvento;
            const datos = (inscripcion?.datos as Record<string, { participa: boolean; numParticipantes: number }>) || {};
            const disciplinasActivas = Object.values(datos).filter(d => d.participa).length;
            const totalParticipantes = Object.values(datos)
                .filter(d => d.participa)
                .reduce((sum, d) => sum + (d.numParticipantes || 0), 0);

            return {
                id: esc.id,
                cct: esc.cct,
                nombre: esc.nombre,
                email: esc.email,
                inscrita: !!inscripcion,
                disciplinasActivas,
                totalParticipantes,
                fechaInscripcion: inscripcion?.updatedAt || null,
                inscripcionId: inscripcion?.id || null,
            };
        });

        const totalInscripciones = escuelasConEstado.filter(e => e.inscrita).length;
        const totalEscuelas = escuelas.length;

        return NextResponse.json({
            activo: config.activo,
            categorias,
            totalInscripciones,
            totalEscuelas,
            escuelas: escuelasConEstado,
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

/**
 * DELETE /api/admin/eventos-config
 * Delete a school's inscription.
 * Body: { escuelaId: string }
 */
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const escuelaId = searchParams.get("escuelaId");

        if (!escuelaId) {
            return NextResponse.json({ error: "escuelaId requerido" }, { status: 400 });
        }

        await prisma.inscripcionEvento2026.deleteMany({
            where: { escuelaId },
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        console.error("Error DELETE eventos-config:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
