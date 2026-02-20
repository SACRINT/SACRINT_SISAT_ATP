import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEscuelaProgramaFolder, uploadFileToDrive } from "@/lib/drive";
import { notifyN8n } from "@/lib/n8n";

// POST: ATP sends correction to a delivery
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || (session.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const formData = await req.formData();
        const texto = formData.get("texto") as string | null;
        const file = formData.get("file") as File | null;

        if (!texto && !file) {
            return NextResponse.json(
                { error: "Debe incluir un texto o un archivo de corrección" },
                { status: 400 }
            );
        }

        // Get entrega info
        const entrega = await prisma.entrega.findUnique({
            where: { id },
            include: {
                escuela: true,
                periodoEntrega: { include: { programa: true } },
            },
        });

        if (!entrega) {
            return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
        }

        // Get admin
        const adminEmail = (session.user as any)?.email;
        const admin = await prisma.admin.findUnique({ where: { email: adminEmail } });
        if (!admin) {
            return NextResponse.json({ error: "Admin no encontrado" }, { status: 404 });
        }

        let archivoId: string | null = null;

        // Upload correction file to Google Drive if provided
        if (file) {
            const programa = entrega.periodoEntrega.programa;
            const escuela = entrega.escuela;

            // Get escuela folder on Drive, then create _correcciones subfolder inside programa folder
            const programaFolderId = await getEscuelaProgramaFolder(
                escuela.cct,
                escuela.nombre,
                programa.nombre
            );

            // Sub-folder for corrections inside the programa folder
            const { getOrCreateFolder } = await import("@/lib/drive");
            const corrFolderId = await getOrCreateFolder(programaFolderId, "_correcciones");

            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = `correccion_${Date.now()}_${file.name}`;

            const { driveId, driveUrl } = await uploadFileToDrive(
                corrFolderId,
                fileName,
                buffer,
                file.type
            );

            const archivo = await prisma.archivo.create({
                data: {
                    entregaId: id,
                    nombre: file.name,
                    driveId,
                    driveUrl,
                    tipo: "CORRECCION",
                    subidoPor: "atp",
                },
            });
            archivoId = archivo.id;
        }

        // Create correction record
        const correccion = await prisma.correccion.create({
            data: {
                entregaId: id,
                texto: texto || null,
                archivoId,
                adminId: admin.id,
            },
        });

        // Update entrega status to REQUIERE_CORRECCION
        await prisma.entrega.update({
            where: { id },
            data: {
                estado: "REQUIERE_CORRECCION",
                fechaRevision: new Date(),
            },
        });

        // Notify director via n8n (non-blocking)
        notifyN8n("correccion-enviada", {
            escuelaNombre: entrega.escuela.nombre,
            escuelaEmail: entrega.escuela.email,
            programaNombre: entrega.periodoEntrega.programa.nombre,
            texto: texto || undefined,
            adminNombre: admin.nombre,
        });

        return NextResponse.json({
            success: true,
            message: "Corrección enviada al director",
            correccion,
        });
    } catch (error) {
        console.error("Correction error:", error);
        return NextResponse.json({ error: "Error al enviar corrección" }, { status: 500 });
    }
}

// GET: List corrections for a delivery
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const correcciones = await prisma.correccion.findMany({
            where: { entregaId: id },
            include: {
                archivo: true,
                admin: { select: { nombre: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ correcciones });
    } catch (error) {
        return NextResponse.json({ error: "Error al obtener correcciones" }, { status: 500 });
    }
}
