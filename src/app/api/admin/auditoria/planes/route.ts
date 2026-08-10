import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const session = await auth();
        const user = session?.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        
        if (!session || !["admin", "supervision", "atp"].includes(user?.role || "")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Usuario sin organización o tenant asignado" }, { status: 401 });
        }

        const [procesos, tareas, gapItems, modulos] = await Promise.all([
            prisma.process.findMany({
                where: { tenantId },
                include: {
                    _count: {
                        select: {
                            tareas: true,
                            mensajes: true,
                            adjuntos: true,
                        },
                    },
                },
                orderBy: { prioridadScore: "desc" },
            }),
            prisma.task.findMany({
                where: { tenantId },
                include: {
                    proceso: {
                        select: {
                            id: true,
                            nombre: true,
                            nivelPrioridad: true,
                        },
                    },
                },
                orderBy: { automatizabilidad: "asc" },
            }),
            prisma.gapItem.findMany({
                where: { tenantId },
                include: {
                    proceso: {
                        select: {
                            id: true,
                            nombre: true,
                        },
                    },
                },
                orderBy: { prioridad: "desc" },
            }),
            prisma.modulePlan.findMany({
                where: { tenantId },
                include: {
                    procesoOrigen: {
                        select: {
                            id: true,
                            nombre: true,
                            prioridadScore: true,
                        },
                    },
                },
                orderBy: { faseRoadmap: "asc" },
            }),
        ]);

        return NextResponse.json({
            procesos,
            tareas,
            gapItems,
            modulos,
            resumen: {
                totalProcesos: procesos.length,
                totalTareas: tareas.length,
                totalGapItems: gapItems.length,
                totalModulos: modulos.length,
                modulosAprobados: modulos.filter((m) => m.estado === "APROBADO").length,
                modulosPendientes: modulos.filter((m) => m.estado === "PENDIENTE").length,
            },
        });
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : "Error al obtener planes y descubrimientos";
        console.error("Error al consultar planes y descubrimientos:", error);
        return NextResponse.json(
            { error: errMessage },
            { status: 500 }
        );
    }
}
