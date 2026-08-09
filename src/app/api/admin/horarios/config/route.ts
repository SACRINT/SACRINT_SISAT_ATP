/**
 * GET  /api/admin/horarios/config  → Lee la config global de Horarios IA
 * POST /api/admin/horarios/config  → Actualiza la configuración global
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
        requiereApiKeyHorarios: config?.requiereApiKeyHorarios ?? true,
        requiereExpedientesHorarios: config?.requiereExpedientesHorarios ?? true,
    });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { modoSinRestriccionesHorarios, requiereApiKeyHorarios, requiereExpedientesHorarios } = await req.json();

    const config = await prisma.preRevisionConfig.upsert({
        where: { id: "singleton" },
        create: {
            id: "singleton",
            modoSinRestriccionesHorarios: modoSinRestriccionesHorarios ?? false,
            requiereApiKeyHorarios: requiereApiKeyHorarios ?? true,
            requiereExpedientesHorarios: requiereExpedientesHorarios ?? true,
        },
        update: {
            ...(modoSinRestriccionesHorarios !== undefined && { modoSinRestriccionesHorarios }),
            ...(requiereApiKeyHorarios !== undefined && { requiereApiKeyHorarios }),
            ...(requiereExpedientesHorarios !== undefined && { requiereExpedientesHorarios }),
        },
    });

    return NextResponse.json({
        ok: true,
        modoSinRestriccionesHorarios: config.modoSinRestriccionesHorarios,
        requiereApiKeyHorarios: config.requiereApiKeyHorarios,
        requiereExpedientesHorarios: config.requiereExpedientesHorarios,
    });
}
