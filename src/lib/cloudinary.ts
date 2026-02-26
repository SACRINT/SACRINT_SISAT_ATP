import { v2 as cloudinary } from "cloudinary";

// ─── Cloudinary client ──────────────────────────────────────────────────────

function getCloudinaryConfig() {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
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
    folderPath: string
): Promise<CloudinaryUploadResult> {
    const client = getCloudinaryConfig();

    // Cloudinary folder path: SISAT-ATP/CCT - Escuela/Programa
    const folder = `SISAT-ATP/${folderPath}`;

    // Determine resource type
    const resourceType = mimeType.startsWith("image/") ? "image" : "raw";

    return new Promise((resolve, reject) => {
        const uploadStream = client.uploader.upload_stream(
            {
                folder,
                public_id: `${Date.now()}_${sanitizeFileName(fileName)}`,
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

/**
 * Añade la bandera fl_attachment a la URL para forzar la descarga de Cloudinary.
 * Útil para saltarse bloqueos 401 en PDFs u otros adjuntos en cuentas sin firmas estrictas para la visualización de medios.
 */
export function getDownloadUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.includes('/upload/') && !url.includes('/fl_attachment')) {
        return url.replace('/upload/', '/upload/fl_attachment/');
    }
    return url;
}
