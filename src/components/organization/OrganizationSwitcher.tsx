import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Plus, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  role: string;
}

export const OrganizationSwitcher = () => {
  const navigate = useNavigate();
  const { isSystemAdmin } = useSystemAdmin();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Buscar perfil para organização padrão
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_organization_id")
      .eq("id", user.id)
      .single();

    // Buscar todas as organizações do usuário
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (error) {
      return;
    }

    const orgs = memberships?.map((m: any) => ({
      id: m.organizations.id,
      name: m.organizations.name,
      role: m.role,
    })) || [];

    setOrganizations(orgs);

    // Definir organização atual
    const defaultOrg = orgs.find(o => o.id === profile?.default_organization_id) || orgs[0];
    setCurrentOrg(defaultOrg);
  };

  const switchOrganization = async (orgId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ default_organization_id: orgId })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao trocar organização");
      return;
    }

    toast.success("Organização alterada!");
    window.location.reload(); // Recarregar para aplicar mudanças
  };

  if (!currentOrg) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="w-4 h-4" />
          <span className="max-w-[150px] truncate">{currentOrg.name}</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Organizações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrganization(org.id)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.name}</span>
            {org.id === currentOrg.id && (
              <span className="text-xs text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/organization/settings")}>
          <Settings className="w-4 h-4 mr-2" />
          Configurações
        </DropdownMenuItem>
        {isSystemAdmin && (
          <DropdownMenuItem onClick={() => navigate("/organization/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Organização
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};