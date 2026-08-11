import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { EstadoPlantilla } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Obtener todas las escuelas de la zona
        const escuelas = await prisma.escuela.findMany({
            orderBy: { nombre: "asc" },
            select: {
                id: true,
                cct: true,
                nombre: true,
                zonaEscolar: true
            }
        });

        // Obtener registros de plantillas
        const registros = await prisma.plantillaPersonalRegistro.findMany({
            where: { tenantId },
            include: {
                _count: {
                    select: {
                        plazas: true,
                        inconsistencias: true
                    }
                },
                inconsistencias: {
                    orderBy: { createdAt: "desc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ escuelas, registros });
    } catch (err: unknown) {
        const session = await auth();
        const user = session?.user as { organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        const msg = err instanceof Error ? err.message : "Error al obtener plantillas";
        await registrarError(tenantId, {
            mensaje: msg,
            ruta: "/api/admin/plantillas",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { id, estado, observacionesSupervision } = body as {
            id: string;
            estado: EstadoPlantilla;
            observacionesSupervision?: string;
        };

        if (!id || !estado) {
            return NextResponse.json({ error: "Faltan parámetros obligatorios (id, estado)" }, { status: 400 });
        }

        const existente = await prisma.plantillaPersonalRegistro.findUnique({
            where: { id, tenantId }
        });

        if (!existente) {
            return NextResponse.json({ error: "Registro de plantilla no encontrado" }, { status: 404 });
        }

        // Definición de transiciones de estado permitidas
        const TRANSICIONES_VALIDAS: Record<string, string[]> = {
            PENDIENTE: ["RECIBIDO", "CON_ERRORES", "CORREGIR"],
            RECIBIDO: ["VALIDADO", "CON_ERRORES", "CORREGIR"],
            CON_ERRORES: ["CORREGIR", "RECIBIDO", "VALIDADO"],
            CORREGIR: ["RECIBIDO", "VALIDADO", "CON_ERRORES"],
            VALIDADO: ["LISTO_PARA_CORDE", "CORREGIR"],
            LISTO_PARA_CORDE: ["ENTREGADO_A_CORDE", "CORREGIR", "VALIDADO"],
            ENTREGADO_A_CORDE: ["LISTO_PARA_CORDE", "CORREGIR"],
            CARGADO: ["EN_VALIDACION", "VALIDADO", "CON_ERRORES"],
            EN_VALIDACION: ["VALIDADO", "CON_ERRORES", "CORREGIR"],
            CONSOLIDADO: ["ENTREGADO_A_CORDE"]
        };

        if (existente.estado !== estado) {
            const permitidas = TRANSICIONES_VALIDAS[existente.estado] || [];
            if (!permitidas.includes(estado)) {
                return NextResponse.json({
                    error: `Transición de estado no permitida de ${existente.estado} a ${estado}. Transiciones válidas desde ${existente.estado}: ${permitidas.join(", ")}`
                }, { status: 400 });
            }
        }

        const actualizado = await prisma.plantillaPersonalRegistro.update({
            where: { id, tenantId },
            data: {
                estado,
                observacionesSupervision: observacionesSupervision ?? undefined,
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ registro: actualizado, mensaje: `Estado actualizado a ${estado}` });
    } catch (err: unknown) {
        const session = await auth();
        const user = session?.user as { organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        const msg = err instanceof Error ? err.message : "Error al actualizar estado de plantilla";
        await registrarError(tenantId, {
            mensaje: msg,
            ruta: "/api/admin/plantillas",
            metodo: "PATCH",
            stack: err instanceof Error ? err.stack : undefined
        });

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Falta el ID del registro" }, { status: 400 });
        }

        await prisma.plantillaPersonalRegistro.deleteMany({
            where: { id, tenantId }
        });

        return NextResponse.json({ mensaje: "Plantilla eliminada correctamente" });
    } catch (err: unknown) {
        const session = await auth();
        const user = session?.user as { organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        const msg = err instanceof Error ? err.message : "Error al eliminar plantilla";
        await registrarError(tenantId, {
            mensaje: msg,
            ruta: "/api/admin/plantillas",
            metodo: "DELETE",
            stack: err instanceof Error ? err.stack : undefined
        });

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
