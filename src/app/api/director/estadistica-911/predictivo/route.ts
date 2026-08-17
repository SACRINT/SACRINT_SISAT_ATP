import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarError } from "@/lib/error-log";
import { calcularProyeccionEscuela } from "@/lib/estadistica-911-predictivo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const user = session.user as { role?: string; organizacionId?: string; tenantId?: string; id?: string };
        const tenantId = user.organizacionId || user.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Sesión sin tenantId" }, { status: 400 });
        }

        // El director solo puede consultar los datos de su propia escuela
        const escuelaId = user.id;
        if (!escuelaId) {
            return NextResponse.json({ error: "ID de escuela no encontrado en la sesión" }, { status: 400 });
        }

        const escuela = await prisma.escuela.findUnique({
            where: { id: escuelaId },
            select: {
                id: true,
                cct: true,
                nombre: true,
                localidad: true,
                municipio: true,
                gruposPrimerAno: true,
                gruposSegundoAno: true,
                gruposTercerAno: true,
                hombres: true,
                mujeres: true,
                total: true
            }
        });

        if (!escuela) {
            return NextResponse.json({ error: "Plantel no encontrado" }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const corteParam = searchParams.get("corte");
        const corteProyectar: "INICIO_DE_CURSOS" | "FIN_DE_CURSOS" =
            corteParam === "FIN_DE_CURSOS" ? "FIN_DE_CURSOS" : "INICIO_DE_CURSOS";

        const registrosHistoricos = await prisma.estadistica911Registro.findMany({
            where: { escuelaId, tenantId },
            include: { detalles: true, cicloEscolar: true }
        });

        const proyeccion = calcularProyeccionEscuela(escuela, registrosHistoricos, corteProyectar);

        return NextResponse.json({
            success: true,
            proyeccion
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al obtener proyección del plantel";
        await registrarError("global", {
            mensaje: msg,
            ruta: "/api/director/estadistica-911/predictivo",
            metodo: "GET",
            stack: err instanceof Error ? err.stack : undefined
        });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
