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

// POST - Actualizar configuración (toggle activo / fecha límite para admin)
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: any = {};
    
    if (body.activo !== undefined) updateData.activo = body.activo;
    if (body.fechaLimite !== undefined) {
        updateData.fechaLimite = body.fechaLimite ? new Date(body.fechaLimite) : null;
    }

    const config = await prisma.capemsConfig.upsert({
        where: { id: "singleton" },
        update: updateData,
        create: { id: "singleton", ...updateData },
    });

    return NextResponse.json(config);
}
