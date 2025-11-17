import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, ShoppingCart, Edit, Eye, Trash2 } from "lucide-react";
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
import { useOrganization } from "@/hooks/useOrganization";

const Orders = () => {
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useOrganization();
  const [orders, setOrders] = useState<any[]>([]);
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
        >
          <SearchInput
            value={filters.search}
            onChange={(value) => setFilters({ ...filters, search: value })}
            placeholder="Buscar por pedido, cliente ou pacote..."
          />
          <StatusFilter
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
          <DateRangeFilter
            label="Data da Viagem"
            startDate={filters.dateStart}
            endDate={filters.dateEnd}
            onStartChange={(value) => setFilters({ ...filters, dateStart: value })}
            onEndChange={(value) => setFilters({ ...filters, dateEnd: value })}
          />
          <ValueRangeFilter
            minValue={filters.minValue}
            maxValue={filters.maxValue}
            onMinChange={(value) => setFilters({ ...filters, minValue: value })}
            onMaxChange={(value) => setFilters({ ...filters, maxValue: value })}
          />
        </FilterBar>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Pedidos</CardTitle>
            <CardDescription>Todos os pedidos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.customers?.full_name}</TableCell>
                    <TableCell>{order.travel_packages?.name}</TableCell>
                    <TableCell>
                      {new Date(order.travel_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      R$ {Number(order.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
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
                          <DropdownMenuItem asChild>
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
