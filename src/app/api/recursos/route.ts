import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const titulo = formData.get("titulo") as string | null;
        const descripcion = formData.get("descripcion") as string | null;
        const programaId = formData.get("programaId") as string | null;

        if (!file || !titulo) {
            return NextResponse.json({ error: "Archivo y título son obligatorios" }, { status: 400 });
        }

        // Upload to Cloudinary under a 'RECURSOS' folder
        const buffer = Buffer.from(await file.arrayBuffer());

        const { publicId, url } = await uploadFileToCloudinary(
            buffer,
            file.name,
            file.type,
            "RECURSOS_INSTITUCIONALES"
        );

        // Save to DB
        const nuevoRecurso = await prisma.recurso.create({
            data: {
                titulo: titulo.trim(),
                descripcion: descripcion?.trim() || null,
                archivoNombre: file.name,
                archivoDriveId: publicId, // reusing this field for Cloudinary public_id
                archivoDriveUrl: url,     // reusing this field for Cloudinary URL
                programaId: programaId || null,
            },
            include: { programa: true }
        });

        return NextResponse.json({ success: true, recurso: nuevoRecurso });
    } catch (error: any) {
        console.error("Error upload recurso:", error);
        return NextResponse.json({ error: "Error al subir recurso" }, { status: 500 });
    }
}
