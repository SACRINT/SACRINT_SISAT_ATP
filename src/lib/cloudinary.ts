import { v2 as cloudinary } from "cloudinary";

// ─── Cloudinary client ──────────────────────────────────────────────────────

function getCloudinaryConfig() {
    cloudinary.config({
        cloud_name: process.env.CLDIN_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLDIN_API_KEY || process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLDIN_API_SECRET || process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
    return cloudinary;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export interface CloudinaryUploadResult {
    publicId: string;   // stored as driveId in Archivo
    url: string;        // stored as driveUrl in Archivo
}

/**
 * Uploads a buffer to Cloudinary.
 * Files are organized in folders: folder/CCT_Programa/
 * Returns { publicId, url }
 */
export async function uploadFileToCloudinary(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderPath: string,
    /** Optional: descriptive name for the public_id in Cloudinary (e.g. "21EBH0682T_CAPEM_1_FichaTrabajo").
     *  If omitted, falls back to timestamp-based name. */
    descriptiveName?: string
): Promise<CloudinaryUploadResult> {
    const client = getCloudinaryConfig();

    // Cloudinary folder path: SISAT-ATP/CCT - Escuela/Programa
    const folder = `SISAT-ATP/${folderPath}`;

    // Determine resource type
    const resourceType = mimeType.startsWith("image/") ? "image" : "raw";

    // Build public_id: prefer descriptive name, fall back to timestamp
    const publicId = descriptiveName
        ? sanitizeFileName(descriptiveName)
        : `${Date.now()}_${sanitizeFileName(fileName)}`;

    return new Promise((resolve, reject) => {
        const uploadStream = client.uploader.upload_stream(
            {
                folder,
                public_id: publicId,
                resource_type: resourceType,
                // Preserve original filename in display
                use_filename: false,
                overwrite: false,
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error("Cloudinary upload returned no result"));
                    return;
                }
                resolve({
                    publicId: result.public_id,
                    url: result.secure_url,
                });
            }
        );

        uploadStream.end(buffer);
    });
}


// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Deletes a file from Cloudinary by its public_id.
 * Tries both resource_type: raw and image to cover all file types.
 */
export async function deleteFileFromCloudinary(publicId: string): Promise<void> {
    const client = getCloudinaryConfig();

    // Try raw first (PDFs, docs, etc.), then image
    try {
        await client.uploader.destroy(publicId, { resource_type: "raw" });
    } catch {
        try {
            await client.uploader.destroy(publicId, { resource_type: "image" });
        } catch {
            // File might not exist — ignore silently
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Descarga un archivo desde Cloudinary como Buffer usando enlaces firmados HMAC.
 * Intenta en orden:
 *   a) private_download_url con resource_type: "raw"
 *   b) private_download_url con resource_type: "image"
 *   c) fetch directo a la URL del archivo
 */
export async function downloadCloudinaryBuffer(opts: {
    archivoUrl: string;
    archivoPublicId: string;
    nombreArchivo: string;
}): Promise<Buffer> {
    const { archivoUrl, archivoPublicId, nombreArchivo } = opts;
    getCloudinaryConfig();

    let lastStatus: number | string = "desconocido";

    // a) Intento con resource_type: "raw"
    try {
        const signedRawUrl = cloudinary.utils.private_download_url(archivoPublicId, "", {
            resource_type: "raw",
            type: "upload",
        });
        console.log(`[cloudinary] Descargando buffer (raw): publicId=${archivoPublicId} (${nombreArchivo})`);
        const resRaw = await fetch(signedRawUrl, {
            signal: AbortSignal.timeout(15000),
        });
        console.log(`[cloudinary] Intento raw status: ${resRaw.status}`);
        if (resRaw.ok) {
            return Buffer.from(await resRaw.arrayBuffer());
        }
        lastStatus = resRaw.status;
    } catch (err: any) {
        console.warn(`[cloudinary] Error en intento raw:`, err.message || err);
    }

    // b) Intento con resource_type: "image"
    try {
        const signedImageUrl = cloudinary.utils.private_download_url(archivoPublicId, "", {
            resource_type: "image",
            type: "upload",
        });
        console.log(`[cloudinary] Descargando buffer (image): publicId=${archivoPublicId} (${nombreArchivo})`);
        const resImage = await fetch(signedImageUrl, {
            signal: AbortSignal.timeout(15000),
        });
        console.log(`[cloudinary] Intento image status: ${resImage.status}`);
        if (resImage.ok) {
            return Buffer.from(await resImage.arrayBuffer());
        }
        lastStatus = resImage.status;
    } catch (err: any) {
        console.warn(`[cloudinary] Error en intento image:`, err.message || err);
    }

    // c) fetch directo de archivoUrl con header User-Agent
    try {
        console.log(`[cloudinary] Descargando buffer directo de archivoUrl: ${archivoUrl}`);
        const resDirect = await fetch(archivoUrl, {
            headers: { "User-Agent": "SISAT-ATP/1.0" },
            signal: AbortSignal.timeout(15000),
        });
        console.log(`[cloudinary] Intento directo status: ${resDirect.status}`);
        if (resDirect.ok) {
            return Buffer.from(await resDirect.arrayBuffer());
        }
        lastStatus = resDirect.status;
    } catch (err: any) {
        console.warn(`[cloudinary] Error en intento directo:`, err.message || err);
    }

    throw new Error(`No se pudo descargar desde Cloudinary (último intento HTTP ${lastStatus}). publicId=${archivoPublicId}`);
}

/**
 * Removemos caracteres no permitidos en el public_id de Cloudinary.
 */
function sanitizeFileName(name: string): string {
    return name
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._\-]/g, "")
        .slice(0, 80); // max length
}

/**
 * Función para generar la estructura de carpetas: "CCT - Escuela/Programa"
 */
export function buildFolderPath(cct: string, escuelaNombre: string, programaNombre: string): string {
    const escuelaFolder = sanitizeFileName(`${cct} - ${escuelaNombre}`);
    const programaFolder = sanitizeFileName(programaNombre);
    return `${escuelaFolder}/${programaFolder}`;
}


