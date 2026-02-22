import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromCloudinary, uploadFileToCloudinary } from "@/lib/cloudinary";

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
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

        // Delete from Cloudinary if it exists there
        if (recurso.archivoDriveId) {
            await deleteFileFromCloudinary(recurso.archivoDriveId);
        }

        // Delete from DB
        await prisma.recurso.delete({
            where: { id: recursoId },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error deleting recurso:", error);
        return NextResponse.json({ error: "Ocurrió un error al eliminar el recurso" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
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

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const titulo = formData.get("titulo") as string | null;
        const descripcion = formData.get("descripcion") as string | null;
        const programaId = formData.get("programaId") as string | null;

        if (!titulo || !titulo.trim()) {
            return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
        }

        // Using const and mapping types implicitly
        const updateData: {
            titulo: string;
            descripcion: string | null;
            programaId: string | null;
            archivoNombre?: string;
            archivoDriveId?: string;
            archivoDriveUrl?: string;
        } = {
            titulo: titulo.trim(),
            descripcion: descripcion?.trim() || null,
            programaId: programaId || null,
        };

        if (file && file.size > 0) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const { publicId, url } = await uploadFileToCloudinary(
                buffer,
                file.name,
                file.type,
                "RECURSOS_INSTITUCIONALES"
            );

            if (recurso.archivoDriveId) {
                await deleteFileFromCloudinary(recurso.archivoDriveId).catch(e => console.error("Error al borrar recurso anterior", e));
            }

            updateData.archivoNombre = file.name;
            updateData.archivoDriveId = publicId;
            updateData.archivoDriveUrl = url;
        }

        const updatedRecurso = await prisma.recurso.update({
            where: { id: recursoId },
            data: updateData,
            include: { programa: true },
        });

        return NextResponse.json({ success: true, recurso: updatedRecurso });
    } catch (error: unknown) {
        console.error("Error updating recurso:", error);
        return NextResponse.json({ error: "Ocurrió un error al actualizar el recurso" }, { status: 500 });
    }
}
