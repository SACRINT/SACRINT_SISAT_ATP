import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary, buildFolderPath } from "@/lib/cloudinary";
import { sendCorrectionNotification } from "@/lib/email";

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

        const adminEmail = (session.user as any)?.email;
        const admin = await prisma.admin.findUnique({ where: { email: adminEmail } });
        if (!admin) {
            return NextResponse.json({ error: "Admin no encontrado" }, { status: 404 });
        }

        let archivoId: string | null = null;

        // Upload correction file to Cloudinary if provided
        if (file) {
            const programa = entrega.periodoEntrega.programa;
            const escuela = entrega.escuela;

            // Store corrections in a _correcciones subfolder
            const folderPath = buildFolderPath(escuela.cct, escuela.nombre, programa.nombre) + "/_correcciones";
            const buffer = Buffer.from(await file.arrayBuffer());

            const { publicId, url } = await uploadFileToCloudinary(
                buffer,
                `correccion_${file.name}`,
                file.type,
                folderPath
            );

            const archivo = await prisma.archivo.create({
                data: {
                    entregaId: id,
                    nombre: file.name,
                    driveId: publicId,
                    driveUrl: url,
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

        // Update entrega status
        await prisma.entrega.update({
            where: { id },
            data: {
                estado: "REQUIERE_CORRECCION",
                fechaRevision: new Date(),
            },
        });

        // Build period label for email notification
        let periodoLabel = "Ciclo 2025-2026";
        const periodo = entrega.periodoEntrega;
        if (periodo.mes) {
            const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            periodoLabel = meses[periodo.mes];
        } else if (periodo.semestre) {
            periodoLabel = `Semestre ${periodo.semestre}`;
        }

        // Send correction email via Resend
        await sendCorrectionNotification(
            entrega.escuela.email,
            entrega.escuela.nombre,
            entrega.periodoEntrega.programa.nombre,
            periodoLabel,
            texto || "Se ha adjuntado un archivo con las correcciones necesarias.",
            admin.nombre
        );

        return NextResponse.json({
            success: true,
            message: "Corrección enviada al director",
            correccion,
        });
    } catch (error: any) {
        console.error("Correction error:", error);
        return NextResponse.json(
            { error: error?.message || "Error al enviar corrección" },
            { status: 500 }
        );
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
