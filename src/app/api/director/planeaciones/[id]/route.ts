/**
 * GET    /api/director/planeaciones/[id]  → Detalles de una planeación específica
 * DELETE /api/director/planeaciones/[id]  → Eliminar una planeación
 * POST   /api/director/planeaciones/[id]  → Re-evaluar planeación con IA Gemini
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verificarRequisitosPlaneaciones } from "@/lib/ia-requisitos";
import { revisarPlaneacionEnBackground } from "../route";

async function obtenerEscuelaId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.escuelaId) return user.escuelaId;
    if (user.id && (user.role === "director" || !user.role)) return user.id;
    if (user.cct) {
        const esc = await prisma.escuela.findUnique({ where: { cct: user.cct }, select: { id: true } });
        if (esc) return esc.id;
    }
    return user.id || null;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;

    const planeacion = await prisma.planeacionDidactica.findUnique({
        where: { id },
    });

    if (!planeacion) {
        return NextResponse.json({ error: "Planeación no encontrada" }, { status: 404 });
    }

    return NextResponse.json(planeacion);
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;

    const planeacion = await prisma.planeacionDidactica.findUnique({
        where: { id },
    });

    if (!planeacion) {
        return NextResponse.json({ error: "Planeación no encontrada" }, { status: 404 });
    }

    await prisma.planeacionDidactica.delete({ where: { id } });

    return NextResponse.json({ ok: true, deletedId: id });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;

    const planeacion = await prisma.planeacionDidactica.findUnique({
        where: { id },
    });

    if (!planeacion) {
        return NextResponse.json({ error: "Planeación no encontrada" }, { status: 404 });
    }

    // Actualizar estado a EN_REVISION antes de la re-evaluación
    await prisma.planeacionDidactica.update({
        where: { id },
        data: { estado: "EN_REVISION" }
    });

    const requisitos = await verificarRequisitosPlaneaciones(planeacion.escuelaId);

    // Ejecutar revisión con IA Gemini
    await revisarPlaneacionEnBackground(planeacion.id, {
        archivoUrl: planeacion.archivoUrl,
        archivoTipo: planeacion.archivoTipo,
        docenteNombre: planeacion.docenteNombre,
        asignatura: planeacion.asignatura,
        semestre: planeacion.semestre,
        tipoAsignatura: planeacion.tipoAsignatura,
        bloqueCorte: planeacion.bloqueCorte || undefined,
        escuelaId: planeacion.escuelaId,
        cct: planeacion.cct,
        entregaPaecPec: requisitos.entregaPaecPec,
    }).catch(err => console.error("[planeaciones] Error en re-evaluación background:", err));

    const planeacionActualizada = await prisma.planeacionDidactica.findUnique({ where: { id } });

    return NextResponse.json({ ok: true, planeacion: planeacionActualizada });
}
