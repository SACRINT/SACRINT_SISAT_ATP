import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/inscripciones-eventos
 * Returns the current school's event registration and the discipline catalog.
 * Also returns the global activo flag so the frontend knows if the form is enabled.
 */
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; cct?: string } | undefined;

        if (!session || user?.role !== "director") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const cct = user?.cct;
        if (!cct) return NextResponse.json({ error: "Sin CCT" }, { status: 400 });

        const escuela = await prisma.escuela.findUnique({ where: { cct } });
        if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

        // Get global config
        const config = await prisma.eventosConfig.findUnique({ where: { id: "singleton" } });

        // Get discipline catalog (categories + disciplines)
        const categorias = await prisma.categoriaEvento.findMany({
            include: {
                disciplinas: { orderBy: { orden: "asc" } },
            },
            orderBy: { orden: "asc" },
        });

        // Get existing inscription for this school
        const inscripcion = await prisma.inscripcionEvento2026.findUnique({
            where: { escuelaId: escuela.id },
        });

        return NextResponse.json({
            activo: config?.activo ?? false,
            categorias,
            inscripcion: inscripcion?.datos ?? null,
            updatedAt: inscripcion?.updatedAt ?? null,
        });
    } catch (error: unknown) {
        console.error("Error GET inscripciones-eventos:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

/**
 * POST /api/inscripciones-eventos
 * Saves/updates the school's event registration.
 * Body: { datos: Record<string, { participa: boolean, numParticipantes: number }> }
 */
export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; cct?: string } | undefined;

        if (!session || user?.role !== "director") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const cct = user?.cct;
        if (!cct) return NextResponse.json({ error: "Sin CCT" }, { status: 400 });

        const escuela = await prisma.escuela.findUnique({ where: { cct } });
        if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

        // Check if the feature is active
        const config = await prisma.eventosConfig.findUnique({ where: { id: "singleton" } });
        if (!config?.activo) {
            return NextResponse.json({ error: "Las inscripciones a eventos no están activas" }, { status: 403 });
        }

        const body = await req.json();
        const datos = body.datos as Record<string, { participa: boolean; numParticipantes: number }>;

        if (!datos || typeof datos !== "object") {
            return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
        }

        // Server-side validation: check each discipline against the catalog
        const disciplinas = await prisma.disciplinaEvento.findMany();
        const discMap = new Map(disciplinas.map(d => [d.id, d]));
        const errors: string[] = [];

        // Build group exclusion check
        const activeByGroup: Record<string, string[]> = {};

        for (const [discId, entry] of Object.entries(datos)) {
            if (!entry.participa) continue;

            const disc = discMap.get(discId);
            if (!disc) {
                errors.push(`Disciplina desconocida: ${discId}`);
                continue;
            }

            // Check participant count
            if (entry.numParticipantes < disc.minParticipantes || entry.numParticipantes > disc.maxParticipantes) {
                errors.push(`${disc.nombre}: participantes debe ser entre ${disc.minParticipantes} y ${disc.maxParticipantes}`);
            }

            // Track exclusion groups
            if (disc.grupoExclusion) {
                if (!activeByGroup[disc.grupoExclusion]) activeByGroup[disc.grupoExclusion] = [];
                activeByGroup[disc.grupoExclusion].push(disc.nombre);
            }
        }

        // Check mutual exclusion
        for (const [group, names] of Object.entries(activeByGroup)) {
            if (names.length > 1) {
                errors.push(`Solo puede elegir una opción en el grupo "${group}": ${names.join(", ")}`);
            }
        }

        if (errors.length > 0) {
            return NextResponse.json({ error: "Errores de validación", details: errors }, { status: 400 });
        }

        // Upsert inscription
        await prisma.inscripcionEvento2026.upsert({
            where: { escuelaId: escuela.id },
            update: { datos },
            create: { escuelaId: escuela.id, datos },
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        console.error("Error POST inscripciones-eventos:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
