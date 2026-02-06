
-- Adicionar coluna tertiary_color na tabela organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tertiary_color text DEFAULT '#f59e0b';

-- Comentário na coluna
COMMENT ON COLUMN public.organizations.tertiary_color IS 'Cor terciária/destaque da organização (ex: cor de hover ou botões de ação secundária)';
