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
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const escuelaId = params.id;

        const data = await request.json();
        const { nombre, email, director, password } = data;

        const updateData: Record<string, string | undefined> = {
            nombre: typeof nombre === "string" ? nombre : undefined,
            email: typeof email === "string" ? email : undefined,
            director: typeof director === "string" ? director : undefined,
        };

        if (password && password.trim().length > 0) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const escuelaUpdate = await prisma.escuela.update({
            where: { id: escuelaId },
            data: updateData,
        });

        return NextResponse.json(escuelaUpdate);
    } catch (error: unknown) {
        console.error("Error updating escuela:", error);
        return NextResponse.json({ error: "Ocurrió un error al actualizar los datos del centro de trabajo" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const escuelaId = params.id;

        await prisma.escuela.delete({
            where: { id: escuelaId },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting escuela:", error);
        return NextResponse.json({ error: "No se pudo eliminar la escuela. Ocurrió un error interno." }, { status: 500 });
    }
}
