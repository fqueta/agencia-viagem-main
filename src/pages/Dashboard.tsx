import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Filters {
  quickFilter: string;
  dateRange: {
    start: string;
    end: string;
  };
  statuses: string[];
}

/**
 * Página Dashboard com visão geral do negócio.
 * EN: Dashboard page showing business overview and quick actions.
 */
/**
 * Calcula e exibe métricas do período, com detalhamento clicável.
 * EN: Computes and displays period metrics, with clickable breakdowns.
 */
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

  const [detailsOpen, setDetailsOpen] = useState<null | "confirmed" | "received" | "overdue">(null);
  const [confirmedBreakdown, setConfirmedBreakdown] = useState<{ order_number: string; status: string | null; amount: number; confirmed_at: string | null }[]>([]);
  const [receivedBreakdown, setReceivedBreakdown] = useState<{ installment_number: number; amount: number; payment_date: string | null; payment_id: string; package_name?: string }[]>([]);
  const [overdueBreakdown, setOverdueBreakdown] = useState<{ installment_number?: number; amount: number; due_date: string | null; payment_id: string; package_name?: string }[]>([]);

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

  /**
   * Calcula o intervalo de datas considerando horário local.
   * Retorna também as strings somente-data (YYYY-MM-DD) para colunas do tipo date.
   * EN: Computes date ranges with local time and returns date-only strings.
   */
  const getDateRange = (filters: Filters): { startDate: string; endDate: string; startDateOnly: string; endDateOnly: string } => {
    const now = new Date();
    let startDate = "";
    let endDate = now.toISOString();
    let startDateOnly = "";
    let endDateOnly = toDateOnly(new Date());

    if (filters.quickFilter !== "all") {
      const startDateTime = new Date();
      const endDateTime = new Date();
      
      switch (filters.quickFilter) {
        case "today":
          startDateTime.setHours(0, 0, 0, 0);
          endDateTime.setHours(23, 59, 59, 999);
          endDate = endDateTime.toISOString();
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
      startDateOnly = toDateOnly(startDateTime);
      endDateOnly = toDateOnly(endDateTime);
    }

    if (filters.dateRange.start) {
      startDate = new Date(filters.dateRange.start).toISOString();
      startDateOnly = filters.dateRange.start;
    }
    if (filters.dateRange.end) {
      endDate = new Date(filters.dateRange.end + "T23:59:59").toISOString();
      endDateOnly = filters.dateRange.end;
    }

    return { startDate, endDate, startDateOnly, endDateOnly };
  };

  /**
   * Converte Date para string YYYY-MM-DD no horário local.
   * EN: Converts a Date to YYYY-MM-DD using local time.
   */
  function toDateOnly(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * formatDateOnlyDisplay
   *
   * Formata uma string de data somente (YYYY-MM-DD) para exibição em pt-BR
   * sem sofrer deslocamentos de timezone. Não cria Date a partir de uma
   * string UTC, evitando cair para o dia anterior em ambientes GMT-3.
   *
   * Parâmetros:
   * - dateStr: string ou null no formato YYYY-MM-DD.
   *
   * Retorno:
   * - string no formato DD/MM/YYYY ou "sem data" quando null.
   */
  function formatDateOnlyDisplay(dateStr: string | null): string {
    if (!dateStr) return "sem data";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  /**
   * Carrega métricas do período e popula os detalhamentos.
   * EN: Loads period metrics and populates breakdown lists.
   */
  const loadStats = async (orgId: string, filters: Filters) => {
    try {
      const { startDate, endDate, startDateOnly, endDateOnly } = getDateRange(filters);

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
        .select("order_number, total_amount, status, created_at, confirmed_at")
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

      // Query para installments (pagas) para calcular Valor Recebido
      // Query de parcelas pagas com filtro por data (YYYY-MM-DD) direto no banco
      // Para "Hoje", usamos igualdade de data para evitar qualquer ambiguidade.
      // EN: For "Today", use date equality to avoid any ambiguity.
      let installmentsQuery = supabase
        .from("installments")
        .select("amount, status, payment_date, installment_number, payment_id, payments(orders(travel_packages(name)))")
        .eq("organization_id", orgId)
        .eq("status", "paid");
      if (startDateOnly && endDateOnly && startDateOnly === endDateOnly) {
        installmentsQuery = installmentsQuery.eq("payment_date", startDateOnly);
      } else {
        if (startDateOnly) installmentsQuery = installmentsQuery.gte("payment_date", startDateOnly);
        if (endDateOnly) installmentsQuery = installmentsQuery.lte("payment_date", endDateOnly);
      }
      installmentsQuery = installmentsQuery.order("payment_date", { ascending: true });

      /**
       * Overdue Installments Query (Valor Atrasado)
       * PT-BR: Consulta de parcelas vencidas para o card do Dashboard.
       *   - Inclui status "overdue" OU "pending" com due_date < hoje (pendente vencida).
       *   - Quando quickFilter === "all" (Tudo), NÃO filtra por intervalo; apenas aplica due_date < hoje
       *     para capturar parcelas pendentes que já venceram.
       *   - Caso contrário, restringe por due_date dentro do período escolhido, mantendo due_date < hoje
       *     para garantir que apenas vencidas sejam retornadas.
       * EN: Overdue installments query for Dashboard card.
       *   - Includes "overdue" OR "pending" with due_date < today.
       *   - For quickFilter === "all", do not filter by range; only require due_date < today.
       *   - Otherwise, filter by due_date in the selected range and still require due_date < today.
       */
      const todayOnly = new Date().toISOString().split("T")[0];
      let overdueInstallmentsQuery = supabase
        .from("installments")
        .select("amount, status, due_date, payment_id, installment_number, payments(orders(travel_packages(name)))")
        .eq("organization_id", orgId)
        .in("status", ["overdue", "pending"])
        .lt("due_date", todayOnly);

      if (filters.quickFilter !== "all") {
        if (startDateOnly && endDateOnly && startDateOnly === endDateOnly) {
          overdueInstallmentsQuery = overdueInstallmentsQuery.eq("due_date", startDateOnly);
        } else {
          if (startDateOnly) overdueInstallmentsQuery = overdueInstallmentsQuery.gte("due_date", startDateOnly);
          if (endDateOnly) overdueInstallmentsQuery = overdueInstallmentsQuery.lte("due_date", endDateOnly);
        }
      }
      overdueInstallmentsQuery = overdueInstallmentsQuery.order("due_date", { ascending: true });

      const [packagesResult, customersResult, ordersResult, paymentsResult, installmentsResult, overdueResult] = await Promise.all([
        packagesRes,
        customersQuery,
        ordersQuery,
        paymentsQuery,
        installmentsQuery,
        overdueInstallmentsQuery,
      ]);

      const orders = ordersResult.data || [];
      const installments = installmentsResult.data || [];
      const overdueInstallments = overdueResult.data || [];
      // Debug rápido: confirmar intervalo aplicado e datas retornadas.
      // EN: Quick debug to confirm applied range and returned dates.
      try {
        // Log reclassificado para console.log para aparecer nos níveis padrão.
        // EN: Use console.log so it shows under default console levels.
        console.log("[Dashboard] installments filter", { startDateOnly, endDateOnly, count: installments.length, dates: (installments || []).map(i => i.payment_date) });
      } catch {}

      // Calcular receita total
      const revenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

      // Calcular receita confirmada por data de confirmação (fallback: created_at)
      const confirmedOrdersList = orders.filter(order => order.status === "confirmed" || order.status === "completed");
      const confirmedRevenue = confirmedOrdersList
        .filter(order => {
          const referenceDate = order.confirmed_at || order.created_at;
          if (!referenceDate) return false;
          const refTime = new Date(referenceDate).getTime();
          const startTime = startDate ? new Date(startDate).getTime() : -Infinity;
          const endTime = endDate ? new Date(endDate).getTime() : Infinity;
          return refTime >= startTime && refTime <= endTime;
        })
        .reduce((sum, order) => sum + Number(order.total_amount), 0);

      // Preparar detalhamento de pedidos confirmados
      const confirmedBreakdownData = confirmedOrdersList
        .filter(order => {
          const referenceDate = order.confirmed_at || order.created_at;
          if (!referenceDate) return false;
          const refTime = new Date(referenceDate).getTime();
          const startTime = startDate ? new Date(startDate).getTime() : -Infinity;
          const endTime = endDate ? new Date(endDate).getTime() : Infinity;
          return refTime >= startTime && refTime <= endTime;
        })
        .map(order => ({
          order_number: order.order_number,
          status: order.status as string | null,
          amount: Number(order.total_amount),
          confirmed_at: order.confirmed_at || order.created_at || null,
        }));

      // Calcular valor recebido (installments pagos no período)
      // Como o filtro por data já foi aplicado no banco, apenas garantimos que há data
      const receivedList = (installments || []).filter(inst => !!inst.payment_date);

      const received = receivedList.reduce((sum, inst) => sum + Number(inst.amount), 0);

      const receivedBreakdownData = receivedList.map(inst => {
        // EN: Try to extract travel package name from nested relation: installments -> payments -> orders -> travel_packages
        // PT: Extrai o nome do pacote via relação aninhada: parcelas -> pagamentos -> pedidos -> pacotes
        const pkgName = (inst as any)?.payments?.orders?.travel_packages?.name as string | undefined;
        return {
          installment_number: Number(inst.installment_number),
          amount: Number(inst.amount),
          payment_date: inst.payment_date,
          payment_id: String(inst.payment_id),
          package_name: pkgName,
        };
      });

      // EN: Build overdue breakdown list with due_date and package name for dialog
      // PT: Monta lista de vencidas com due_date e nome do pacote para o diálogo
      const overdueBreakdownData = (overdueInstallments || []).map(inst => {
        const pkgName = (inst as any)?.payments?.orders?.travel_packages?.name as string | undefined;
        return {
          installment_number: inst.installment_number ? Number(inst.installment_number) : undefined,
          amount: Number(inst.amount),
          due_date: (inst as any)?.due_date || null,
          payment_id: String(inst.payment_id),
          package_name: pkgName,
        };
      });

      // Calcular valor atrasado
      // Valor atrasado baseado na consulta específica de vencidas
      const overdue = overdueInstallments.reduce((sum, inst) => sum + Number(inst.amount), 0);

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

      setConfirmedBreakdown(confirmedBreakdownData);
      setReceivedBreakdown(receivedBreakdownData);
      setOverdueBreakdown(overdueBreakdownData);
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
    <div className="min-h-screen bg-background">
      

      <main className="container mx-auto px-4 py-0">
        {/* Dropdown do usuário foi movido para MainLayout para padronizar o topo */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
        </div>

        <Card className="mb-8 border bg-card rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filtros de Período
            </CardTitle>
            <CardDescription>Selecione o período para análise financeira</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-4">
                <QuickFilterButtons
                  value={filters.quickFilter}
                  onChange={(value) => setFilters({ ...filters, quickFilter: value, dateRange: { start: "", end: "" } })}
                />
              </div>
              <div className="lg:col-span-5">
                <DateRangeFilter
                  startDate={filters.dateRange.start}
                  endDate={filters.dateRange.end}
                  onStartChange={(start) => setFilters({ ...filters, dateRange: { ...filters.dateRange, start }, quickFilter: "all" })}
                  onEndChange={(end) => setFilters({ ...filters, dateRange: { ...filters.dateRange, end }, quickFilter: "all" })}
                  label="Período Personalizado"
                />
              </div>
              <div className="lg:col-span-3">
                <StatusCheckboxGroup
                  selectedStatuses={filters.statuses}
                  onChange={(statuses) => setFilters({ ...filters, statuses })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">
            Estatísticas do Período: {filters.quickFilter === "all" ? "Todo o período" : filters.quickFilter === "today" ? "Hoje" : filters.quickFilter === "week" ? "Esta semana" : filters.quickFilter === "month" ? "Este mês" : filters.quickFilter === "year" ? "Este ano" : filters.quickFilter === "7days" ? "Últimos 7 dias" : filters.quickFilter === "30days" ? "Últimos 30 dias" : filters.quickFilter === "90days" ? "Últimos 90 dias" : "Período personalizado"}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pedidos
              </CardTitle>
              <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.orders}</div>
              <p className="text-xs text-muted-foreground mt-1">pedidos no período</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Novos Clientes
              </CardTitle>
              <Users className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.customers}</div>
              <p className="text-xs text-muted-foreground mt-1">cadastrados no período</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Total
              </CardTitle>
              <DollarSign className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R$ {stats.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">todos os pedidos</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de Conversão
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">pedidos confirmados</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailsOpen("confirmed")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Confirmada
              </CardTitle>
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R$ {stats.confirmedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">pedidos confirmados/completos</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailsOpen("received")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Recebido
              </CardTitle>
              <DollarSign className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R$ {stats.received.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">pagamentos recebidos</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailsOpen("overdue")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor Atrasado
              </CardTitle>
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R$ {stats.overdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">parcelas vencidas</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contas Pendentes
              </CardTitle>
              <Calendar className="w-5 h-5 text-muted-foreground" />
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
          {/* <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/packages")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-muted-foreground" />
                Pacotes de Viagem
              </CardTitle>
              <CardDescription>Gerencie seus pacotes turísticos</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/customers")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                Clientes
              </CardTitle>
              <CardDescription>Cadastro e gestão de clientes</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/orders")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                Pedidos
              </CardTitle>
              <CardDescription>Gerencie vendas e reservas</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/payments")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-muted-foreground" />
                Contas a Receber
              </CardTitle>
              <CardDescription>Controle financeiro</CardDescription>
            </CardHeader>
          </Card> */}

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/birthdays")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                Aniversários
              </CardTitle>
              <CardDescription>Notificações de clientes</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/delinquency")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                Inadimplência
              </CardTitle>
              <CardDescription>Gestão de cobranças</CardDescription>
            </CardHeader>
          </Card>

          {/* <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/organization/settings")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                Equipe
              </CardTitle>
              <CardDescription>Gerenciar membros e convites</CardDescription>
            </CardHeader>
          </Card> */}
        </div>
        {/* Dialog de detalhamento */}
        <Dialog open={!!detailsOpen} onOpenChange={(open) => setDetailsOpen(open ? detailsOpen : null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detailsOpen === "confirmed" ? "Detalhe: Receita Confirmada" : detailsOpen === "received" ? "Detalhe: Valor Recebido" : detailsOpen === "overdue" ? "Detalhe: Valor Atrasado" : ""}</DialogTitle>
              <DialogDescription>
                {detailsOpen === "confirmed" ? "Soma de pedidos confirmados/completos no período." : detailsOpen === "received" ? "Soma de parcelas pagas no período." : detailsOpen === "overdue" ? "Soma de parcelas vencidas conforme filtro selecionado." : ""}
              </DialogDescription>
            </DialogHeader>

            {detailsOpen === "confirmed" && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Total: R$ {stats.confirmedRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                <div className="max-h-72 overflow-auto divide-y">
                  {confirmedBreakdown.length === 0 && (
                    <div className="py-3 text-sm">Nenhum pedido no período.</div>
                  )}
                  {confirmedBreakdown.map((item, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div className="text-sm">Pedido {item.order_number} • {item.status}</div>
                      <div className="text-sm font-medium">R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailsOpen === "received" && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Total: R$ {stats.received.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="max-h-72 overflow-auto divide-y">
                  {receivedBreakdown.length === 0 && (
                    <div className="py-3 text-sm">Nenhuma parcela paga no período.</div>
                  )}
                  {receivedBreakdown.map((item, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div className="text-sm">Parcela #{item.installment_number} • {formatDateOnlyDisplay(item.payment_date)}{item.package_name ? ` — ${item.package_name}` : ""}</div>
                      <div className="text-sm font-medium">R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailsOpen === "overdue" && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Total: R$ {stats.overdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                <div className="max-h-72 overflow-auto divide-y">
                  {overdueBreakdown.length === 0 && (
                    <div className="py-3 text-sm">Nenhuma parcela vencida.</div>
                  )}
                  {overdueBreakdown.map((item, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div className="text-sm">{item.installment_number ? `Parcela #${item.installment_number} • ` : ""}{formatDateOnlyDisplay(item.due_date)}{item.package_name ? ` — ${item.package_name}` : ""}</div>
                      <div className="text-sm font-medium">R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>
                {/**
                 * Navigate to Delinquency dashboard
                 * PT-BR: Botão opcional para abrir o Dashboard de Inadimplência
                 * EN: Optional button to open the Delinquency dashboard
                 */}
                <div className="pt-3">
                  <Button variant="secondary" onClick={() => navigate("/delinquency")}>
                    Detalhes de Inadimplentes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

export default Dashboard;
