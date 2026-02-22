import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH: ATP changes delivery status
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
        const { estado, observaciones } = await req.json();

        const validEstados = [
            "PENDIENTE",
            "EN_REVISION",
            "REQUIERE_CORRECCION",
            "APROBADO",
            "NO_APROBADO",
            "NO_ENTREGADO",
        ];

        if (!validEstados.includes(estado)) {
            return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
        }

        const entrega = await prisma.entrega.update({
            where: { id },
            data: {
                estado,
                observacionesATP: observaciones ?? undefined,
                fechaRevision: new Date(),
            },
        });

        return NextResponse.json({ success: true, entrega });
    } catch (error: unknown) {
        console.error("Estado update error:", error);
        return NextResponse.json({ error: "Error al actualizar estado" }, { status: 500 });
    }
}
