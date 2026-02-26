import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildFolderPath } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { entregaId, originalFilename, etiqueta, subfolder } = await req.json();

        if (!entregaId) {
            return NextResponse.json({ error: "EntregaId es requerido" }, { status: 400 });
        }

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

        let folderPath = buildFolderPath(entrega.escuela.cct, entrega.escuela.nombre, entrega.periodoEntrega.programa.nombre);
        if (subfolder) {
            folderPath += `/${subfolder.replace(/^\/+/, '')}`;
        }
        const folder = `SISAT-ATP/${folderPath}`;

        let publicId: string | undefined = undefined;
        if (originalFilename) {
            // Formato solicitado: CCT_Nombre_Programa_Documento
            const docName = etiqueta ? etiqueta : originalFilename.split('.').slice(0, -1).join('.');
            const prefix = `${entrega.escuela.cct}_${entrega.escuela.nombre}_${entrega.periodoEntrega.programa.nombre}`;

            let finalName = `${prefix}_${docName}`;
            if (subfolder === "_correcciones") {
                finalName = `${prefix}_Correccion_${docName}`;
            }

            // Cloudinary public_id cannot contain ? & # \ % < >
            publicId = finalName.replace(/[\?&#\\%<>]/g, '').trim();
        }

        // Configure cloudinary using env vars
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });

        const timestamp = Math.round(new Date().getTime() / 1000);

        // Parameters to sign
        const paramsToSign: Record<string, any> = {
            timestamp,
            folder
        };

        if (publicId) {
            paramsToSign.public_id = publicId;
        }

        const signature = cloudinary.utils.api_sign_request(
            paramsToSign,
            process.env.CLOUDINARY_API_SECRET!
        );

        return NextResponse.json({
            signature,
            timestamp,
            folder,
            publicId,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY
        });
    } catch (error) {
        console.error("Signature error:", error);
        return NextResponse.json({ error: "Error al generar firma" }, { status: 500 });
    }
}
