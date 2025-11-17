import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, DollarSign, CreditCard, Edit, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { FilterBar } from "@/components/filters/FilterBar";
import { SearchInput } from "@/components/filters/SearchInput";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { StatusFilter } from "@/components/filters/StatusFilter";
import { ValueRangeFilter } from "@/components/filters/ValueRangeFilter";
import { useOrganization } from "@/hooks/useOrganization";
import { PAYMENT_METHODS } from "@/lib/constants";

const Payments = () => {
  const navigate = useNavigate();
  const { organizationId } = useOrganization();
  const [payments, setPayments] = useState<any[]>([]);
  const [installments, setInstallments] = useState<Record<string, any[]>>({});
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isAddInstallmentOpen, setIsAddInstallmentOpen] = useState(false);
  const [isEditInstallmentOpen, setIsEditInstallmentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [installmentCount, setInstallmentCount] = useState("1");
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    dateStart: "",
    dateEnd: "",
    minValue: "",
    maxValue: "",
    paymentType: "all", // "all", "installments", "single"
  });

  useEffect(() => {
    if (organizationId) {
      loadPayments();
    }
  }, [organizationId]);

  useEffect(() => {
    payments.forEach(payment => {
      loadInstallments(payment.id);
    });
  }, [payments]);

  const loadPayments = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (!organizationId) {
      setPayments([]);
      return;
    }

    const { data, error } = await supabase
      .from("payments")
      .select("*, orders(order_number, customers(full_name))")
      .eq("organization_id", organizationId)
      .order("due_date", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar pagamentos");
      return;
    }
    setPayments(data || []);
  };

  const loadInstallments = async (paymentId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (!organizationId) return;

    const { data, error } = await supabase
      .from("installments")
      .select("*")
      .eq("payment_id", paymentId)
      .eq("organization_id", organizationId)
      .order("installment_number", { ascending: true });

    if (!error && data) {
      setInstallments(prev => ({ ...prev, [paymentId]: data }));
    }
  };

  const handleAddInstallments = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const count = parseInt(installmentCount);
    const totalAmount = selectedPayment.amount;
    const installmentAmount = totalAmount / count;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }

    const installmentsToCreate = Array.from({ length: count }, (_, i) => ({
      payment_id: selectedPayment.id,
      installment_number: i + 1,
      total_installments: count,
      amount: installmentAmount,
      due_date: new Date(new Date(selectedPayment.due_date).setMonth(new Date(selectedPayment.due_date).getMonth() + i)).toISOString().split('T')[0],
      status: "pending" as const,
      organization_id: organizationId,
      created_by: session.user.id
    }));

    const { error } = await supabase.from("installments").insert(installmentsToCreate);

    if (error) {
      toast.error("Erro ao criar parcelamentos");
      return;
    }

    toast.success("Parcelamentos criados com sucesso");
    setIsAddInstallmentOpen(false);
    loadInstallments(selectedPayment.id);
    loadPayments();
  };

  const handleUpdateInstallment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from("installments")
      .update({
        status: formData.get("status") as "pending" | "paid" | "overdue" | "partial",
        payment_date: (formData.get("payment_date") as string) || null,
        payment_method: (formData.get("payment_method") as string) || null,
        notes: (formData.get("notes") as string) || null,
      })
      .eq("id", selectedInstallment.id);

    if (error) {
      toast.error("Erro ao atualizar parcela");
      return;
    }

    toast.success("Parcela atualizada com sucesso");
    setIsEditInstallmentOpen(false);
    loadInstallments(selectedInstallment.payment_id);
    loadPayments();
  };

  const togglePaymentExpansion = (paymentId: string) => {
    setExpandedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "secondary",
      partial: "outline",
      paid: "default",
      overdue: "destructive",
    };
    const labels: any = {
      pending: "Pendente",
      partial: "Parcial",
      paid: "Pago",
      overdue: "Atrasado",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const getTotalPaid = (paymentId: string) => {
    const paymentInstallments = installments[paymentId] || [];
    return paymentInstallments
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.amount), 0);
  };

  const getOverdueCount = (paymentId: string) => {
    const paymentInstallments = installments[paymentId] || [];
    return paymentInstallments.filter(i => 
      (i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date()))
    ).length;
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        !filters.search ||
        payment.orders?.order_number?.toLowerCase().includes(searchLower) ||
        payment.orders?.customers?.full_name?.toLowerCase().includes(searchLower);

      const matchesStatus = filters.status === "all" || payment.status === filters.status;

      const dueDate = new Date(payment.due_date);
      const matchesDateStart =
        !filters.dateStart || dueDate >= new Date(filters.dateStart);
      const matchesDateEnd = !filters.dateEnd || dueDate <= new Date(filters.dateEnd);

      const paymentAmount = Number(payment.amount);
      const matchesMinValue =
        !filters.minValue || paymentAmount >= Number(filters.minValue);
      const matchesMaxValue =
        !filters.maxValue || paymentAmount <= Number(filters.maxValue);

      const paymentInstallments = installments[payment.id] || [];
      const hasInstallments = paymentInstallments.length > 0;
      const matchesPaymentType =
        filters.paymentType === "all" ||
        (filters.paymentType === "installments" && hasInstallments) ||
        (filters.paymentType === "single" && !hasInstallments);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDateStart &&
        matchesDateEnd &&
        matchesMinValue &&
        matchesMaxValue &&
        matchesPaymentType
      );
    });
  }, [payments, filters, installments]);

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
      paymentType: "all",
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
            <div className="w-10 h-10 bg-gradient-to-r from-success to-accent rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Contas a Receber</h1>
              <p className="text-sm text-muted-foreground">Controle financeiro e inadimplência</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <FilterBar
          onClear={clearFilters}
          activeFiltersCount={activeFiltersCount}
          resultsCount={filteredPayments.length}
          totalCount={payments.length}
        >
          <SearchInput
            value={filters.search}
            onChange={(value) => setFilters({ ...filters, search: value })}
            placeholder="Buscar por pedido ou cliente..."
          />
          <StatusFilter
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={[
              { value: "all", label: "Todos" },
              { value: "pending", label: "Pendente" },
              { value: "partial", label: "Parcial" },
              { value: "paid", label: "Pago" },
              { value: "overdue", label: "Atrasado" },
            ]}
          />
          <DateRangeFilter
            label="Vencimento"
            startDate={filters.dateStart}
            endDate={filters.dateEnd}
            onStartChange={(value) => setFilters({ ...filters, dateStart: value })}
            onEndChange={(value) => setFilters({ ...filters, dateEnd: value })}
          />
          <StatusFilter
            value={filters.paymentType}
            onChange={(value) => setFilters({ ...filters, paymentType: value })}
            options={[
              { value: "all", label: "Todos os tipos" },
              { value: "single", label: "À vista" },
              { value: "installments", label: "Parcelado" },
            ]}
            label="Tipo de Pagamento"
            placeholder="Todos os tipos"
          />
        </FilterBar>

        <Card>
          <CardHeader>
            <CardTitle>Pagamentos e Parcelamentos</CardTitle>
            <CardDescription>Acompanhe os pagamentos, parcelas e inadimplência dos clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => {
                  const paymentInstallments = installments[payment.id] || [];
                  const hasInstallments = paymentInstallments.length > 0;
                  const isExpanded = expandedPayments.has(payment.id);
                  const overdueCount = getOverdueCount(payment.id);

                  return (
                    <>
                      <TableRow key={payment.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          {hasInstallments && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePaymentExpansion(payment.id)}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{payment.orders?.order_number}</TableCell>
                        <TableCell>{payment.orders?.customers?.full_name}</TableCell>
                        <TableCell>
                          R$ {Number(payment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>R$ {getTotalPaid(payment.id).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            {hasInstallments && (
                              <span className="text-xs text-muted-foreground">
                                {paymentInstallments.filter(i => i.status === 'paid').length}/{paymentInstallments.length} parcelas
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(payment.due_date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            {getStatusBadge(payment.status)}
                            {overdueCount > 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasInstallments ? (
                            <span>{paymentInstallments.length}x</span>
                          ) : (
                            <span className="text-muted-foreground">À vista</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!hasInstallments && (
                            <Dialog open={isAddInstallmentOpen && selectedPayment?.id === payment.id} onOpenChange={(open) => {
                              setIsAddInstallmentOpen(open);
                              if (open) setSelectedPayment(payment);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <CreditCard className="w-4 h-4" />
                                  Parcelar
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Criar Parcelamento</DialogTitle>
                                  <DialogDescription>
                                    Divida o pagamento em parcelas mensais
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleAddInstallments} className="space-y-4">
                                  <div>
                                    <Label>Valor Total</Label>
                                    <p className="text-lg font-semibold">
                                      R$ {Number(payment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div>
                                    <Label htmlFor="installment_count">Número de Parcelas</Label>
                                    <Select value={installmentCount} onValueChange={setInstallmentCount}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                                          <SelectItem key={num} value={num.toString()}>
                                            {num}x de R$ {(Number(payment.amount) / num).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button type="button" variant="outline" onClick={() => setIsAddInstallmentOpen(false)}>
                                      Cancelar
                                    </Button>
                                    <Button type="submit">Criar Parcelas</Button>
                                  </div>
                                </form>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasInstallments && paymentInstallments.map((installment) => (
                        <TableRow key={installment.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={2} className="pl-12">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">
                                Parcela {installment.installment_number}/{installment.total_installments}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            R$ {Number(installment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {installment.payment_date
                              ? `R$ ${Number(installment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {new Date(installment.due_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>{getStatusBadge(installment.status)}</TableCell>
                          <TableCell>
                            {installment.payment_method || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog open={isEditInstallmentOpen && selectedInstallment?.id === installment.id} onOpenChange={(open) => {
                              setIsEditInstallmentOpen(open);
                              if (open) setSelectedInstallment(installment);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Parcela</DialogTitle>
                                  <DialogDescription>
                                    Parcela {installment.installment_number}/{installment.total_installments}
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleUpdateInstallment} className="space-y-4">
                                  <div>
                                    <Label>Valor</Label>
                                    <p className="text-lg font-semibold">
                                      R$ {Number(installment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div>
                                    <Label htmlFor="status">Status</Label>
                                    <Select name="status" defaultValue={installment.status}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="paid">Pago</SelectItem>
                                        <SelectItem value="overdue">Atrasado</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="payment_date">Data de Pagamento</Label>
                                    <Input
                                      type="date"
                                      name="payment_date"
                                      defaultValue={installment.payment_date || ""}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="payment_method">Método de Pagamento</Label>
                                    <Select name="payment_method" defaultValue={installment.payment_method || ""}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione o método" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {PAYMENT_METHODS.map((method) => (
                                          <SelectItem key={method.value} value={method.value}>
                                            {method.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor="notes">Observações</Label>
                                    <Input
                                      name="notes"
                                      placeholder="Observações sobre o pagamento"
                                      defaultValue={installment.notes || ""}
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button type="button" variant="outline" onClick={() => setIsEditInstallmentOpen(false)}>
                                      Cancelar
                                    </Button>
                                    <Button type="submit">Salvar</Button>
                                  </div>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
                {filteredPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {payments.length === 0
                        ? "Nenhum pagamento registrado ainda"
                        : "Nenhum pagamento encontrado com os filtros aplicados"}
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

export default Payments;
