import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { EstadoEstadistica911 } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        if (user?.role !== "admin" && user?.role !== "superadmin" && user?.role !== "ATP") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { estado, notasAtp } = body;

        const updateData: { estado?: EstadoEstadistica911; notasAtp?: string } = {};

        if (estado && Object.values(EstadoEstadistica911).includes(estado as EstadoEstadistica911)) {
            updateData.estado = estado as EstadoEstadistica911;
        }

        if (typeof notasAtp === "string") {
            updateData.notasAtp = notasAtp;
        }

        const registro = await prisma.estadistica911Registro.update({
            where: { id, tenantId },
            data: updateData
        });

        return NextResponse.json({ success: true, registro });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al actualizar estado del registro 911";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/[id]/estado",
            metodo: "PATCH",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
