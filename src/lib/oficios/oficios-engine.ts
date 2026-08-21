/**
 * ATP-MOD-01 — Biblioteca de lógica de negocio para Oficios y Plazos
 *
 * Reglas:
 * - Cero hardcodes: umbrales de semáforo provienen de OficioConfig en BD.
 * - tenantId obligatorio en toda operación.
 * - Zero-payload: nunca guardamos contenido de archivos en BD, solo rutas + SHA-256.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import type { CriticidadOficio, EstadoOficio } from "@prisma/client";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ExtraerMetadatosIA {
    remitenteNombre?: string;
    remitenteEmail?: string;
    asunto?: string;
    fechaLimite?: string | null; // ISO 8601 o null si no detectada
    instrucciones?: string;
    confianza?: number; // 0-1
    [key: string]: unknown; // permite serialización Prisma Json
}

// ── Config por tenant ─────────────────────────────────────────────────────────

/**
 * Obtiene (o crea) la OficioConfig para el tenant.
 * Nunca devuelve null — si no existe, crea con defaults.
 */
export async function getOficioConfig(tenantId: string) {
    let config = await prisma.oficioConfig.findUnique({ where: { tenantId } });
    if (!config) {
        config = await prisma.oficioConfig.create({
            data: { tenantId },
        });
    }
    return config;
}

// ── Semáforo de criticidad ────────────────────────────────────────────────────

/**
 * Calcula la criticidad de un oficio basándose en su fechaLimite y los
 * umbrales configurados en OficioConfig (no hardcodeados).
 */
export function calcularCriticidad(
    fechaLimite: Date | null | undefined,
    umbralRojoHoras: number,
    umbralAmarilloHoras: number
): CriticidadOficio {
    if (!fechaLimite) return "VERDE";

    const ahora = new Date();
    const diffMs = fechaLimite.getTime() - ahora.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);

    if (diffHoras <= 0) return "ROJO"; // ya venció
    if (diffHoras <= umbralRojoHoras) return "ROJO";
    if (diffHoras <= umbralAmarilloHoras) return "AMARILLO";
    return "VERDE";
}

/**
 * Recalcula y actualiza la criticidad de todos los oficios del tenant
 * que estén en estado RECIBIDO o ENVIADO. Llamado por el cron diario.
 */
export async function recalcularCriticidadesTenant(tenantId: string): Promise<number> {
    const config = await getOficioConfig(tenantId);

    const oficios = await prisma.oficio.findMany({
        where: {
            tenantId,
            estado: { in: ["RECIBIDO", "ENVIADO"] },
            fechaLimite: { not: null },
        },
        select: { id: true, fechaLimite: true, estado: true },
    });

    let actualizados = 0;
    for (const oficio of oficios) {
        const nuevaCriticidad = calcularCriticidad(
            oficio.fechaLimite,
            config.umbralRojoHoras,
            config.umbralAmarilloHoras
        );

        // Si venció, actualizar estado también
        const nuevoEstado: EstadoOficio | undefined =
            oficio.fechaLimite && oficio.fechaLimite < new Date() &&
            oficio.estado !== "ACUSADO" && oficio.estado !== "CANCELADO"
                ? "VENCIDO"
                : undefined;

        await prisma.oficio.update({
            where: { id: oficio.id },
            data: {
                criticidad: nuevaCriticidad,
                ...(nuevoEstado ? { estado: nuevoEstado } : {}),
            },
        });
        actualizados++;
    }

    return actualizados;
}

// ── Hash de integridad ────────────────────────────────────────────────────────

