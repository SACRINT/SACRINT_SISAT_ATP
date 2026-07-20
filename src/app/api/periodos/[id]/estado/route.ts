import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasBackendAccess } from "@/lib/permissions";

// PATCH: Bulk update delivery status for an entire period
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; dbRole?: string; permisos?: any } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        if (!hasBackendAccess(user, "avances", "write")) {
            return NextResponse.json({ error: "No autorizado (sin permisos de escritura en avances)" }, { status: 403 });
        }

        const { id } = await params;
        const { estado } = await req.json();

        const validEstados = [
            "PENDIENTE",
            "EN_REVISION",
            "REQUIERE_CORRECCION",
            "APROBADO",
            "NO_APROBADO",
            "NO_ENTREGADO",
            "EXENTO",
            "ENTREGADO_FISICO",
        ];

        if (!validEstados.includes(estado)) {
            return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
        }

        const result = await prisma.entrega.updateMany({
            where: { periodoEntregaId: id },
            data: { estado },
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (error: unknown) {
        console.error("Bulk estado update error:", error);
        return NextResponse.json({ error: "Error al actualizar estado masivo" }, { status: 500 });
    }
}
