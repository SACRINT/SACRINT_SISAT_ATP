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

/**
 * Genera un nombre de archivo descriptivo para descargas de ENTREGAS DE PROGRAMAS.
 *
 * Formato: [CCT]_[Programa]_[Periodo]_[Etiqueta].[ext]
 * Ejemplo: 21DBA0123K_Planeacion_Anual_Registro.pdf
 *
 * @param cct - Clave del Centro de Trabajo de la escuela
 * @param programa - Nombre del programa educativo
 * @param periodo - Periodo (e.g., "Anual", "Enero", "Semestre 1")
 * @param etiqueta - Etiqueta del archivo (e.g., "Registro", "Evidencias")
 * @param nombreOriginal - Nombre original del archivo (para extraer extensión)
 */
export function buildEntregaFileName(
    cct: string,
    programa: string,
    periodo: string,
    etiqueta: string | null | undefined,
    nombreOriginal: string,
): string {
    const ext = getExtension(nombreOriginal);
    const parts = [
        sanitize(cct),
        sanitize(programa),
        sanitize(periodo),
        etiqueta ? sanitize(etiqueta) : null,
    ].filter(Boolean);
    return parts.join("_") + ext;
}

/**
 * Genera un nombre de archivo descriptivo para descargas de EXPEDIENTES DE PERSONAL.
 *
 * Formato: [CCT]_[ApellidoPaterno][ApellidoMaterno]_[Nombre]_[TipoDocumento].[ext]
 * Ejemplo: 21DBA0123K_GarciaLopez_Juan_CURP.pdf
 * Ejemplo: 21DBA0123K_MartinezRuiz_Ana_TITULO.pdf
 *
 * @param cct - Clave del Centro de Trabajo de la escuela
 * @param apellidoPaterno - Apellido paterno de la persona
 * @param apellidoMaterno - Apellido materno de la persona
 * @param nombre - Nombre(s) de la persona
 * @param tipoDocumento - Tipo de documento (e.g., "CURP_DOC", "TITULO", "INE")
 * @param etiqueta - Etiqueta personalizada (para documentos tipo CUSTOM)
 * @param nombreOriginal - Nombre original del archivo (para extraer extensión)
 */
export function buildExpedienteFileName(
    cct: string,
    apellidoPaterno: string,
    apellidoMaterno: string,
    nombre: string,
    tipoDocumento: string,
    etiqueta: string | null | undefined,
    nombreOriginal: string,
): string {
    const ext = getExtension(nombreOriginal);
    const tipoLabel = etiqueta
        ? sanitize(etiqueta)
        : TIPO_DOCUMENTO_LABELS[tipoDocumento] ?? sanitize(tipoDocumento);

    const parts = [
        sanitize(cct),
        sanitize(apellidoPaterno + apellidoMaterno),
        sanitize(nombre.split(" ")[0]), // solo primer nombre para brevedad
        tipoLabel,
    ].filter(Boolean);
    return parts.join("_") + ext;
}

/**
 * Genera un nombre de archivo para descargas de CAPEMS.
 *
 * Formato: [CCT]_CAPEM_[NombreCapem]_[NombreFicha].[ext]
 * Ejemplo: 21DBA0123K_CAPEM_Basico_FichaInscripcion.pdf
 */
export function buildCapemFileName(
    cct: string,
    capemNombre: string,
    fichaNombre: string,
    nombreOriginal: string,
): string {
    const ext = getExtension(nombreOriginal);
    const parts = [
        sanitize(cct),
        "CAPEM",
        sanitize(capemNombre),
        sanitize(fichaNombre),
    ].filter(Boolean);
    return parts.join("_") + ext;
}

// ─── Helpers internos ──────────────────────────────────────

/** Mapa de tipos de documento a etiquetas cortas y legibles */
const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
    TITULO: "Titulo",
    CEDULA: "Cedula",
    ACTA_NACIMIENTO: "Acta_Nacimiento",
    CURP_DOC: "CURP",
    ORDEN_ADSCRIPCION: "Orden_Adscripcion",
    MOVIMIENTO_PERSONAL: "Movimiento_Personal",
    COMPROBANTE_PAGO: "Comprobante_Pago",
    COMPROBANTE_FISCAL: "Comprobante_Fiscal",
    INE: "INE",
    COMPROBANTE_DOMICILIO: "Comprobante_Domicilio",
};

/** Elimina caracteres especiales y espacios, capitaliza palabras */
function sanitize(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-zA-Z0-9\s_-]/g, "") // keep only alphanumeric, space, underscore, dash
        .trim()
        .replace(/\s+/g, "_"); // spaces to underscores
}

/** Extrae la extensión de un nombre de archivo (incluyendo el punto) */
function getExtension(fileName: string): string {
    const match = fileName.match(/(\.[^.]+)$/);
    return match ? match[1].toLowerCase() : "";
}

/**
 * URL de descarga con nombre automático contextual para ENTREGAS.
 * Wrapper conveniente que combina buildEntregaFileName + getDownloadUrl.
 */
export function getEntregaDownloadUrl(opts: {
    url: string | null | undefined;
    publicId?: string | null;
    cct: string;
    programa: string;
    periodo: string;
    etiqueta?: string | null;
    nombreOriginal: string;
}): string | undefined {
    if (!opts.url) return undefined;
    const fileName = buildEntregaFileName(
        opts.cct,
        opts.programa,
        opts.periodo,
        opts.etiqueta,
        opts.nombreOriginal
    );
    return getDownloadUrl(opts.url, fileName, opts.publicId);
}

/**
 * URL de descarga con nombre automático contextual para EXPEDIENTES.
 * Wrapper conveniente que combina buildExpedienteFileName + getDownloadUrl.
 */
export function getExpedienteDownloadUrl(opts: {
    url: string | null | undefined;
    publicId?: string | null;
    cct: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    nombre: string;
    tipoDocumento: string;
    etiqueta?: string | null;
    nombreOriginal: string;
}): string | undefined {
    if (!opts.url) return undefined;
    const fileName = buildExpedienteFileName(
        opts.cct,
        opts.apellidoPaterno,
        opts.apellidoMaterno,
        opts.nombre,
        opts.tipoDocumento,
        opts.etiqueta,
        opts.nombreOriginal
    );
    return getDownloadUrl(opts.url, fileName, opts.publicId);
}
