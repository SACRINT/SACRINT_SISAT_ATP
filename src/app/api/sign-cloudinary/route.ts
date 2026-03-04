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
                periodoEntrega: { include: { programa: true, cicloEscolar: true } },
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
            const programaNombre = entrega.periodoEntrega.programa.nombre;
            const isAcosoEscolar = programaNombre.toUpperCase().includes("ACOSO ESCOLAR");

            let finalName: string;

            if (isAcosoEscolar) {
                // Nomenclatura especial: CCT_ACOSO ESCOLAR_AÑO_MES_NOMBRE DE LA ESCUELA
                const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const periodo = entrega.periodoEntrega;
                const cicloNombre = periodo.cicloEscolar?.nombre || "2025-2026";
                // Extract year: take second year from cycle (e.g. "2025-2026" -> "2026")
                const anio = cicloNombre.split("-").pop() || new Date().getFullYear().toString();
                const mes = periodo.mes ? MESES[periodo.mes] : (periodo.semestre ? `Semestre${periodo.semestre}` : "CicloCompleto");

                finalName = `${entrega.escuela.cct}_ACOSO ESCOLAR_${anio}_${mes}_${entrega.escuela.nombre}`;
                if (subfolder === "_correcciones") {
                    finalName = `${entrega.escuela.cct}_ACOSO ESCOLAR_${anio}_${mes}_${entrega.escuela.nombre}_Correccion`;
                }
            } else {
                // Formato default: CCT_Nombre_Programa_Documento
                const docName = etiqueta ? etiqueta : originalFilename.split('.').slice(0, -1).join('.');
                const prefix = `${entrega.escuela.cct}_${entrega.escuela.nombre}_${programaNombre}`;
                finalName = `${prefix}_${docName}`;
                if (subfolder === "_correcciones") {
                    finalName = `${prefix}_Correccion_${docName}`;
                }
            }

            // Cloudinary public_id cannot contain ? & # \ % < >
            publicId = finalName.replace(/[\?\&#\\%<>]/g, '').trim();
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