export function calcularSHA256Buffer(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function calcularSHA256Archivo(rutaAbsoluta: string): string {
    const buffer = fs.readFileSync(rutaAbsoluta);
    return calcularSHA256Buffer(buffer);
}

// ── Guardar archivo físico del oficio ─────────────────────────────────────────

/**
 * Guarda el buffer del oficio en el directorio de oficios del tenant.
 * Devuelve la ruta relativa (para guardar en BD).
 * NUNCA almacenamos contenido en BD — solo ruta + hash.
 */
export function guardarArchivoOficio(
    tenantId: string,
    nombreArchivo: string,
    buffer: Buffer
): { rutaRelativa: string; sha256: string } {
    const baseDir = process.env.OFICIOS_DIR || process.env.FORMATOS_DIR;
    if (!baseDir) {
        throw new Error(
            "OFICIOS_DIR o FORMATOS_DIR no está configurado. Define la variable de entorno."
        );
    }

    const ext = path.extname(nombreArchivo).toLowerCase();
    const extensionesPermitidas = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx", ".xlsx"];
    if (!extensionesPermitidas.includes(ext)) {
        throw new Error(
            `Extensión de archivo no permitida: ${ext}. Solo se permiten: ${extensionesPermitidas.join(", ")}`
        );
    }

    const dirTenant = path.join(baseDir, "oficios", tenantId);
    fs.mkdirSync(dirTenant, { recursive: true });

    const timestamp = Date.now();
    const nombreSafe = nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const nombreFinal = `${timestamp}_${nombreSafe}`;
    const rutaAbsoluta = path.join(dirTenant, nombreFinal);

    fs.writeFileSync(rutaAbsoluta, buffer);

    const sha256 = calcularSHA256Buffer(buffer);
    const rutaRelativa = path.join("oficios", tenantId, nombreFinal);

    return { rutaRelativa, sha256 };
}

// ── Recordatorios ─────────────────────────────────────────────────────────────

/**
 * Evalúa si se debe enviar recordatorio (48h o 12h) y registra en log.
 * Llama a este helper desde el cron /api/cron/recordatorios.
 */
export async function procesarRecordatoriosOficio(
    tenantId: string,
    sendEmailFn: (to: string, asunto: string, html: string) => Promise<{ success: boolean }>
): Promise<{ enviados: number; errores: number }> {
    const config = await getOficioConfig(tenantId);

    if (!config.recordatorios48h && !config.recordatorios12h) {
        return { enviados: 0, errores: 0 };
    }

    const ahora = new Date();
    const en48h = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
    const en12h = new Date(ahora.getTime() + 12 * 60 * 60 * 1000);

    // Oficios que vencen en las próximas 48h (RECIBIDO o ENVIADO)
    const oficiosPendientes = await prisma.oficio.findMany({
        where: {
            tenantId,
            estado: { in: ["RECIBIDO", "ENVIADO"] },
            fechaLimite: { lte: en48h, gte: ahora },
        },
        include: {
            destinatarios: {
                where: { acuseRecibido: false, confirmadoATP: false },
                select: { emailDestino: true, escuelaNombre: true },
            },
            recordatorios: { select: { tipo: true } },
        },
    });

    let enviados = 0;
    let errores = 0;

    for (const oficio of oficiosPendientes) {
        const tiposEnviados = oficio.recordatorios.map((r) => r.tipo);
        const horasRestantes =
            (oficio.fechaLimite!.getTime() - ahora.getTime()) / (1000 * 60 * 60);

        const tipo = horasRestantes <= 12 ? "12H" : "48H";

        if (
            (tipo === "48H" && !config.recordatorios48h) ||
            (tipo === "12H" && !config.recordatorios12h)
        )
            continue;

        if (tiposEnviados.includes(tipo)) continue; // ya enviado

        // Buscar destinatarios sin acuse
        for (const dest of oficio.destinatarios) {
            if (!dest.emailDestino) continue;
            try {
                const html = `
                    <h2>Recordatorio de Plazo — Oficio: ${oficio.numeroOficio}</h2>
                    <p><strong>Asunto:</strong> ${oficio.asunto}</p>
                    <p><strong>Plazo:</strong> ${oficio.fechaLimite?.toLocaleDateString("es-MX")}</p>
                    <p>Restan aproximadamente <strong>${Math.round(horasRestantes)} horas</strong>.</p>
                    <p>Favor de enviar su acuse de recibo a la brevedad.</p>
                `;
                await sendEmailFn(
                    dest.emailDestino,
                    `[RECORDATORIO ${tipo}] Oficio ${oficio.numeroOficio} — ${oficio.asunto}`,
                    html
                );
                enviados++;
            } catch (err) {
                errores++;
                console.error(`[MOD-01 Recordatorio] Error enviando a ${dest.emailDestino}:`, err);
            }
        }

        // Registrar log del recordatorio (idempotente por tipo)
        await prisma.oficioRecordatorioLog.create({
            data: {
                tenantId,
                oficioId: oficio.id,
                tipo,
                exitoso: errores === 0,
            },
        });
    }

    return { enviados, errores };
}
