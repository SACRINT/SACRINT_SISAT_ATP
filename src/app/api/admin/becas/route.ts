import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/** GET /api/admin/becas — Listado de convocatorias informativas de Becas Benito Juárez */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const soloActivas = searchParams.get("activas") === "true";

    const convocatorias = await prisma.becaConvocatoriaInformativa.findMany({
        where: {
            tenantId: "zona004",
            ...(soloActivas && { activo: true }),
        },
        orderBy: { fechaPublicacion: "desc" },
    });

    return NextResponse.json(convocatorias);
}

/** POST /api/admin/becas — Publicar nueva convocatoria informativa de Becas Benito Juárez
 *  NOTA: Solo información pública. PROHIBIDO guardar padrones, folios SUBES o datos de becarios.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { titulo, descripcion, archivoNombre, archivoUrl, fechaVigencia } = body;

    if (!titulo) return NextResponse.json({ error: "El título es requerido" }, { status: 400 });

    const convocatoria = await prisma.becaConvocatoriaInformativa.create({
        data: {
            tenantId: "zona004",
            titulo,
            descripcion,
            archivoNombre,
            archivoUrl,
            fechaVigencia: fechaVigencia ? new Date(fechaVigencia) : null,
        },
    });

    return NextResponse.json(convocatoria, { status: 201 });
}
