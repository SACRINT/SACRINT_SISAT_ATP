import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

        const data = await request.json();
        const { nombre, descripcion, tipo, numArchivos, orden } = data;

        // Use a single transaction to ensure atomicity and speed
        const result = await prisma.$transaction(async (tx) => {
            // Fetch existing program to check if 'tipo' is changing
            const existingPrograma = await tx.programa.findUnique({
                where: { id: programaId }
            });

            if (!existingPrograma) {
                throw new Error("PROGRAMA_NOT_FOUND");
            }

            const isTipoChanging = tipo !== undefined && tipo !== existingPrograma.tipo;

            // Update the program
            const updatedPrograma = await tx.programa.update({
                where: { id: programaId },
                data: {
                    nombre: nombre !== undefined ? nombre : undefined,
                    descripcion: descripcion !== undefined ? descripcion : undefined,
                    tipo: tipo !== undefined ? tipo : undefined,
                    numArchivos: numArchivos !== undefined ? parseInt(numArchivos) : undefined,
                    orden: orden !== undefined ? parseInt(orden) : undefined,
                },
            });

            // If 'tipo' has changed, recreate periods and deliveries
            if (isTipoChanging) {
                // Delete all entregas for this program's periods in one query
                await tx.entrega.deleteMany({
                    where: {
                        periodoEntrega: { programaId }
                    }
                });

                // Delete all periods for this program in one query
                await tx.periodoEntrega.deleteMany({
                    where: { programaId }
                });

                // Get active school cycle and all schools
                const cicloActivo = await tx.cicloEscolar.findFirst({ where: { activo: true } });
                const escuelas = await tx.escuela.findMany({ select: { id: true } });

                if (cicloActivo && escuelas.length > 0) {
                    // Create the new periods based on the new tipo
                    let periodosToCreate: { cicloEscolarId: string; programaId: string; activo: boolean; mes?: number; semestre?: number }[] = [];

                    if (tipo === "ANUAL") {
                        periodosToCreate = [{ cicloEscolarId: cicloActivo.id, programaId, activo: false }];
                    } else if (tipo === "SEMESTRAL") {
                        periodosToCreate = [
                            { cicloEscolarId: cicloActivo.id, programaId, activo: false, semestre: 1 },
                            { cicloEscolarId: cicloActivo.id, programaId, activo: false, semestre: 2 },
                        ];
                    } else if (tipo === "MENSUAL") {
                        const meses = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
                        periodosToCreate = meses.map(mes => ({
                            cicloEscolarId: cicloActivo.id,
                            programaId,
                            activo: false,
                            mes,
                        }));
                    }

                    // Create ALL periods in one batch, then fetch their IDs
                    for (const periodoData of periodosToCreate) {
                        const periodo = await tx.periodoEntrega.create({ data: periodoData });

                        // Bulk-create entregas for this period
                        await tx.entrega.createMany({
                            data: escuelas.map(esc => ({
                                escuelaId: esc.id,
                                periodoEntregaId: periodo.id,
                            })),
                        });
                    }
                }
            }

            return updatedPrograma;
        }, {
            timeout: 30000, // 30 second timeout for the transaction
        });

        revalidatePath("/admin");
        revalidatePath("/director");
        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("Error updating programa:", error);
        if (error instanceof Error && error.message === "PROGRAMA_NOT_FOUND") {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }
        return NextResponse.json({ error: "Error al actualizar el programa. Verifique datos." }, { status: 500 });
    }
}

export async function DELETE(
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

        await prisma.$transaction(async (tx) => {
            // Delete all entregas for this program's periods
            await tx.entrega.deleteMany({
                where: {
                    periodoEntrega: { programaId }
                }
            });

            // Delete all periods
            await tx.periodoEntrega.deleteMany({
                where: { programaId }
            });

            // Delete the program
            await tx.programa.delete({
                where: { id: programaId }
            });
        });

        revalidatePath("/admin");
        revalidatePath("/director");
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting programa:", error);
        return NextResponse.json({ error: "Ocurrió un error al intentar eliminar el programa." }, { status: 500 });
    }
}
