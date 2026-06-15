import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { deleteFileFromCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// PATCH - Actualizar documento (archivo o bloqueo)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || !user?.role) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const doc = await prisma.documentoPersonal.findUnique({
        where: { id },
        include: { personal: { include: { escuela: true } } },
    });

    if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

    const body = await req.json();

    // Admin can toggle bloqueado
    if (user.role === "admin" && body.bloqueado !== undefined) {
        const updated = await prisma.documentoPersonal.update({
            where: { id },
            data: { bloqueado: body.bloqueado },
        });
        return NextResponse.json(updated);
    }

    // Director can update file if not bloqueado
    if (user.role === "director") {
        if (doc.bloqueado) {
            return NextResponse.json({ error: "Este documento está bloqueado" }, { status: 403 });
        }

        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
        if (!escuela || escuela.id !== doc.personal.escuelaId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        // Delete old file from Cloudinary if replacing or marking as noTiene=true
        const shouldDeleteOldFile = (doc.archivoDriveId && body.archivoDriveId && body.archivoDriveId !== doc.archivoDriveId) ||
                                    (doc.archivoDriveId && body.noTiene === true);
        if (shouldDeleteOldFile && doc.archivoDriveId) {
            try { await deleteFileFromCloudinary(doc.archivoDriveId); } catch { /* ignore */ }
        }

        const updatedData: any = {
            etiqueta: body.etiqueta !== undefined ? body.etiqueta : doc.etiqueta,
        };

        if (body.noTiene !== undefined) {
            updatedData.noTiene = !!body.noTiene;
            if (body.noTiene) {
                updatedData.archivoNombre = null;
                updatedData.archivoDriveId = null;
                updatedData.archivoDriveUrl = null;
            } else {
                updatedData.archivoNombre = body.archivoNombre ?? doc.archivoNombre;
                updatedData.archivoDriveId = body.archivoDriveId ?? doc.archivoDriveId;
                updatedData.archivoDriveUrl = body.archivoDriveUrl ?? doc.archivoDriveUrl;
            }
        } else {
            updatedData.archivoNombre = body.archivoNombre ?? doc.archivoNombre;
            updatedData.archivoDriveId = body.archivoDriveId ?? doc.archivoDriveId;
            updatedData.archivoDriveUrl = body.archivoDriveUrl ?? doc.archivoDriveUrl;
        }

        const updated = await prisma.documentoPersonal.update({
            where: { id },
            data: updatedData,
        });
        return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

// DELETE - Eliminar un documento
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const user = session?.user as { role?: string; cct?: string } | undefined;
    if (!session || !user?.role) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const doc = await prisma.documentoPersonal.findUnique({
        where: { id },
        include: { personal: { include: { escuela: true } } },
    });

    if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

    // Admin can always delete
    if (user.role === "admin") {
        if (doc.archivoDriveId) {
            try { await deleteFileFromCloudinary(doc.archivoDriveId); } catch { /* ignore */ }
        }
        await prisma.documentoPersonal.delete({ where: { id } });
        return NextResponse.json({ success: true });
    }

    // Director can delete if not bloqueado
    if (user.role === "director") {
        if (doc.bloqueado) {
            return NextResponse.json({ error: "Este documento está bloqueado" }, { status: 403 });
        }
        const escuela = await prisma.escuela.findUnique({ where: { cct: user.cct! } });
        if (!escuela || escuela.id !== doc.personal.escuelaId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }
        if (doc.archivoDriveId) {
            try { await deleteFileFromCloudinary(doc.archivoDriveId); } catch { /* ignore */ }
        }
        await prisma.documentoPersonal.delete({ where: { id } });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}
