import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, ShoppingCart, Edit, Eye, Trash2, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FilterBar } from "@/components/filters/FilterBar";
import { SearchInput } from "@/components/filters/SearchInput";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { StatusFilter } from "@/components/filters/StatusFilter";
import { ValueRangeFilter } from "@/components/filters/ValueRangeFilter";
import { OrderDeleteDialog } from "@/components/orders/OrderDeleteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";

/**
 * Página de listagem de pedidos com filtros e tabela.
 * EN: Orders listing page with filter bar and orders table.
 */
/**
 * Página Pedidos com filtros padronizados e grade responsiva 12-colunas.
 * EN: Orders page with standardized filter labels and 12-column responsive grid.
 */
const Orders = () => {
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useOrganization();
  const { isOrgAdmin, role, isAgent } = useOrganizationRole();
  // Pode excluir: admin/owner ou agent (inclui fallback de role de sistema)
  const canDelete = isOrgAdmin || isAgent;
  console.log("canDelete", canDelete, { role, isOrgAdmin, isAgent });
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [updating, setUpdating] = useState<boolean>(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    dateStart: "",
    dateEnd: "",
    minValue: "",
    maxValue: "",
  });

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (!organizationId) {
      setOrders([]);
      return;
    }

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        *,
        customers(full_name),
        travel_packages(name),
        payments(
          id,
          status,
          amount,
          installments:installments(
            id,
            status,
            amount
          )
        )
      `)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (ordersError) {
      toast.error("Erro ao carregar dados");
      return;
    }

    setOrders(ordersData || []);
  };

  const handleDelete = async (orderId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }

    const { error } = await supabase.from("orders").delete().eq("id", orderId);

    if (error) {
      toast.error("Erro ao excluir pedido");
      return;
    }

    toast.success("Pedido excluído com sucesso!");
    loadData();
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "secondary",
      confirmed: "default",
      cancelled: "destructive",
      completed: "outline",
    };
    const labels: any = {
      pending: "Pendente",
      confirmed: "Confirmado",
      cancelled: "Cancelado",
      completed: "Concluído",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const ORDER_STATUS_OPTIONS = [
    { value: "pending", label: "Pendente" },
    { value: "confirmed", label: "Confirmado" },
    { value: "completed", label: "Concluído" },
    { value: "cancelled", label: "Cancelado" },
  ] as const;

  /**
   * Atualiza o status de um pedido individual no banco (Supabase) e no estado local.
   * EN: Update a single order's status in Supabase and local state.
   */
  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    setUpdating(true);
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .eq("organization_id", organizationId);

    if (error) {
      toast.error("Falha ao atualizar status do pedido");
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      toast.success("Status do pedido atualizado");
    }
    setUpdating(false);
  };

  /**
   * Atualiza o status de todos os pedidos selecionados, com feedback e reload opcional.
   * EN: Bulk-update status for selected orders with feedback and optional reload.
   */
  const bulkUpdateSelectedOrdersStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    setUpdating(true);
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .in("id", selectedIds)
      .eq("organization_id", organizationId);

    if (error) {
      toast.error("Falha ao aplicar status nos selecionados");
    } else {
      setOrders((prev) => prev.map((o) => (selectedIds.includes(o.id) ? { ...o, status } : o)));
      toast.success("Status aplicado aos pedidos selecionados");
      setSelectedIds([]);
    }
    setUpdating(false);
  };

  /**
   * Alterna seleção de uma linha (pedido) na tabela.
   * EN: Toggle selection for a single order row in the table.
   */
  const toggleRowSelection = (orderId: string, checked: boolean | string) => {
    const isChecked = checked === true || checked === "indeterminate";
    setSelectedIds((prev) =>
      isChecked ? [...new Set([...prev, orderId])] : prev.filter((id) => id !== orderId)
    );
  };

  /**
   * Alterna seleção de todas as linhas visíveis (após filtros).
   * EN: Toggle selection for all visible rows (after filters).
   */
  const toggleAllSelection = (checked: boolean | string) => {
    const isChecked = checked === true || checked === "indeterminate";
    if (isChecked) {
      setSelectedIds(filteredOrders.map((o: any) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const getPaymentStatusBadge = (order: any) => {
    const payment = order.payments?.[0];
    
    if (!payment) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-600">
          Sem Pagamento
        </Badge>
      );
    }

    const installments = payment.installments || [];
    const totalInstallments = installments.length;
    const paidInstallments = installments.filter((i: any) => i.status === 'paid').length;
    const overdueInstallments = installments.filter((i: any) => i.status === 'overdue').length;

    if (payment.status === 'paid') {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-green-500 hover:bg-green-600">
            ✓ Pago
          </Badge>
          {totalInstallments > 0 && (
            <span className="text-xs text-muted-foreground">
              {paidInstallments}/{totalInstallments} parcelas
            </span>
          )}
        </div>
      );
    }

    if (payment.status === 'overdue' || overdueInstallments > 0) {
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="destructive">
            ⚠ Atrasado
          </Badge>
          {totalInstallments > 0 && (
            <span className="text-xs text-muted-foreground">
              {overdueInstallments} em atraso
            </span>
          )}
        </div>
      );
    }

    if (payment.status === 'partial') {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-blue-500 hover:bg-blue-600">
            ⚡ Parcial
          </Badge>
          <span className="text-xs text-muted-foreground">
            {paidInstallments}/{totalInstallments} pagas
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
          ⏳ Pendente
        </Badge>
        {totalInstallments > 0 && (
          <span className="text-xs text-muted-foreground">
            0/{totalInstallments} pagas
          </span>
        )}
      </div>
    );
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        !filters.search ||
        order.order_number?.toLowerCase().includes(searchLower) ||
        order.customers?.full_name?.toLowerCase().includes(searchLower) ||
        order.travel_packages?.name?.toLowerCase().includes(searchLower);

      const matchesStatus = filters.status === "all" || order.status === filters.status;

      const orderDate = new Date(order.travel_date);
      const matchesDateStart =
        !filters.dateStart || orderDate >= new Date(filters.dateStart);
      const matchesDateEnd =
        !filters.dateEnd || orderDate <= new Date(filters.dateEnd);

      const orderAmount = Number(order.total_amount);
      const matchesMinValue =
        !filters.minValue || orderAmount >= Number(filters.minValue);
      const matchesMaxValue =
        !filters.maxValue || orderAmount <= Number(filters.maxValue);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDateStart &&
        matchesDateEnd &&
        matchesMinValue &&
        matchesMaxValue
      );
    });
  }, [orders, filters]);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== "all" && value !== ""
  ).length;

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      dateStart: "",
      dateEnd: "",
      minValue: "",
      maxValue: "",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-gradient-to-r from-secondary to-primary rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pedidos</h1>
              <p className="text-sm text-muted-foreground">Gerencie suas vendas</p>
            </div>
          </div>
          <Button variant="gradient" onClick={() => navigate("/orders/create")}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Pedido
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <FilterBar
          onClear={clearFilters}
          activeFiltersCount={activeFiltersCount}
          resultsCount={filteredOrders.length}
          totalCount={orders.length}
          gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4"
        >
          <div className="lg:col-span-4 space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar
            </Label>
            <SearchInput
              value={filters.search}
              onChange={(value) => setFilters({ ...filters, search: value })}
              placeholder="Buscar por pedido, cliente ou pacote..."
            />
          </div>
          <div className="lg:col-span-2">
            <StatusFilter
              label="Status"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              options={[
                { value: "all", label: "Todos" },
                { value: "pending", label: "Pendente" },
                { value: "confirmed", label: "Confirmado" },
                { value: "completed", label: "Concluído" },
                { value: "cancelled", label: "Cancelado" },
              ]}
            />
          </div>
          <div className="lg:col-span-3">
            <DateRangeFilter
              label="Data da Viagem"
              startDate={filters.dateStart}
              endDate={filters.dateEnd}
              onStartChange={(value) => setFilters({ ...filters, dateStart: value })}
              onEndChange={(value) => setFilters({ ...filters, dateEnd: value })}
            />
          </div>
          <div className="lg:col-span-3">
            <ValueRangeFilter
              label="Valor Total"
              minValue={filters.minValue}
              maxValue={filters.maxValue}
              onMinChange={(value) => setFilters({ ...filters, minValue: value })}
              onMaxChange={(value) => setFilters({ ...filters, maxValue: value })}
            />
          </div>
        </FilterBar>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Pedidos</CardTitle>
            <CardDescription>Todos os pedidos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Área de gerenciamento de status em lote */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Label className="text-sm">Gerenciar Status</Label>
              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecionar novo status" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                disabled={selectedIds.length === 0 || !bulkStatus || updating}
                onClick={() => bulkUpdateSelectedOrdersStatus(bulkStatus)}
              >
                Aplicar aos selecionados ({selectedIds.length})
              </Button>
              <Button
                variant="ghost"
                disabled={selectedIds.length === 0 || updating}
                onClick={() => setSelectedIds([])}
              >
                Limpar seleção
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length > 0 && selectedIds.length === filteredOrders.length}
                      onCheckedChange={toggleAllSelection}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead>Data Viagem</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedIds.includes(order.id)}
                        onCheckedChange={(v) => toggleRowSelection(order.id, v)}
                        aria-label={`Selecionar pedido ${order.order_number}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.customers?.full_name}</TableCell>
                    <TableCell>{order.travel_packages?.name}</TableCell>
                    <TableCell>
                      {formatDateOnlyDisplay(order.travel_date)}
                    </TableCell>
                    <TableCell>
                      R$ {Number(order.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(order.status)}
                        <Select value={order.status} onValueChange={(v) => updateOrderStatus(order.id, v)}>
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORDER_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>{getPaymentStatusBadge(order)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/orders/${order.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {canDelete ? (
                            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                              <OrderDeleteDialog
                                orderId={order.id}
                                orderNumber={order.order_number}
                                customerName={order.customers?.full_name || "N/A"}
                                onSuccess={loadData}
                                trigger={
                                  <span className="flex items-center text-destructive cursor-pointer w-full">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </span>
                                }
                              />
                            </DropdownMenuItem>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem disabled>
                                    <span className="flex items-center text-muted-foreground w-full">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </span>
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Sem permissão para excluir. Usuários com papel "viewer" não podem excluir.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {orders.length === 0
                        ? "Nenhum pedido registrado ainda"
                        : "Nenhum pedido encontrado com os filtros aplicados"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Orders;

  /**
   * formatDateOnlyDisplay
   *
   * PT-BR: Formata uma string de data (YYYY-MM-DD) para exibição em pt-BR
   * sem criar objetos Date, evitando deslocamentos por timezone.
   * EN: Formats a date-only string (YYYY-MM-DD) to pt-BR display without
   * creating Date objects to avoid timezone shifts.
   */
  function formatDateOnlyDisplay(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const parts = String(dateStr).split("-");
    if (parts.length !== 3) return String(dateStr);
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
