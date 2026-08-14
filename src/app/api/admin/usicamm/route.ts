import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/** GET /api/admin/usicamm — Listado de convocatorias USICAMM */
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const tenantId = (session.user as any)?.organizacionId || (session.user as any)?.tenantId || process.env.TENANT_ID || "zona004";
        const { searchParams } = new URL(req.url);
        const soloActivas = searchParams.get("activas") === "true";

        const convocatorias = await prisma.convocatoriaUsicamm.findMany({
            where: {
                tenantId,
                ...(soloActivas && { activo: true }),
            },
            orderBy: { fechaPublicacion: "desc" },
        });

        return NextResponse.json(convocatorias);
    } catch (error: any) {
        console.error("Error en GET /api/admin/usicamm:", error);
        return NextResponse.json({ error: error.message || "Error al obtener convocatorias USICAMM" }, { status: 500 });
    }
}

/** POST /api/admin/usicamm — Publicar nueva convocatoria USICAMM */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const tenantId = (session.user as any)?.organizacionId || (session.user as any)?.tenantId || process.env.TENANT_ID || "zona004";
        const body = await req.json();
        const { titulo, descripcion, tipo, archivoNombre, archivoUrl, fechaVigencia, convocatoriaUrl } = body;

        if (!titulo) return NextResponse.json({ error: "El título es requerido" }, { status: 400 });

        const convocatoria = await prisma.convocatoriaUsicamm.create({
            data: {
                tenantId,
                titulo,
                descripcion,
                tipo: tipo ?? "CONCURSO",
                archivoNombre,
                archivoUrl,
                fechaVigencia: fechaVigencia ? new Date(fechaVigencia) : null,
                convocatoriaUrl,
            },
        });

        return NextResponse.json(convocatoria, { status: 201 });
    } catch (error: any) {
        console.error("Error en POST /api/admin/usicamm:", error);
        return NextResponse.json({ error: error.message || "Error al crear convocatoria USICAMM" }, { status: 500 });
    }
}
