import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Users, UserCheck, Search, Clock, Edit } from "lucide-react";
import { UserCreateDialog } from "@/components/admin/UserCreateDialog";
import { UserDeleteDialog } from "@/components/admin/UserDeleteDialog";
import { UserApprovalDialog } from "@/components/admin/UserApprovalDialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface UserRole {
  role: string;
}

type AppRole = "admin" | "agent" | "user";

interface UserOrganization {
  membership_id: string;
  organization_id: string;
  name: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
  is_active: boolean;
}

interface UserWithRole extends UserProfile {
  role: AppRole | null;
  phone?: string;
  organizations?: UserOrganization[];
  status: 'active' | 'pending';
}

export default function UsersManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [userToApprove, setUserToApprove] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, roleFilter, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error: profilesError } = await supabase
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
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      const usersWithRoles = profiles?.map(profile => {
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

        const userRole = rolesMap.get(profile.id) as AppRole | undefined;

        return {
          ...profile,
          role: userRole || null,
          organizations: userOrgs,
          organization_members: undefined,
          status: userRole ? 'active' : 'pending'
        } as UserWithRole;
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    if (!role) return "outline";
    switch (role) {
      case "admin":
        return "default";
      case "agent":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: AppRole | null) => {
    if (!role) return "Pendente";
    switch (role) {
      case "admin":
        return "Admin";
      case "agent":
        return "Agente";
      default:
        return "Usuário";
    }
  };

  const getOrgRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      case "agent":
        return "outline";
      case "viewer":
        return "outline";
      default:
        return "outline";
    }
  };

  const getOrgRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Proprietário";
      case "admin":
        return "Admin";
      case "agent":
        return "Agente";
      case "viewer":
        return "Visualizador";
      default:
        return role;
    }
  };

  const renderOrganizations = (organizations?: UserOrganization[]) => {
    if (!organizations || organizations.length === 0) {
      return <span className="text-muted-foreground text-sm">Nenhuma</span>;
    }

    // Se tiver só 1 organização, mostrar diretamente
    if (organizations.length === 1) {
      const org = organizations[0];
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{org.name}</span>
          <Badge variant={getOrgRoleBadgeVariant(org.role)} className="w-fit text-xs">
            {getOrgRoleLabel(org.role)}
          </Badge>
        </div>
      );
    }

    // Se tiver múltiplas, mostrar com HoverCard
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="outline" size="sm" className="h-auto py-1">
            {organizations.length} organizações
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Organizações do Usuário</h4>
            <div className="space-y-2">
              {organizations.map((org) => (
                <div key={org.organization_id} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm font-medium truncate flex-1">{org.name}</span>
                  <Badge variant={getOrgRoleBadgeVariant(org.role)} className="ml-2 text-xs">
                    {getOrgRoleLabel(org.role)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.role === "admin").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground">Gerencie todos os usuários do sistema</p>
          </div>
        </div>
        <UserCreateDialog onSuccess={loadUsers} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminUsers}</div>
          </CardContent>
        </Card>

        {pendingUsers > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aguardando Aprovação</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingUsers}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Lista de todos os usuários do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Role Sistema</TableHead>
                    <TableHead>Organizações</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {getRoleLabel(user.role)}
                        </Badge>
                        {user.status === 'pending' && (
                          <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-600">
                            Aguardando
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{renderOrganizations(user.organizations)}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {user.status === 'pending' ? (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => setUserToApprove({ id: user.id, full_name: user.full_name, email: user.email, created_at: user.created_at })}
                            >
                              Aprovar
                            </Button>
                          ) : (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <UserDeleteDialog
                                userId={user.id}
                                userName={user.full_name}
                                onSuccess={loadUsers}
                              />
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserApprovalDialog
        user={userToApprove}
        open={!!userToApprove}
        onOpenChange={(open) => !open && setUserToApprove(null)}
        onSuccess={loadUsers}
      />
    </div>
  );
}
