// Load .env and .env.local variables
import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
    console.log("Iniciando envío de correo de prueba...");

    // 1. Obtener la escuela "01 Escuela de prueba"
    const escuela = await prisma.escuela.findFirst({
        where: { nombre: { contains: "01 Escuela de prueba" } }
    });

    if (!escuela || !escuela.email) {
        console.error("No se encontró '01 Escuela de prueba' o no tiene email.");
        return;
    }

    // 2. Obtener el programa "Día Naranja" en el ciclo activo
    const cicloActivo = await prisma.cicloEscolar.findFirst({
        where: { activo: true }
    });

    if (!cicloActivo) {
        console.error("No hay ciclo escolar activo.");
        return;
    }

    const periodoDianaranja = await prisma.periodoEntrega.findFirst({
        where: {
            cicloEscolarId: cicloActivo.id,
            activo: true,
            programa: { nombre: { contains: "Día Naranja" } }
        },
        include: { programa: true }
    });

    if (!periodoDianaranja) {
        console.error("No se encontró el periodo activo para 'Día Naranja'.");
        return;
    }

    // 3. Crear el contenido del correo
    const emailTo = process.env.NODE_ENV === "development" ? (process.env.GMAIL_USER || escuela.email) : escuela.email;
    const emailFrom = process.env.EMAIL_FROM || "notificaciones@sisat.site";

    console.log(`Enviando a: ${emailTo} (Escuela: ${escuela.nombre})`);
    console.log(`Programa faltante: ${periodoDianaranja.programa.nombre}`);

    // 4. Enviar mediante Resend
    const { data, error } = await resend.emails.send({
        from: `SISAT Notificaciones <${emailFrom}>`,
        to: [emailTo],
        subject: `Recordatorio de Entrega Pendiente: ${periodoDianaranja.programa.nombre}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f7bf31; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Recordatorio de Entrega</h1>
            </div>
            
            <div style="padding: 30px 20px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #334155;">Estimado(a) Director(a) de la <strong>${escuela.nombre}</strong>,</p>
                
                <p style="font-size: 16px; color: #334155; line-height: 1.5;">
                    Le recordamos que tiene una entrega pendiente en la plataforma SISAT-ATP correspondiente al programa:
                </p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #f7bf31; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #0f172a;">${periodoDianaranja.programa.nombre}</h3>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Por favor, ingrese a la plataforma para completar esta acción lo antes posible.</p>
                </div>
                
                <p style="font-size: 16px; color: #334155; line-height: 1.5;">
                    Si ya realizó la entrega o tiene dudas, por favor comuníquese con su Apoyo Técnico Pedagógico (ATP).
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://sisat.site" style="display: inline-block; background-color: #f7bf31; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                        Ingresar a SISAT-ATP
                    </a>
                </div>
            </div>
            
            <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">Este es un mensaje automático, por favor no responda a este correo.</p>
                <p style="margin: 5px 0 0 0;">SISAT-ATP - Sistema Inteligente de Supervisión y Automatización Técnica</p>
            </div>
        </div>
        `
    });

    if (error) {
        console.error("Error al enviar el correo a través de Resend:", error);
    } else {
        console.log("¡Correo enviado exitosamente!", data);
    }
}

main()
    .catch((e) => console.error("Error en el script:", e))
    .finally(async () => {
        await prisma.$disconnect();
    });
