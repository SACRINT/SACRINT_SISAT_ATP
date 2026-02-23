import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");
const FROM_EMAIL = "Centro de Mando ATP <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
    try {
        // Verificar autenticación o si es una llamada desde Vercel Cron.
        // Si no es un cron, exigimos ser admin autenticado para disparo manual.
        const authHeader = req.headers.get("authorization");
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

        let session;
        if (!isCron) {
            session = await auth();
            const user = session?.user as { role?: string } | undefined;
            if (!session || user?.role !== "admin") {
                return NextResponse.json({ error: "No autorizado" }, { status: 401 });
            }
        }

        const data = await req.json();
        const { programaId } = data;

        if (!programaId) {
            return NextResponse.json({ error: "Falta el ID del programa" }, { status: 400 });
        }

        const programa = await prisma.programa.findUnique({
            where: { id: programaId }
        });

        if (!programa) {
            return NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });
        }

        // Obtener fechas y periodos del programa que estén activos
        const periodosLimites = await prisma.periodoEntrega.findMany({
            where: { programaId, activo: true },
        });

        if (periodosLimites.length === 0) {
            return NextResponse.json({ enviados: 0, message: "No hay periodos activos para este programa." });
        }

        const periodoIds = periodosLimites.map(p => p.id);

        // Buscar directores y escuelas que "DEBEN"
        // 1. Buscamos todas las escuelas
        const escuelas = await prisma.escuela.findMany();

        // 2. Buscamos todas las entregas para estos periodos activos
        const entregasActuales = await prisma.entrega.findMany({
            where: {
                escuelaId: { in: escuelas.map(e => e.id) },
                periodoEntregaId: { in: periodoIds },
                estado: {
                    in: ["PENDIENTE", "REQUIERE_CORRECCION"]
                }
            },
            include: {
                escuela: true,
                periodoEntrega: { include: { cicloEscolar: true } }
            }
        });

        let emailCount = 0;

        // Disparar un correo for loop no escalable en prod millonario pero para este scale escolar es util
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

                await resend.emails.send({
                    from: FROM_EMAIL,
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
                            <a href="https://sacrint-sisat-atp.vercel.app" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir a mi Portal</a>
                        </p>
                        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #888;">Este es un mensaje automático del Sistema de Centro de Mando ATP. Por favor no responda a este correo.</p>
                        </div>
                    `,
                });
                emailCount++;
            } catch (err) {
                console.error("No se pudo enviar correo a " + entrega.escuela.email, err);
            }
        }

        return NextResponse.json({ success: true, enviados: emailCount });

    } catch (error) {
        console.error("Error al enviar recordatorios API", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
