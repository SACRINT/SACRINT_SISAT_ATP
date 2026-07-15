import { prisma } from "./db";
import { callGemini } from "./gemini";
import { downloadFile } from "./pre-revision";

const systemInstruction = `Eres un Asesor Técnico Pedagógico experto en validación y revisión de expedientes escolares.
Tu tarea es analizar el documento proporcionado y validar si coincide exactamente con el tipo de documento requerido.

Debes responder estrictamente en formato JSON utilizando el siguiente esquema de respuesta:
{
  "valido": "APROBADO" | "ADVERTENCIA" | "RECHAZADO",
  "observaciones": "Breve explicación detallada de tu decisión (en español). Si es RECHAZADO o ADVERTENCIA, especifica qué es lo que falta o por qué es incorrecto."
}

Criterios de validación por tipo de documento:
1. "INE": Debe ser una credencial para votar oficial de México (IFE/INE), mostrar fotografía y datos personales de la persona.
2. "CURP": Debe ser la Clave Única de Registro de Población oficial mexicana.
3. "ACTA_NACIMIENTO": Debe ser un acta de nacimiento mexicana oficial.
4. "COMPROBANTE_DOMICILIO": Debe ser un recibo de servicio (luz, agua, teléfono, etc.) legible.
5. "TITULO": Debe ser un título profesional universitario o de bachillerato.
6. "CEDULA": Debe ser una cédula profesional oficial.
7. "ORDEN_ADSCRIPCION": Documento de adscripción al centro de trabajo/plantel.
8. "MOVIMIENTO_PERSONAL": Formato de movimiento o asignación de personal.
9. "COMPROBANTE_PAGO": Comprobante, recibo o talón de nómina de pago.
10. "COMPROBANTE_FISCAL": Constancia de situación fiscal del SAT.
11. "FICHA_CAPEMS" / "Ficha CAPEMS": Ficha técnica de registro CAPEMS oficial de la escuela.

Considera:
- Si el documento está de cabeza, muy borroso o ilegible, marca "ADVERTENCIA" y solicita que se vuelva a subir de forma legible.
- Si el documento no tiene ninguna relación con el tipo solicitado (ej. subió un INE en la ranura de Acta de Nacimiento), marca "RECHAZADO".
- Si es legible, coincide y está completo, marca "APROBADO".`;

const responseSchema = {
    type: "OBJECT",
    properties: {
        valido: {
            type: "STRING",
            enum: ["APROBADO", "ADVERTENCIA", "RECHAZADO"]
        },
        observaciones: {
            type: "STRING"
        }
    },
    required: ["valido", "observaciones"]
};

// Helper to determine mime type based on file extension
function getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "pdf") return "application/pdf";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    return "application/octet-stream";
}

/**
 * Validar registro de Ficha CAPEMS con IA (Gemini Vision)
 */
export async function validarRegistroCapemConIA(registroId: string): Promise<any> {
    console.log(`[ocr-validator] Iniciando escaneo de CAPEMS para el registro ${registroId}`);
    try {
        const registro = await prisma.capemFichaRegistro.findUnique({
            where: { id: registroId },
            include: { ficha: true, escuela: true }
        });

        if (!registro || !registro.archivoDriveUrl) {
            console.warn(`[ocr-validator] Registro de CAPEMS ${registroId} no encontrado o sin archivo.`);
            return;
        }

        // Descargar archivo
        const buffer = await downloadFile(registro.archivoDriveUrl);
        const mimeType = getMimeType(registro.archivoNombre || "archivo.pdf");

        // Llamar a Gemini Vision
        const prompt = `Analiza y valida el documento de la escuela "${registro.escuela.nombre}" (CCT: ${registro.escuela.cct}).
El tipo de documento que debe ser es: "FICHA_CAPEMS" / "Ficha CAPEMS" con el nombre específico de la ficha: "${registro.ficha.nombre}".`;

        const responseText = await callGemini(
            systemInstruction,
            prompt,
            buffer,
            mimeType,
            responseSchema
        );

        const result = JSON.parse(responseText);

        // Guardar resultado
        await prisma.capemFichaRegistro.update({
            where: { id: registroId },
            data: {
                validoIA: result.valido,
                observacionesIA: result.observaciones
            }
        });

        console.log(`[ocr-validator] Registro de CAPEMS ${registroId} validado exitosamente: ${result.valido}`);
        return result;
    } catch (err: any) {
        console.error(`[ocr-validator] Error validando registro CAPEMS ${registroId}:`, err);
        throw err;
    }
}

/**
 * Validar documento personal (Expedientes) con IA (Gemini Vision)
 */
export async function validarDocumentoPersonalConIA(documentoId: string): Promise<any> {
    console.log(`[ocr-validator] Iniciando escaneo de Expediente Personal para el documento ${documentoId}`);
    try {
        const documento = await prisma.documentoPersonal.findUnique({
            where: { id: documentoId },
            include: { personal: { include: { escuela: true } } }
        });

        if (!documento || !documento.archivoDriveUrl || documento.noTiene) {
            console.warn(`[ocr-validator] Documento personal ${documentoId} no encontrado, sin archivo o marcado como 'noTiene'.`);
            return;
        }

        // Descargar archivo
        const buffer = await downloadFile(documento.archivoDriveUrl);
        const mimeType = getMimeType(documento.archivoNombre || "archivo.pdf");

        const personalNombre = `${documento.personal.apellidoPaterno} ${documento.personal.apellidoMaterno} ${documento.personal.nombre}`.trim();

        // Llamar a Gemini Vision
        const prompt = `Analiza y valida el documento correspondiente a la persona "${personalNombre}" de la escuela "${documento.personal.escuela.nombre}".
El tipo de documento requerido es: "${documento.tipoDocumento}" ${documento.etiqueta ? `(Nombre personalizado: "${documento.etiqueta}")` : ""}.`;

        const responseText = await callGemini(
            systemInstruction,
            prompt,
            buffer,
            mimeType,
            responseSchema
        );

        const result = JSON.parse(responseText);

        // Guardar resultado
        await prisma.documentoPersonal.update({
            where: { id: documentoId },
            data: {
                validoIA: result.valido,
                observacionesIA: result.observaciones
            }
        });

        console.log(`[ocr-validator] Documento personal ${documentoId} validado exitosamente: ${result.valido}`);
        return result;
    } catch (err: any) {
        console.error(`[ocr-validator] Error validando documento personal ${documentoId}:`, err);
        throw err;
    }
}

