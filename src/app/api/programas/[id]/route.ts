import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const programaId = params.id;

        const data = await request.json();
        const { nombre, descripcion, tipo, numArchivos, orden } = data;

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

        return NextResponse.json(updatedPrograma);
    } catch (error: any) {
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
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const programaId = params.id;

        // Check if there are periodos connected
        const count = await prisma.periodoEntrega.count({
            where: { programaId }
        });

        if (count > 0) {
            return NextResponse.json({ error: "No se puede eliminar porque tiene periodos y entregas conectadas." }, { status: 400 });
        }

        await prisma.programa.delete({
            where: { id: programaId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting programa:", error);
        return NextResponse.json({ error: "Ocurrió un error al intentar eliminar el programa." }, { status: 500 });
    }
}
