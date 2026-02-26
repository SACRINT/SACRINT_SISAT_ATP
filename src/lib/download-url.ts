/**
 * Genera una URL de descarga que usa el proxy del servidor (/api/download)
 * para descargar archivos de Cloudinary sin restricciones de acceso directo.
 *
 * Este archivo es client-safe (no importa dependencias de Node.js).
 */
export function getDownloadUrl(
    url: string | null | undefined,
    fileName?: string,
    publicId?: string | null,
): string | undefined {
    if (!url) return undefined;

    // Use the server-side proxy to download the file
    const params = new URLSearchParams({ url });
    if (fileName) {
        params.set("name", fileName);
    }
    if (publicId) {
        params.set("publicId", publicId);
    }
    return `/api/download?${params.toString()}`;
}
