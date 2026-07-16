import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromCloudinary } from "@/lib/cloudinary";
import { hasBackendAccess } from "@/lib/permissions";

// DELETE: Delete an uploaded file
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;

        const archivo = await prisma.archivo.findUnique({
            where: { id },
            include: {
                entrega: { include: { escuela: true } },
            },
        });

        if (!archivo) {
            return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
        }

        // Only directors can delete their own files, Admins must have write access to avances
        const user = session.user as { role?: string; dbRole?: string; permisos?: any } | undefined;
        const userRole = user?.role;
        if (userRole === "director") {
            const userCct = (session.user as { cct?: string })?.cct;
            if (archivo.entrega.escuela.cct !== userCct) {
                return NextResponse.json({ error: "No autorizado" }, { status: 403 });
            }
        } else if (userRole === "admin") {
            if (!hasBackendAccess(user, "avances", "write")) {
                return NextResponse.json({ error: "No autorizado (sin permisos de escritura en avances)" }, { status: 403 });
            }
        }

        // Cannot delete if APROBADO
        if (archivo.entrega.estado === "APROBADO") {
            return NextResponse.json(
                { error: "No se puede eliminar un archivo de una entrega aprobada" },
                { status: 403 }
            );
        }

        // Delete from Cloudinary if publicId exists
        if (archivo.driveId) {
            await deleteFileFromCloudinary(archivo.driveId);
        }

        // Delete from database
        await prisma.archivo.delete({ where: { id } });

        // Delete previous pre-revision so that it forces a new clean analysis with remaining files
        try {
            await prisma.preRevision.delete({
                where: { entregaId: archivo.entregaId }
            });
        } catch (e) {
            // Ignore if it didn't exist
        }

        // If no more ENTREGA files, reset entrega status
        const remainingFiles = await prisma.archivo.count({
            where: { entregaId: archivo.entregaId, tipo: "ENTREGA" },
        });

        if (remainingFiles === 0) {
            await prisma.entrega.update({
                where: { id: archivo.entregaId },
                data: { estado: "NO_ENTREGADO", fechaSubida: null },
            });
        }

        return NextResponse.json({ success: true, message: "Archivo eliminado" });
    } catch (error: unknown) {
        console.error("Delete file error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error al eliminar archivo" },
            { status: 500 }
        );
    }
}
