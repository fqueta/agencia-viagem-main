import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendEmail } from "../_shared/resend.ts";

/**
 * Edge Function: send-reminder
 *
 * PT-BR: Envia um email de lembrete de cobrança para o cliente.
 * Valida autenticação do chamador e usa Resend para envio do email.
 *
 * EN: Sends a delinquency reminder email to the customer.
 * Validates caller authentication and uses Resend to deliver the email.
 */

/**
 * PT-BR: Headers de CORS para ambientes local e produção.
 * EN: CORS headers for local and production environments.
 */
function corsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ??
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  } as Record<string, string>;
}

interface SendReminderRequest {
  to: string; // Email do cliente
  subject: string; // Assunto do email
  message: string; // Corpo em texto simples informado no app
}

serve(async (req: Request): Promise<Response> => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  const headers = { "Content-Type": "application/json", ...corsHeaders(req) };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    // Require auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers });
    }

    const { to, subject, message }: SendReminderRequest = await req.json();
    if (!to || !subject || !message) {
      return new Response(JSON.stringify({ error: "to, subject e message são obrigatórios" }), { status: 400, headers });
    }

    // Build a simple, styled HTML email using the provided message
    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lembrete de Cobrança</title>
  <style>
    body { margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; background-color:#f5f5f5; }
    .container { max-width:600px; margin:0 auto; background-color:#ffffff; padding:32px 24px; }
    h1 { color:#1e293b; font-size:22px; margin:0 0 16px 0; text-align:center; }
    .content { color:#475569; font-size:16px; line-height:1.6; white-space:pre-wrap; }
    .footer { color:#94a3b8; font-size:14px; line-height:1.5; margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; }
  </style>
}</head>
<body>
  <div class="container">
    <h1>Lembrete de Cobrança</h1>
    <div class="content">${message.replace(/</g, "&lt;")}</div>
    <div class="footer">
      <p>Este é um aviso automático do sistema de gestão da Agência de Viagem.</p>
      <p>Se você já realizou o pagamento, por favor desconsidere.</p>
    </div>
  </div>
}</body>
</html>`;

    const emailResponse = await sendEmail({ to, subject, html: emailHtml });
    console.log("Lembrete enviado:", emailResponse);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err: any) {
    console.error("Erro em send-reminder:", err?.message ?? err);
    return new Response(JSON.stringify({ error: "Falha ao enviar lembrete" }), { status: 500, headers });
  }
});