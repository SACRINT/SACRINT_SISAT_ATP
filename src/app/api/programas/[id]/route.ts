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

        // Step 1: Fetch existing program to check if 'tipo' is changing
        const existingPrograma = await prisma.programa.findUnique({
            where: { id: programaId }
        });

        if (!existingPrograma) {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }

        const isTipoChanging = tipo !== undefined && tipo !== existingPrograma.tipo;

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
            // Delete all entregas linked to this program's periods (single query using relation filter)
            await prisma.entrega.deleteMany({
                where: {
                    periodoEntrega: { programaId }
                }
            });

            // Delete all periods for this program (single query)
            await prisma.periodoEntrega.deleteMany({
                where: { programaId }
            });

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
            }
        }

        revalidatePath("/admin");
        revalidatePath("/director");
        return NextResponse.json(updatedPrograma);
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
