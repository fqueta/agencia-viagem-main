-- ============================================
-- SPRINT 1: FUNDAÇÃO DO SISTEMA MULTI-TENANCY
-- ============================================

-- 1. CRIAR ENUM PARA ROLES DE ORGANIZAÇÃO
CREATE TYPE public.org_role AS ENUM (
  'owner',      -- Dono da organização (criador)
  'admin',      -- Administrador (pode gerenciar tudo)
  'agent',      -- Agente de vendas (cria pedidos, clientes)
  'viewer'      -- Apenas visualização
);

-- 2. CRIAR TABELA DE ORGANIZAÇÕES
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  cnpj TEXT UNIQUE,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  subscription_tier TEXT DEFAULT 'free',
  max_users INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. CRIAR TABELA DE MEMBROS DA ORGANIZAÇÃO
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.org_role NOT NULL DEFAULT 'agent',
  invited_by UUID REFERENCES public.profiles(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. CRIAR TABELA DE CONVITES
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'agent',
  invited_by UUID REFERENCES public.profiles(id) NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, email)
);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 5. ADICIONAR ORGANIZATION_ID ÀS TABELAS EXISTENTES
ALTER TABLE public.customers ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.travel_packages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.installments ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 6. ADICIONAR CAMPO DEFAULT_ORGANIZATION_ID AO PROFILES
ALTER TABLE public.profiles ADD COLUMN default_organization_id UUID REFERENCES public.organizations(id);

-- 7. FUNÇÕES DE SEGURANÇA (SECURITY DEFINER)

-- Verificar se usuário é membro de uma organização
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND is_active = true
  );
$$;

-- Verificar se usuário tem uma role específica
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
      AND is_active = true
  );
$$;

-- Verificar se usuário é admin ou owner
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
$$;

-- Obter organização padrão do usuário
CREATE OR REPLACE FUNCTION public.get_user_default_org(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT default_organization_id FROM public.profiles WHERE id = _user_id),
    (SELECT organization_id FROM public.organization_members 
     WHERE user_id = _user_id AND is_active = true 
     ORDER BY joined_at ASC LIMIT 1)
  );
$$;

-- 8. MIGRAÇÃO DE DADOS EXISTENTES
-- Criar organizações pessoais para cada usuário e migrar seus dados

DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
BEGIN
  -- Para cada usuário que criou clientes
  FOR user_record IN 
    SELECT DISTINCT p.id, p.full_name, p.email
    FROM public.profiles p
    WHERE EXISTS (
      SELECT 1 FROM public.customers c WHERE c.created_by = p.id
      UNION
      SELECT 1 FROM public.travel_packages t WHERE t.created_by = p.id
      UNION
      SELECT 1 FROM public.orders o WHERE o.created_by = p.id
    )
  LOOP
    -- Criar organização pessoal
    INSERT INTO public.organizations (name, email)
    VALUES (
      'Organização de ' || user_record.full_name,
      user_record.email
    )
    RETURNING id INTO new_org_id;
    
    -- Associar usuário como owner
    INSERT INTO public.organization_members (
      organization_id, 
      user_id, 
      role, 
      joined_at
    )
    VALUES (
      new_org_id, 
      user_record.id, 
      'owner', 
      now()
    );
    
    -- Atualizar default_organization_id no profile
    UPDATE public.profiles
    SET default_organization_id = new_org_id
    WHERE id = user_record.id;
    
    -- Migrar clientes para a organização
    UPDATE public.customers
    SET organization_id = new_org_id
    WHERE created_by = user_record.id;
    
    -- Migrar pacotes
    UPDATE public.travel_packages
    SET organization_id = new_org_id
    WHERE created_by = user_record.id;
    
    -- Migrar pedidos
    UPDATE public.orders
    SET organization_id = new_org_id
    WHERE created_by = user_record.id;
    
    -- Migrar pagamentos
    UPDATE public.payments
    SET organization_id = new_org_id
    WHERE created_by = user_record.id;
    
    -- Migrar parcelas
    UPDATE public.installments
    SET organization_id = new_org_id
    WHERE created_by = user_record.id;
    
    RAISE NOTICE 'Organização criada para usuário %: %', user_record.full_name, new_org_id;
  END LOOP;
END $$;

-- 9. TORNAR ORGANIZATION_ID OBRIGATÓRIO
ALTER TABLE public.customers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.travel_packages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.installments ALTER COLUMN organization_id SET NOT NULL;

-- 10. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_customers_organization_id ON public.customers(organization_id);
CREATE INDEX idx_travel_packages_organization_id ON public.travel_packages(organization_id);
CREATE INDEX idx_orders_organization_id ON public.orders(organization_id);
CREATE INDEX idx_payments_organization_id ON public.payments(organization_id);
CREATE INDEX idx_installments_organization_id ON public.installments(organization_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_organization_invites_token ON public.organization_invites(token);
CREATE INDEX idx_organization_invites_email ON public.organization_invites(email);

-- 11. POLÍTICAS RLS PARA ORGANIZATIONS

-- Membros podem ver sua organização
CREATE POLICY "Members can view their organization"
ON public.organizations FOR SELECT
USING (public.is_org_member(auth.uid(), id));

-- Admins podem atualizar organização
CREATE POLICY "Admins can update organization"
ON public.organizations FOR UPDATE
USING (public.is_org_admin(auth.uid(), id));

-- Usuários autenticados podem criar organizações
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 12. POLÍTICAS RLS PARA ORGANIZATION_MEMBERS

-- Membros podem ver outros membros da mesma org
CREATE POLICY "Members can view other members"
ON public.organization_members FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Admins podem gerenciar membros
CREATE POLICY "Admins can manage members"
ON public.organization_members FOR ALL
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- 13. POLÍTICAS RLS PARA ORGANIZATION_INVITES

-- Admins podem ver convites da sua org
CREATE POLICY "Admins can view invites"
ON public.organization_invites FOR SELECT
USING (public.is_org_admin(auth.uid(), organization_id));

-- Admins podem criar convites
CREATE POLICY "Admins can create invites"
ON public.organization_invites FOR INSERT
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Admins podem deletar convites
CREATE POLICY "Admins can delete invites"
ON public.organization_invites FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id));