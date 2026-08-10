import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ESTADOS_VALIDOS = ["PENDIENTE", "APROBADO", "RECHAZADO", "MODIFICADO", "EN_ESPERA"];

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; email?: string; name?: string; organizacionId?: string; tenantId?: string } | undefined;
        
        if (!session || !["admin", "supervision"].includes(user?.role || "")) {
            return NextResponse.json({ error: "No autorizado para cambiar el estado de módulos" }, { status: 401 });
        }

        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Usuario sin organización o tenant asignado" }, { status: 401 });
        }

        const { id } = await context.params;
        const body = await req.json();
        const { estado, comentario } = body;

        if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
            return NextResponse.json(
                { error: `Estado inválido. Estados permitidos: ${ESTADOS_VALIDOS.join(", ")}` },
                { status: 400 }
            );
        }

        const modulo = await prisma.modulePlan.findFirst({
            where: { id, tenantId },
        });

        if (!modulo) {
            return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
        }

        const updated = await prisma.modulePlan.update({
            where: { id },
            data: {
                estado,
                fechaDecision: new Date(),
                decisionPor: user?.name || user?.email || "Administrador",
                comentarioDecision: comentario || null,
            },
        });

        return NextResponse.json({
            success: true,
            modulo: updated,
            message: `Módulo ${id} actualizado a estado "${estado}".`,
        });
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : "Error al actualizar estado del módulo";
        console.error("Error al actualizar estado del módulo:", error);
        return NextResponse.json(
            { error: errMessage },
            { status: 500 }
        );
    }
}
