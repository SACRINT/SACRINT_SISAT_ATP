/**
 * Helper para registrar errores de servidor en la tabla ErrorLog.
 * Diseñado para ser infalible (no lanza excepciones si falla el guardado).
 */
import { prisma } from "@/lib/db";

export interface ErrorLogContext {
    ruta?: string;
    metodo?: string;
    mensaje: string;
    stack?: string;
    userId?: string;
}

export async function registrarError(
    tenantId?: string | null,
    ctx?: ErrorLogContext
): Promise<void> {
    try {
        if (!ctx?.mensaje) return;

        await prisma.errorLog.create({
            data: {
                tenantId: tenantId || null,
                ruta: ctx.ruta || "desconocida",
                metodo: ctx.metodo || "UNKNOWN",
                mensaje: ctx.mensaje.slice(0, 4000), // Evitar desbordamiento
                stack: ctx.stack ? ctx.stack.slice(0, 8000) : null,
                userId: ctx.userId || null,
            },
        });
    } catch (err) {
        console.error("[registrarError] Error al persistir ErrorLog en BD:", err);
    }
}
