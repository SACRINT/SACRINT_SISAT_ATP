import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: Obtener configuración de Encuentro PAEC
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const config = await prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } });
    return NextResponse.json(config || { id: "singleton", activo: false, convocatoriaUrl: null, encuentroUrl: null });
}

// POST: Toggle activo + actualizar URLs
export async function POST(req: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || !["ATP", "ATP_ADMIN"].includes(user?.role || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { activo, convocatoriaUrl, encuentroUrl } = await req.json();

    const config = await prisma.encuentroPAECConfig.upsert({
        where: { id: "singleton" },
        update: {
            ...(activo !== undefined && { activo }),
            ...(convocatoriaUrl !== undefined && { convocatoriaUrl }),
            ...(encuentroUrl !== undefined && { encuentroUrl }),
        },
        create: {
            id: "singleton",
            activo: activo ?? false,
            convocatoriaUrl: convocatoriaUrl ?? null,
            encuentroUrl: encuentroUrl ?? null,
        },
    });

    return NextResponse.json(config);
}
