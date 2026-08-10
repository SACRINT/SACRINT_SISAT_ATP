import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EstadoEntrega } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { procesarRecordatoriosOficio } from "@/lib/oficios/oficios-engine";
import { generarYEnviarResumenSemanal } from "@/lib/resumen-semanal";

export const dynamic = "force-dynamic";

async function ejecutarProcesamientoRecordatorios(req: NextRequest, bodyData?: Record<string, unknown>) {
    // 1. Procesamiento de entregas de programas
    const programaId = bodyData?.programaId as string | undefined;
    const estados = bodyData?.estados as string[] | undefined;

    let emailCountProgramas = 0;

    if (programaId) {
        const targetEstados: EstadoEntrega[] = Array.isArray(estados) && estados.length > 0
            ? (estados as EstadoEntrega[])
            : [EstadoEntrega.NO_ENTREGADO, EstadoEntrega.REQUIERE_CORRECCION];

        const programa = await prisma.programa.findUnique({
            where: { id: programaId }
        });

        if (programa) {
            const periodosLimites = await prisma.periodoEntrega.findMany({
                where: { programaId, activo: true },
            });

            if (periodosLimites.length > 0) {
                const periodoIds = periodosLimites.map(p => p.id);
                const escuelas = await prisma.escuela.findMany();

                const entregasActuales = await prisma.entrega.findMany({
                    where: {
                        escuelaId: { in: escuelas.map(e => e.id) },
                        periodoEntregaId: { in: periodoIds },
                        estado: { in: targetEstados }
                    },
                    include: {
                        escuela: true,
                        periodoEntrega: { include: { cicloEscolar: true } }
                    }
                });

                for (const entrega of entregasActuales) {
                    try {
                        const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                        const p = entrega.periodoEntrega;
                        const pName = p.mes ? meses[p.mes] : (p.semestre ? `Semestre ${p.semestre}` : `Anual`);
                        const fLimite = p.fechaLimite ? new Date(p.fechaLimite).toLocaleDateString("es-MX") : 'fecha límite no especificada';

                        let subject = `URGENTE: Entrega de ${programa.nombre} pendiente`;
                        let headerTxt = "Entrega Pendiente";
                        let textBody = `El sistema detecta que aún no ha subido los archivos correspondientes a <strong>${pName}</strong> para el programa <strong>${programa.nombre}</strong>.`;

                        if (entrega.estado === "REQUIERE_CORRECCION") {
                            subject = `URGENTE: Corrección de ${programa.nombre} pendiente`;
                            headerTxt = "Corrección Pendiente";
                            textBody = `El ATP ha marcado su entrega de <strong>${pName}</strong> para el programa <strong>${programa.nombre}</strong> con estado de Corrección. Favor de subir nuevamente los archivos listos a la brevedad.`;
                        }

                        await sendEmail({
                            to: entrega.escuela.email,
                            subject: subject,
                            html: `
                                <div style="font-family: Arial, sans-serif; color: #333;">
                                <h2 style="color: #dc2626;">Aviso de ${headerTxt}</h2>
                                <p>Estimado(a) Director(a) de la escuela <strong>${entrega.escuela.nombre}</strong>,</p>
                                <p>${textBody}</p>
                                <p>La fecha de entrega para este periodo es: <strong style="color: #dc2626">${fLimite}</strong>.</p>
                                <p>Le pedimos amablemente completar este requerimiento desde su portal.</p>
                                
                                <p style="text-align: center; margin: 30px 0;">
                                    <a href="${getAppUrl()}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ir a mi Portal</a>
                                </p>
                                <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                                <p style="font-size: 12px; color: #888;">Este es un mensaje automático del Sistema de Centro de Mando ATP. Por favor no responda a este correo.</p>
                                </div>
                            `,
                        });
                        emailCountProgramas++;
                    } catch (errEmail) {
                        console.error("Error al enviar correo a", entrega.escuela.email, errEmail);
                    }
                }
            }
        }
    }

    // 2. Procesamiento de recordatorios de ATP-MOD-01 (Oficios y Plazos Urgentes)
    // Obtener todos los tenants configurados en OficioConfig u Oficio
    const configs = await prisma.oficioConfig.findMany({
        select: { tenantId: true },
    });
    const oficiosTenants = await prisma.oficio.findMany({
        select: { tenantId: true },
        distinct: ["tenantId"],
    });

    const tenantSet = new Set<string>();
    configs.forEach((c) => tenantSet.add(c.tenantId));
    oficiosTenants.forEach((o) => tenantSet.add(o.tenantId));

    let oficiosEnviados = 0;
    let oficiosErrores = 0;

    for (const tenantId of tenantSet) {
        try {
            const res = await procesarRecordatoriosOficio(
                tenantId,
                async (to, asunto, html) => sendEmail({ to, subject: asunto, html })
            );
            oficiosEnviados += res.enviados;
            oficiosErrores += res.errores;
        } catch (errOficios) {
            console.error(`[Recordatorios Cron] Error procesando oficios tenant ${tenantId}:`, errOficios);
        }
    }

    // 3. Enviar Resumen Semanal al Supervisor si es Viernes (5) o si es forzado en body
    let resumenSemanalResult = null;
    const esViernes = new Date().getDay() === 5;
    const forzarResumen = Boolean(bodyData?.enviarResumenSemanal);

    if (esViernes || forzarResumen) {
        try {
            resumenSemanalResult = await generarYEnviarResumenSemanal();
        } catch (errResumen) {
            console.error("[Recordatorios Cron] Error enviando resumen semanal:", errResumen);
        }
    }

    return {
        success: true,
        enviadosProgramas: emailCountProgramas,
        oficiosReminders: { enviados: oficiosEnviados, errores: oficiosErrores },
        resumenSemanal: resumenSemanalResult,
    };
}

// ── GET: Invocación Cron desde Vercel Cron (/api/recordatorios) ──────────────
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

        if (process.env.NODE_ENV === "production" && !isCron) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const resultado = await ejecutarProcesamientoRecordatorios(req);
        return NextResponse.json(resultado);
    } catch (error) {
        console.error("Error en GET /api/recordatorios (Cron)", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

// ── POST: Invocación manual o por API (/api/recordatorios) ───────────────────
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

        if (!isCron) {
            const session = await auth();
            const user = session?.user as { role?: string } | undefined;
            if (!session || !["admin", "supervision", "atp"].includes(user?.role ?? "")) {
                return NextResponse.json({ error: "No autorizado" }, { status: 401 });
            }
        }

        let bodyData: Record<string, unknown> = {};
        try {
            bodyData = (await req.json()) as Record<string, unknown>;
        } catch {
            // Body opcional
        }

        const resultado = await ejecutarProcesamientoRecordatorios(req, bodyData);
        return NextResponse.json(resultado);
    } catch (error) {
        console.error("Error al enviar recordatorios API", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
