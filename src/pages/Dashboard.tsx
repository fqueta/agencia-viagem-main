import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plane, Users, Package, ShoppingCart, DollarSign, Calendar, LogOut, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Session } from "@supabase/supabase-js";
import { QuickFilterButtons } from "@/components/filters/QuickFilterButtons";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { StatusCheckboxGroup } from "@/components/filters/StatusCheckboxGroup";
import { useOrganization } from "@/hooks/useOrganization";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";

interface Filters {
  quickFilter: string;
  dateRange: {
    start: string;
    end: string;
  };
  statuses: string[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { organizationId } = useOrganization();
  const [session, setSession] = useState<Session | null>(null);
  const [filters, setFilters] = useState<Filters>({
    quickFilter: "all",
    dateRange: { start: "", end: "" },
    statuses: ["pending", "confirmed", "completed", "cancelled"],
  });
  const [stats, setStats] = useState({
    packages: 0,
    customers: 0,
    orders: 0,
    revenue: 0,
    pending: 0,
    confirmedRevenue: 0,
    received: 0,
    overdue: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setSession(session);
      if (organizationId) {
        loadStats(organizationId, filters);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setSession(session);
        if (organizationId) {
          loadStats(organizationId, filters);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, organizationId]);

  useEffect(() => {
    if (session && organizationId) {
      loadStats(organizationId, filters);
    }
  }, [filters, session, organizationId]);

  const getDateRange = (filters: Filters): { startDate: string; endDate: string } => {
    const now = new Date();
    let startDate = "";
    let endDate = now.toISOString();

    if (filters.quickFilter !== "all") {
      const startDateTime = new Date();
      
      switch (filters.quickFilter) {
        case "today":
          startDateTime.setHours(0, 0, 0, 0);
          break;
        case "week":
          const dayOfWeek = startDateTime.getDay();
          startDateTime.setDate(startDateTime.getDate() - dayOfWeek);
          startDateTime.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDateTime.setDate(1);
          startDateTime.setHours(0, 0, 0, 0);
          break;
        case "year":
          startDateTime.setMonth(0, 1);
          startDateTime.setHours(0, 0, 0, 0);
          break;
        case "7days":
          startDateTime.setDate(startDateTime.getDate() - 7);
          startDateTime.setHours(0, 0, 0, 0);
          break;
        case "30days":
          startDateTime.setDate(startDateTime.getDate() - 30);
          startDateTime.setHours(0, 0, 0, 0);
          break;
        case "90days":
          startDateTime.setDate(startDateTime.getDate() - 90);
          startDateTime.setHours(0, 0, 0, 0);
          break;
      }
      
      startDate = startDateTime.toISOString();
    }

    if (filters.dateRange.start) {
      startDate = new Date(filters.dateRange.start).toISOString();
    }
    if (filters.dateRange.end) {
      endDate = new Date(filters.dateRange.end + "T23:59:59").toISOString();
    }

    return { startDate, endDate };
  };

  const loadStats = async (orgId: string, filters: Filters) => {
    try {
      const { startDate, endDate } = getDateRange(filters);

      // Query base para pacotes (não filtrado por data)
      const packagesRes = await supabase
        .from("travel_packages")
        .select("*", { count: "exact" })
        .eq("organization_id", orgId);

      // Query para clientes com filtro de data
      let customersQuery = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .eq("organization_id", orgId);
      
      if (startDate) customersQuery = customersQuery.gte("created_at", startDate);
      if (endDate) customersQuery = customersQuery.lte("created_at", endDate);

      // Query para pedidos com filtro de data e status
      let ordersQuery = supabase
        .from("orders")
        .select("total_amount, status, created_at")
        .eq("organization_id", orgId);
      
      if (startDate) ordersQuery = ordersQuery.gte("created_at", startDate);
      if (endDate) ordersQuery = ordersQuery.lte("created_at", endDate);
      if (filters.statuses.length > 0) ordersQuery = ordersQuery.in("status", filters.statuses as ("pending" | "confirmed" | "completed" | "cancelled")[]);

      // Query para pagamentos pendentes
      let paymentsQuery = supabase
        .from("payments")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "pending");
      
      if (startDate) paymentsQuery = paymentsQuery.gte("created_at", startDate);
      if (endDate) paymentsQuery = paymentsQuery.lte("created_at", endDate);

      // Query para installments para calcular valores recebidos e atrasados
      let installmentsQuery = supabase
        .from("installments")
        .select("amount, status, payment_date")
        .eq("organization_id", orgId);

      const [packagesResult, customersResult, ordersResult, paymentsResult, installmentsResult] = await Promise.all([
        packagesRes,
        customersQuery,
        ordersQuery,
        paymentsQuery,
        installmentsQuery,
      ]);

      const orders = ordersResult.data || [];
      const installments = installmentsResult.data || [];

      // Calcular receita total
      const revenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

      // Calcular receita confirmada (apenas pedidos confirmed e completed)
      const confirmedRevenue = orders
        .filter(order => order.status === "confirmed" || order.status === "completed")
        .reduce((sum, order) => sum + Number(order.total_amount), 0);

      // Calcular valor recebido (installments pagos no período)
      const received = installments
        .filter(inst => {
          if (inst.status !== "paid" || !inst.payment_date) return false;
          const paymentDate = new Date(inst.payment_date).toISOString();
          if (startDate && paymentDate < startDate) return false;
          if (endDate && paymentDate > endDate) return false;
          return true;
        })
        .reduce((sum, inst) => sum + Number(inst.amount), 0);

      // Calcular valor atrasado
      const overdue = installments
        .filter(inst => inst.status === "overdue")
        .reduce((sum, inst) => sum + Number(inst.amount), 0);

      // Calcular taxa de conversão
      const totalOrders = orders.length;
      const confirmedOrders = orders.filter(order => order.status === "confirmed" || order.status === "completed").length;
      const conversionRate = totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0;

      setStats({
        packages: packagesResult.count || 0,
        customers: customersResult.count || 0,
        orders: totalOrders,
        revenue,
        pending: paymentsResult.data?.length || 0,
        confirmedRevenue,
        received,
        overdue,
        conversionRate,
      });
    } catch (error) {
      toast.error("Erro ao carregar estatísticas");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso");
    navigate("/auth");
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">TravelManager</h1>
              <p className="text-sm text-muted-foreground">Sistema de Gestão</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OrganizationSwitcher />
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">Visão geral do seu negócio</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filtros de Período
            </CardTitle>
            <CardDescription>Selecione o período para análise financeira</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <QuickFilterButtons
                value={filters.quickFilter}
                onChange={(value) => setFilters({ ...filters, quickFilter: value, dateRange: { start: "", end: "" } })}
              />
            </div>

            <Separator />

            <DateRangeFilter
              startDate={filters.dateRange.start}
              endDate={filters.dateRange.end}
              onStartChange={(start) => setFilters({ ...filters, dateRange: { ...filters.dateRange, start }, quickFilter: "all" })}
              onEndChange={(end) => setFilters({ ...filters, dateRange: { ...filters.dateRange, end }, quickFilter: "all" })}
              label="Período Personalizado"
            />

            <Separator />

            <StatusCheckboxGroup
              selectedStatuses={filters.statuses}
              onChange={(statuses) => setFilters({ ...filters, statuses })}
            />
          </CardContent>
        </Card>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">
            Estatísticas do Período: {filters.quickFilter === "all" ? "Todo o período" : filters.quickFilter === "today" ? "Hoje" : filters.quickFilter === "week" ? "Esta semana" : filters.quickFilter === "month" ? "Este mês" : filters.quickFilter === "year" ? "Este ano" : filters.quickFilter === "7days" ? "Últimos 7 dias" : filters.quickFilter === "30days" ? "Últimos 30 dias" : filters.quickFilter === "90days" ? "Últimos 90 dias" : "Período personalizado"}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pedidos
              </CardTitle>
              <ShoppingCart className="w-5 h-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.orders}</div>
              <p className="text-xs text-muted-foreground mt-1">pedidos no período</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Novos Clientes
              </CardTitle>
              <Users className="w-5 h-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.customers}</div>
              <p className="text-xs text-muted-foreground mt-1">cadastrados no período</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Total
              </CardTitle>
              <DollarSign className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R$ {stats.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">todos os pedidos</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de Conversão
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">pedidos confirmados</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow border-success/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Confirmada
              </CardTitle>
              <CheckCircle2 className="w-5 h-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                R$ {stats.confirmedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">pedidos confirmados/completos</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Recebido
              </CardTitle>
              <DollarSign className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                R$ {stats.received.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">pagamentos recebidos</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Atrasado
              </CardTitle>
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                R$ {stats.overdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">parcelas vencidas</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-secondary/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contas Pendentes
              </CardTitle>
              <Calendar className="w-5 h-5 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">pagamentos pendentes</p>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Acesso Rápido</h3>
          <p className="text-sm text-muted-foreground">Navegue para as principais funcionalidades</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/packages")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Pacotes de Viagem
              </CardTitle>
              <CardDescription>Gerencie seus pacotes turísticos</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/customers")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                Clientes
              </CardTitle>
              <CardDescription>Cadastro e gestão de clientes</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/orders")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-secondary" />
                Pedidos
              </CardTitle>
              <CardDescription>Gerencie vendas e reservas</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/payments")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success" />
                Contas a Receber
              </CardTitle>
              <CardDescription>Controle financeiro</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/birthdays")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-secondary" />
                Aniversários
              </CardTitle>
              <CardDescription>Notificações de clientes</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/delinquency")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Inadimplência
              </CardTitle>
              <CardDescription>Gestão de cobranças</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/organization/settings")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Equipe
              </CardTitle>
              <CardDescription>Gerenciar membros e convites</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
