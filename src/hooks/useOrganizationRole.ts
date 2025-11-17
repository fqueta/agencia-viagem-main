import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

/**
 * useOrganizationRole
 * PT-BR: Hook para obter a role do usuário na organização atual e
 * expor um flag conveniente `isOrgAdmin` para controlar permissões
 * (owner/admin). Usa `maybeSingle()` para evitar 406 quando não há
 * associação ativa ou múltiplos registros.
 * EN: Hook to get the current user's role in the active organization
 * and expose `isOrgAdmin` for permission checks (owner/admin). It
 * uses `maybeSingle()` to avoid PostgREST 406 in non-strict queries.
 */
export function useOrganizationRole() {
  const { organizationId, loading: orgLoading } = useOrganization();
  const [role, setRole] = useState<"owner" | "admin" | "agent" | "viewer" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRole = async () => {
      try {
        // Se ainda está carregando org ou não há org, não buscar
        if (orgLoading) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !organizationId) {
          setRole(null);
          return;
        }

        const { data, error } = await supabase
          .from("organization_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("organization_id", organizationId)
          .limit(1)
          .maybeSingle();

        if (error) {
          // Em caso de erro, não travar UI – considerar como sem permissão
          console.error("Erro ao carregar role da organização:", error);
          setRole(null);
          return;
        }

        setRole((data?.role as any) ?? null);
      } catch (err) {
        console.error("Erro inesperado ao carregar role da organização:", err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    loadRole();
    // Recarrega quando orgLoading muda (finaliza) ou organizationId troca
  }, [orgLoading, organizationId]);

  const isOrgAdmin = role === "owner" || role === "admin";
  return { role, isOrgAdmin, loading };
}