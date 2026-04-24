import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// POST - Reordenar CAPEMS (recibe un array de { id, orden })
export async function POST(req: Request) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const items: { id: string; orden: number }[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "Se requiere un array de items con id y orden" }, { status: 400 });
    }

    try {
        await prisma.$transaction(
            items.map((item) =>
                prisma.capem.update({
                    where: { id: item.id },
                    data: { orden: item.orden },
                })
            )
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error reordenando CAPEMS:", error);
        return NextResponse.json({ error: "Error al reordenar" }, { status: 500 });
    }
}
