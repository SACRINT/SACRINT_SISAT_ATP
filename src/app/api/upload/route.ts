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
        const files = formData.getAll("file") as File[];
        const entregaId = formData.get("entregaId") as string;
        const etiquetas = formData.getAll("etiqueta") as string[];

        if (files.length === 0 || !entregaId) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }

        // Validate file sizes
        for (const file of files) {
            if (file.size > 25 * 1024 * 1024) {
                return NextResponse.json(
                    { error: `"${file.name}" es muy grande. Máximo 25 MB.` },
                    { status: 400 }
                );
            }
        }

        // Validate file types
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

        for (const file of files) {
            if (!allowedTypes.includes(file.type)) {
                return NextResponse.json(
                    { error: `"${file.name}" no es un tipo permitido. Use PDF, Word, Excel, PowerPoint o imagen.` },
                    { status: 400 }
                );
            }
        }

        // Get the entrega and verify ownership
        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: {
                escuela: true,
                periodoEntrega: { include: { programa: true } },
            },
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

            // Directors cannot replace if APROBADO
            if (entrega.estado === "APROBADO") {
                return NextResponse.json(
                    { error: "Esta entrega ya fue aprobada. No se puede modificar." },
                    { status: 403 }
                );
            }
        }

        const programa = entrega.periodoEntrega.programa;

        // Save files locally (will be replaced by Google Drive later)
        const uploadsDir = join(process.cwd(), "uploads", entrega.escuela.cct, programa.nombre);
        await mkdir(uploadsDir, { recursive: true });

        const createdArchivos = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const etiqueta = etiquetas[i] || null;

            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = `${Date.now()}_${file.name}`;
            const filePath = join(uploadsDir, fileName);
            await writeFile(filePath, buffer);

            const archivo = await prisma.archivo.create({
                data: {
                    entregaId,
                    nombre: file.name,
                    tipo: "ENTREGA",
                    subidoPor: "director",
                    etiqueta,
                },
            });
            createdArchivos.push(archivo);
        }

        // Update entrega status to PENDIENTE (uploaded, waiting for review)
        await prisma.entrega.update({
            where: { id: entregaId },
            data: {
                estado: "PENDIENTE",
                fechaSubida: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            message: `${files.length} archivo(s) subido(s) correctamente`,
            archivos: createdArchivos,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Error al procesar el archivo" },
            { status: 500 }
        );
    }
}
