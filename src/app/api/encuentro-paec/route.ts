import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: Obtener inscripción de la escuela actual
export async function GET() {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || user?.role !== "director") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
    if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

    const config = await prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } });
    const inscripcion = await prisma.inscripcionEncuentroPAEC.findUnique({ where: { escuelaId: escuela.id } });

    return NextResponse.json({
        config: config || { activo: false, convocatoriaUrl: null, encuentroUrl: null },
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

    const config = await prisma.encuentroPAECConfig.findUnique({ where: { id: "singleton" } });
    if (!config?.activo) {
        return NextResponse.json({ error: "El Encuentro PAEC 2026 no está activo" }, { status: 403 });
    }

    const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
    if (!escuela) return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });

    const { datos } = await req.json();
    // datos = { nombreProyecto, problematicaEntorno, alumnos: [{nombre, grado, curp}] }

    const inscripcion = await prisma.inscripcionEncuentroPAEC.upsert({
        where: { escuelaId: escuela.id },
        update: { datos },
        create: { escuelaId: escuela.id, datos },
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

    await prisma.inscripcionEncuentroPAEC.deleteMany({ where: { escuelaId: escuela.id } });

    return NextResponse.json({ success: true });
}
