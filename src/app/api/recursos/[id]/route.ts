import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromDrive } from "@/lib/drive";

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const params = await context.params;
        const recursoId = params.id;

        const recurso = await prisma.recurso.findUnique({
            where: { id: recursoId },
        });

        if (!recurso) {
            return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 });
        }

        // Delete from Google Drive if it exists there
        if (recurso.archivoDriveId) {
            await deleteFileFromDrive(recurso.archivoDriveId);
        }

        // Delete from DB
        await prisma.recurso.delete({
            where: { id: recursoId },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting recurso:", error);
        return NextResponse.json({ error: "Ocurrió un error al eliminar el recurso" }, { status: 500 });
    }
}
