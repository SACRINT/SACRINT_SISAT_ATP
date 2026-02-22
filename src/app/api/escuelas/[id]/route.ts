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
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const escuelaId = params.id;

        const data = await request.json();
        const { nombre, email, director, password } = data;

        const updateData: any = {
            nombre: nombre !== undefined ? nombre : undefined,
            email: email !== undefined ? email : undefined,
            director: director !== undefined ? director : undefined,
        };

        if (password && password.trim().length > 0) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const escuelaUpdate = await prisma.escuela.update({
            where: { id: escuelaId },
            data: updateData,
        });

        return NextResponse.json(escuelaUpdate);
    } catch (error: any) {
        console.error("Error updating escuela:", error);
        return NextResponse.json({ error: "Ocurrió un error al actualizar los datos del centro de trabajo" }, { status: 500 });
    }
}
