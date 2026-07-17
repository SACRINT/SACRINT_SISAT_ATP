import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { v2 as cloudinary } from "cloudinary";

// GET: Helper function to download cloudinary file into Buffer
async function downloadFromCloudinary(url: string, publicId: string): Promise<Buffer> {
    // If it's a signed private url setup:
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
    });
    // Obtener un signed URL en caso de que esté protegido (si no, url directo)
    const secureUrl = cloudinary.utils.private_download_url(publicId, "docx", {
        type: "upload",
        resource_type: "raw" // or "image" if applicable, usually "raw" for docs
    });

    const fetchUrl = url.includes("res.cloudinary.com") ? secureUrl : url;
    
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error("No se pudo descargar la plantilla original");
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// POST: Generar Documento
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { plantillaId, escuelaId, directorId, personalId, datosFinales, actualizarExpediente } = body;

        if (!plantillaId || !datosFinales) {
            return NextResponse.json({ error: "Faltan datos (plantillaId, datosFinales)" }, { status: 400 });
        }

        const plantilla = await prisma.plantillaDocumento.findUnique({ where: { id: plantillaId } });
        if (!plantilla) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

        // Actualizar Expediente Permanente si el usuario lo pidió
        if (actualizarExpediente && directorId) {
            const updateData: any = {};
            if (datosFinales.NOMBRE_DIRECTOR) updateData.nombreCompleto = datosFinales.NOMBRE_DIRECTOR;
            if (datosFinales.RFC_DIRECTOR) updateData.rfc = datosFinales.RFC_DIRECTOR;
            if (datosFinales.CURP_DIRECTOR) updateData.curp = datosFinales.CURP_DIRECTOR;
            if (datosFinales.CLAVE_PRESUPUESTAL_DIRECTOR) updateData.clavePresupuestal = datosFinales.CLAVE_PRESUPUESTAL_DIRECTOR;
            if (datosFinales.TELEFONO_DIRECTOR) updateData.telefono = datosFinales.TELEFONO_DIRECTOR;
            if (datosFinales.CORREO_DIRECTOR) updateData.correo = datosFinales.CORREO_DIRECTOR;
            if (datosFinales.FECHA_INGRESO_DIRECTOR) updateData.fechaIngreso = new Date(datosFinales.FECHA_INGRESO_DIRECTOR);

            if (Object.keys(updateData).length > 0) {
                await prisma.directorExpediente.update({
                    where: { id: directorId },
                    data: updateData
                });
            }
        }

        // Descargar plantilla original
        const templateBuffer = await downloadFromCloudinary(plantilla.archivoDriveUrl, plantilla.archivoDriveId);

        // Reemplazar usando docxtemplater
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Autoridades Educativas Config
        const autoridadesConfig = await prisma.autoridadesConfig.findUnique({
            where: { id: "singleton" }
        });

        // Configurar los datos detectados. Los 'datosFinales' es un objeto clave-valor 
        // donde la clave es la Etiqueta (campoPlantilla detectado) y el valor es lo que el admin introdujo.
        // Además inyectamos las Autoridades Educativas
        const renderData = {
            ...datosFinales,
            SUPERVISOR: autoridadesConfig?.supervisor || "C. SUPERVISOR(A)",
            SUPERVISOR_RFC: autoridadesConfig?.supervisorRFC || "",
            SUPERVISOR_FECHA: autoridadesConfig?.supervisorFecha || "",
            SUPERVISOR_CLAVE: autoridadesConfig?.supervisorClave || "",
            COORDINADOR_REGIONAL: autoridadesConfig?.coordinadorRegional || "C. COORDINADOR(A) REGIONAL",
            DIRECTOR_NIVEL: autoridadesConfig?.directorNivel || "C. DIRECTOR(A) DEL NIVEL",
            ATP1_NOMBRE: autoridadesConfig?.atp1Nombre || "",
            ATP1_RFC: autoridadesConfig?.atp1RFC || "",
            ATP1_FECHA: autoridadesConfig?.atp1Fecha || "",
            ATP1_CLAVE: autoridadesConfig?.atp1Clave || "",
            ATP2_NOMBRE: autoridadesConfig?.atp2Nombre || "",
            ATP2_RFC: autoridadesConfig?.atp2RFC || "",
            ATP2_FECHA: autoridadesConfig?.atp2Fecha || "",
            ATP2_CLAVE: autoridadesConfig?.atp2Clave || "",
            ATP3_NOMBRE: autoridadesConfig?.atp3Nombre || "",
            ATP3_RFC: autoridadesConfig?.atp3RFC || "",
            ATP3_FECHA: autoridadesConfig?.atp3Fecha || "",
            ATP3_CLAVE: autoridadesConfig?.atp3Clave || "",
            ATP4_NOMBRE: autoridadesConfig?.atp4Nombre || "",
            ATP4_RFC: autoridadesConfig?.atp4RFC || "",
            ATP4_FECHA: autoridadesConfig?.atp4Fecha || "",
            ATP4_CLAVE: autoridadesConfig?.atp4Clave || "",
        };
        
        doc.render(renderData);

        const generatedBuf = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        // Subir a Cloudinary para el historial
        const fileName = `${plantilla.nombre.replace(/\s+/g, '_')}_${Date.now()}.docx`;
        const { publicId, url } = await uploadFileToCloudinary(
            generatedBuf,
            fileName,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Documentos_Administrativos/Generados",
            fileName.replace(/\.[^.]+$/, "")
        );

        // Guardar Historial
        const historial = await prisma.documentoAdministrativo.create({
            data: {
                tipo: "CONSTANCIA",
                plantillaId,
                escuelaId,
                directorId: directorId || null,
                personalId: personalId || null,
                generadoPorId: (session.user as any).id,
                datosUtilizados: datosFinales,
                archivoWordId: publicId,
                archivoWordUrl: url
            }
        });

        return NextResponse.json({ 
            success: true, 
            url, // URL para descargar inmediatamente el word
            historial 
        });

    } catch (error: any) {
        console.error("Error generando documento:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
