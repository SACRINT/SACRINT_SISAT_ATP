import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { v2 as cloudinary } from "cloudinary";

async function downloadFromCloudinary(url: string, publicId: string): Promise<Buffer> {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
    });
    const secureUrl = cloudinary.utils.private_download_url(publicId, "docx", {
        type: "upload",
        resource_type: "raw"
    });
    const fetchUrl = url.includes("res.cloudinary.com") ? secureUrl : url;
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error("No se pudo descargar la plantilla original");
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "director") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { plantillaId, personalId, datosFinales, actualizarExpediente } = body;
        const escuelaId = (session.user as any).id; // El ID del usuario director es el escuelaId

        if (!plantillaId || !personalId || !datosFinales) {
            return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
        }

        const escuela = await prisma.escuela.findUnique({ where: { id: escuelaId } });
        if (!escuela?.geminiApiKey) {
            return NextResponse.json({ error: "Debes configurar tu API Key de Gemini en Ajustes para usar este módulo." }, { status: 403 });
        }

        const plantilla = await prisma.plantillaDocumento.findUnique({ where: { id: plantillaId } });
        if (!plantilla) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

        // Actualizar expediente de Personal si es necesario
        if (actualizarExpediente) {
            const updateData: any = {};
            if (datosFinales.RFC_PERSONAL) updateData.rfc = datosFinales.RFC_PERSONAL;
            if (datosFinales.CURP_PERSONAL) updateData.curp = datosFinales.CURP_PERSONAL;
            if (datosFinales.TELEFONO_PERSONAL) updateData.telefono = datosFinales.TELEFONO_PERSONAL;
            if (datosFinales.CORREO_PERSONAL) updateData.correoElectronico = datosFinales.CORREO_PERSONAL;
            
            if (Object.keys(updateData).length > 0) {
                await prisma.personal.update({
                    where: { id: personalId },
                    data: updateData
                });
            }
        }

        const templateBuffer = await downloadFromCloudinary(plantilla.archivoDriveUrl, plantilla.archivoDriveId);
        
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        
        doc.render(datosFinales);
        const generatedBuf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });

        const fileName = `${plantilla.nombre.replace(/\s+/g, '_')}_Personal_${Date.now()}`;
        const { publicId, url } = await uploadFileToCloudinary(
            generatedBuf,
            `SISAT-ATP/${escuelaId}/Documentos_Generados`,
            fileName
        );

        const historial = await prisma.documentoAdministrativo.create({
            data: {
                tipo: "CONSTANCIA_PERSONAL",
                plantillaId,
                escuelaId,
                personalId: personalId,
                generadoPorId: escuelaId,
                datosUtilizados: datosFinales,
                archivoWordId: publicId,
                archivoWordUrl: url
            }
        });

        return NextResponse.json({ success: true, url, historial });
    } catch (error: any) {
        console.error("Error generando documento director:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
