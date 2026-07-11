import { Resend } from "resend";
import nodemailer from "nodemailer";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

// Default sender email (used when falling back to Resend)
const FROM_EMAIL = "Centro de Mando ATP <onboarding@resend.dev>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Unified email sending function that uses SMTP (Gmail or custom) if configured,
 * otherwise falls back to Resend API.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean }> {
  // Check if SMTP is configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const host = process.env.SMTP_HOST || "smtp.gmail.com";
      const port = parseInt(process.env.SMTP_PORT || "465");
      const secure = process.env.SMTP_SECURE !== "false"; // true by default

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const from = process.env.SMTP_FROM || `Supervisión Escolar ATP <${process.env.SMTP_USER}>`;

      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      console.log(`[SMTP] Email successfully sent to ${to}`);
      return { success: true };
    } catch (error) {
      console.error("[SMTP] Failed to send email, attempting Resend fallback:", error);
    }
  }

  // Fallback to Resend if SMTP is not configured or failed
  if (process.env.RESEND_API_KEY) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      });

      if (error) {
        console.error("[Resend] API returned error:", error);
        throw new Error(error.message);
      }

      console.log(`[Resend] Email successfully sent to ${to}`);
      return { success: true };
    } catch (error) {
      console.error("[Resend] Failed to send email:", error);
      throw error;
    }
  }

  console.warn("[Email] No SMTP or Resend credentials configured. Simulated email send to:", to);
  return { success: true };
}

/**
 * Mails a confirmation when a director uploads a file.
 */
