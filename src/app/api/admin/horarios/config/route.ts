/**
 * GET  /api/admin/horarios/config  → Lee la config global de Horarios IA
 * POST /api/admin/horarios/config  → Actualiza modoSinRestriccionesHorarios
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const config = await prisma.preRevisionConfig.findUnique({ where: { id: "singleton" } });

    return NextResponse.json({
        modoSinRestriccionesHorarios: config?.modoSinRestriccionesHorarios ?? false,
    });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { modoSinRestriccionesHorarios } = await req.json();

    const config = await prisma.preRevisionConfig.upsert({
        where: { id: "singleton" },
        create: {
            id: "singleton",
            modoSinRestriccionesHorarios: modoSinRestriccionesHorarios ?? false,
        },
        update: {
            ...(modoSinRestriccionesHorarios !== undefined && { modoSinRestriccionesHorarios }),
        },
    });

    return NextResponse.json({ ok: true, modoSinRestriccionesHorarios: config.modoSinRestriccionesHorarios });
}
