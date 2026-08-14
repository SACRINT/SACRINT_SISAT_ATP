import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/** GET /api/admin/comites — Tablero zonal de comités de convivencia con estado por escuela */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const tenantId = (session.user as any)?.organizacionId || (session.user as any)?.tenantId || process.env.TENANT_ID || "zona004";

        const [comites, escuelas] = await Promise.all([
            prisma.comiteEscolarRegistro.findMany({
                where: { tenantId },
                include: {
                    escuela: { select: { id: true, cct: true, nombre: true } },
                    actas: { orderBy: { createdAt: "desc" }, take: 1 },
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma.escuela.findMany({
                where: { esDePrueba: false, esSupervision: false },
                select: { id: true, cct: true, nombre: true },
                orderBy: { nombre: "asc" },
            }),
        ]);

        return NextResponse.json({ comites, escuelas });
    } catch (error: any) {
        console.error("Error en GET /api/admin/comites:", error);
        return NextResponse.json({ error: error.message || "Error al obtener comités" }, { status: 500 });
    }
}

/** POST /api/admin/comites — Crear o actualizar registro de comité para una escuela */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const body = await req.json();
        const { escuelaId, cicloId, estado, notasAtp, fechaIntegracion } = body;

        if (!escuelaId) return NextResponse.json({ error: "escuelaId es requerido" }, { status: 400 });

        const tenantId = (session.user as any)?.organizacionId || (session.user as any)?.tenantId || process.env.TENANT_ID || "zona004";
        const cicloFinal = cicloId ?? null;

        const comite = await prisma.comiteEscolarRegistro.upsert({
            where: { tenantId_escuelaId_cicloId: { tenantId, escuelaId, cicloId: cicloFinal ?? "" } },
            update: {
                estado: estado ?? undefined,
                notasAtp: notasAtp ?? undefined,
                fechaIntegracion: fechaIntegracion ? new Date(fechaIntegracion) : undefined,
            },
            create: {
                tenantId,
                escuelaId,
                cicloId: cicloFinal,
                estado: estado ?? "PENDIENTE_INTEGRACION",
                notasAtp,
                fechaIntegracion: fechaIntegracion ? new Date(fechaIntegracion) : null,
            },
        });

        return NextResponse.json(comite, { status: 201 });
    } catch (error: any) {
        console.error("Error en POST /api/admin/comites:", error);
        return NextResponse.json({ error: error.message || "Error al actualizar comité" }, { status: 500 });
    }
}
