import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/** GET /api/admin/becas — Listado de convocatorias informativas de Becas Benito Juárez */
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const tenantId = (session.user as any)?.organizacionId || (session.user as any)?.tenantId || process.env.TENANT_ID || "zona004";
        const { searchParams } = new URL(req.url);
        const soloActivas = searchParams.get("activas") === "true";

        const convocatorias = await prisma.becaConvocatoriaInformativa.findMany({
            where: {
                tenantId,
                ...(soloActivas && { activo: true }),
            },
            orderBy: { fechaPublicacion: "desc" },
        });

        return NextResponse.json(convocatorias);
    } catch (error: any) {
        console.error("Error en GET /api/admin/becas:", error);
        return NextResponse.json({ error: error.message || "Error al obtener convocatorias" }, { status: 500 });
    }
}

/** POST /api/admin/becas — Publicar nueva convocatoria informativa de Becas Benito Juárez
 *  NOTA: Solo información pública. PROHIBIDO guardar padrones, folios SUBES o datos de becarios.
 */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const tenantId = (session.user as any)?.organizacionId || (session.user as any)?.tenantId || process.env.TENANT_ID || "zona004";
        const body = await req.json();
        const { titulo, descripcion, archivoNombre, archivoUrl, fechaVigencia } = body;

        if (!titulo) return NextResponse.json({ error: "El título es requerido" }, { status: 400 });

        const convocatoria = await prisma.becaConvocatoriaInformativa.create({
            data: {
                tenantId,
                titulo,
                descripcion,
                archivoNombre,
                archivoUrl,
                fechaVigencia: fechaVigencia ? new Date(fechaVigencia) : null,
            },
        });

        return NextResponse.json(convocatoria, { status: 201 });
    } catch (error: any) {
        console.error("Error en POST /api/admin/becas:", error);
        return NextResponse.json({ error: error.message || "Error al crear convocatoria" }, { status: 500 });
    }
}
