import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: Obtener configuración de Olimpiada
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const config = await prisma.olimpiadaConfig.findUnique({ where: { id: "singleton" } });
    return NextResponse.json(config || { id: "singleton", activo: false, convocatoriaUrl: null });
}

// POST: Toggle activo + actualizar convocatoriaUrl
export async function POST(req: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || !["ATP", "ATP_ADMIN"].includes(user?.role || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { activo, convocatoriaUrl } = await req.json();

    const config = await prisma.olimpiadaConfig.upsert({
        where: { id: "singleton" },
        update: {
            ...(activo !== undefined && { activo }),
            ...(convocatoriaUrl !== undefined && { convocatoriaUrl }),
        },
        create: {
            id: "singleton",
            activo: activo ?? false,
            convocatoriaUrl: convocatoriaUrl ?? null,
        },
    });

    return NextResponse.json(config);
}
