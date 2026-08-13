import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const [
            sidebarConfig,
            oficiosConfig,
            sparhConfig,
            estadistica911Config,
            eventosConfig,
            circularConfig,
            olimpiadaConfig,
            paecConfig,
            expedientesConfig,
            planeacionesConfig,
            programas
        ] = await Promise.all([
            prisma.adminSidebarConfig.upsert({
                where: { id: "singleton" },
                update: {},
                create: { id: "singleton" }
            }),
            prisma.oficioConfig.upsert({
                where: { tenantId },
                update: {},
                create: { tenantId }
            }),
            prisma.plantillaCorteConfig.upsert({
                where: { tenantId },
                update: {},
                create: { tenantId }
            }),
            prisma.estadisticaPeriodoConfig.upsert({
                where: { tenantId },
                update: {},
                create: { tenantId }
            }),
            prisma.eventosConfig.findUnique({ where: { id: "singleton" } }),
            prisma.circular05Config.findUnique({ where: { id: "singleton" } }),
            prisma.olimpiadaConfig.findUnique({ where: { id: "singleton" } }),
            prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } }),
            prisma.expedientesConfig.findUnique({ where: { id: "singleton" } }),
            prisma.planeacionesConfig.findUnique({ where: { id: "singleton" } }),
            prisma.programa.findMany({
                orderBy: { orden: "asc" }
            })
        ]);

        return NextResponse.json({
            sidebarConfig,
            oficiosConfig,
            sparhConfig,
            estadistica911Config,
            eventosConfig,
            circularConfig,
            olimpiadaConfig,
            paecConfig,
            expedientesConfig,
            planeacionesConfig,
            programas
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al obtener activación de módulos";
        await registrarError("zona004", {
            mensaje: msg,
            ruta: "/api/admin/modulos-activacion",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId || "zona004";

        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { modulo, activo } = body as { modulo?: string; activo?: boolean };

        if (!modulo || typeof activo !== "boolean") {
            return NextResponse.json({ error: "Faltan parámetros obligatorios (modulo, activo)" }, { status: 400 });
        }

        if (modulo === "oficios") {
            await prisma.adminSidebarConfig.upsert({
                where: { id: "singleton" },
                update: { showOficios: activo },
                create: { id: "singleton", showOficios: activo }
            });
            await prisma.oficioConfig.upsert({
                where: { tenantId },
                update: { activo, visibleEnDirector: activo },
                create: { tenantId, activo, visibleEnDirector: activo }
            });
        } else if (modulo === "sparh") {
            await prisma.adminSidebarConfig.upsert({
                where: { id: "singleton" },
                update: { showSparh: activo },
                create: { id: "singleton", showSparh: activo }
            });
            await prisma.plantillaCorteConfig.upsert({
                where: { tenantId },
                update: { activo, visibleEnDirector: activo },
                create: { tenantId, activo, visibleEnDirector: activo }
            });
        } else if (modulo === "becas") {
            await prisma.adminSidebarConfig.upsert({
                where: { id: "singleton" },
                update: { showBecas: activo },
                create: { id: "singleton", showBecas: activo }
            });
        } else if (modulo === "estadistica911" || modulo === "911") {
            await prisma.adminSidebarConfig.upsert({
                where: { id: "singleton" },
                update: { showEstadistica911: activo },
                create: { id: "singleton", showEstadistica911: activo }
            });
            await prisma.estadisticaPeriodoConfig.upsert({
                where: { tenantId },
                update: { activo, visibleEnDirector: activo },
                create: { tenantId, activo, visibleEnDirector: activo }
            });
        } else {
            return NextResponse.json({ error: `Módulo desconocido: ${modulo}` }, { status: 400 });
        }

        return NextResponse.json({ ok: true, activo });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al actualizar activación de módulo";
        await registrarError("zona004", {
            mensaje: msg,
            ruta: "/api/admin/modulos-activacion",
            metodo: "POST",
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

        if (!session || !["admin", "supervision"].includes(user?.role || "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();

        // 1. Actualizar AdminSidebarConfig si se enviaron valores
        if (body.sidebarConfig) {
            await prisma.adminSidebarConfig.upsert({
                where: { id: "singleton" },
                update: body.sidebarConfig,
                create: { id: "singleton", ...body.sidebarConfig }
            });
        }

        // 2. Oficios Config
        if (body.oficiosConfig) {
            await prisma.oficioConfig.upsert({
                where: { tenantId },
                update: {
                    activo: body.oficiosConfig.activo,
                    visibleEnDirector: body.oficiosConfig.visibleEnDirector
                },
                create: {
                    tenantId,
                    activo: body.oficiosConfig.activo ?? true,
                    visibleEnDirector: body.oficiosConfig.visibleEnDirector ?? true
                }
            });
        }

        // 3. SPARH Config
        if (body.sparhConfig) {
            await prisma.plantillaCorteConfig.upsert({
                where: { tenantId },
                update: {
                    activo: body.sparhConfig.activo,
                    visibleEnDirector: body.sparhConfig.visibleEnDirector
                },
                create: {
                    tenantId,
                    activo: body.sparhConfig.activo ?? true,
                    visibleEnDirector: body.sparhConfig.visibleEnDirector ?? true
                }
            });
        }

        // 3.5. Estadística 911 Config
        if (body.estadistica911Config) {
            await prisma.estadisticaPeriodoConfig.upsert({
                where: { tenantId },
                update: {
                    activo: body.estadistica911Config.activo,
                    visibleEnDirector: body.estadistica911Config.visibleEnDirector
                },
                create: {
                    tenantId,
                    activo: body.estadistica911Config.activo ?? true,
                    visibleEnDirector: body.estadistica911Config.visibleEnDirector ?? true
                }
            });
        }

        // 4. Módulos especiales (Eventos, PAEC, Circular05, Olimpiada, Planeaciones)
        if (typeof body.eventosActivo === "boolean") {
            await prisma.eventosConfig.upsert({
                where: { id: "singleton" },
                update: { activo: body.eventosActivo },
                create: { id: "singleton", activo: body.eventosActivo }
            });
        }

        if (typeof body.paecActivo === "boolean") {
            await prisma.encuentroPAECConfig.upsert({
                where: { id: "singleton" },
                update: { activo: body.paecActivo },
                create: { id: "singleton", activo: body.paecActivo }
            });
        }

        if (typeof body.circularActivo === "boolean") {
            await prisma.circular05Config.upsert({
                where: { id: "singleton" },
                update: { activo: body.circularActivo },
                create: { id: "singleton", activo: body.circularActivo }
            });
        }

        if (typeof body.olimpiadaActivo === "boolean") {
            await prisma.olimpiadaConfig.upsert({
                where: { id: "singleton" },
                update: { activo: body.olimpiadaActivo },
                create: { id: "singleton", activo: body.olimpiadaActivo }
            });
        }

        if (typeof body.planeacionesActivo === "boolean") {
            await prisma.planeacionesConfig.upsert({
                where: { id: "singleton" },
                update: { activoGlobal: body.planeacionesActivo },
                create: { id: "singleton", activoGlobal: body.planeacionesActivo }
            });
        }

        // 5. Programas (actualización de activo, visibleEnDirector y quienesPuedenSubir)
        if (Array.isArray(body.programas)) {
            for (const prog of body.programas) {
                if (prog.id) {
                    await prisma.programa.update({
                        where: { id: prog.id },
                        data: {
                            activo: typeof prog.activo === "boolean" ? prog.activo : undefined,
                            visibleEnDirector: typeof prog.visibleEnDirector === "boolean" ? prog.visibleEnDirector : undefined,
                            quienesPuedenSubir: Array.isArray(prog.quienesPuedenSubir) ? prog.quienesPuedenSubir : undefined
                        }
                    });
                }
            }
        }

        return NextResponse.json({ ok: true, mensaje: "Configuración de módulos actualizada correctamente" });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al actualizar activación de módulos";
        await registrarError("zona004", {
            mensaje: msg,
            ruta: "/api/admin/modulos-activacion",
            metodo: "PATCH",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
