import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
        modoSinRestricciones: false,
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
            modoSinRestricciones: modoSinRestricciones ?? false,
        },
        update: {
            ...(activoGlobal !== undefined && { activoGlobal }),
            ...(requierePaecPec !== undefined && { requierePaecPec }),
            ...(requiereApiKey !== undefined && { requiereApiKey }),
            ...(modoSinRestricciones !== undefined && { modoSinRestricciones }),
        },
    });

    // Sincronizar en cascada con todas las escuelas para mantener total consistencia
    const escuelas = await prisma.escuela.findMany();
    await Promise.all(
        escuelas
            .filter((esc) => !(esc as any).esSupervision)
            .map((esc) => {
                const perms = (esc.permisos as any) || {};
                const nuevosPerms = { ...perms };

                if (activoGlobal !== undefined) {
                    nuevosPerms.planeacionesDesactivado = !activoGlobal;
                }
                if (requiereApiKey !== undefined) {
                    // Si requiereApiKey es false (desactivado), se exime a las escuelas (planeacionesSinApiKey = true)
                    nuevosPerms.planeacionesSinApiKey = !requiereApiKey;
                }
                if (requierePaecPec !== undefined) {
                    // Si requierePaecPec es false (desactivado), se exime a las escuelas (planeacionesSinPaec = true)
                    nuevosPerms.planeacionesSinPaec = !requierePaecPec;
                }

                return prisma.escuela.update({
                    where: { id: esc.id },
                    data: { permisos: nuevosPerms },
                });
            })
    );

    revalidatePath("/admin");
    revalidatePath("/director");

    return NextResponse.json({ ok: true, config });
}
