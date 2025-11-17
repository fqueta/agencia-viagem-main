-- Criar função para criar organização com membership em uma única transação
CREATE OR REPLACE FUNCTION public.create_organization_with_membership(
  org_name text,
  org_email text,
  org_cnpj text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  current_user_id uuid;
BEGIN
  -- Pegar ID do usuário autenticado
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Criar a organização
  INSERT INTO public.organizations (name, email, cnpj)
  VALUES (org_name, org_email, org_cnpj)
  RETURNING id INTO new_org_id;

  -- Adicionar o usuário como owner
  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (new_org_id, current_user_id, 'owner', now());

  -- Definir como organização padrão
  UPDATE public.profiles
  SET default_organization_id = new_org_id
  WHERE id = current_user_id;

  RETURN new_org_id;
END;
$$;