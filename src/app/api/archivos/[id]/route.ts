import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromCloudinary } from "@/lib/cloudinary";

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

        // Only directors can delete their own files
        const userRole = (session.user as any)?.role;
        if (userRole === "director") {
            const userCct = (session.user as any)?.cct;
            if (archivo.entrega.escuela.cct !== userCct) {
                return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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

        // If no more ENTREGA files, reset entrega status
        const remainingFiles = await prisma.archivo.count({
            where: { entregaId: archivo.entregaId, tipo: "ENTREGA" },
        });

        if (remainingFiles === 0) {
            await prisma.entrega.update({
                where: { id: archivo.entregaId },
                data: { estado: "PENDIENTE", fechaSubida: null },
            });
        }

        return NextResponse.json({ success: true, message: "Archivo eliminado" });
    } catch (error: any) {
        console.error("Delete file error:", error);
        return NextResponse.json(
            { error: error?.message || "Error al eliminar archivo" },
            { status: 500 }
        );
    }
}
