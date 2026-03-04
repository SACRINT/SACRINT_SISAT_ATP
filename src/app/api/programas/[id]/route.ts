import { NextRequest, NextResponse } from "next/server";
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

        // Fetch existing program to check if 'tipo' is changing
        const existingPrograma = await prisma.programa.findUnique({
            where: { id: programaId }
        });

        if (!existingPrograma) {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }

        const isTipoChanging = tipo !== undefined && tipo !== existingPrograma.tipo;

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

        // If 'tipo' has changed, we must recreate the periods and deliveries
        if (isTipoChanging) {
            // Delete existing entregas and periodos for this program
            const periodos = await prisma.periodoEntrega.findMany({ where: { programaId } });
            const periodoIds = periodos.map(p => p.id);

            if (periodoIds.length > 0) {
                await prisma.entrega.deleteMany({
                    where: { periodoEntregaId: { in: periodoIds } }
                });
                await prisma.periodoEntrega.deleteMany({
                    where: { programaId }
                });
            }

            // Recreate new periods and deliveries based on the new 'tipo'
            const cicloActivo = await prisma.cicloEscolar.findFirst({ where: { activo: true } });
            const escuelas = await prisma.escuela.findMany();

            if (cicloActivo && escuelas.length > 0) {
                const MESES_CICLO = [
                    { mes: 8, año: 2025 }, { mes: 9, año: 2025 }, { mes: 10, año: 2025 }, { mes: 11, año: 2025 }, { mes: 12, año: 2025 },
                    { mes: 1, año: 2026 }, { mes: 2, año: 2026 }, { mes: 3, año: 2026 }, { mes: 4, año: 2026 }, { mes: 5, año: 2026 }, { mes: 6, año: 2026 }, { mes: 7, año: 2026 }
                ];

                // Optimization: Prepare bulk creations to avoid sequential delays
                const newEntregas: { escuelaId: string, periodoEntregaId: string }[] = [];

                if (tipo === "ANUAL") {
                    const periodo = await prisma.periodoEntrega.create({
                        data: { cicloEscolarId: cicloActivo.id, programaId: updatedPrograma.id, activo: false }
                    });
                    for (const esc of escuelas) {
                        newEntregas.push({ escuelaId: esc.id, periodoEntregaId: periodo.id });
                    }
                } else if (tipo === "SEMESTRAL") {
                    for (const sem of [1, 2]) {
                        const periodo = await prisma.periodoEntrega.create({
                            data: { cicloEscolarId: cicloActivo.id, programaId: updatedPrograma.id, semestre: sem, activo: false }
                        });
                        for (const esc of escuelas) {
                            newEntregas.push({ escuelaId: esc.id, periodoEntregaId: periodo.id });
                        }
                    }
                } else if (tipo === "MENSUAL") {
                    for (const { mes } of MESES_CICLO) {
                        const periodo = await prisma.periodoEntrega.create({
                            data: { cicloEscolarId: cicloActivo.id, programaId: updatedPrograma.id, mes, activo: false }
                        });
                        for (const esc of escuelas) {
                            newEntregas.push({ escuelaId: esc.id, periodoEntregaId: periodo.id });
                        }
                    }
                }

                // Bulk insert all entregas
                if (newEntregas.length > 0) {
                    await prisma.entrega.createMany({
                        data: newEntregas
                    });
                }
            }
        }

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

        // Check if there are periodos connected and delete their deliveries and the periods themselves
        const periodos = await prisma.periodoEntrega.findMany({ where: { programaId } });
        const periodoIds = periodos.map(p => p.id);

        if (periodoIds.length > 0) {
            await prisma.entrega.deleteMany({
                where: { periodoEntregaId: { in: periodoIds } }
            });
            await prisma.periodoEntrega.deleteMany({
                where: { programaId }
            });
        }

        await prisma.programa.delete({
            where: { id: programaId }
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting programa:", error);
        return NextResponse.json({ error: "Ocurrió un error al intentar eliminar el programa." }, { status: 500 });
    }
}
