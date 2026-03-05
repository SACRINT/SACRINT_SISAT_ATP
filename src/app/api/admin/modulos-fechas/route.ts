import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/modulos-fechas
 * Returns the deadline dates for the 3 special modules.
 */
export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const [eventos, olimpiada, paec] = await Promise.all([
            prisma.eventosConfig.upsert({
                where: { id: "singleton" },
                update: {},
                create: { id: "singleton", activo: false },
                select: { fechaLimite: true },
            }),
            prisma.olimpiadaConfig.upsert({
                where: { id: "singleton" },
                update: {},
                create: { id: "singleton", activo: false },
                select: { fechaLimite: true },
            }),
            prisma.encuentroPAECConfig.upsert({
                where: { id: "singleton" },
                update: {},
                create: { id: "singleton", activo: false },
                select: { fechaLimite: true },
            }),
        ]);

        return NextResponse.json({
            modulos: [
                { id: "eventos", nombre: "Eventos Culturales", fechaLimite: eventos.fechaLimite },
                { id: "olimpiada", nombre: "Olimpiada de Matemáticas", fechaLimite: olimpiada.fechaLimite },
                { id: "paec", nombre: "Encuentro PAEC", fechaLimite: paec.fechaLimite },
            ],
        });
    } catch (error: unknown) {
        console.error("GET modulos-fechas:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/modulos-fechas
 * Update a deadline date for a specific module.
 * Body: { modulo: "eventos"|"olimpiada"|"paec", fechaLimite: "2026-03-15" | null }
 */
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { modulo, fechaLimite } = body;

        if (!modulo) {
            return NextResponse.json({ error: "modulo requerido" }, { status: 400 });
        }

        const fecha = fechaLimite ? new Date(fechaLimite) : null;

        if (modulo === "eventos") {
            await prisma.eventosConfig.upsert({
                where: { id: "singleton" },
                update: { fechaLimite: fecha },
                create: { id: "singleton", activo: false, fechaLimite: fecha },
            });
        } else if (modulo === "olimpiada") {
            await prisma.olimpiadaConfig.upsert({
                where: { id: "singleton" },
                update: { fechaLimite: fecha },
                create: { id: "singleton", activo: false, fechaLimite: fecha },
            });
        } else if (modulo === "paec") {
            await prisma.encuentroPAECConfig.upsert({
                where: { id: "singleton" },
                update: { fechaLimite: fecha },
                create: { id: "singleton", activo: false, fechaLimite: fecha },
            });
        } else {
            return NextResponse.json({ error: "modulo inválido" }, { status: 400 });
        }

        return NextResponse.json({ ok: true, modulo, fechaLimite: fecha });
    } catch (error: unknown) {
        console.error("PATCH modulos-fechas:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
