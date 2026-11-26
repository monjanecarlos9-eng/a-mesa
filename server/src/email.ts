import nodemailer from 'nodemailer';
import { env } from './env';

const transporte = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

export const emailConfigurado = !!transporte;

export async function enviarEmail(para: string, assunto: string, texto: string): Promise<void> {
  if (!transporte) {
    if (env.producao) {
      console.warn(`[email] SMTP_URL não está definido — não foi possível enviar "${assunto}".`);
    } else {
      // Em desenvolvimento, mostra o email na consola para se poder testar sem servidor de email.
      console.log(`\n📧 [email de teste] Para: ${para}\n   Assunto: ${assunto}\n   ${texto.replace(/\n/g, '\n   ')}\n`);
    }
    return;
  }
  await transporte.sendMail({ from: env.EMAIL_REMETENTE, to: para, subject: assunto, text: texto });
}
