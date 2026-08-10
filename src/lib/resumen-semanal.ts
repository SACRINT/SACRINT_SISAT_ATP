/**
 * Generador y enviador del Resumen Semanal de Supervisión al Correo Institucional / Supervisor.
 */
import { prisma } from "@/lib/db";
import { getInstitucion } from "@/lib/institucion";
import { sendEmail } from "@/lib/email";

export interface ResumenSemanalResultado {
    success: boolean;
    destinatario: string;
    entregasTotal: number;
    oficiosActivos: number;
    topRezagosCount: number;
    mensaje: string;
}

export async function generarYEnviarResumenSemanal(
    tenantId?: string
): Promise<ResumenSemanalResultado> {
    const inst = await getInstitucion(tenantId);
    const emailDestino = inst.emailReporteNivel;

    if (!emailDestino) {
        throw new Error("No hay correo institucional (emailReporteNivel) configurado en la institución.");
    }

    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleDateString("es-MX", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    // ── 1. Datos de Entregas por Programa ─────────────────────────────────────
    const programas = await prisma.programa.findMany({
        include: {
            periodos: {
                where: { activo: true },
                include: {
                    entregas: {
                        select: { estado: true, escuelaId: true },
                    },
                },
            },
        },
    });

    const resumenProgramas = programas.map((p) => {
        let entregadas = 0;
        let pendientes = 0;
        let correccion = 0;
        let noEntregadas = 0;

        p.periodos.forEach((per) => {
            per.entregas.forEach((e) => {
                if (e.estado === "APROBADO") entregadas++;
                else if (e.estado === "PENDIENTE") pendientes++;
                else if (e.estado === "REQUIERE_CORRECCION") correccion++;
                else if (e.estado === "NO_ENTREGADO") noEntregadas++;
            });
        });

        const total = entregadas + pendientes + correccion + noEntregadas;
        return {
            nombre: p.nombre,
            total,
            entregadas,
            pendientes,
            correccion,
            noEntregadas,
        };
    });

    const totalEntregasGenerales = resumenProgramas.reduce((acc, curr) => acc + curr.total, 0);

    // ── 2. Oficios Activos y Criticidad ───────────────────────────────────────
    const whereOficios = tenantId ? { tenantId } : {};
    const oficiosActivos = await prisma.oficio.findMany({
        where: {
            ...whereOficios,
            estado: { in: ["RECIBIDO", "ENVIADO"] },
        },
        include: {
            destinatarios: {
                where: { acuseRecibido: false },
                select: { id: true },
            },
        },
    });

    const oficiosRojo = oficiosActivos.filter((o) => o.criticidad === "ROJO").length;
    const oficiosAmarillo = oficiosActivos.filter((o) => o.criticidad === "AMARILLO").length;
    const oficiosVerde = oficiosActivos.filter((o) => o.criticidad === "VERDE").length;
    const totalDestinatariosSinAcuse = oficiosActivos.reduce(
        (acc, o) => acc + o.destinatarios.length,
        0
    );

    // ── 3. Top 5 Escuelas con Más Rezagos ─────────────────────────────────────
    const escuelas = await prisma.escuela.findMany({
        where: { esSupervision: false, esDePrueba: false },
        include: {
            entregas: {
                where: { estado: { in: ["NO_ENTREGADO", "REQUIERE_CORRECCION"] } },
                select: { id: true },
            },
        },
    });

    const escuelasConRezagos = escuelas
        .map((e) => ({
            nombre: e.nombre,
            cct: e.cct,
            rezagos: e.entregas.length,
        }))
        .filter((e) => e.rezagos > 0)
        .sort((a, b) => b.rezagos - a.rezagos)
        .slice(0, 5);

    // ── 4. Construcción del Template HTML ────────────────────────────────────
    const htmlProgramas = resumenProgramas.length === 0
        ? `<p style="color: #64748b;">No hay programas registrados.</p>`
        : `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
            <thead>
                <tr style="background-color: #1e293b; color: white; text-align: left;">
                    <th style="padding: 8px 12px;">Programa</th>
                    <th style="padding: 8px 12px; text-align: center;">Total</th>
                    <th style="padding: 8px 12px; text-align: center;">Entregadas</th>
                    <th style="padding: 8px 12px; text-align: center;">Pendientes</th>
                    <th style="padding: 8px 12px; text-align: center;">Corrección</th>
                    <th style="padding: 8px 12px; text-align: center;">Sin Entregar</th>
                </tr>
            </thead>
            <tbody>
                ${resumenProgramas
                    .map(
                        (p, idx) => `
                    <tr style="background-color: ${idx % 2 === 0 ? "#f8fafc" : "#ffffff"}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px 12px; font-weight: bold; color: #1e293b;">${p.nombre}</td>
                        <td style="padding: 8px 12px; text-align: center;">${p.total}</td>
                        <td style="padding: 8px 12px; text-align: center; color: #16a34a; font-weight: bold;">${p.entregadas}</td>
                        <td style="padding: 8px 12px; text-align: center; color: #0284c7;">${p.pendientes}</td>
                        <td style="padding: 8px 12px; text-align: center; color: #d97706;">${p.correccion}</td>
                        <td style="padding: 8px 12px; text-align: center; color: #dc2626; font-weight: bold;">${p.noEntregadas}</td>
                    </tr>
                `
                    )
                    .join("")}
            </tbody>
        </table>
    `;

    const htmlTopRezagos = escuelasConRezagos.length === 0
        ? `<p style="color: #16a34a; font-weight: bold;">¡Excelente! No hay escuelas con entregas pendientes o con rezago.</p>`
        : `
        <ol style="margin: 10px 0; padding-left: 20px;">
            ${escuelasConRezagos
                .map(
                    (e) => `
                <li style="margin-bottom: 6px; color: #334155;">
                    <strong>${e.nombre}</strong> (${e.cct}) — <span style="color: #dc2626; font-weight: bold;">${e.rezagos} pendientes</span>
                </li>
            `
                )
                .join("")}
        </ol>
    `;

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #334155; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
                <h2 style="margin: 0; font-size: 20px; font-weight: bold; color: #f8fafc;">${inst.nombreSupervision} — Zona ${inst.zona}</h2>
                <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">Reporte Ejecutivo Semanal al Supervisor Escolar</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">${fechaFormateada}</p>
            </div>

            <div style="padding: 24px;">
                <p style="font-size: 14px;">Estimado(a) <strong>${inst.supervisor}</strong>,</p>
                <p style="font-size: 14px;">A continuación se presenta el resumen de avance operativo, seguimiento de oficios y estatus de escuelas en la zona escolar:</p>

                <!-- Resumen de Oficios Activos -->
                <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #0f172a;">📩 Estado de Oficios y Plazos Activos</h3>
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div style="padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; font-weight: bold; color: #991b1b;">
                            🔴 Urgentes (Rojo ≤24h): ${oficiosRojo}
                        </div>
                        <div style="padding: 8px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; font-weight: bold; color: #92400e;">
                            🟡 En Atención (Amarillo ≤72h): ${oficiosAmarillo}
                        </div>
                        <div style="padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-weight: bold; color: #166534;">
                            🟢 En Plazo (Verde): ${oficiosVerde}
                        </div>
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 13px; color: #475569;">
                        Total Oficios Activos: <strong>${oficiosActivos.length}</strong> | Escuelas sin acuse de recibido: <strong style="color: #dc2626;">${totalDestinatariosSinAcuse}</strong>
                    </p>
                </div>

                <!-- Entregas por Programa -->
                <div style="margin: 24px 0;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #0f172a;">📊 Cumplimiento de Programas Oficiales</h3>
                    ${htmlProgramas}
                </div>

                <!-- Top Rezagos -->
                <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #9f1239;">⚠️ Top 5 Escuelas con Mayor Rezago</h3>
                    ${htmlTopRezagos}
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.APP_URL || "https://sacrint-sisat-atp.vercel.app"}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acceder al Centro de Mando</a>
                </div>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
                    Generado automáticamente por el Sistema Centro de Mando ATP.
                </p>
            </div>
        </div>
    `;

    await sendEmail({
        to: emailDestino,
        subject: `📊 Resumen Semanal de Supervisión — Zona ${inst.zona} (${fechaFormateada})`,
        html: htmlBody,
    });

    return {
        success: true,
        destinatario: emailDestino,
        entregasTotal: totalEntregasGenerales,
        oficiosActivos: oficiosActivos.length,
        topRezagosCount: escuelasConRezagos.length,
        mensaje: `Resumen semanal enviado a ${emailDestino}`,
    };
}
