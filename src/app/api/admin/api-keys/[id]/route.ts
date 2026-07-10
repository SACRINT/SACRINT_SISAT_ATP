import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH - Actualizar llave de API (activar/desactivar, cambiar etiqueta, cambiar tipo o actualizar clave)
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();

        const keyRecord = await prisma.apiKey.findUnique({
            where: { id },
        });

        if (!keyRecord) {
            return NextResponse.json({ error: "Llave de API no encontrada" }, { status: 404 });
        }

        const updateData: any = {};
        if (body.label !== undefined) updateData.label = body.label.trim();
        if (body.active !== undefined) updateData.active = !!body.active;
        if (body.isPremium !== undefined) updateData.isPremium = !!body.isPremium;
        if (body.key !== undefined && body.key.trim() !== "") {
            updateData.key = body.key.trim();
            updateData.errorCount = 0; // reset error count if they update the key string
            updateData.active = true; // reactivate automatically on edit
        }

        const updated = await prisma.apiKey.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            ...updated,
            key: `${updated.key.slice(0, 6)}...${updated.key.slice(-4)}`
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al actualizar la llave" }, { status: 500 });
    }
}

// DELETE - Eliminar llave de API
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;

        const keyRecord = await prisma.apiKey.findUnique({
            where: { id },
        });

        if (!keyRecord) {
            return NextResponse.json({ error: "Llave de API no encontrada" }, { status: 404 });
        }

        await prisma.apiKey.delete({
            where: { id },
        });

        return NextResponse.json({ success: true, message: "Llave de API eliminada" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error al eliminar la llave" }, { status: 500 });
    }
}
