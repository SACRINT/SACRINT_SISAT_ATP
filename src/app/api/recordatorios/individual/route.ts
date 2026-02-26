import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");
const FROM_EMAIL = "Centro de Mando ATP <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { entregaId } = body;

        if (!entregaId) {
            return NextResponse.json({ error: "Falta el ID de la entrega" }, { status: 400 });
        }

        const entrega = await prisma.entrega.findUnique({
            where: { id: entregaId },
            include: {
                escuela: true,
                periodoEntrega: {
                    include: {
                        programa: true,
                    },
                },
            },
        });

        if (!entrega) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });

        const p = entrega.periodoEntrega;
        const programa = p.programa;
        const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
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

        const { error: resendError } = await resend.emails.send({
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

        if (resendError) {
            console.error("Error devuelto por Resend:", resendError);
            return NextResponse.json({ error: resendError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: "Correo enviado exitosamente a " + entrega.escuela.email });
    } catch (error: any) {
        console.error("Error al enviar recordatorio individual:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
