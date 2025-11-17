import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendEmail } from "../_shared/resend.ts";

/**
 * CORS helper: ecoa os headers do preflight para suportar ambientes locais
 * e produção com origens diferentes.
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

interface PasswordResetRequest {
  email: string;
}

/**
 * Edge Function: send-password-reset
 *
 * Generates a password recovery link and sends an email via Resend.
 * Includes CORS preflight support for browser requests.
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(req) },
        }
      );
    }

    console.log("Iniciando processo de recuperação de senha para:", email);

    // Criar cliente Supabase com service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Gerar token de recuperação de senha
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${req.headers.get('origin') || 'https://agencia-viagem.maisaqui.com.br'}/reset-password`,
      }
    });

    if (error) {
      console.error("Erro ao gerar link de recuperação:", error);
      throw error;
    }

    if (!data?.properties?.action_link) {
      throw new Error("Link de recuperação não gerado");
    }

    const resetLink = data.properties.action_link;
    console.log("Link de recuperação gerado com sucesso");

    // Template de email em português com logo
    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 40px 30px;
    }
    .logo-container {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #3B82F6, #1E40AF);
      border-radius: 50%;
      margin-bottom: 20px;
    }
    .logo-icon {
      font-size: 40px;
      color: white;
    }
    h1 {
      color: #1e293b;
      font-size: 28px;
      margin: 0 0 20px 0;
      text-align: center;
    }
    .content {
      color: #475569;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #3B82F6, #1E40AF);
      color: #ffffff !important;
      padding: 16px 48px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .footer {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.5;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <div class="logo-circle">
        <span class="logo-icon">🧳</span>
      </div>
      <h2 style="color: #3B82F6; margin: 0; font-size: 20px;">Agência de Viagem</h2>
    </div>
    
    <h1>Recuperação de Senha</h1>
    
    <div class="content">
      <p>Olá,</p>
      <p>Você solicitou a redefinição de sua senha. Clique no botão abaixo para escolher uma nova senha:</p>
    </div>
    
    <div class="button-container">
      <a href="${resetLink}" class="button" style="color: #ffffff !important; text-decoration: none;">
        Redefinir Senha
      </a>
    </div>
    
    <div class="warning">
      <strong>⚠️ Importante:</strong> Este link expira em 60 minutos por segurança.
    </div>
    
    <div class="content">
      <p>Se você não solicitou esta alteração, pode ignorar este email com segurança. Sua senha permanecerá inalterada.</p>
    </div>
    
    <div class="footer">
      <p><strong>Precisa de ajuda?</strong></p>
      <p>Se você tiver alguma dúvida, entre em contato com nosso suporte.</p>
      <p style="margin-top: 20px;">
        © ${new Date().getFullYear()} Agência de Viagem. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Enviar email via Resend (helper compartilhado)
    const emailResponse = await sendEmail({
      to: email,
      subject: "Recuperação de Senha - Agência de Viagem",
      html: emailHtml,
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Email de recuperação enviado com sucesso" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(req),
        },
      }
    );
  } catch (error: any) {
    console.error("Erro ao enviar email de recuperação:", error);
    return new Response(
      JSON.stringify({ 
        error: "Erro ao enviar email de recuperação",
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) },
      }
    );
  }
};

serve(handler);
