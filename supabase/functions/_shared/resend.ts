import { Resend } from "https://esm.sh/resend@4.0.0";

/**
 * Resend Email Helper (Deno / Supabase Edge Functions)
 *
 * PT-BR: Inicializa o cliente Resend usando a variável de ambiente
 * `RESEND_API_KEY` e expõe utilitários para envio de email com um
 * remetente padrão. Centraliza a lógica para que todos os emails do
 * sistema utilizem Resend de forma consistente.
 *
 * EN: Initializes the Resend client using the `RESEND_API_KEY` env var
 * and exposes utilities to send emails with a default sender. This
 * centralizes logic so all system emails consistently use Resend.
 */
export function getResend(): Resend {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    // PT-BR: Falha explícita para permitir que a Edge Function capture e responda.
    // EN: Explicit failure so the Edge Function can catch and respond.
    throw new Error("RESEND_API_KEY não configurada nas Secrets/ambiente");
  }
  return new Resend(apiKey);
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string; // default provided below
}

/**
 * PT-BR: Envia email via Resend com remetente padrão.
 * EN: Sends email via Resend with a default sender.
 */
export async function sendEmail({ to, subject, html, from = "Agência de Viagem <nao_responda@maisaqui.com.br>" }: SendEmailParams) {
  const resend = getResend();
  const recipients = Array.isArray(to) ? to : [to];
  return await resend.emails.send({
    from,
    to: recipients,
    subject,
    html,
  });
}