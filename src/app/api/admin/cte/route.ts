import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/cte — Tablero zonal de sesiones de CTE con semáforo de entregas y compromisos */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const user = session.user as any;
        const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        const userRole = (user.role || "director") as "admin" | "supervision" | "director";
        const isDirector = userRole === "director";
        const directorEscuelaId = user.id;

        const [sesiones, escuelas] = await Promise.all([
            prisma.cteSesionConfig.findMany({
                where: { tenantId },
                include: {
                    productos: {
                        where: isDirector ? { escuelaId: directorEscuelaId } : undefined,
                        include: { escuela: { select: { id: true, cct: true, nombre: true } } },
                    },
                    _count: {
                        select: { compromisos: true, productos: true },
                    },
                },
                orderBy: [{ fase: "asc" }, { numero: "asc" }],
            }),
            prisma.escuela.findMany({
                where: isDirector
                    ? { id: directorEscuelaId }
                    : { esDePrueba: false, esSupervision: false },
                select: { id: true, cct: true, nombre: true },
                orderBy: { nombre: "asc" },
            }),
        ]);

        return NextResponse.json({ sesiones, escuelas });
    } catch (error: any) {
        console.error("Error en GET /api/admin/cte:", error);
        return NextResponse.json({ error: error.message || "Error al obtener sesiones CTE" }, { status: 500 });
    }
}

/** POST /api/admin/cte — Crear nueva sesión de CTE (solo admin/supervisión) */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const user = session.user as any;
        const userRole = (user.role || "director") as "admin" | "supervision" | "director";
        if (userRole === "director") {
            return NextResponse.json({ error: "No tiene permisos para crear sesiones de CTE" }, { status: 403 });
        }

        const tenantId = user.tenantId || user.organizacionId || process.env.TENANT_ID;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        const body = await req.json();
        const { numero, fase, tipoSesion = "CAPEMS", descripcion, fechaSesion, fechaLimite, guiaUrl } = body;

        if (!numero || !fase) {
            return NextResponse.json({ error: "numero y fase son requeridos" }, { status: 400 });
        }

        const tipoSesionFinal = String(tipoSesion || "CAPEMS");
        const sesion = await prisma.cteSesionConfig.upsert({
            where: {
                tenantId_numero_fase_tipoSesion: {
                    tenantId,
                    numero: Number(numero),
                    fase,
                    tipoSesion: tipoSesionFinal
                }
            },
            update: {
                tipoSesion: tipoSesionFinal,
                descripcion,
                fechaSesion: fechaSesion ? new Date(fechaSesion) : null,
                fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
                guiaUrl,
                activo: true,
            },
            create: {
                tenantId,
                numero: Number(numero),
                fase,
                tipoSesion: tipoSesionFinal,
                descripcion,
                fechaSesion: fechaSesion ? new Date(fechaSesion) : null,
                fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
                guiaUrl,
            },
        });

        return NextResponse.json(sesion, { status: 201 });
    } catch (error: any) {
        console.error("Error en POST /api/admin/cte:", error);
        return NextResponse.json({ error: error.message || "Error al guardar sesión CTE" }, { status: 500 });
    }
}
