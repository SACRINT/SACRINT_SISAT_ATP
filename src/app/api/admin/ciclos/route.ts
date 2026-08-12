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

// PATCH - Activar un ciclo escolar específico y migrar programas seleccionados
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id, copiarProgramaIds } = await request.json();

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

        // Get the currently active cycle (before switching)
        const cicloAnterior = await prisma.cicloEscolar.findFirst({
            where: { activo: true },
        });

        // ── Migration: copy selected programs to the new cycle ──────────────
        if (Array.isArray(copiarProgramaIds) && copiarProgramaIds.length > 0) {
            const escuelas = await prisma.escuela.findMany({ select: { id: true } });

            // Calculate months for the NEW cycle dynamically
            const mesesDelCiclo: number[] = [];
            const cur = new Date(targetCiclo.inicio);
            cur.setDate(1);
            const finCiclo = new Date(targetCiclo.fin);
            while (cur <= finCiclo) {
                mesesDelCiclo.push(cur.getMonth() + 1);
                cur.setMonth(cur.getMonth() + 1);
            }

            for (const programaId of copiarProgramaIds) {
                // Fetch program type
                const programa = await prisma.programa.findUnique({
                    where: { id: programaId },
                    select: { tipo: true },
                });
                if (!programa) continue;

                // Skip if PeriodoEntrega already exists for this program in the new cycle
                const existente = await prisma.periodoEntrega.findFirst({
                    where: { cicloEscolarId: id, programaId },
                });
                if (existente) continue;

                const tipo = programa.tipo;

                if (tipo === "ANUAL") {
                    const periodo = await prisma.periodoEntrega.create({
                        data: { cicloEscolarId: id, programaId, activo: false },
                    });
                    if (escuelas.length > 0) {
                        await prisma.entrega.createMany({
                            data: escuelas.map((e) => ({
                                escuelaId: e.id,
                                periodoEntregaId: periodo.id,
                            })),
                            skipDuplicates: true,
                        });
                    }
                } else if (tipo === "SEMESTRAL") {
                    for (const semestre of [1, 2]) {
                        const periodo = await prisma.periodoEntrega.create({
                            data: { cicloEscolarId: id, programaId, semestre, activo: false },
                        });
                        if (escuelas.length > 0) {
                            await prisma.entrega.createMany({
                                data: escuelas.map((e) => ({
                                    escuelaId: e.id,
                                    periodoEntregaId: periodo.id,
                                })),
                                skipDuplicates: true,
                            });
                        }
                    }
                } else if (tipo === "MENSUAL") {
                    for (const mes of mesesDelCiclo) {
                        const periodo = await prisma.periodoEntrega.create({
                            data: { cicloEscolarId: id, programaId, mes, activo: false },
                        });
                        if (escuelas.length > 0) {
                            await prisma.entrega.createMany({
                                data: escuelas.map((e) => ({
                                    escuelaId: e.id,
                                    periodoEntregaId: periodo.id,
                                })),
                                skipDuplicates: true,
                            });
                        }
                    }
                }
            }
        }

        // ── Activate the new cycle, deactivate the rest ─────────────────────
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

        return NextResponse.json({
            success: true,
            message: `Ciclo ${targetCiclo.nombre} activado`,
            cicloAnteriorId: cicloAnterior?.id ?? null,
            programasMigrados: Array.isArray(copiarProgramaIds) ? copiarProgramaIds.length : 0,
        });
    } catch (error: unknown) {
        console.error("Error activating ciclo:", error);
        return NextResponse.json({ error: "Error al activar el ciclo escolar" }, { status: 500 });
    }
}
