-- Modificar função para permitir apenas admins criarem organizações
CREATE OR REPLACE FUNCTION public.create_organization_with_membership(
  org_name text,
  org_email text,
  org_cnpj text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid;
  new_org_id uuid;
  is_admin boolean;
BEGIN
  -- Obter ID do usuário autenticado
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verificar se usuário é system admin
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = current_user_id 
    AND role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem criar organizações';
  END IF;

  -- Criar organização
  INSERT INTO public.organizations (name, email, cnpj)
  VALUES (org_name, org_email, org_cnpj)
  RETURNING id INTO new_org_id;

  -- Adicionar criador como owner da organização
  INSERT INTO public.organization_members (user_id, organization_id, role, is_active, joined_at)
  VALUES (current_user_id, new_org_id, 'owner', true, now());

  -- Atualizar default_organization_id do usuário se ele ainda não tiver uma
  UPDATE public.profiles
  SET default_organization_id = new_org_id,
      updated_at = now()
  WHERE id = current_user_id 
    AND default_organization_id IS NULL;

  RETURN new_org_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar organização: %', SQLERRM;
END;
$$;