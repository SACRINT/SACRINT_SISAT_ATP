import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToCloudinary } from "@/lib/cloudinary";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
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
            file.name,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Documentos_Administrativos/Plantillas",
            file.name.replace(/\.[^.]+$/, "")
        );

        // ─── Extraer texto del Word con reconstrucción inteligente ───────────────
        // Word fragmenta {NOMBRE_DIRECTOR} en múltiples nodos XML. 
        // Debemos leer el XML y reconstruir el texto completo del párrafo antes de limpiar tags.
        let extractedText = "";
        let rawXml = "";
        
        try {
            const zip = new PizZip(buffer);
            rawXml = zip.file("word/document.xml")?.asText() || "";
            
            if (rawXml) {
                // Estrategia: concatenar todos los <w:t> de cada <w:r> (run de texto) por párrafo
                // para reconstruir las etiquetas que Word parte en nodos XML separados
                const paragraphs = rawXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
                const lines: string[] = [];
                for (const para of paragraphs) {
                    // Concatenar todos los bloques de texto dentro de un párrafo
                    const texts = para.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
                    const lineText = texts.map(t => t.replace(/<[^>]+>/g, '')).join('');
                    if (lineText.trim()) lines.push(lineText.trim());
                }
                extractedText = lines.join('\n');
            }
        } catch (err) {
            console.error("Error al leer el archivo ZIP de la plantilla:", err);
        }

        console.log(`[PLANTILLA] Texto extraído (${extractedText.length} chars): ${extractedText.substring(0, 300)}`);

        // ─── Analizar con IA ────────────────────────────────────────────────────
        let camposDetectados: Array<{campoPlantilla: string, sugerenciaSistema: string, explicacion: string}> = [];
        
        if (extractedText && extractedText.trim().length > 0) {
            try {
                const apiKeyRecord = await prisma.apiKey.findFirst({ where: { provider: "gemini", active: true } });
                const aiKey = apiKeyRecord?.key || process.env.GEMINI_API_KEY;
                
                if (aiKey) {
                    const ai = new GoogleGenAI({ apiKey: aiKey });
                    const prompt = `Eres un asistente para el sistema SISAT-ATP, un sistema de gestión escolar mexicano.
A continuación te proporciono el texto de una plantilla de documento oficial (Constancia, Oficio, etc.).

CAMPOS ESTÁNDAR DISPONIBLES EN EL SISTEMA:
- NOMBRE_DIRECTOR: Nombre completo del director o persona
- RFC_DIRECTOR: RFC del director o persona
- CURP_DIRECTOR: CURP del director o persona  
- FECHA_INGRESO_DIRECTOR: Fecha de ingreso al servicio
- CLAVE_PRESUPUESTAL_DIRECTOR: Clave presupuestal del director
- TELEFONO_DIRECTOR: Teléfono de contacto
- CORREO_DIRECTOR: Correo electrónico
- NOMBRE_ESCUELA: Nombre completo de la escuela
- CCT_ESCUELA: Clave del Centro de Trabajo
- LOCALIDAD_ESCUELA: Localidad donde está la escuela
- MUNICIPIO_ESCUELA: Municipio donde está la escuela
- ZONA_ESCOLAR: Zona escolar a la que pertenece
- FECHA_ACTUAL: Fecha en que se genera el documento

TU TAREA:
1. Analiza el texto de la plantilla
2. Identifica TODOS los espacios donde se insertarán datos variables: pueden ser etiquetas entre llaves {ETIQUETA}, líneas de guiones/subguiones ____, espacios en blanco descriptivos (ej. "Nombre del director: "), o cualquier otro indicador de dato a llenar
3. Para CADA variable encontrada, propón cuál campo del sistema corresponde
4. Si encuentras una etiqueta que ya tiene el formato {NOMBRE_CAMPO}, úsala exactamente como campoPlantilla (con las llaves incluidas)
5. Si encuentras un espacio en blanco o descripción, crea una etiqueta sugerida con el formato {CAMPO_SISTEMA}

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin explicaciones, sin caracteres extra:
{"campos":[{"campoPlantilla":"{NOMBRE_DIRECTOR}","sugerenciaSistema":"NOMBRE_DIRECTOR","explicacion":"Nombre del director"},{"campoPlantilla":"{RFC}","sugerenciaSistema":"RFC_DIRECTOR","explicacion":"RFC del titular"}]}

Texto de la plantilla (analiza TODO el texto y detecta TODOS los campos variables):
"""
${extractedText.substring(0, 6000)}
"""`;
                    
                    const response = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: prompt
                    });
                    
                    const aiText = response.text || "";
                    console.log(`[PLANTILLA] Respuesta IA (${aiText.length} chars): ${aiText.substring(0, 500)}`);
                    
                    // Extraer el JSON de la respuesta (puede venir con texto extra)
                    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.campos && Array.isArray(parsed.campos)) {
                                camposDetectados = parsed.campos;
                                console.log(`[PLANTILLA] Campos detectados: ${camposDetectados.length}`);
                            }
                        } catch (parseErr) {
                            console.error("[PLANTILLA] Error al parsear JSON de IA:", parseErr, jsonMatch[0]);
                        }
                    } else {
                        console.warn("[PLANTILLA] IA no devolvió un JSON válido:", aiText.substring(0, 300));
                    }
                } else {
                    console.warn("[PLANTILLA] No hay API Key de Gemini configurada");
                }
            } catch (aiError) {
                console.error("Error en análisis IA de plantilla:", aiError);
            }
        } else {
            console.warn("[PLANTILLA] No se extrajo texto del documento. Guardando plantilla sin campos.");
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
