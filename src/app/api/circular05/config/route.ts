import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET - Obtener configuración de Circular 05
export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let config = await prisma.circular05Config.findUnique({ where: { id: "singleton" } });
    if (!config) {
        config = await prisma.circular05Config.create({
            data: { id: "singleton", activo: false },
        });
    }
    return NextResponse.json(config);
}

// PATCH - Actualizar configuración
export async function PATCH(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || !["ATP_ADMIN", "SUPER_ADMIN", "ATP_LECTOR"].includes(user?.role || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: any = {};
    if (body.activo !== undefined) updateData.activo = body.activo;
    if (body.destinatario !== undefined) updateData.destinatario = body.destinatario;
    if (body.cargoDestinatario !== undefined) updateData.cargoDestinatario = body.cargoDestinatario;
    if (body.zonaDestinatario !== undefined) updateData.zonaDestinatario = body.zonaDestinatario;

    const config = await prisma.circular05Config.upsert({
        where: { id: "singleton" },
        update: updateData,
        create: {
            id: "singleton",
            activo: body.activo ?? false,
            destinatario: body.destinatario ?? "ING. ALEJANDRO ESCAMILLA MARTINEZ",
            cargoDestinatario: body.cargoDestinatario ?? "SUPERVISOR ESCOLAR DE BACHILLERATOS GENERALES",
            zonaDestinatario: body.zonaDestinatario ?? "ZONA 004, VENUSTIANO CARRANZA PUEBLA",
        },
    });

    return NextResponse.json(config);
}
