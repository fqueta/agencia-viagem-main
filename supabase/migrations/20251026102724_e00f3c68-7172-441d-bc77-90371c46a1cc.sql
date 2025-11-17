-- Remover criação automática de role 'user' do trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir perfil com todos os dados disponíveis
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Role será definida manualmente pelo admin
  -- Removido: INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user'::app_role);
  
  RETURN NEW;
END;
$$;