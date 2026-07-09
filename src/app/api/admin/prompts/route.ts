import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: Obtener todas las plantillas de evaluación
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const plantillas = await prisma.plantillaEvaluacion.findMany({
            orderBy: { modulo: "asc" }
        });

        return NextResponse.json(plantillas);
    } catch (error: unknown) {
        console.error("GET Prompts error:", error);
        return NextResponse.json({ error: "Error al obtener plantillas" }, { status: 500 });
    }
}
