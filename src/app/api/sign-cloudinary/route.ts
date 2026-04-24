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

        const { entregaId, originalFilename, etiqueta, subfolder, programa, cct, escuelaNombre } = await req.json();

        let folder: string;
        let escuelaCct: string = "";
        let escuelaNombreResolved: string = "";
        let programaNombre: string = "";

        // ─── CAPEMS mode: no entregaId needed ───
        if (programa === "CAPEMS" && cct && escuelaNombre) {
            escuelaCct = cct;
            escuelaNombreResolved = escuelaNombre;
            programaNombre = "CAPEMS";
            let folderPath = buildFolderPath(cct, escuelaNombre, "CAPEMS");
            if (subfolder) {
                folderPath += `/${subfolder.replace(/^\/+/, '')}`;
            }
            folder = `SISAT-ATP/${folderPath}`;
        } else {
            // ─── Standard mode: requires entregaId ───
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

            escuelaCct = entrega.escuela.cct;
            escuelaNombreResolved = entrega.escuela.nombre;
            programaNombre = entrega.periodoEntrega.programa.nombre;

            let folderPath = buildFolderPath(entrega.escuela.cct, entrega.escuela.nombre, entrega.periodoEntrega.programa.nombre);
            if (subfolder) {
                folderPath += `/${subfolder.replace(/^\/+/, '')}`;
            }
            folder = `SISAT-ATP/${folderPath}`;
        }

        let publicId: string | undefined = undefined;
        if (originalFilename) {
            const isAcosoEscolar = programaNombre.toUpperCase().includes("ACOSO ESCOLAR");

            let finalName: string;

            if (isAcosoEscolar && entregaId) {
                // Nomenclatura especial para Acoso Escolar (solo en modo standard)
                const entrega = await prisma.entrega.findUnique({
                    where: { id: entregaId },
                    include: { periodoEntrega: { include: { cicloEscolar: true } } },
                });
                const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const periodo = entrega?.periodoEntrega;
                const cicloNombre = periodo?.cicloEscolar?.nombre || "2025-2026";
                const anio = cicloNombre.split("-").pop() || new Date().getFullYear().toString();
                const mes = periodo?.mes ? MESES[periodo.mes] : (periodo?.semestre ? `Semestre${periodo.semestre}` : "CicloCompleto");

                finalName = `${escuelaCct}_ACOSO ESCOLAR_${anio}_${mes}_${escuelaNombreResolved}`;
                if (subfolder === "_correcciones") {
                    finalName = `${escuelaCct}_ACOSO ESCOLAR_${anio}_${mes}_${escuelaNombreResolved}_Correccion`;
                }
            } else {
                // Formato default: CCT_Nombre_Programa_Documento
                const docName = etiqueta ? etiqueta : originalFilename.split('.').slice(0, -1).join('.');
                const prefix = `${escuelaCct}_${escuelaNombreResolved}_${programaNombre}`;
                finalName = `${prefix}_${docName}`;
                if (subfolder === "_correcciones") {
                    finalName = `${prefix}_Correccion_${docName}`;
                }
            }

            // Cloudinary public_id cannot contain ? & # \ % < >
            publicId = finalName.replace(/[?\&#\\%<>]/g, '').trim();
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
