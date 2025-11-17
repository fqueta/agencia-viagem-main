import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'agent' | 'user';
  organization_id: string;
  org_role: 'owner' | 'admin' | 'agent' | 'viewer';
  initial_password?: string;
}

/**
 * Edge Function: create-user
 *
 * Admin-only: cria um usuário no auth, atribui role do aplicativo,
 * vincula-o a uma organização e define senha inicial opcional.
 * Se não houver senha informada, gera uma temporária segura.
 * Inclui CORS para preflight do navegador.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is a system admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is system admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores do sistema podem criar usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, full_name, phone, role, organization_id, org_role, initial_password }: CreateUserRequest = await req.json();

    // Validate input
    if (!email || !full_name || !role || !organization_id || !org_role) {
      return new Response(
        JSON.stringify({ error: 'Email, nome completo, role, organização e papel na organização são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate initial password if provided
    let tempPassword: string;
    if (initial_password && initial_password.length > 0) {
      const valid = initial_password.length >= 8 && initial_password.length <= 72
        && /[A-Z]/.test(initial_password)
        && /[a-z]/.test(initial_password)
        && /[0-9]/.test(initial_password);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: 'Senha inicial inválida. Exige 8-72 caracteres com maiúscula, minúscula e número.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tempPassword = initial_password;
    } else {
      tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;
    }

    // Verify organization exists
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organization_id)
      .maybeSingle();

    if (orgError || !orgData) {
      return new Response(
        JSON.stringify({ error: 'Organização não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user in auth.users (trigger will create profile automatically)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || null
      }
    });

    if (createError || !newUser.user) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update phone if provided (profile was created by trigger)
    if (phone) {
      const { error: phoneError } = await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', newUser.user.id);

      if (phoneError) {
        console.error('Error updating phone:', phoneError);
      }
    }

    // Create user role
    const { error: roleInsertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: role
      });

    if (roleInsertError) {
      console.error('Error creating user role:', roleInsertError);
      // Rollback: delete profile and auth user
      await supabase.from('profiles').delete().eq('id', newUser.user.id);
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao atribuir role ao usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create organization membership
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        user_id: newUser.user.id,
        organization_id: organization_id,
        role: org_role,
        is_active: true,
        joined_at: new Date().toISOString(),
        invited_by: caller.id
      });

    if (memberError) {
      console.error('Error creating organization membership:', memberError);
      // Rollback: delete role, profile and auth user
      await supabase.from('user_roles').delete().eq('user_id', newUser.user.id);
      await supabase.from('profiles').delete().eq('id', newUser.user.id);
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao vincular usuário à organização' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set default organization
    const { error: defaultOrgError } = await supabase
      .from('profiles')
      .update({ default_organization_id: organization_id })
      .eq('id', newUser.user.id);

    if (defaultOrgError) {
      console.error('Error setting default organization:', defaultOrgError);
    }

    console.log(`User created successfully: ${email} with role ${role} in org ${organization_id} as ${org_role}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email,
          full_name,
          role,
          organization_id,
          org_role
        },
        temporary_password: tempPassword
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});