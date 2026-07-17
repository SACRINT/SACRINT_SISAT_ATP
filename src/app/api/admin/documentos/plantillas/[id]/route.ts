import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromCloudinary } from "@/lib/cloudinary";

// PUT: Actualizar configuración de la plantilla (Admin aprueba los campos)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { configuracionCampos, estado } = body;

        const plantilla = await prisma.plantillaDocumento.update({
            where: { id: id },
            data: {
                configuracionCampos,
                estado: estado || "CONFIGURADA"
            }
        });

        return NextResponse.json({ success: true, plantilla });
    } catch (error: any) {
        console.error("Error actualizando plantilla:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

// DELETE: Eliminar plantilla
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const plantilla = await prisma.plantillaDocumento.findUnique({ where: { id: id } });
        if (!plantilla) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

        // Borrar de Cloudinary
        if (plantilla.archivoDriveId) {
            await deleteFileFromCloudinary(plantilla.archivoDriveId).catch(console.error);
        }

        await prisma.plantillaDocumento.delete({ where: { id: id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error borrando plantilla:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
