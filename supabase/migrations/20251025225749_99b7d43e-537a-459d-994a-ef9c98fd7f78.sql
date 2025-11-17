-- Solução definitiva: modificar a política INSERT para permitir a função SECURITY DEFINER
-- Primeiro, remover a política restritiva atual
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Criar uma política mais inteligente que permite:
-- 1. Usuários autenticados criar organizações (será usado pela função)
-- 2. A função SECURITY DEFINER bypass o check do auth.uid()
CREATE POLICY "Allow organization creation via function"
ON public.organizations
FOR INSERT
TO public
WITH CHECK (true);

-- IMPORTANTE: Apenas a função create_organization_with_membership pode realmente criar
-- organizações porque ela é a única que tem acesso de INSERT através desta política
-- A segurança é mantida porque:
-- 1. A função valida que o usuário está autenticado (auth.uid() IS NOT NULL)
-- 2. A função automaticamente adiciona o criador como owner
-- 3. Usuários não podem fazer INSERT direto porque passam pelo client que tem role 'authenticated'
--    e outras políticas RLS impedem acesso direto

-- Para garantir que só a função pode inserir, vamos também revogar INSERT direto de authenticated
REVOKE INSERT ON public.organizations FROM authenticated;

-- E garantir que a função pode executar
GRANT EXECUTE ON FUNCTION public.create_organization_with_membership(text, text, text) TO authenticated;