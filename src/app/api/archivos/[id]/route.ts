import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromDrive } from "@/lib/drive";

// DELETE: Director deletes their uploaded file (if entrega is not APROBADO)
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
                entrega: {
                    include: { escuela: true },
                },
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

        // Delete from Google Drive if driveId exists
        if (archivo.driveId) {
            await deleteFileFromDrive(archivo.driveId);
        }

        // Delete from database (cascade will handle relations)
        await prisma.archivo.delete({ where: { id } });

        // If no more ENTREGA files, reset status to PENDIENTE
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
    } catch (error) {
        console.error("Delete file error:", error);
        return NextResponse.json({ error: "Error al eliminar archivo" }, { status: 500 });
    }
}
