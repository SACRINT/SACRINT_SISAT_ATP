import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin" || (session.user as any)?.dbRole !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const id = params.id;
        const data = await request.json();

        // Si se envía contraseña, la actualizamos
        const updateData: any = {};
        if (data.nombre) updateData.nombre = data.nombre;
        if (data.email) updateData.email = data.email;
        if (data.role) updateData.role = data.role;

        if (data.password && data.password.trim() !== "") {
            updateData.password = await bcrypt.hash(data.password, 12);
        }

        const admin = await prisma.admin.update({
            where: { id },
            data: updateData,
            select: { id: true, nombre: true, email: true, role: true }
        });

        return NextResponse.json(admin);
    } catch (error) {
        return NextResponse.json({ error: "Error al actualizar administrador" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin" || (session.user as any)?.dbRole !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const id = params.id;

        // Validar que no se auto-elimine
        if ((session.user as any).id === id) {
            return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
        }

        await prisma.admin.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        // Puede fallar si existen correcciones asociadas por la restricción de FK
        return NextResponse.json({ error: "Error al eliminar administrador. Puede que tenga correcciones asociadas." }, { status: 500 });
    }
}
