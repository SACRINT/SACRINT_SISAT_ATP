import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET: Obtener todas las escuelas y el expediente de su director
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const escuelas = await prisma.escuela.findMany({
            include: {
                directorExpediente: true,
                personal: true
            },
            orderBy: { nombre: 'asc' }
        });

        // Asegurarse de que si hay un 'director' en texto y no hay expediente, al menos devolvemos esa info
        const result = escuelas.map(esc => ({
            id: esc.id,
            cct: esc.cct,
            nombre: esc.nombre,
            localidad: esc.localidad,
            municipio: esc.municipio,
            directorTexto: esc.director, // El que ya existía
            expediente: esc.directorExpediente,
            personal: esc.personal
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error obteniendo directores:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

// POST: Crear o actualizar un expediente de director
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { escuelaId, nombreCompleto, rfc, curp, fechaIngreso, clavePresupuestal, telefono, correo } = body;

        if (!escuelaId || !nombreCompleto) {
            return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
        }

        // Usamos upsert basado en escuelaActualId
        const expediente = await prisma.directorExpediente.upsert({
            where: { escuelaActualId: escuelaId },
            update: {
                nombreCompleto, rfc, curp, fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null, clavePresupuestal, telefono, correo
            },
            create: {
                escuelaActualId: escuelaId,
                nombreCompleto, rfc, curp, fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : null, clavePresupuestal, telefono, correo
            }
        });

        return NextResponse.json({ success: true, expediente });
    } catch (error: any) {
        console.error("Error guardando expediente:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
