import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { obtenerCicloActual } from "@/lib/ciclo";

// GET: Obtener inscripción de la escuela actual
export async function GET() {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || user?.role !== "director") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
    if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

    const ciclo = await obtenerCicloActual();
    if (!ciclo) return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 404 });

    const config = await prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } });
    const inscripcion = await prisma.inscripcionEncuentroPAEC.findUnique({
        where: {
            escuelaId_cicloEscolarId: {
                escuelaId: escuela.id,
                cicloEscolarId: ciclo.id,
            },
        },
    });

    return NextResponse.json({
        config: config ? { ...config, activo: config.activo && ciclo.activo } : { activo: false, convocatoriaUrl: null, encuentroUrl: null },
        inscripcion: inscripcion?.datos || null,
        inscripcionId: inscripcion?.id || null,
    });
}

// POST: Guardar/actualizar inscripción
export async function POST(req: NextRequest) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || user?.role !== "director") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const ciclo = await obtenerCicloActual();
    if (!ciclo) return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 404 });

    // If cycle is not active, it's read-only
    if (!ciclo.activo) {
        return NextResponse.json({ error: "No se permiten modificaciones en ciclos escolares pasados o inactivos" }, { status: 403 });
    }

    const config = await prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } });
    if (!config?.activo) {
        return NextResponse.json({ error: "El Encuentro PAEC no está activo" }, { status: 403 });
    }

    const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
    if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

    const { datos } = await req.json();
    // datos = { nombreProyecto, problematicaEntorno, alumnos: [{nombre, grado, curp}] }

    const inscripcion = await prisma.inscripcionEncuentroPAEC.upsert({
        where: {
            escuelaId_cicloEscolarId: {
                escuelaId: escuela.id,
                cicloEscolarId: ciclo.id,
            },
        },
        update: { datos },
        create: { escuelaId: escuela.id, cicloEscolarId: ciclo.id, datos },
    });

    return NextResponse.json({ success: true, inscripcion });
}

// DELETE: Cancelar inscripción
export async function DELETE() {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || user?.role !== "director") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
    if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

    const ciclo = await obtenerCicloActual();
    if (!ciclo) return NextResponse.json({ error: "No hay ciclo escolar activo" }, { status: 404 });

    // If cycle is not active, it's read-only
    if (!ciclo.activo) {
        return NextResponse.json({ error: "No se permiten modificaciones en ciclos escolares pasados o inactivos" }, { status: 403 });
    }

    await prisma.inscripcionEncuentroPAEC.deleteMany({
        where: {
            escuelaId: escuela.id,
            cicloEscolarId: ciclo.id,
        },
    });

    return NextResponse.json({ success: true });
}
