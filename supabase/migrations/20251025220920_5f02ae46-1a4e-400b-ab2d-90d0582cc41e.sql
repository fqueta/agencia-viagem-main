-- ============================================
-- SPRINT 2: ATUALIZAR POLÍTICAS RLS PARA MULTI-TENANCY
-- ============================================

-- 1. REMOVER POLÍTICAS ANTIGAS BASEADAS EM CREATED_BY

-- Customers
DROP POLICY IF EXISTS "Require authentication for customers" ON public.customers;
DROP POLICY IF EXISTS "Users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;

-- Travel Packages
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.travel_packages;
DROP POLICY IF EXISTS "Authenticated users can create packages" ON public.travel_packages;
DROP POLICY IF EXISTS "Users can update their own packages" ON public.travel_packages;

-- Orders
DROP POLICY IF EXISTS "Require authentication for orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

-- Payments
DROP POLICY IF EXISTS "Require authentication for payments" ON public.payments;
DROP POLICY IF EXISTS "Users can create payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;

-- Installments
DROP POLICY IF EXISTS "Require authentication for installments" ON public.installments;
DROP POLICY IF EXISTS "Users can create installments" ON public.installments;
DROP POLICY IF EXISTS "Users can delete their own installments" ON public.installments;
DROP POLICY IF EXISTS "Users can update their own installments" ON public.installments;
DROP POLICY IF EXISTS "Users can view their own installments" ON public.installments;

-- 2. CRIAR NOVAS POLÍTICAS BASEADAS EM ORGANIZAÇÃO

-- ===== CUSTOMERS =====

-- Membros podem visualizar clientes da sua organização
CREATE POLICY "Organization members can view customers"
ON public.customers FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Agentes podem criar clientes (viewers não podem)
CREATE POLICY "Agents can create customers"
ON public.customers FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Agentes podem atualizar clientes (viewers não podem)
CREATE POLICY "Agents can update customers"
ON public.customers FOR UPDATE
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Admins podem deletar clientes
CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id));

-- ===== TRAVEL PACKAGES =====

-- Membros podem visualizar pacotes da sua organização
CREATE POLICY "Organization members can view packages"
ON public.travel_packages FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Agentes podem criar pacotes (viewers não podem)
CREATE POLICY "Agents can create packages"
ON public.travel_packages FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Agentes podem atualizar pacotes (viewers não podem)
CREATE POLICY "Agents can update packages"
ON public.travel_packages FOR UPDATE
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Admins podem deletar pacotes
CREATE POLICY "Admins can delete packages"
ON public.travel_packages FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id));

-- ===== ORDERS =====

-- Membros podem visualizar pedidos da sua organização
CREATE POLICY "Organization members can view orders"
ON public.orders FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Agentes podem criar pedidos (viewers não podem)
CREATE POLICY "Agents can create orders"
ON public.orders FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Agentes podem atualizar pedidos (viewers não podem)
CREATE POLICY "Agents can update orders"
ON public.orders FOR UPDATE
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Admins podem deletar pedidos
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id));

-- ===== PAYMENTS =====

-- Membros podem visualizar pagamentos da sua organização
CREATE POLICY "Organization members can view payments"
ON public.payments FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Agentes podem criar pagamentos (viewers não podem)
CREATE POLICY "Agents can create payments"
ON public.payments FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Agentes podem atualizar pagamentos (viewers não podem)
CREATE POLICY "Agents can update payments"
ON public.payments FOR UPDATE
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Admins podem deletar pagamentos
CREATE POLICY "Admins can delete payments"
ON public.payments FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id));

-- ===== INSTALLMENTS =====

-- Membros podem visualizar parcelas da sua organização
CREATE POLICY "Organization members can view installments"
ON public.installments FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- Agentes podem criar parcelas (viewers não podem)
CREATE POLICY "Agents can create installments"
ON public.installments FOR INSERT
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Agentes podem atualizar parcelas (viewers não podem)
CREATE POLICY "Agents can update installments"
ON public.installments FOR UPDATE
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND NOT public.has_org_role(auth.uid(), organization_id, 'viewer')
);

-- Admins podem deletar parcelas
CREATE POLICY "Admins can delete installments"
ON public.installments FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id));

-- 3. ATUALIZAR QUERIES DO FRONTEND PARA USAR ORGANIZATION_ID

-- As queries do frontend precisarão ser atualizadas para filtrar por organization_id
-- em vez de created_by. Isso será feito na próxima etapa do código frontend.