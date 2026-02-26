/**
 * Añade la bandera fl_attachment a la URL para forzar la descarga de Cloudinary.
 * Útil para saltarse bloqueos 401 en PDFs u otros adjuntos.
 *
 * Este archivo es client-safe (no importa el SDK de Cloudinary de Node).
 */
export function getDownloadUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.includes('/upload/') && !url.includes('/fl_attachment')) {
        return url.replace('/upload/', '/upload/fl_attachment/');
    }
    return url;
}
