import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, User, Trash2, Plus } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { userUpdateSchema, type UserUpdateData } from "@/lib/validations";

type AppRole = 'admin' | 'agent' | 'user';
type OrgRole = 'owner' | 'admin' | 'agent' | 'viewer';

interface UserOrganization {
  membership_id: string;
  organization_id: string;
  name: string;
  role: OrgRole;
  is_active: boolean;
}

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: AppRole;
  created_at: string;
  organizations?: UserOrganization[];
}

export default function UserEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [emailChanged, setEmailChanged] = useState(false);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [availableOrgs, setAvailableOrgs] = useState<{id: string, name: string}[]>([]);
  const [selectedOrgToAdd, setSelectedOrgToAdd] = useState<string>("");
  const [selectedOrgRole, setSelectedOrgRole] = useState<OrgRole>("agent");

  const form = useForm<UserUpdateData>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      role: "agent",
    },
  });

  const emailValue = form.watch("email");

  useEffect(() => {
    if (user) {
      setEmailChanged(emailValue !== user.email);
    }
  }, [emailValue, user]);

  useEffect(() => {
    loadUser();
  }, [id]);

  const loadUser = async () => {
    try {
      setLoading(true);

      // Carregar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          *,
          organization_members!organization_members_user_id_fkey(
            id,
            organization_id,
            role,
            is_active,
            organizations(
              id,
              name
            )
          )
        `)
        .eq("id", id)
        .single();

      if (profileError) throw profileError;

      // Carregar role do usuário
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", id)
        .maybeSingle();

      // Agrupar organizações do usuário
      const userOrgs = (profile as any).organization_members
        ?.filter((om: any) => om.is_active && om.organizations)
        .map((om: any) => ({
          membership_id: om.id,
          organization_id: om.organizations.id,
          name: om.organizations.name,
          role: om.role,
          is_active: om.is_active
        })) || [];

      const userData: UserWithRole = {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || "",
        role: (roleData?.role as AppRole) || "agent",
        created_at: profile.created_at,
        organizations: userOrgs,
      };

      setUser(userData);
      setOrganizations(userOrgs);
      
      form.reset({
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone || "",
        role: userData.role,
      });

      loadAvailableOrganizations(userOrgs);
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Erro ao carregar usuário");
      navigate("/admin/users");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableOrganizations = async (currentOrgs: UserOrganization[]) => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      
      const userOrgIds = currentOrgs.map(o => o.organization_id);
      const available = data?.filter(org => !userOrgIds.includes(org.id)) || [];
      
      setAvailableOrgs(available);
    } catch (error) {
      console.error("Error loading organizations:", error);
    }
  };

  const handleAddOrganization = async () => {
    if (!selectedOrgToAdd || !user) {
      toast.error("Selecione uma organização");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("organization_members")
        .insert({
          user_id: user.id,
          organization_id: selectedOrgToAdd,
          role: selectedOrgRole,
          is_active: true,
          joined_at: new Date().toISOString(),
        })
        .select(`
          id,
          organization_id,
          role,
          is_active,
          organizations(name)
        `)
        .single();

      if (error) throw error;

      const newOrg: UserOrganization = {
        membership_id: data.id,
        organization_id: data.organization_id,
        name: (data.organizations as any).name,
        role: data.role as OrgRole,
        is_active: data.is_active,
      };

      const updatedOrgs = [...organizations, newOrg];
      setOrganizations(updatedOrgs);
      setSelectedOrgToAdd("");
      setSelectedOrgRole("agent");
      loadAvailableOrganizations(updatedOrgs);
      
      toast.success("Organização adicionada!");
    } catch (error: any) {
      console.error("Error adding organization:", error);
      toast.error("Erro ao adicionar organização");
    }
  };

  const handleRemoveOrganization = async (membershipId: string, orgName: string, orgId: string, role: OrgRole) => {
    if (role === 'owner') {
      const { data: owners } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("role", "owner")
        .eq("is_active", true);

      if (owners && owners.length === 1) {
        toast.error("Não é possível remover o último proprietário da organização");
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ is_active: false })
        .eq("id", membershipId);

      if (error) throw error;

      const updatedOrgs = organizations.filter(o => o.membership_id !== membershipId);
      setOrganizations(updatedOrgs);
      loadAvailableOrganizations(updatedOrgs);
      toast.success(`Usuário removido da organização ${orgName}`);
    } catch (error: any) {
      console.error("Error removing organization:", error);
      toast.error("Erro ao remover organização");
    }
  };

  const handleChangeOrgRole = async (
    membershipId: string, 
    newRole: OrgRole
  ) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", membershipId);

      if (error) throw error;

      setOrganizations(
        organizations.map(org => 
          org.membership_id === membershipId 
            ? { ...org, role: newRole }
            : org
        )
      );

      toast.success("Papel atualizado!");
    } catch (error: any) {
      console.error("Error updating org role:", error);
      toast.error("Erro ao atualizar papel");
    }
  };

  const onSubmit = async (values: UserUpdateData) => {
    if (!user) return;
    
    setSaving(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update role if changed
      if (values.role !== user.role) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: values.role })
          .eq("user_id", user.id);

        if (roleError) throw roleError;
      }

      toast.success("Usuário atualizado com sucesso!");
      navigate("/admin/users");
    } catch (error: any) {
      toast.error("Erro ao atualizar usuário");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 bg-gradient-to-r from-accent to-secondary rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Editar Usuário</h1>
        </div>

        {emailChanged && (
          <Alert className="mb-6">
            <AlertDescription>
              ⚠️ Alterar o email modificará o login do usuário. Certifique-se de informá-lo.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-card p-6 rounded-lg border">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="usuario@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <PhoneInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agente</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Organizações</h3>
                <p className="text-sm text-muted-foreground">
                  Gerencie as organizações do usuário e seus papéis
                </p>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Usuário não pertence a nenhuma organização
                  </p>
                ) : (
                  organizations.map((org) => (
                    <Card key={org.membership_id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{org.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Label className="text-xs">Papel:</Label>
                            <Select
                              value={org.role}
                              onValueChange={(value) => 
                                handleChangeOrgRole(org.membership_id, value as OrgRole)
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Proprietário</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="agent">Agente</SelectItem>
                                <SelectItem value="viewer">Visualizador</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOrganization(org.membership_id, org.name, org.organization_id, org.role)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {availableOrgs.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Adicionar à Organização</Label>
                  <div className="flex gap-2">
                    <Select value={selectedOrgToAdd} onValueChange={setSelectedOrgToAdd}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione uma organização" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedOrgRole} onValueChange={(value) => setSelectedOrgRole(value as OrgRole)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Proprietário</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agente</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddOrganization} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin/users")}>
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
