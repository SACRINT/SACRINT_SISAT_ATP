import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { obtenerCicloActual } from "@/lib/ciclo";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        const ciclo = await obtenerCicloActual();
        if (!ciclo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }

        let config = await prisma.estadisticaPeriodoConfig.findUnique({
            where: { tenantId }
        });

        if (!config) {
            config = await prisma.estadisticaPeriodoConfig.create({
                data: {
                    tenantId,
                    cicloEscolarId: ciclo.id,
                    tipoCorte: "INICIO_DE_CURSOS",
                    activo: true,
                    visibleEnDirector: true
                }
            });
        }

        return NextResponse.json({ success: true, config });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al obtener configuración de estadística 911";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/config",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string } | undefined;
        const tenantId = user?.organizacionId || user?.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        if (user?.role !== "admin" && user?.role !== "superadmin" && user?.role !== "ATP") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const ciclo = await obtenerCicloActual();
        if (!ciclo) {
            return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 400 });
        }
        const body = await req.json();
        const { tipoCorte, fechaLimite, activo, visibleEnDirector } = body;

        const updateData: {
            cicloEscolarId?: string;
            tipoCorte?: string;
            fechaLimite?: Date | null;
            activo?: boolean;
            visibleEnDirector?: boolean;
        } = { cicloEscolarId: ciclo.id };

        if (tipoCorte === "INICIO_DE_CURSOS" || tipoCorte === "FIN_DE_CURSOS") {
            updateData.tipoCorte = tipoCorte;
        }
        if (fechaLimite !== undefined) {
            updateData.fechaLimite = fechaLimite ? new Date(fechaLimite) : null;
        }
        if (typeof activo === "boolean") {
            updateData.activo = activo;
        }
        if (typeof visibleEnDirector === "boolean") {
            updateData.visibleEnDirector = visibleEnDirector;
        }

        const config = await prisma.estadisticaPeriodoConfig.upsert({
            where: { tenantId },
            update: updateData,
            create: {
                tenantId,
                cicloEscolarId: ciclo.id,
                tipoCorte: tipoCorte || "INICIO_DE_CURSOS",
                fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
                activo: activo ?? true,
                visibleEnDirector: visibleEnDirector ?? true
            }
        });

        return NextResponse.json({ success: true, config });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al actualizar configuración de estadística 911";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/admin/estadistica-911/config",
            metodo: "POST",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
