import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Obtener configuración de pre-revisión IA
export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let config = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });
    if (!config) {
        config = await prisma.preRevisionConfig.create({
            data: { id: "singleton", activoDirectores: false, limiteIntentos: 3 },
        });
    }
    return NextResponse.json(config);
}

// POST - Crear o actualizar la configuración de pre-revisión IA
export async function POST(req: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as { role?: string } | undefined;
    const userRole = user?.role;
    // Only admin/ATP role can update the configuration
    if (userRole !== "admin") {
        return NextResponse.json({ error: "Prohibido: requiere rol administrador" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: any = {};
    if (body.activoDirectores !== undefined) updateData.activoDirectores = body.activoDirectores;
    if (body.limiteIntentos !== undefined) updateData.limiteIntentos = Number(body.limiteIntentos);

    const config = await prisma.preRevisionConfig.upsert({
        where: { id: "singleton" },
        update: updateData,
        create: {
            id: "singleton",
            activoDirectores: body.activoDirectores ?? false,
            limiteIntentos: body.limiteIntentos !== undefined ? Number(body.limiteIntentos) : 3,
        },
    });

    return NextResponse.json(config);
}
