import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH: ATP toggles a periodo's active status
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const { activo } = await req.json();

        const periodo = await prisma.periodoEntrega.update({
            where: { id },
            data: { activo: Boolean(activo) },
        });

        return NextResponse.json({ success: true, periodo });
    } catch (error) {
        console.error("Periodo update error:", error);
        return NextResponse.json({ error: "Error al actualizar periodo" }, { status: 500 });
    }
}
