import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Obtener configuración de visibilidad del sidebar admin
export async function GET() {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let config = await prisma.adminSidebarConfig.findUnique({ where: { id: "singleton" } });
    if (!config) {
        config = await prisma.adminSidebarConfig.create({
            data: { id: "singleton" },
        });
    }
    return NextResponse.json(config);
}

// PATCH - Actualizar visibilidad de módulos en el sidebar
export async function PATCH(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: Record<string, boolean> = {};

    const fields = ["showRecursos", "showEventos", "showCircular05", "showOlimpiada", "showPAEC", "showCapems", "showExpedientes"];
    for (const field of fields) {
        if (body[field] !== undefined) {
            updateData[field] = body[field];
        }
    }

    const config = await prisma.adminSidebarConfig.upsert({
        where: { id: "singleton" },
        update: updateData,
        create: { id: "singleton", ...updateData },
    });

    return NextResponse.json(config);
}
