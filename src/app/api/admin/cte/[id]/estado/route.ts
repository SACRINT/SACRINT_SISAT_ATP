import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/** PATCH /api/admin/cte/[id]/estado — Actualizar estado de un producto CTE */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { estado, notasAtp } = body;

    const estadosValidos = ["PENDIENTE", "ENTREGADO", "REVISADO", "OBSERVACIONES"];
    if (estado && !estadosValidos.includes(estado)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const producto = await prisma.cteProductoEscuela.update({
        where: { id },
        data: {
            ...(estado && { estado }),
            ...(notasAtp !== undefined && { notasAtp }),
        },
    });

    return NextResponse.json(producto);
}
