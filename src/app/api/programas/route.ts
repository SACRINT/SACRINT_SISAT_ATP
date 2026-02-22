import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const data = await request.json();
        const { nombre, descripcion, tipo, numArchivos, orden } = data;

        if (!nombre || !tipo) {
            return NextResponse.json({ error: "El nombre y el tipo son requeridos" }, { status: 400 });
        }

        const newPrograma = await prisma.programa.create({
            data: {
                nombre,
                descripcion,
                tipo,
                numArchivos: parseInt(numArchivos) || 1,
                orden: parseInt(orden) || 0,
            },
        });

        return NextResponse.json(newPrograma, { status: 201 });
    } catch (error: any) {
        console.error("Error creating programa:", error);
        return NextResponse.json({ error: "No se pudo crear el programa. Verifique que el nombre no esté duplicado." }, { status: 500 });
    }
}
