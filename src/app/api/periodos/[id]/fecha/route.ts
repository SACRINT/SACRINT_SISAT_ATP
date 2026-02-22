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
        const periodoId = params.id;

        const data = await request.json();
        const { fechaLimite } = data; // Expected ISO Date string or null

        const periodoUpdate = await prisma.periodoEntrega.update({
            where: { id: periodoId },
            data: {
                fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
            },
        });

        return NextResponse.json(periodoUpdate);
    } catch (error: unknown) {
        console.error("Error updating fechaLimite:", error);
        return NextResponse.json({ error: "Ocurrió un error al actualizar la fecha límite" }, { status: 500 });
    }
}
