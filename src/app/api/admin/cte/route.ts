import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/** GET /api/admin/cte — Tablero zonal de sesiones de CTE con semáforo de entregas */
export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const tenantId = "zona004";

    const [sesiones, escuelas] = await Promise.all([
        prisma.cteSesionConfig.findMany({
            where: { tenantId },
            include: {
                productos: {
                    include: { escuela: { select: { id: true, cct: true, nombre: true } } },
                },
            },
            orderBy: [{ fase: "asc" }, { numero: "asc" }],
        }),
        prisma.escuela.findMany({
            where: { esDePrueba: false, esSupervision: false },
            select: { id: true, cct: true, nombre: true },
            orderBy: { nombre: "asc" },
        }),
    ]);

    return NextResponse.json({ sesiones, escuelas });
}

/** POST /api/admin/cte — Crear nueva sesión de CTE */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { numero, fase, descripcion, fechaSesion, fechaLimite, guiaUrl } = body;

    if (!numero || !fase) {
        return NextResponse.json({ error: "numero y fase son requeridos" }, { status: 400 });
    }

    const tenantId = "zona004";

    const sesion = await prisma.cteSesionConfig.upsert({
        where: { tenantId_numero_fase: { tenantId, numero: Number(numero), fase } },
        update: { descripcion, fechaSesion: fechaSesion ? new Date(fechaSesion) : null, fechaLimite: fechaLimite ? new Date(fechaLimite) : null, guiaUrl, activo: true },
        create: { tenantId, numero: Number(numero), fase, descripcion, fechaSesion: fechaSesion ? new Date(fechaSesion) : null, fechaLimite: fechaLimite ? new Date(fechaLimite) : null, guiaUrl },
    });

    return NextResponse.json(sesion, { status: 201 });
}
