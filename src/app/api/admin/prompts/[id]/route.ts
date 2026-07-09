import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH: Actualizar una plantilla de evaluación específica
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const { nombre, contenido, activo } = await req.json();

        const updated = await prisma.plantillaEvaluacion.update({
            where: { id },
            data: {
                nombre: nombre ?? undefined,
                contenido: contenido ?? undefined,
                activo: activo ?? undefined
            }
        });

        return NextResponse.json(updated);
    } catch (error: unknown) {
        console.error("PATCH Prompt error:", error);
        return NextResponse.json({ error: "Error al actualizar plantilla" }, { status: 500 });
    }
}
