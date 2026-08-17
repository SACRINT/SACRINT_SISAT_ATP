/**
 * Sanitizador de salida para el Chatbot Agéntico.
 * Garantiza que ninguna respuesta del chatbot exponga datos personales sensibles
 * como CURP o RFC (Regla 7 de AGENTS.md).
 */

// Regex para CURP mexicana (18 caracteres estándar: 4 letras, 6 dígitos fecha, H/M, 2 entidad, 3 consonantes, 2 homoclave/verificador)
const CURP_REGEX = /\b[A-Z]{4}\d{6}[HM][A-Z\d]{6,7}\b/gi;

// Regex para RFC mexicano (física 13 chars o moral 12 chars: 3-4 letras, 6 dígitos fecha, 3 homoclave)
const RFC_REGEX = /\b[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}\b/gi;

export function sanitizeOutput(text: string): string {
    if (!text) return "";
    
    let sanitized = text.replace(CURP_REGEX, "[CURP PROTEGIDA]");
    sanitized = sanitized.replace(RFC_REGEX, "[RFC PROTEGIDO]");
    
    return sanitized;
}
