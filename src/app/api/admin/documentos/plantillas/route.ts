import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/genai";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// GET: Listar plantillas
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const plantillas = await prisma.plantillaDocumento.findMany({
            orderBy: { createdAt: "desc" }
        });
        return NextResponse.json(plantillas);
    } catch (error: any) {
        console.error("Error obteniendo plantillas:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

// POST: Subir nueva plantilla y analizar con IA
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "admin") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const nombre = formData.get("nombre") as string;

        if (!file || !nombre) {
            return NextResponse.json({ error: "Faltan datos requeridos (file, nombre)" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Calcular Hash para detectar duplicados
        const hash = crypto.createHash("sha256").update(buffer).digest("hex");
        
        const existente = await prisma.plantillaDocumento.findFirst({
            where: { hash }
        });

        if (existente) {
            return NextResponse.json({ 
                success: true, 
                message: "Esta plantilla ya existe y ha sido identificada por su contenido.",
                plantilla: existente
            });
        }

        // Subir a Cloudinary
        const { publicId, url } = await uploadFileToCloudinary(
            buffer,
            "SISAT-ATP/Documentos_Administrativos/Plantillas",
            file.name.replace(/\.[^.]+$/, "")
        );

        // Extraer texto del Word para enviarlo a la IA
        let extractedText = "";
        try {
            const zip = new PizZip(buffer);
            const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
            extractedText = doc.getFullText();
        } catch (err) {
            console.warn("No se pudo extraer texto con docxtemplater, posiblemente no es un word válido:", err);
        }

        // Analizar con IA (Gemini)
        let camposDetectados: Array<{campoPlantilla: string, sugerenciaSistema: string, explicacion: string}> = [];
        
        if (extractedText) {
            try {
                // Obtener llave API
                const apiKeyRecord = await prisma.apiKey.findFirst({ where: { provider: "gemini", active: true } });
                const aiKey = apiKeyRecord?.key || process.env.GEMINI_API_KEY;
                
                if (aiKey) {
                    const ai = new GoogleGenerativeAI({ apiKey: aiKey });
                    const prompt = `
Eres un asistente para el sistema SISAT-ATP.
A continuación te proporciono el texto extraído de una plantilla de documento Word (Constancia, Oficio, etc.).
El usuario debe haber colocado variables entre llaves, por ejemplo {NOMBRE_DIRECTOR}, o espacios a rellenar.
Tu tarea es analizar el texto, identificar qué datos variables se necesitan para llenar este documento, y devolver un JSON con la propuesta de mapeo.

Los campos estándar del sistema SISAT-ATP que tenemos disponibles son:
- NOMBRE_DIRECTOR
- RFC_DIRECTOR
- CURP_DIRECTOR
- FECHA_INGRESO_DIRECTOR
- CLAVE_PRESUPUESTAL_DIRECTOR
- TELEFONO_DIRECTOR
- CORREO_DIRECTOR
- NOMBRE_ESCUELA
- CCT_ESCUELA
- LOCALIDAD_ESCUELA
- MUNICIPIO_ESCUELA
- ZONA_ESCOLAR
- FECHA_ACTUAL

Responde ÚNICAMENTE con un JSON con el siguiente formato, sin markdown ni explicaciones adicionales:
{
  "campos": [
    {
      "campoPlantilla": "El texto o etiqueta detectada en el documento (ej. {NOMBRE_DIRECTOR} o Nombre del director: _______)",
      "sugerenciaSistema": "El nombre EXACTO del campo estándar del sistema que mejor encaja de la lista anterior",
      "explicacion": "Breve motivo de la sugerencia"
    }
  ]
}

Texto de la plantilla:
"""
${extractedText.substring(0, 5000)}
"""
`;
                    const response = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: prompt
                    });
                    
                    const aiText = response.text || "";
                    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.campos && Array.isArray(parsed.campos)) {
                            camposDetectados = parsed.campos;
                        }
                    }
                }
            } catch (aiError) {
                console.error("Error en análisis IA de plantilla:", aiError);
            }
        }

        // Guardar en BD
        const plantilla = await prisma.plantillaDocumento.create({
            data: {
                nombre,
                archivoNombre: file.name,
                archivoDriveId: publicId,
                archivoDriveUrl: url,
                hash,
                estado: "NUEVA",
                configuracionCampos: camposDetectados
            }
        });

        return NextResponse.json({ success: true, plantilla });
    } catch (error: any) {
        console.error("Error subiendo plantilla:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
