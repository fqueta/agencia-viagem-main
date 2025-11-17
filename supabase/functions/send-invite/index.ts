import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendInviteRequest {
  organization_id: string;
  email: string;
  role: "owner" | "admin" | "agent" | "viewer";
}

/**
 * Edge Function: send-invite
 *
 * Objetivo: Criar um convite para a organização e enviar um email personalizado
 *           com o link de aceite. Valida se o chamador é admin/owner da org.
 *
 * Purpose: Creates an organization invite and sends a personalized email
 *          with the acceptance link. Validates caller is org admin/owner.
 */
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    // Require auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { organization_id, email, role }: SendInviteRequest = await req.json();
    if (!organization_id || !email || !role) {
      return new Response(
        JSON.stringify({ error: "organization_id, email e role são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify caller is admin/owner of the organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", organization_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas admin/owner podem convidar." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Insert invite (table defaults will generate token and expires_at)
    const { data: inserted, error: insertError } = await supabase
      .from("organization_invites")
      .insert({
        organization_id,
        email,
        role,
        invited_by: caller.id,
      })
      .select("id, token, expires_at")
      .single();

    // If duplicate, fetch existing active invite and reuse
    let invite = inserted;
    if (insertError) {
      if ((insertError as any).code === "23505") {
        const { data: existing } = await supabase
          .from("organization_invites")
          .select("id, token, expires_at")
          .eq("organization_id", organization_id)
          .eq("email", email)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .single();
        invite = existing ?? null;
      } else {
        return new Response(
          JSON.stringify({ error: "Erro ao criar convite" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    if (!invite) {
      return new Response(
        JSON.stringify({ error: "Convite não encontrado ou expirado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch organization and inviter data for personalization
    const [{ data: org }, { data: inviter }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", organization_id).single(),
      supabase.from("profiles").select("full_name, email").eq("id", caller.id).single(),
    ]);

    const orgName = org?.name ?? "sua organização";
    const inviterName = inviter?.full_name ?? caller.email ?? "Um membro";

    const origin = req.headers.get("origin") || "https://agencia-viagem.maisaqui.com.br";
    const acceptLink = `${origin}/invite/${invite.token}`;
    const expiresDate = new Date(invite.expires_at).toLocaleDateString("pt-BR");

    // Build personalized email HTML (PT-BR)
    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para Organização</title>
  <style>
    body { margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; background-color:#f5f5f5; }
    .container { max-width:600px; margin:0 auto; background-color:#ffffff; padding:40px 30px; }
    .logo-container { text-align:center; margin-bottom:30px; }
    .logo-circle { display:inline-flex; align-items:center; justify-content:center; width:80px; height:80px; background:linear-gradient(135deg, #3B82F6, #1E40AF); border-radius:50%; margin-bottom:20px; }
    .logo-icon { font-size:40px; color:white; }
    h1 { color:#1e293b; font-size:26px; margin:0 0 16px 0; text-align:center; }
    .content { color:#475569; font-size:16px; line-height:1.6; margin-bottom:24px; }
    .button-container { text-align:center; margin:36px 0; }
    .button { display:inline-block; background:linear-gradient(135deg, #3B82F6, #1E40AF); color:#ffffff !important; padding:14px 40px; text-decoration:none; border-radius:8px; font-weight:600; font-size:16px; transition:transform 0.2s; }
    .button:hover { transform: translateY(-2px); }
    .footer { color:#94a3b8; font-size:14px; line-height:1.5; margin-top:30px; padding-top:20px; border-top:1px solid #e2e8f0; }
    .warning { background-color:#fef3c7; border-left:4px solid #f59e0b; padding:12px; margin:18px 0; border-radius:4px; font-size:14px; color:#92400e; }
  </style>
}</head>
<body>
  <div class="container">
    <div class="logo-container">
      <div class="logo-circle"><span class="logo-icon">🧳</span></div>
      <h2 style="color:#3B82F6; margin:0; font-size:20px;">Agência de Viagem</h2>
    </div>
    <h1>Convite para ${orgName}</h1>
    <div class="content">
      <p>Olá,</p>
      <p><strong>${inviterName}</strong> convidou você para participar da organização <strong>${orgName}</strong> como <strong>${role}</strong>.</p>
      <p>Para aceitar o convite e começar, clique no botão abaixo:</p>
    </div>
    <div class="button-container">
      <a href="${acceptLink}" class="button" style="color:#ffffff !important; text-decoration:none;">Aceitar Convite</a>
    </div>
    <div class="warning"><strong>⚠️ Importante:</strong> este convite expira em ${expiresDate}.</div>
    <div class="content">
      <p>Se você ainda não possui uma conta, crie sua conta usando este email quando for solicitado.</p>
    </div>
    <div class="footer">
      <p>Precisa de ajuda? Entre em contato com nosso suporte.</p>
      <p style="margin-top:16px;">© ${new Date().getFullYear()} Agência de Viagem. Todos os direitos reservados.</p>
    </div>
  </div>
}</body>
</html>`;

    // Send email via Resend (shared helper)
    const emailResponse = await sendEmail({
      to: email,
      subject: `Convite para ${orgName}`,
      html: emailHtml,
    });

    console.log("Convite enviado:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, invite_id: invite.id, expires_at: invite.expires_at }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Erro ao enviar convite:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar convite", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});