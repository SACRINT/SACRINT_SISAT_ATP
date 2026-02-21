import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTactfulReminder } from "@/lib/email";

// Disable Next.js caching for this cron route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Only allow GET requests that come from Vercel Cron (they include a special header)
    // In local development, we might want to bypass this for testing
    const authHeader = request.headers.get("Authorization");
    if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        console.log("Iniciando cron job de recordatorios...");

        // Find the active ciclo escolar
        const ciclo = await prisma.cicloEscolar.findFirst({
            where: { activo: true },
        });

        if (!ciclo) {
            return NextResponse.json({ message: "No hay ciclo escolar activo" });
        }

        // Find all active periodos
        const periodosActivos = await prisma.periodoEntrega.findMany({
            where: {
                cicloEscolarId: ciclo.id,
                activo: true,
                fechaLimite: { not: null } // must have a deadline
            },
            include: { programa: true }
        });

        let correosEnviados = 0;
        const hoy = new Date();
        // Reset hours to compare only dates
        const hoySoloFecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

        for (const periodo of periodosActivos) {
            if (!periodo.fechaLimite) continue;

            const limiteDate = new Date(periodo.fechaLimite);
            const limiteSoloFecha = new Date(limiteDate.getFullYear(), limiteDate.getMonth(), limiteDate.getDate());

            const diferenciaDias = Math.floor((limiteSoloFecha.getTime() - hoySoloFecha.getTime()) / (1000 * 60 * 60 * 24));

            let tipoNotificacion: "proximo" | "vencido" | null = null;

            // "proxima a llegar": exactly 3 days before timeline
            if (diferenciaDias === 3) {
                tipoNotificacion = "proximo";
            }
            // "vencida": exactly 1 day after timeline
            else if (diferenciaDias === -1) {
                tipoNotificacion = "vencido";
            }

            if (!tipoNotificacion) continue;

            // Find all entregas for this period that are NOT approved or pending review (i.e. NO_ENTREGADO, REQUIERE_CORRECCION, NO_APROBADO)
            const entregasIncompletas = await prisma.entrega.findMany({
                where: {
                    periodoEntregaId: periodo.id,
                    estado: { in: ["NO_ENTREGADO", "REQUIERE_CORRECCION", "NO_APROBADO"] }
                },
                include: { escuela: true }
            });

            // Build period label
            let periodoLabel = "Ciclo 2025-2026";
            if (periodo.mes) {
                const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                periodoLabel = meses[periodo.mes];
            } else if (periodo.semestre) {
                periodoLabel = `Semestre ${periodo.semestre}`;
            }

            // Send emails concurrently but in small batches to avoid rate limits
            for (const entrega of entregasIncompletas) {
                await sendTactfulReminder(
                    entrega.escuela.email,
                    entrega.escuela.nombre,
                    periodo.programa.nombre,
                    periodoLabel,
                    limiteDate,
                    tipoNotificacion
                );
                correosEnviados++;
            }
        }

        console.log(`Cron job completado. ${correosEnviados} correos enviados.`);
        return NextResponse.json({ success: true, enviados: correosEnviados });

    } catch (error) {
        console.error("Error en cron job:", error);
        return NextResponse.json({ error: "Error en cron job" }, { status: 500 });
    }
}
