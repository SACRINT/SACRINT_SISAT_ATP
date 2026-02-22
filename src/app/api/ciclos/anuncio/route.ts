import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { anuncioGlobal } = await request.json();

        // Get active ciclo
        const ciclo = await prisma.cicloEscolar.findFirst({
            where: { activo: true },
        });

        if (!ciclo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 404 });
        }

        const updatedCiclo = await prisma.cicloEscolar.update({
            where: { id: ciclo.id },
            data: { anuncioGlobal },
        });

        return NextResponse.json({ success: true, anuncioGlobal: updatedCiclo.anuncioGlobal });
    } catch (error: unknown) {
        console.error("Error updating anuncio global:", error);
        return NextResponse.json({ error: "Error al actualizar anuncio global" }, { status: 500 });
    }
}
