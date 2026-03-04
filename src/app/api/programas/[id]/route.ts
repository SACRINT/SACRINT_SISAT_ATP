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
        console.log("[PUT /api/programas] Received data:", { nombre, tipo, numArchivos, programaId });

        // Step 1: Fetch existing program to check if 'tipo' is changing
        const existingPrograma = await prisma.programa.findUnique({
            where: { id: programaId }
        });

        if (!existingPrograma) {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }

        const isTipoChanging = tipo !== undefined && tipo !== existingPrograma.tipo;
        console.log("[PUT /api/programas] Tipo check:", { receivedTipo: tipo, existingTipo: existingPrograma.tipo, isTipoChanging });

        // Step 2: Update the program immediately (fast operation)
        const updatedPrograma = await prisma.programa.update({
            where: { id: programaId },
            data: {
                nombre: nombre !== undefined ? nombre : undefined,
                descripcion: descripcion !== undefined ? descripcion : undefined,
                tipo: tipo !== undefined ? tipo : undefined,
                numArchivos: numArchivos !== undefined ? parseInt(numArchivos) : undefined,
                orden: orden !== undefined ? parseInt(orden) : undefined,
            },
        });

        // Step 3: If 'tipo' changed, recreate periods and deliveries
        // This is done AFTER the program update is already committed
        if (isTipoChanging) {
            console.log("[PUT /api/programas] TIPO IS CHANGING - deleting old periods...");
            // Delete all entregas linked to this program's periods (single query using relation filter)
            const deletedEntregas = await prisma.entrega.deleteMany({
                where: {
                    periodoEntrega: { programaId }
                }
            });
            console.log("[PUT /api/programas] Deleted entregas:", deletedEntregas.count);

            // Delete all periods for this program (single query)
            const deletedPeriods = await prisma.periodoEntrega.deleteMany({
                where: { programaId }
            });
            console.log("[PUT /api/programas] Deleted periods:", deletedPeriods.count);

            // Get active school cycle and all schools
            const cicloActivo = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
            const escuelas = await prisma.escuela.findMany({ select: { id: true } });

            if (cicloActivo && escuelas.length > 0) {
                // Define the periods to create based on new tipo
                let periodConfigs: { mes?: number; semestre?: number }[] = [];

                if (tipo === "ANUAL") {
                    periodConfigs = [{}]; // 1 period, no mes/semestre
                } else if (tipo === "SEMESTRAL") {
                    periodConfigs = [{ semestre: 1 }, { semestre: 2 }]; // 2 periods
                } else if (tipo === "MENSUAL") {
                    periodConfigs = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7].map(mes => ({ mes })); // 12 periods
                }

                // Create each period and its entregas
                for (const config of periodConfigs) {
                    const periodo = await prisma.periodoEntrega.create({
                        data: {
                            cicloEscolarId: cicloActivo.id,
                            programaId,
                            activo: false,
                            ...(config.mes !== undefined && { mes: config.mes }),
                            ...(config.semestre !== undefined && { semestre: config.semestre }),
                        }
                    });

                    // Bulk-create all entregas for this period in one shot
                    await prisma.entrega.createMany({
                        data: escuelas.map(esc => ({
                            escuelaId: esc.id,
                            periodoEntregaId: periodo.id,
                        })),
                    });
                }
                console.log("[PUT /api/programas] Created", periodConfigs.length, "new periods for tipo:", tipo);
            } else {
                console.log("[PUT /api/programas] WARNING: No cicloActivo or no escuelas found!", { cicloActivo: !!cicloActivo, escuelasCount: escuelas.length });
            }
        } else {
            console.log("[PUT /api/programas] Tipo NOT changing, skipping period recreation.");
        }

        // Re-fetch the complete programa with all periods and entregas
        // so the frontend gets accurate data immediately
        const cicloActivoForQuery = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
        const completePrograma = await prisma.programa.findUnique({
            where: { id: programaId },
            include: {
                periodos: {
                    ...(cicloActivoForQuery ? { where: { cicloEscolarId: cicloActivoForQuery.id } } : {}),
                    orderBy: [{ mes: "asc" }, { semestre: "asc" }],
                    include: {
                        entregas: {
                            include: {
                                escuela: true,
                                archivos: { where: { tipo: "ENTREGA" } },
                                correcciones: {
                                    include: {
                                        admin: { select: { id: true, nombre: true } },
                                        archivo: true,
                                    },
                                    orderBy: { createdAt: "desc" },
                                },
                            },
                        },
                    },
                },
            },
        });

        revalidatePath("/admin");
        revalidatePath("/director");
        return NextResponse.json(completePrograma);
    } catch (error: unknown) {
        console.error("Error updating programa:", error);
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

        // Delete entregas via relation filter (single query)
        await prisma.entrega.deleteMany({
            where: {
                periodoEntrega: { programaId }
            }
        });

        // Delete periods (single query)
        await prisma.periodoEntrega.deleteMany({
            where: { programaId }
        });

        // Delete the program
        await prisma.programa.delete({
            where: { id: programaId }
        });

        revalidatePath("/admin");
        revalidatePath("/director");
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting programa:", error);
        return NextResponse.json({ error: "Ocurrió un error al intentar eliminar el programa." }, { status: 500 });
    }
}
