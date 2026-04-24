import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { deleteFileFromCloudinary } from "@/lib/cloudinary";

// PATCH - Actualizar registro (admin bloquea/desbloquea, director sube archivo)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const user = session.user as { role?: string; cct?: string } | undefined;
    const body = await req.json();

    const registro = await prisma.capemFichaRegistro.findUnique({
        where: { id },
        include: { escuela: true },
    });

    if (!registro) {
        return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    // Admin puede bloquear/desbloquear
    if (user?.role === "admin") {
        const updateData: Record<string, any> = {};
        if (body.bloqueado !== undefined) updateData.bloqueado = body.bloqueado;
        
        const updated = await prisma.capemFichaRegistro.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(updated);
    }

    // Director puede subir archivo si no está bloqueado
    if (user?.role === "director") {
        if (registro.escuela.cct !== user.cct) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }
        if (registro.bloqueado) {
            return NextResponse.json({ error: "Este registro está bloqueado por el administrador" }, { status: 403 });
        }

        const updateData: Record<string, any> = {};
        if (body.fileData) {
            updateData.archivoNombre = body.fileData.name;
            updateData.archivoDriveId = body.fileData.publicId;
            updateData.archivoDriveUrl = body.fileData.url;
        }
        if (body.fichaId) {
            updateData.fichaId = body.fichaId;
        }

        const updated = await prisma.capemFichaRegistro.update({
            where: { id },
            data: updateData,
            include: {
                ficha: { select: { id: true, nombre: true } },
                capem: { select: { id: true, nombre: true } },
            },
        });
        return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

// DELETE - Eliminar registro (director solo si no está bloqueado)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const user = session.user as { role?: string; cct?: string } | undefined;

    const registro = await prisma.capemFichaRegistro.findUnique({
        where: { id },
        include: { escuela: true },
    });

    if (!registro) {
        return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    if (user?.role === "director") {
        if (registro.escuela.cct !== user.cct) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }
        if (registro.bloqueado) {
            return NextResponse.json({ error: "Este registro está bloqueado por el administrador" }, { status: 403 });
        }
    } else if (user?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Eliminar archivo de Cloudinary si existe
    if (registro.archivoDriveId) {
        try {
            await deleteFileFromCloudinary(registro.archivoDriveId);
        } catch (e) {
            console.error("Error eliminando archivo de Cloudinary:", e);
        }
    }

    await prisma.capemFichaRegistro.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
