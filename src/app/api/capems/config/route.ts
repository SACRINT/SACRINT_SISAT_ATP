import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Obtener configuración de CAPEMS
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let config = await prisma.capemsConfig.findUnique({ where: { id: "singleton" } });
    if (!config) {
        config = await prisma.capemsConfig.create({
            data: { id: "singleton", activo: false },
        });
    }
    return NextResponse.json(config);
}

// PATCH - Actualizar configuración (toggle activo para directores)
export async function PATCH(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const config = await prisma.capemsConfig.upsert({
        where: { id: "singleton" },
        update: { activo: body.activo ?? false },
        create: { id: "singleton", activo: body.activo ?? false },
    });

    return NextResponse.json(config);
}
