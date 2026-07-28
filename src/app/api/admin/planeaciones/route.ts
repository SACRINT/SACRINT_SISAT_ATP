/**
 * GET /api/admin/planeaciones
 * Lista todas las planeaciones didácticas de la zona (uso exclusivo del admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const session = await auth();
    const user = session?.user as any;
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const planeaciones = await prisma.planeacionDidactica.findMany({
        orderBy: { fechaSubida: "desc" },
        include: {
            escuela: {
                select: { nombre: true, cct: true },
            },
        },
    });

    return NextResponse.json(planeaciones);
}
