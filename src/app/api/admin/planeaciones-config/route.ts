/**
 * GET  /api/admin/planeaciones-config  → Lee la configuración global del módulo de planeaciones
 * POST /api/admin/planeaciones-config  → Actualiza la configuración global
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const config = await prisma.planeacionesConfig.findUnique({ where: { id: "singleton" } });

    // Si no existe, devuelve los defaults habilitados para fácil inicio
    return NextResponse.json(config ?? {
        id: "singleton",
        activoGlobal: true,
        requierePaecPec: true,
        requiereApiKey: true,
        modoSinRestricciones: true,
    });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { activoGlobal, requierePaecPec, requiereApiKey, modoSinRestricciones } = body;

    const config = await prisma.planeacionesConfig.upsert({
        where: { id: "singleton" },
        create: {
            id: "singleton",
            activoGlobal: activoGlobal ?? true,
            requierePaecPec: requierePaecPec ?? true,
            requiereApiKey: requiereApiKey ?? true,
            modoSinRestricciones: modoSinRestricciones ?? true,
        },
        update: {
            ...(activoGlobal !== undefined && { activoGlobal }),
            ...(requierePaecPec !== undefined && { requierePaecPec }),
            ...(requiereApiKey !== undefined && { requiereApiKey }),
            ...(modoSinRestricciones !== undefined && { modoSinRestricciones }),
        },
    });

    return NextResponse.json({ ok: true, config });
}
