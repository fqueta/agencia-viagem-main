-- 1. Função para verificar se usuário é admin do sistema
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::app_role
  );
$$;

-- 2. Atualizar trigger para criar role 'user' por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir perfil
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  
  -- Inserir role padrão 'user'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role);
  
  RETURN NEW;
END;
$$;

-- 3. RLS em organizations (admins do sistema podem ver todas)
DROP POLICY IF EXISTS "System admins can view all organizations" ON public.organizations;
CREATE POLICY "System admins can view all organizations" 
ON public.organizations 
FOR SELECT 
USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can update organizations" ON public.organizations;
CREATE POLICY "System admins can update organizations" 
ON public.organizations 
FOR UPDATE 
USING (public.is_system_admin(auth.uid()));

-- 4. RLS em organization_members (admins do sistema podem gerenciar)
DROP POLICY IF EXISTS "System admins can manage all members" ON public.organization_members;
CREATE POLICY "System admins can manage all members" 
ON public.organization_members 
FOR ALL 
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 5. RLS em profiles (admins do sistema podem ver todos)
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.profiles;
CREATE POLICY "System admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can update all profiles" ON public.profiles;
CREATE POLICY "System admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- 6. RLS em user_roles (admins do sistema podem gerenciar)
DROP POLICY IF EXISTS "System admins can view all roles" ON public.user_roles;
CREATE POLICY "System admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can update roles" ON public.user_roles;
CREATE POLICY "System admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can insert roles" ON public.user_roles;
CREATE POLICY "System admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "System admins can delete roles" ON public.user_roles;
CREATE POLICY "System admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (public.is_system_admin(auth.uid()));