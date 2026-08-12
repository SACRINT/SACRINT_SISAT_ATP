import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// POST /api/admin/ciclos/seleccionar
// Body: { cicloId: string }  — si cicloId es "" borra la cookie (vuelve al activo)
export async function POST(request: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string } | undefined;
    if (!session || user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { cicloId } = await request.json();

    const response = NextResponse.json({ ok: true });

    if (cicloId) {
        // Setear cookie solo para el panel admin
        response.cookies.set("selectedCicloId", cicloId, {
            httpOnly: true,
            path: "/",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30, // 30 días
        });
    } else {
        // Borrar cookie → vuelve al ciclo activo
        response.cookies.delete("selectedCicloId");
    }

    return response;
}
