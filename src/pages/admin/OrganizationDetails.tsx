import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Building2, Users, Package, UserCheck, ShoppingCart } from "lucide-react";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";

interface Organization {
  id: string;
  name: string;
  email: string;
  cnpj: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  is_active: boolean;
  max_users: number;
  subscription_tier: string | null;
  created_at: string;
}

interface Member {
  id: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
  is_active: boolean;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
  };
}

interface Package {
  id: string;
  name: string;
  destination: string;
  price: number;
  available_spots: number;
  is_active: boolean;
  created_at: string;
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  customers: {
    full_name: string;
  };
  travel_packages: {
    name: string;
  };
}

interface Stats {
  memberCount: number;
  packageCount: number;
  customerCount: number;
  orderCount: number;
}

export default function OrganizationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSystemAdmin, loading: adminLoading } = useSystemAdmin();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<Stats>({ memberCount: 0, packageCount: 0, customerCount: 0, orderCount: 0 });
  const [members, setMembers] = useState<Member[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isSystemAdmin) {
      navigate("/dashboard");
    }
  }, [isSystemAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (id && isSystemAdmin) {
      loadOrganizationData();
    }
  }, [id, isSystemAdmin]);

  const loadOrganizationData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Load organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id)
        .single();

      if (orgError) throw orgError;
      if (!orgData) {
        toast.error("Organização não encontrada");
        navigate("/admin/organizations");
        return;
      }

      setOrganization(orgData);

      // Load stats
      const [membersRes, packagesRes, customersRes, ordersRes] = await Promise.all([
        supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", id),
        supabase.from("travel_packages").select("id", { count: "exact", head: true }).eq("organization_id", id),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", id),
      ]);

      setStats({
        memberCount: membersRes.count || 0,
        packageCount: packagesRes.count || 0,
        customerCount: customersRes.count || 0,
        orderCount: ordersRes.count || 0,
      });

      // Load detailed data for tabs
      await Promise.all([
        loadMembers(),
        loadPackages(),
        loadCustomers(),
        loadOrders(),
      ]);
    } catch (error) {
      console.error("Error loading organization:", error);
      toast.error("Erro ao carregar dados da organização");
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("organization_members")
      .select(`
        id,
        role,
        is_active,
        joined_at,
        user_id,
        profiles!organization_members_user_id_fkey(
          full_name,
          email,
          phone
        )
      `)
      .eq("organization_id", id)
      .order("joined_at", { ascending: true });

    if (!error && data) {
      setMembers(data as unknown as Member[]);
    }
  };

  const loadPackages = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("travel_packages")
      .select("id, name, destination, price, available_spots, is_active, created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setPackages(data);
    }
  };

  const loadCustomers = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setCustomers(data);
    }
  };

  const loadOrders = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        total_amount,
        status,
        created_at,
        customers!inner(full_name),
        travel_packages!inner(name)
      `)
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setOrders(data as Order[]);
    }
  };

  const getOrgRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
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

  const getOrderStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "outline";
      default:
        return "outline";
    }
  };

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmado";
      case "pending":
        return "Pendente";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/admin/organizations")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-muted-foreground" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">{organization.name}</h1>
              <p className="text-muted-foreground">{organization.email}</p>
            </div>
            <Badge variant={organization.is_active ? "default" : "secondary"} className="ml-4">
              {organization.is_active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>Detalhes da organização</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Nome</p>
            <p className="font-medium">{organization.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{organization.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">CNPJ</p>
            <p className="font-medium">{organization.cnpj || "Não informado"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Telefone</p>
            <p className="font-medium">{organization.phone || "Não informado"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Limite de Usuários</p>
            <p className="font-medium">{stats.memberCount} / {organization.max_users}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Data de Criação</p>
            <p className="font-medium">{new Date(organization.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
          {organization.address && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Endereço</p>
              <p className="font-medium">
                {organization.address}
                {organization.city && `, ${organization.city}`}
                {organization.state && ` - ${organization.state}`}
                {organization.zip_code && ` - ${organization.zip_code}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.memberCount} / {organization.max_users}</div>
            <p className="text-xs text-muted-foreground">usuários ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pacotes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.packageCount}</div>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customerCount}</div>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orderCount}</div>
            <p className="text-xs text-muted-foreground">total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="packages">Pacotes</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Membros da Equipe</CardTitle>
              <CardDescription>Usuários com acesso a esta organização</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum membro cadastrado</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data de Entrada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.profiles.full_name}</TableCell>
                          <TableCell>{member.profiles.email}</TableCell>
                          <TableCell>{member.profiles.phone || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={getOrgRoleBadgeVariant(member.role)}>
                              {getOrgRoleLabel(member.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.is_active ? "default" : "outline"}>
                              {member.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(member.joined_at).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pacotes de Viagem</CardTitle>
              <CardDescription>Últimos 10 pacotes cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              {packages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum pacote cadastrado</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Vagas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data de Criação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packages.map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-medium">{pkg.name}</TableCell>
                          <TableCell>{pkg.destination}</TableCell>
                          <TableCell>R$ {pkg.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>{pkg.available_spots}</TableCell>
                          <TableCell>
                            <Badge variant={pkg.is_active ? "default" : "outline"}>
                              {pkg.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(pkg.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>Últimos 10 clientes cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              {customers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Data de Cadastro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.full_name}</TableCell>
                          <TableCell>{customer.email}</TableCell>
                          <TableCell>{customer.phone}</TableCell>
                          <TableCell>{new Date(customer.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos</CardTitle>
              <CardDescription>Últimos 10 pedidos realizados</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum pedido realizado</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Pacote</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.customers.full_name}</TableCell>
                          <TableCell>{order.travel_packages.name}</TableCell>
                          <TableCell>R$ {order.total_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Badge variant={getOrderStatusBadgeVariant(order.status)}>
                              {getOrderStatusLabel(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(order.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