export async function sendUploadConfirmation(
  to: string,
  escuelaNombre: string,
  programaNombre: string,
  periodoLabel: string
) {
  try {
    await sendEmail({
      to,
      subject: `✅ Acuse de recibo: ${programaNombre} - ${periodoLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #2563eb;">Acuse de Recibo</h2>
          <p>Estimado(a) Director(a) de la escuela <strong>${escuelaNombre}</strong>,</p>
          <p>La Supervisión Escolar ha recibido correctamente sus archivo(s) para:</p>
          <ul>
            <li><strong>Programa:</strong> ${programaNombre}</li>
            <li><strong>Periodo:</strong> ${periodoLabel}</li>
          </ul>
          <p>En los próximos días, el ATP revisará sus documentos y le notificará por este medio en caso de requerir alguna corrección o ajuste.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://sacrint-sisat-atp.vercel.app" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acceder a la Plataforma</a>
          </p>

          <p>Agradecemos su compromiso.</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">Este es un mensaje automático del Sistema de Centro de Mando ATP. Por favor no responda a este correo.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending upload confirmation email:", error);
  }
}

/**
 * Notifies the director when the ATP requests a correction.
 */
export async function sendCorrectionNotification(
  to: string,
  escuelaNombre: string,
  programaNombre: string,
  periodoLabel: string,
  notasATP: string,
  adminNombre: string,
  archivoAdjuntoUrl?: string
) {
  const APP_URL = "https://sacrint-sisat-atp.vercel.app";

  try {
    await sendEmail({
      to,
      subject: `⚠️ Corrección requerida: ${programaNombre} - ${periodoLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #ea580c;">Corrección Solicitada</h2>
          <p>Estimado(a) Director(a) de la escuela <strong>${escuelaNombre}</strong>,</p>
          <p>La Supervisión ATP ha revisado su entrega correspondiente a:</p>
          <ul>
            <li><strong>Programa:</strong> ${programaNombre}</li>
            <li><strong>Periodo:</strong> ${periodoLabel}</li>
          </ul>
          <p>Se requiere realizar algunas adecuaciones. A continuación, las notas proporcionadas por <strong>${adminNombre}</strong>:</p>
          <blockquote style="border-left: 4px solid #ea580c; padding-left: 15px; margin-left: 0; font-style: italic; background: #fff7ed; padding: 15px;">
            ${notasATP.replace(/\n/g, "<br>")}
          </blockquote>
          
          ${archivoAdjuntoUrl ? `
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #cbd5e1;">
            <p style="margin: 0 0 10px 0;"><strong>📎 Archivo adjunto por el ATP:</strong></p>
            <p style="margin: 0;"><a href="${archivoAdjuntoUrl}" style="color: #2563eb; text-decoration: underline; font-weight: bold;" target="_blank">Descargar documento revisado</a></p>
          </div>
          ` : ""}

          <p>Por favor, ingrese al sistema para revisar el detalle y subir el archivo corregido a la brevedad posible.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ir a la plataforma para corregir</a>
          </p>

          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">Este es un mensaje automático del Sistema de Centro de Mando ATP.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending correction email:", error);
  }
}

/**
 * Sends a highly tactful reminder (either pre-deadline or overdue).
 */
export async function sendTactfulReminder(
  to: string,
  escuelaNombre: string,
  programaNombre: string,
  periodoLabel: string,
  fechaLimite: Date,
  type: "proximo" | "vencido"
) {
  const fechaFormateada = fechaLimite.toLocaleDateString("es-MX", {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let subject = "";
  let htmlContent = "";
  const APP_URL = "https://sacrint-sisat-atp.vercel.app";

  if (type === "proximo") {
    subject = `🕒 Recordatorio amistoso: Próxima entrega de ${programaNombre}`;
    htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>Estimado(a) Director(a) de la escuela <strong>${escuelaNombre}</strong>,</p>
          <p>Esperamos que se encuentre muy bien. Comprendemos la gran carga de trabajo y el excelente esfuerzo que realiza cada día al frente de su institución.</p>
          <p>Este mensaje es únicamente un <strong>recordatorio amistoso</strong> para informarle que la fecha límite para subir el archivo de <strong>${programaNombre}</strong> (${periodoLabel}) está próxima a llegar.</p>
          <p><strong>Fecha límite:</strong> ${fechaFormateada}</p>
          <p>Si ya lo tiene listo, le invitamos a subirlo en la plataforma cuando tenga la oportunidad accediendo al siguiente enlace:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acceder a la Plataforma</a>
          </p>
          <p>Si tiene algún inconveniente o duda, estamos a su disposición para apoyarle.</p>
          <p>Le agradecemos de antemano su atención e invaluable compromiso con la educación.</p>
          <br>
          <p>Atentamente,</p>
          <p><strong>Supervisión Escolar ATP</strong></p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">Este es un mensaje automático del Centro de Mando ATP.</p>
        </div>
      `;
  } else {
    subject = `⚠️ Aviso importante: Fecha vencida para ${programaNombre}`;
    htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>Estimado(a) Director(a) de la escuela <strong>${escuelaNombre}</strong>,</p>
          <p>Esperamos que se encuentre teniendo una excelente semana. Sabemos de primera mano los retos y múltiples responsabilidades que conlleva la dirección escolar.</p>
          <p>Nos ponemos en contacto con usted con mucho respeto porque nuestro sistema indica que <strong>ha concluido la fecha límite</strong> para la entrega de <strong>${programaNombre}</strong> (${periodoLabel}), la cual estaba programada para el <strong>${fechaFormateada}</strong>, y aún no registramos su archivo.</p>
          <p>Entendemos perfectamente que pueden surgir imprevistos o contratiempos en las actividades diarias. Le pedimos de la manera más atenta si pudiera subir su archivo a la plataforma a la brevedad posible a través del siguiente enlace, a fin de regularizar su expediente:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Subir mi Archivo</a>
          </p>
          <p>Si requiere alguna asesoría o si ha enfrentado algún problema técnico, por favor háganoslo saber; con gusto le brindaremos el apoyo necesario.</p>
          <br>
          <p>Agradecemos sinceramente su comprensión y su constante disposición.</p>
          <p>Atentamente,</p>
          <p><strong>Supervisión Escolar ATP</strong></p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">Este es un mensaje automático del Centro de Mando ATP.</p>
        </div>
      `;
  }

  try {
    await sendEmail({
      to,
      subject,
      html: htmlContent,
    });
  } catch (error) {
    console.error("Error sending reminder email:", error);
  }
}
