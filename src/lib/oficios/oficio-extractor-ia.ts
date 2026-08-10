/**
 * ATP-MOD-01 — Extractor IA de metadatos de oficios PDF / imagen
 *
 * Usa el orquestador callGemini de src/lib/gemini.ts para extraer:
 *   - remitenteNombre, remitenteEmail
 *   - asunto / título del oficio
 *   - fechaLimite (ISO 8601) — null si no hay plazo explícito
 *   - instrucciones clave
 *
 * Zero-payload: el buffer solo viaja en memoria para la llamada a la API;
 * nunca se guarda en BD. Solo se persisten los metadatos resultantes.
 */

import type { ExtraerMetadatosIA } from "./oficios-engine";
import { procesarDocumentoOcr } from "./ocr-documento";

/**
 * Extrae metadatos de un oficio a partir de su buffer (PDF o imagen).
 * Delega al módulo ocr-documento.ts para extracción en 2 pasos y división de archivos grandes.
 *
 * @param buffer - Contenido del archivo en memoria
 * @param mimeType - MIME type del archivo ("application/pdf" | "image/jpeg" | "image/png" | etc.)
 * @returns Metadatos extraídos
 */
export async function extraerMetadatosOficioIA(
    buffer: Buffer,
    mimeType: "application/pdf" | "image/jpeg" | "image/png" | string
): Promise<ExtraerMetadatosIA> {
    return await procesarDocumentoOcr(buffer, mimeType);
}
