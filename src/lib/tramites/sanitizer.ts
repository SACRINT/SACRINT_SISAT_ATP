/**
 * Sanitizador de salida para el Chatbot Agéntico.
 * Garantiza que ninguna respuesta del chatbot exponga datos personales sensibles
 * como CURP o RFC (Regla 7 de AGENTS.md).
 */

// Regex para CURP mexicana (18 caracteres estándar: 4 letras, 6 dígitos fecha, H/M, 2 entidad, 3 consonantes, 2 homoclave/verificador)
const CURP_REGEX = /\b[A-Z]{4}\d{6}[HM][A-Z\d]{6,7}\b/gi;

// Regex para RFC mexicano (física 13 chars o moral 12 chars: 3-4 letras, 6 dígitos fecha, 3 homoclave)
const RFC_REGEX = /\b[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}\b/gi;

/**
 * Limpia la sintaxis cruda de Markdown (asteriscos, almohadillas, etc.) para entregar
 * texto perfectamente legible, formal y en formato normal según la preferencia del usuario.
 */
export function limpiarFormatoMarkdown(text: string): string {
    if (!text) return "";

    let limpio = text;

    // 1. Quitar negritas y cursivas en markdown (***texto***, **texto**, *texto*, __texto__, _texto_)
    limpio = limpio.replace(/\*\*\*([^\*\n]+)\*\*\*/g, "$1");
    limpio = limpio.replace(/\*\*([^\*\n]+)\*\*/g, "$1");
    limpio = limpio.replace(/__([^_\n]+)__/g, "$1");
    limpio = limpio.replace(/\*([^\*\n]+)\*/g, "$1");
    limpio = limpio.replace(/_([^_\n]+)_/g, "$1");

    // 2. Convertir encabezados markdown (### Título -> Título)
    limpio = limpio.replace(/^#{1,6}\s*(.+)$/gm, "$1");

    // 3. Normalizar viñetas con asterisco o guión a viñetas estándar con punto limpio (•)
    limpio = limpio.replace(/^[\*\-]\s+/gm, "• ");

    // 4. Limpiar cualquier asterisco suelto residual
    limpio = limpio.replace(/\s+\*\s+/g, " • ");
    limpio = limpio.replace(/\*+/g, "");

    // 5. Normalizar enlaces markdown [Texto](URL) a Texto (URL)
    limpio = limpio.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, "$1: $2");

    // 6. Normalizar saltos de línea excesivos
    limpio = limpio.replace(/\n{3,}/g, "\n\n");

    return limpio.trim();
}

export function sanitizeOutput(text: string): string {
    if (!text) return "";
    
    let sanitized = text.replace(CURP_REGEX, "[CURP PROTEGIDA]");
    sanitized = sanitized.replace(RFC_REGEX, "[RFC PROTEGIDO]");
    
    // Limpieza estricta de formato markdown para entregar texto normal
    sanitized = limpiarFormatoMarkdown(sanitized);

    return sanitized;
}
