/**
 * Genera una URL de descarga que usa el proxy del servidor (/api/download)
 * para descargar archivos de Cloudinary sin restricciones de acceso directo.
 *
 * Este archivo es client-safe (no importa dependencias de Node.js).
 */
export function getDownloadUrl(url: string | null | undefined, fileName?: string): string | undefined {
    if (!url) return undefined;

    // Use the server-side proxy to download the file
    const params = new URLSearchParams({ url });
    if (fileName) {
        params.set("name", fileName);
    }
    return `/api/download?${params.toString()}`;
}
