import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/cte/[id]/estado — Actualizar estado de un producto CTE (solo admin/supervisión) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as any;
    const userRole = (user.role || "director") as "admin" | "supervision" | "director";
    if (userRole === "director") {
        return NextResponse.json({ error: "No tiene permisos para modificar estados de productos CTE" }, { status: 403 });
    }

    const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
    if (!tenantId) {
        return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
    }

    const { id } = await params;
    const body = await req.json();
    const { estado, notasAtp } = body;

    const estadosValidos = ["PENDIENTE", "ENTREGADO", "REVISADO", "OBSERVACIONES"];
    if (estado && !estadosValidos.includes(estado)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const productoExistente = await prisma.cteProductoEscuela.findUnique({
        where: { id },
    });

    if (!productoExistente || productoExistente.tenantId !== tenantId) {
        return NextResponse.json({ error: "Producto CTE no encontrado" }, { status: 404 });
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
