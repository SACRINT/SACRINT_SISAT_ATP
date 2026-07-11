import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";



export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user as { role?: string } | undefined;
        if (!session || user?.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { asunto, contenido, tipoDestinatarios, escuelasSeleccionadas } = body;

        if (!asunto || !contenido || !tipoDestinatarios) {
            return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
        }

        let escuelasTargets: { id: string; nombre: string; email: string }[] = [];

        if (tipoDestinatarios === "TODOS") {
            escuelasTargets = await prisma.escuela.findMany({
                select: { id: true, nombre: true, email: true },
            });
        } else if (tipoDestinatarios === "SELECCIONADOS" && Array.isArray(escuelasSeleccionadas)) {
            escuelasTargets = await prisma.escuela.findMany({
                where: { id: { in: escuelasSeleccionadas } },
                select: { id: true, nombre: true, email: true },
            });
        } else if (tipoDestinatarios === "ALERTAS") {
            // Buscar escuelas que tengan alguna entrega en estado que requiera atención
            const entregasAlertas = await prisma.entrega.findMany({
                where: {
                    estado: {
                        in: ["NO_ENTREGADO", "REQUIERE_CORRECCION", "PENDIENTE", "EN_REVISION"],
                    },
                },
                select: {
                    escuelaId: true,
                },
            });

            const escuelaIds = Array.from(new Set(entregasAlertas.map((e) => e.escuelaId)));

            escuelasTargets = await prisma.escuela.findMany({
                where: { id: { in: escuelaIds } },
                select: { id: true, nombre: true, email: true },
            });
        }

        if (escuelasTargets.length === 0) {
            return NextResponse.json({ success: true, enviadosCount: 0, message: "No se encontraron destinatarios." });
        }

        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json({
                success: true,
                enviadosCount: escuelasTargets.length,
                simulated: true,
                message: "Simulación: No hay clave de API de Resend configurada.",
            });
        }

        let enviadosCount = 0;
        let fallidosCount = 0;

        for (const esc of escuelasTargets) {
            try {
                const htmlContent = `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-top: 0;">Aviso de la Supervisión Escolar</h2>
                        <p>Estimado(a) Director(a) de la escuela <strong>${esc.nombre}</strong>,</p>
                        
                        <div style="background-color: #f8fafc; border-left: 4px solid #1d4ed8; padding: 15px; margin: 20px 0; font-size: 0.95rem; line-height: 1.6; color: #1e293b;">
                            ${contenido.replace(/\n/g, "<br>")}
                        </div>

                        <p>Por favor, ingrese al sistema para dar seguimiento o resolver los pendientes indicados.</p>
                        
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="https://sacrint-sisat-atp.vercel.app" style="background-color: #1d4ed8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acceder al Portal del Director</a>
                        </p>

                        <br>
                        <p>Atentamente,</p>
                        <p><strong>Supervisión Escolar ATP</strong><br>Zona Escolar 004</p>
                        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                        <p style="font-size: 11px; color: #64748b; text-align: center;">Este es un mensaje institucional enviado desde la plataforma SISAT-ATP.</p>
                    </div>
                `;

                await sendEmail({
                    to: esc.email,
                    subject: asunto,
                    html: htmlContent,
                });
                enviadosCount++;

                // Pequeña pausa para no sobrepasar límites de la cuenta gratuita de Resend
                await new Promise((resolve) => setTimeout(resolve, 350));
            } catch (err) {
                console.error(`Error al enviar correo a ${esc.nombre} (${esc.email}):`, err);
                fallidosCount++;
            }
        }

        return NextResponse.json({
            success: true,
            enviadosCount,
            fallidosCount,
            message: `Aviso enviado exitosamente a ${enviadosCount} escuelas.${fallidosCount > 0 ? ` Fallaron ${fallidosCount} envíos.` : ""}`,
        });
    } catch (error: any) {
        console.error("Error en ruta de envío global de avisos:", error);
        return NextResponse.json({ error: error.message || "Error al enviar el aviso" }, { status: 500 });
    }
}
