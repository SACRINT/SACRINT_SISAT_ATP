import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function calcularMesesDelCiclo(inicio: Date, fin: Date): number[] {
    const meses: number[] = [];
    const cur = new Date(inicio);
    cur.setDate(1);
    const finCiclo = new Date(fin);
    while (cur <= finCiclo) {
        meses.push(cur.getMonth() + 1);
        cur.setMonth(cur.getMonth() + 1);
    }
    return meses;
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const programaId = params.id;

        const body = await request.json();
        const { cicloId, activo } = body;

        if (!cicloId || typeof activo !== "boolean") {
            return NextResponse.json({ error: "Faltan parámetros: cicloId y activo son requeridos" }, { status: 400 });
        }

        // Verificar existencia del programa y del ciclo
        const [programa, ciclo] = await Promise.all([
            prisma.programa.findUnique({ where: { id: programaId } }),
            prisma.cicloEscolar.findUnique({ where: { id: cicloId } })
        ]);

        if (!programa) {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }
        if (!ciclo) {
            return NextResponse.json({ error: "Ciclo escolar no encontrado" }, { status: 404 });
        }

        // Buscar si ya existen periodos para este programa en este ciclo
        const periodosExistentes = await prisma.periodoEntrega.findMany({
            where: {
                cicloEscolarId: cicloId,
                programaId: programaId,
            },
        });

        if (activo) {
            if (periodosExistentes.length > 0) {
                // Si ya existen periodos en este ciclo, activarlos todos
                await prisma.periodoEntrega.updateMany({
                    where: {
                        cicloEscolarId: cicloId,
                        programaId: programaId,
                    },
                    data: { activo: true },
                });
            } else {
                // Crear los periodos según el tipo de programa para este ciclo
                const escuelas = await prisma.escuela.findMany({ select: { id: true } });
                const tipo = programa.tipo;

                if (tipo === "ANUAL") {
                    const periodo = await prisma.periodoEntrega.create({
                        data: {
                            cicloEscolarId: cicloId,
                            programaId: programaId,
                            activo: true,
                        },
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
                            data: {
                                cicloEscolarId: cicloId,
                                programaId: programaId,
                                semestre,
                                activo: true,
                            },
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
                    const meses = calcularMesesDelCiclo(ciclo.inicio, ciclo.fin);
                    for (const mes of meses) {
                        const periodo = await prisma.periodoEntrega.create({
                            data: {
                                cicloEscolarId: cicloId,
                                programaId: programaId,
                                mes,
                                activo: true,
                            },
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
        } else {
            // Desactivar todos los periodos existentes de este programa en este ciclo
            if (periodosExistentes.length > 0) {
                await prisma.periodoEntrega.updateMany({
                    where: {
                        cicloEscolarId: cicloId,
                        programaId: programaId,
                    },
                    data: { activo: false },
                });
            }
        }

        // Obtener el estado actualizado de los periodos de este ciclo
        const periodosActualizados = await prisma.periodoEntrega.findMany({
            where: {
                cicloEscolarId: cicloId,
                programaId: programaId,
            },
            orderBy: [{ mes: "asc" }, { semestre: "asc" }],
        });

        revalidatePath("/admin");
        revalidatePath("/director");

        return NextResponse.json({
            success: true,
            programaId,
            cicloId,
            activo,
            periodos: periodosActualizados,
        });
    } catch (error: unknown) {
        console.error("Error en toggle-ciclo:", error);
        return NextResponse.json(
            { error: "Error al actualizar estado del programa en el ciclo" },
            { status: 500 }
        );
    }
}
