import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, UserPlus, Trash2, Shield, Eye, Crown, Pencil, X, Check, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Organization {
  id: string;
  name: string;
  email: string;
  cnpj?: string;
  max_users: number;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  tertiary_color?: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
}

/**
 * OrganizationSettings
 *
 * PT-BR: Página de configurações da organização. Ajusta renderização
 * para não ficar em carregamento infinito quando a organização não
 * existir (ex.: usuário sem organização ativa). Usa `orgLoading` do
 * hook `useOrganization` para controlar o estado de carregamento e
 * exibe um estado vazio com ação para criar organização.
 * EN: Organization settings page. Prevents infinite loading when the
 * organization does not exist. Uses `orgLoading` from `useOrganization`
 * to control loading and shows an empty state with a CTA to create one.
 */
export default function OrganizationSettings() {
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useOrganization();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviting, setInviting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  
  // Estados para edição
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    cnpj: "",
    primary_color: "",
    secondary_color: "",
    tertiary_color: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) {
      loadOrganization();
      loadMembers();
      loadInvites();
      loadUserRole();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organization) {
      setEditForm({
        name: organization.name || "",
        email: organization.email || "",
        cnpj: organization.cnpj || "",
        primary_color: organization.primary_color || "#2563eb",
        secondary_color: organization.secondary_color || "#1e40af",
        tertiary_color: organization.tertiary_color || "#f59e0b",
      });
      setLogoPreview(organization.logo_url || null);
    }
  }, [organization]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Carrega dados da organização atual.
   *
   * Usa `.maybeSingle()` para evitar erro 406 quando
   * não há exatamente um registro (zero ou múltiplos).
   */
  const loadOrganization = async () => {
    if (!organizationId) return;

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .limit(1)
      .maybeSingle();

    if (error) {
      toast.error("Erro ao carregar organização");
      return;
    }
    if (!data) {
      toast.error("Organização não encontrada");
      return;
    }
    setOrganization(data);
  };

  const loadMembers = async () => {
    if (!organizationId) return;

    const { data, error } = await supabase
      .from("organization_members")
      .select("id, user_id, role, joined_at, profiles!organization_members_user_id_fkey(full_name, email)")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("joined_at", { ascending: true });

    if (error) {
      return;
    }
    setMembers(data as Member[]);
  };

  const loadInvites = async () => {
    if (!organizationId) return;

    const { data, error } = await supabase
      .from("organization_invites")
      .select("*")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return;
    }
    setInvites(data as Invite[]);
  };

  /**
   * Carrega a role do usuário na organização atual.
   *
   * Usa `.maybeSingle()` para evitar 406 caso o usuário
   * não tenha associação ativa na organização.
   */
  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !organizationId) return;

    const { data } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (data) {
      setUserRole(data.role);
    }
  };

  const handleSaveOrganization = async () => {
    if (!organizationId) return;
    setEditLoading(true);

    try {
      let logoUrl = organization?.logo_url;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `${organizationId}/logo.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('organization-assets')
          .upload(filePath, logoFile, {
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading logo:', uploadError);
          toast.error("Erro ao fazer upload da logo.");
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('organization-assets')
            .getPublicUrl(filePath);
          logoUrl = publicUrl;
        }
      }

      const { error } = await supabase
        .from("organizations")
        .update({
          name: editForm.name,
          email: editForm.email,
          cnpj: editForm.cnpj || null,
          logo_url: logoUrl,
          primary_color: editForm.primary_color,
          secondary_color: editForm.secondary_color,
          tertiary_color: editForm.tertiary_color,
        })
        .eq("id", organizationId);

      if (error) {
        throw error;
      }

      toast.success("Organização atualizada com sucesso!");
      setIsEditing(false);
      loadOrganization();
    } catch (error) {
      console.error("Erro ao atualizar organização:", error);
      toast.error("Erro ao atualizar organização");
    } finally {
      setEditLoading(false);
    }
  };

  /**
   * Envia convite via função edge com email personalizado
   *
   * Sends an invite using an edge function that also emails the recipient.
   */
  const handleInvite = async () => {
    if (!organizationId || !inviteEmail) return;

    setInviting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      setInviting(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: {
        organization_id: organizationId,
        email: inviteEmail,
        role: inviteRole as "owner" | "admin" | "agent" | "viewer",
      },
    });

    if (error) {
      toast.error(error.message || "Erro ao enviar convite");
      setInviting(false);
      return;
    }

    toast.success("Convite enviado por email com sucesso!");
    setInviteEmail("");
    setInviteRole("agent");
    setInviteDialogOpen(false);
    setInviting(false);
    loadInvites();
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (userId === user?.id) {
      toast.error("Você não pode remover a si mesmo");
      return;
    }

    const { error } = await supabase
      .from("organization_members")
      .update({ is_active: false })
      .eq("id", memberId);

    if (error) {
      toast.error("Erro ao remover membro");
      return;
    }

    toast.success("Membro removido com sucesso");
    loadMembers();
  };

  const handleCancelInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      toast.error("Erro ao cancelar convite");
      return;
    }

    toast.success("Convite cancelado");
    loadInvites();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner": return <Crown className="w-4 h-4 text-yellow-500" />;
      case "admin": return <Shield className="w-4 h-4 text-blue-500" />;
      case "agent": return <Building2 className="w-4 h-4 text-green-500" />;
      case "viewer": return <Eye className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      owner: "default",
      admin: "secondary",
      agent: "outline",
      viewer: "outline",
    };
    return (
      <Badge variant={variants[role] || "outline"} className="gap-1">
        {getRoleIcon(role)}
        {role === "owner" ? "Dono" : role === "admin" ? "Admin" : role === "agent" ? "Agente" : "Visualizador"}
      </Badge>
    );
  };

  const isAdmin = userRole === "owner" || userRole === "admin";

  // Estado de carregamento baseado no hook
  if (orgLoading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  // Estado vazio quando não há organização disponível
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Organização não encontrada</CardTitle>
            <CardDescription>
              Não encontramos uma organização ativa para o seu usuário.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
            <Button onClick={() => navigate('/organization/create')}>Criar Organização</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Configurações da Organização</h1>
              <p className="text-sm text-muted-foreground">{organization.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Informações da Organização */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Informações da Organização</CardTitle>
                <CardDescription>Detalhes da sua organização</CardDescription>
              </div>
              {isAdmin && !isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
              {isEditing && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={editLoading}>
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveOrganization} disabled={editLoading}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input 
                  value={isEditing ? editForm.name : organization.name} 
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  disabled={!isEditing || editLoading} 
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  value={isEditing ? editForm.email : organization.email} 
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={!isEditing || editLoading} 
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input 
                  value={isEditing ? editForm.cnpj : (organization.cnpj || "")} 
                  onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                  disabled={!isEditing || editLoading} 
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Limite de Usuários</Label>
                <Input value={`${members.length} / ${organization.max_users}`} disabled />
              </div>

              <div className="col-span-2 space-y-4 pt-4 border-t">
                <h3 className="font-medium">Personalização</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Logo da Organização</Label>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <div className="relative w-16 h-16 border rounded bg-muted flex items-center justify-center overflow-hidden">
                          <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 border rounded bg-muted flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {isEditing && (
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            disabled={editLoading}
                            className="w-full"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Recomendado: PNG ou JPG, máx 2MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cor Primária</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={isEditing ? editForm.primary_color : (organization.primary_color || "#2563eb")}
                          onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })}
                          disabled={!isEditing || editLoading}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={isEditing ? editForm.primary_color : (organization.primary_color || "#2563eb")}
                          onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })}
                          disabled={!isEditing || editLoading}
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Cor Secundária</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={isEditing ? editForm.secondary_color : (organization.secondary_color || "#1e40af")}
                          onChange={(e) => setEditForm({ ...editForm, secondary_color: e.target.value })}
                          disabled={!isEditing || editLoading}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={isEditing ? editForm.secondary_color : (organization.secondary_color || "#1e40af")}
                          onChange={(e) => setEditForm({ ...editForm, secondary_color: e.target.value })}
                          disabled={!isEditing || editLoading}
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Cor Terciária / Hover (Destaque)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={isEditing ? editForm.tertiary_color : (organization.tertiary_color || "#f59e0b")}
                          onChange={(e) => setEditForm({ ...editForm, tertiary_color: e.target.value })}
                          disabled={!isEditing || editLoading}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={isEditing ? editForm.tertiary_color : (organization.tertiary_color || "#f59e0b")}
                          onChange={(e) => setEditForm({ ...editForm, tertiary_color: e.target.value })}
                          disabled={!isEditing || editLoading}
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Membros da Equipe */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Membros da Equipe</CardTitle>
                <CardDescription>
                  {members.length} membro{members.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              {isAdmin && (
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="gradient">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Convidar Membro
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Convidar Novo Membro</DialogTitle>
                      <DialogDescription>
                        Envie um convite por email para adicionar um novo membro à equipe
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@exemplo.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Função</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="agent">Agente</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                        {inviting ? "Enviando..." : "Enviar Convite"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Membro desde</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.profiles?.full_name || "Usuário sem perfil"}
                    </TableCell>
                    <TableCell>{member.profiles?.email || "Email não disponível"}</TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                      {new Date(member.joined_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {member.role !== "owner" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover {member.profiles.full_name} da organização?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id, member.user_id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Convites Pendentes */}
        {isAdmin && invites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Convites Pendentes</CardTitle>
              <CardDescription>{invites.length} convite(s) aguardando resposta</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>{getRoleBadge(invite.role)}</TableCell>
                      <TableCell>
                        {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvite(invite.id)}
                        >
                          Cancelar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
