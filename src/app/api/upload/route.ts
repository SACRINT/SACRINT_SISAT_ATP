import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary, buildFolderPath } from "@/lib/cloudinary";
import { sendUploadConfirmation } from "@/lib/email";
import { buildEntregaFileName } from "@/lib/download-url";
import { hasBackendAccess } from "@/lib/permissions";

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

        // Validate file sizes (25 MB max)
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

        // Directors can only upload to their own school, Admins must have write access to avances
        const user = session.user as { role?: string; dbRole?: string; cct?: string; permisos?: any } | undefined;
        const userRole = user?.role;
        if (userRole === "director") {
            const userCct = user?.cct;
            if (entrega.escuela.cct !== userCct) {
                return NextResponse.json({ error: "No autorizado" }, { status: 403 });
            }
            if (entrega.estado === "APROBADO") {
                return NextResponse.json(
                    { error: "Esta entrega ya fue aprobada. No se puede modificar." },
                    { status: 403 }
                );
            }
        } else if (userRole === "admin") {
            if (!hasBackendAccess(user, "avances", "write")) {
                return NextResponse.json({ error: "No autorizado (sin permisos de escritura en avances)" }, { status: 403 });
            }
        }

        const programa = entrega.periodoEntrega.programa;
        const escuela = entrega.escuela;
        const folderPath = buildFolderPath(escuela.cct, escuela.nombre, programa.nombre);

        // Build period label for naming
        const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const periodo = entrega.periodoEntrega;
        const periodoLabel = periodo.mes
            ? MESES[periodo.mes]
            : periodo.semestre
                ? `Semestre${periodo.semestre}`
                : "CicloCompleto";

        // Upload files to Cloudinary
        const createdArchivos = [];
        let lastUrl: string | undefined;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const etiqueta = etiquetas[i] || null;
            const buffer = Buffer.from(await file.arrayBuffer());

            // Build descriptive name: CCT_Programa_Periodo_Etiqueta
            const descriptiveName = buildEntregaFileName(
                escuela.cct,
                programa.nombre,
                periodoLabel,
                etiqueta,
                file.name
            ).replace(/\.[^.]+$/, ""); // strip extension (Cloudinary adds it)

            const { publicId, url } = await uploadFileToCloudinary(
                buffer,
                file.name,
                file.type,
                folderPath,
                descriptiveName
            );

            const archivo = await prisma.archivo.create({
                data: {
                    entregaId,
                    nombre: file.name,
                    driveId: publicId,   // reusing driveId field for Cloudinary public_id
                    driveUrl: url,       // reusing driveUrl field for Cloudinary URL
                    tipo: "ENTREGA",
                    subidoPor: "director",
                    etiqueta,
                },
            });

            createdArchivos.push(archivo);
            lastUrl = url;
        }

        // Update entrega status
        await prisma.entrega.update({
            where: { id: entregaId },
            data: {
                estado: "PENDIENTE",
                fechaSubida: new Date(),
            },
        });

        // Enviar acuse de recibo por email
        await sendUploadConfirmation(
            escuela.email,
            escuela.nombre,
            programa.nombre,
            periodoLabel
        );


        return NextResponse.json({
            success: true,
            message: `${files.length} archivo(s) subido(s) correctamente`,
            archivos: createdArchivos,
        });
    } catch (error: unknown) {
        console.error("Upload error:", error);

        // Safely extract properties from error if it exists
        const errObj = error as Record<string, unknown>;
        const errList = errObj?.errors as Array<Record<string, unknown>> | undefined;
        const message =
            errObj?.message ||
            errList?.[0]?.message ||
            "Error al procesar el archivo";

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
