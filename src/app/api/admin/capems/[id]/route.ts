import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// PATCH - Actualizar CAPEM (nombre, activo, orden)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const updateData: Record<string, any> = {};

    if (body.nombre !== undefined) updateData.nombre = body.nombre.trim();
    if (body.activo !== undefined) updateData.activo = body.activo;
    if (body.orden !== undefined) updateData.orden = body.orden;

    try {
        const capem = await prisma.capem.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(capem);
    } catch (error: any) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "Ya existe un CAPEM con ese nombre en este ciclo" }, { status: 409 });
        }
        if (error.code === "P2025") {
            return NextResponse.json({ error: "CAPEM no encontrado" }, { status: 404 });
        }
        throw error;
    }
}

// DELETE - Eliminar CAPEM (solo si no tiene registros)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    // Verificar que no tenga registros asociados
    const registros = await prisma.capemFichaRegistro.count({ where: { capemId: id } });
    if (registros > 0) {
        return NextResponse.json(
            { error: `No se puede eliminar: tiene ${registros} registro(s) de escuelas asociados` },
            { status: 409 }
        );
    }

    try {
        await prisma.capem.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.code === "P2025") {
            return NextResponse.json({ error: "CAPEM no encontrado" }, { status: 404 });
        }
        throw error;
    }
}
