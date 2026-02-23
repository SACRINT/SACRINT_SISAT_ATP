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

        // Verifica si es admin
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await context.params;
        const data = await request.json();

        if (typeof data.recordatorioAuto !== "boolean") {
            return NextResponse.json({ error: "El campo recordatorioAuto debe ser un booleano" }, { status: 400 });
        }

        const programaContent = await prisma.programa.update({
            where: { id },
            data: { recordatorioAuto: data.recordatorioAuto } as any,
            select: { id: true, recordatorioAuto: true } as any
        });

        return NextResponse.json(programaContent);

    } catch (error) {
        console.error("Error al actualizar recordatorioAuto", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
