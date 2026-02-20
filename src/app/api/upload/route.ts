import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const entregaId = formData.get("entregaId") as string;

        if (!file || !entregaId) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }

        // Validate file size (max 25MB)
        if (file.size > 25 * 1024 * 1024) {
            return NextResponse.json(
                { error: "El archivo es muy grande. Máximo 25 MB." },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "image/jpeg",
            "image/png",
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Tipo de archivo no permitido. Use PDF, Word, Excel, PowerPoint o imagen." },
                { status: 400 }
            );
        }

        // Get the entrega and verify ownership
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: { escuela: true, programa: true },
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        // Directors can only upload to their own school
        const userRole = (session.user as any)?.role;
        if (userRole === "director") {
            const userCct = (session.user as any)?.cct;
            if (entrega.escuela.cct !== userCct) {
                return NextResponse.json({ error: "No autorizado" }, { status: 403 });
            }
        }

        // Save file locally (will be replaced by Google Drive later)
        const uploadsDir = join(process.cwd(), "uploads", entrega.escuela.cct, entrega.programa.nombre);
        await mkdir(uploadsDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = join(uploadsDir, fileName);
        await writeFile(filePath, buffer);

        // Update entrega status
        await prisma.entrega.update({
            where: { id: entregaId },
            data: {
                estatus: "COMPLETO",
                archivoNombre: file.name,
                fechaSubida: new Date(),
                // archivoDriveId will be set when Google Drive is integrated
            },
        });

        return NextResponse.json({
            success: true,
            message: "Archivo subido correctamente",
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Error al procesar el archivo" },
            { status: 500 }
        );
    }
}
