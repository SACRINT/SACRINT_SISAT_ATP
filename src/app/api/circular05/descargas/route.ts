import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET - Obtener descargas agrupadas por escuela
export async function GET() {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || !["ATP_ADMIN", "SUPER_ADMIN", "ATP_LECTOR"].includes(user?.role || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const descargas = await prisma.circular05Descarga.findMany({
        include: {
            escuela: {
                select: { id: true, cct: true, nombre: true, localidad: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    // Agrupar por escuela
    const agrupado: Record<string, {
        escuelaId: string;
        cct: string;
        nombre: string;
        localidad: string;
        totalDescargas: number;
        ultimaDescarga: string;
    }> = {};

    for (const d of descargas) {
        if (!agrupado[d.escuelaId]) {
            agrupado[d.escuelaId] = {
                escuelaId: d.escuelaId,
                cct: d.escuela.cct,
                nombre: d.escuela.nombre,
                localidad: d.escuela.localidad,
                totalDescargas: 0,
                ultimaDescarga: d.createdAt.toISOString(),
            };
        }
        agrupado[d.escuelaId].totalDescargas++;
    }

    return NextResponse.json(Object.values(agrupado));
}
