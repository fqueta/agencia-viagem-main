import { useEffect, useState, useMemo, useRef } from "react";
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
import { ArrowLeft, DollarSign, CreditCard, Edit, AlertCircle, CalendarDays, Search } from "lucide-react";
import { toast } from "sonner";
import { FilterBar } from "@/components/filters/FilterBar";
import { SearchInput } from "@/components/filters/SearchInput";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { StatusFilter } from "@/components/filters/StatusFilter";
import { ValueRangeFilter } from "@/components/filters/ValueRangeFilter";
import { useOrganization } from "@/hooks/useOrganization";
import { PAYMENT_METHODS } from "@/lib/constants";

/**
 * Página Contas a Receber com filtros padronizados e grade 12-colunas.
 * EN: Accounts Receivable page with standardized filter labels and 12-column grid.
 */
const Payments = () => {
  const navigate = useNavigate();
  const { organizationId } = useOrganization();
  const [payments, setPayments] = useState<any[]>([]);
  const [installments, setInstallments] = useState<Record<string, any[]>>({});
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isAddInstallmentOpen, setIsAddInstallmentOpen] = useState(false);
  const [isEditInstallmentOpen, setIsEditInstallmentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [isEditPaymentDateOpen, setIsEditPaymentDateOpen] = useState(false);
  const [paymentDateOnly, setPaymentDateOnly] = useState<string>("");
  const [isEditDueDateOpen, setIsEditDueDateOpen] = useState(false);
  const [dueDateOnly, setDueDateOnly] = useState<string>("");
  // Dialog de lançamento de pagamento (igual ao OrderView)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentDateInput, setPaymentDateInput] = useState<string>("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>("");
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

  /**
   * Debounce e utilitários de máscara BRL para edição inline.
   * EN: Debounce and BRL currency mask utilities for inline editing.
   */
  const DEBOUNCE_MS = 600;
  const amountDebounceRef = useRef<number | null>(null);
  const dueDateDebounceRef = useRef<number | null>(null);

  /**
   * Formata um número para moeda brasileira (BRL) para exibição em inputs.
   * EN: Formats a number as Brazilian currency (BRL) for input display.
   */
  const formatCurrencyBRL = (value: number): string => {
    if (value === null || value === undefined || isNaN(value)) return "";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  /**
   * Aplica máscara de moeda ao texto digitado e retorna valor numérico em reais.
   * EN: Applies currency mask to typed text and returns numeric value in BRL.
   */
  const parseMaskedCurrency = (raw: string): { display: string; value: number } => {
    const digits = raw.replace(/\D/g, "");
    const numeric = Number(digits) / 100; // cents to reais
    const display = formatCurrencyBRL(numeric);
    return { display, value: numeric };
  };

  /**
   * Redistribui um valor total igualmente entre N parcelas com precisão de 2 casas.
   * EN: Evenly distributes a total amount across N installments with 2-decimal precision.
   * Garante que a soma final seja exatamente igual ao total, espalhando os centavos restantes.
   */
  const distributeEvenly = (total: number, n: number): number[] => {
    if (n <= 0) return [];
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / n);
    const remainder = cents - base * n; // número de parcelas que recebem +0.01
    const result: number[] = Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
    return result;
  };

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

  /**
   * Atualiza a parcela selecionada, permitindo editar status,
   * data de pagamento, método de pagamento, notas e vencimento.
   * EN: Unified handler to update selected installment fields.
   */
  const handleUpdateInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;

    const { error } = await supabase
      .from("installments")
      .update({
        status: selectedInstallment.status,
        payment_date: selectedInstallment.payment_date,
        due_date: selectedInstallment.due_date,
        payment_method: selectedInstallment.payment_method,
        notes: selectedInstallment.notes,
      })
      .eq("id", selectedInstallment.id);

    if (error) {
      toast.error("Erro ao atualizar parcela");
      return;
    }

    toast.success("Parcela atualizada!");
    setIsEditInstallmentOpen(false);
    if (selectedInstallment?.payment_id) {
      loadInstallments(selectedInstallment.payment_id);
    }
  };

  /**
   * handleLaunchPayment
   *
   * PT-BR: Lança pagamento para a parcela selecionada, definindo data, método
   * e marcando o status como "paid". Atualiza o estado local e recalcula o
   * status do pagamento principal (paid/partial).
   * EN: Launches a payment for the selected installment, setting date, method
   * and marking the status as "paid". Updates local state and recalculates the
   * main payment status (paid/partial).
   */
  const handleLaunchPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment || !selectedPayment) return;

    const effectiveDate = paymentDateInput || new Date().toISOString().split("T")[0];
    const effectiveMethod = paymentMethodInput || selectedInstallment.payment_method || "cash";

    const { error } = await supabase
      .from("installments")
      .update({
        status: "paid",
        payment_date: effectiveDate,
        payment_method: effectiveMethod,
      })
      .eq("id", selectedInstallment.id);

    if (error) {
      toast.error("Erro ao lançar pagamento: " + error.message);
      return;
    }

    // Atualiza estado local das parcelas do pagamento atual
    setInstallments((prev) => {
      const arr = prev[selectedPayment.id] || [];
      const nextArr = arr.map((i) =>
        i.id === selectedInstallment.id
          ? { ...i, status: "paid", payment_date: effectiveDate, payment_method: effectiveMethod }
          : i
      );
      return { ...prev, [selectedPayment.id]: nextArr };
    });

    // Recalcula e atualiza status do pagamento principal
    const current = installments[selectedPayment.id] || [];
    const updatedAll = current.map((i) =>
      i.id === selectedInstallment.id
        ? { ...i, status: "paid", payment_date: effectiveDate, payment_method: effectiveMethod }
        : i
    );
    const allPaid = updatedAll.every((i) => i.status === "paid");
    const newStatus = allPaid ? "paid" : "partial";

    const { error: payErr } = await supabase
      .from("payments")
      .update({ status: newStatus })
      .eq("id", selectedPayment.id);

    if (payErr) {
      toast.error("Pagamento lançado, mas falhou ao atualizar status geral: " + payErr.message);
    } else {
      setPayments((prev) => prev.map((p) => (p.id === selectedPayment.id ? { ...p, status: newStatus } : p)));
    }

    toast.success("Pagamento lançado com sucesso");
    setIsPaymentDialogOpen(false);
    setPaymentDateInput("");
    setPaymentMethodInput("");
  };

  /**
   * Atualiza o valor (amount) da parcela de forma inline com redistribuição.
   * EN: Inline amount update with redistribution across open installments.
   */
  const handleInlineAmountChange = async (installmentId: string, paymentId: string, newAmount: number) => {
    const paymentInstallments = installments[paymentId] || [];
    const target = paymentInstallments.find((i) => i.id === installmentId);
    if (target && target.status === "paid") return;
    if (isNaN(newAmount)) return;
    const rounded = Math.round(newAmount * 100) / 100;

    const { error } = await supabase
      .from("installments")
      .update({ amount: rounded })
      .eq("id", installmentId);

    if (error) {
      toast.error("Erro ao atualizar valor");
      return;
    }

    const paymentObj = payments.find((p) => p.id === paymentId);
    if (!paymentObj) return;

    const paidSum = paymentInstallments
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const openOthers = paymentInstallments.filter((i) => i.status !== "paid" && i.id !== installmentId);
    const remainingRaw = Number(paymentObj.amount) - paidSum - rounded;
    const remaining = Math.max(0, Math.round(remainingRaw * 100) / 100);

    if (remainingRaw < 0) {
      toast.error("Valor excede o total do pagamento. Demais parcelas ajustadas para 0.");
    }

    if (openOthers.length > 0) {
      const distributed = distributeEvenly(remaining, openOthers.length);
      const updates = openOthers.map((i, idx) => ({ id: i.id, amount: distributed[idx] }));
      const results = await Promise.all(
        updates.map((u) => supabase.from("installments").update({ amount: u.amount }).eq("id", u.id))
      );
      const updateError = results.find((r: any) => r.error)?.error;
      if (updateError) {
        toast.error("Erro ao redistribuir parcelas");
      }

      // Atualiza estado local apenas do grupo deste pagamento
      setInstallments((prev) => {
        const arr = prev[paymentId] || [];
        const nextArr = arr.map((i) => {
          if (i.id === installmentId) return { ...i, amount: rounded };
          const found = updates.find((u) => u.id === i.id);
          return found ? { ...i, amount: found.amount } : i;
        });
        return { ...prev, [paymentId]: nextArr };
      });
    } else {
      setInstallments((prev) => {
        const arr = prev[paymentId] || [];
        const nextArr = arr.map((i) => (i.id === installmentId ? { ...i, amount: rounded } : i));
        return { ...prev, [paymentId]: nextArr };
      });
    }
  };

  /**
   * Atualiza o vencimento (due_date) de uma parcela de forma inline.
   * EN: Inline due date update.
   */
  const handleInlineDueDateChange = async (installmentId: string, paymentId: string, newDate: string) => {
    const paymentInstallments = installments[paymentId] || [];
    const target = paymentInstallments.find((i) => i.id === installmentId);
    if (target && target.status === "paid") return;
    if (!newDate) return;

    const { error } = await supabase
      .from("installments")
      .update({ due_date: newDate })
      .eq("id", installmentId);

    if (error) {
      toast.error("Erro ao atualizar vencimento");
      return;
    }
  };

  /**
   * Agenda atualização debounced do valor da parcela.
   */
  const queueAmountUpdate = (installmentId: string, paymentId: string, newAmount: number) => {
    if (amountDebounceRef.current) clearTimeout(amountDebounceRef.current);
    amountDebounceRef.current = window.setTimeout(() => {
      handleInlineAmountChange(installmentId, paymentId, newAmount);
    }, DEBOUNCE_MS);
  };

  /**
   * Agenda atualização debounced do vencimento da parcela.
   */
  const queueDueDateUpdate = (installmentId: string, paymentId: string, newDate: string) => {
    if (dueDateDebounceRef.current) clearTimeout(dueDateDebounceRef.current);
    dueDateDebounceRef.current = window.setTimeout(() => {
      handleInlineDueDateChange(installmentId, paymentId, newDate);
    }, DEBOUNCE_MS);
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

  /**
   * Atualiza dados da parcela, incluindo data de vencimento.
   *
   * PT-BR: Permite editar status, data de vencimento (due_date),
   * data de pagamento, método de pagamento e observações.
   * EN: Updates installment details including due date, payment date,
   * payment method, and notes.
   */
  // Removido: handler baseado em FormData duplicado.

  /**
   * Atualiza apenas a data de pagamento de uma parcela.
   *
   * PT-BR: Permite editar somente a data de pagamento sem alterar o status da parcela.
   * EN: Allows editing only the payment date without changing the installment status.
   */
  const handleUpdatePaymentDateOnly = async () => {
    if (!selectedInstallment) return;
    // PT-BR: Bloqueia edição quando a parcela está marcada como "paga".
    // EN: Prevent editing when installment status is "paid".
    if (selectedInstallment.status === "paid") {
      toast.warning("Esta parcela está paga e não pode ser editada.");
      return;
    }

    const { error } = await supabase
      .from("installments")
      .update({ payment_date: paymentDateOnly || null })
      .eq("id", selectedInstallment.id);

    if (error) {
      toast.error("Erro ao atualizar data de pagamento");
      return;
    }

    toast.success("Data de pagamento atualizada");
    setIsEditPaymentDateOpen(false);
    loadInstallments(selectedInstallment.payment_id);
    loadPayments();
  };

  /**
   * Atualiza apenas a data de vencimento de uma parcela.
   *
   * PT-BR: Permite editar somente o vencimento (due_date) sem alterar o status.
   * EN: Updates only the due date without changing the installment status.
   */
  const handleUpdateDueDateOnly = async () => {
    if (!selectedInstallment) return;
    // PT-BR: Bloqueia edição quando a parcela está marcada como "paga".
    // EN: Prevent editing when installment status is "paid".
    if (selectedInstallment.status === "paid") {
      toast.warning("Esta parcela está paga e não pode ser editada.");
      return;
    }

    const { error } = await supabase
      .from("installments")
      .update({ due_date: dueDateOnly })
      .eq("id", selectedInstallment.id);

    if (error) {
      toast.error("Erro ao atualizar vencimento");
      return;
    }

    toast.success("Vencimento atualizado");
    setIsEditDueDateOpen(false);
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
              placeholder="Buscar por pedido ou cliente..."
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
                { value: "partial", label: "Parcial" },
                { value: "paid", label: "Pago" },
                { value: "overdue", label: "Atrasado" },
              ]}
            />
          </div>
          <div className="lg:col-span-3">
            <DateRangeFilter
              label="Vencimento"
              startDate={filters.dateStart}
              endDate={filters.dateEnd}
              onStartChange={(value) => setFilters({ ...filters, dateStart: value })}
              onEndChange={(value) => setFilters({ ...filters, dateEnd: value })}
            />
          </div>
          <div className="lg:col-span-3">
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
          </div>
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
                          {formatDateOnlyDisplay(payment.due_date)}
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
                            <Input
                              type="text"
                              inputMode="numeric"
                              className="w-40"
                              value={formatCurrencyBRL(Number(installment.amount))}
                              disabled={installment.status === "paid"}
                              onChange={(e) => {
                                const masked = parseMaskedCurrency(e.target.value);
                                setInstallments((prev) => {
                                  const arr = prev[payment.id] || [];
                                  const nextArr = arr.map((i) => (i.id === installment.id ? { ...i, amount: masked.value } : i));
                                  return { ...prev, [payment.id]: nextArr };
                                });
                                queueAmountUpdate(installment.id, payment.id, masked.value);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {installment.payment_date
                              ? `R$ ${Number(installment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="w-40"
                              value={installment.due_date || ""}
                              disabled={installment.status === "paid"}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                setInstallments((prev) => {
                                  const arr = prev[payment.id] || [];
                                  const nextArr = arr.map((i) => (i.id === installment.id ? { ...i, due_date: val } : i));
                                  return { ...prev, [payment.id]: nextArr };
                                });
                                queueDueDateUpdate(installment.id, payment.id, val);
                              }}
                            />
                          </TableCell>
                          <TableCell>{getStatusBadge(installment.status)}</TableCell>
                          <TableCell>
                            {installment.payment_method || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {/* Editar parcela */}
                            <Dialog open={isEditInstallmentOpen && selectedInstallment?.id === installment.id} onOpenChange={(open) => {
                              setIsEditInstallmentOpen(open);
                              if (open) setSelectedInstallment(installment);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="Editar parcela (status editável quando pago)">
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
                                      {formatCurrencyBRL(Number(selectedInstallment?.amount ?? installment.amount))}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <Select
                                      value={selectedInstallment?.status ?? installment.status}
                                      onValueChange={(value) =>
                                        setSelectedInstallment({ ...selectedInstallment, status: value })
                                      }
                                    >
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
                                    <Label>Data de Vencimento</Label>
                                    <Input
                                      type="date"
                                      value={(selectedInstallment?.due_date ?? installment.due_date) || ""}
                                      onChange={(e) =>
                                        setSelectedInstallment({ ...selectedInstallment, due_date: e.target.value })
                                      }
                                      disabled={(selectedInstallment?.status ?? installment.status) === "paid"}
                                    />
                                  </div>
                                  <div>
                                    <Label>Data de Pagamento</Label>
                                    <Input
                                      type="date"
                                      value={(selectedInstallment?.payment_date ?? installment.payment_date) || ""}
                                      onChange={(e) =>
                                        setSelectedInstallment({ ...selectedInstallment, payment_date: e.target.value })
                                      }
                                      disabled={(selectedInstallment?.status ?? installment.status) === "paid"}
                                    />
                                  </div>
                                  <div>
                                    <Label>Método de Pagamento</Label>
                                    <Select
                                      value={(selectedInstallment?.payment_method ?? installment.payment_method) || ""}
                                      onValueChange={(value) =>
                                        setSelectedInstallment({ ...selectedInstallment, payment_method: value })
                                      }
                                      disabled={(selectedInstallment?.status ?? installment.status) === "paid"}
                                    >
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
                                    <Label>Observações</Label>
                                    <Input
                                      placeholder="Observações sobre o pagamento"
                                      value={(selectedInstallment?.notes ?? installment.notes) || ""}
                                      onChange={(e) =>
                                        setSelectedInstallment({ ...selectedInstallment, notes: e.target.value })
                                      }
                                      disabled={(selectedInstallment?.status ?? installment.status) === "paid"}
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
                            {/* Lançar pagamento (igual ao OrderView) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Lançar pagamento"
                              onClick={() => {
                                setSelectedInstallment(installment);
                                setSelectedPayment(payment);
                                setPaymentDateInput(installment.payment_date || new Date().toISOString().split("T")[0]);
                                setPaymentMethodInput(installment.payment_method || "");
                                setIsPaymentDialogOpen(true);
                              }}
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
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
        {/* Diálogo de Lançamento de Pagamento (padronizado com OrderView) */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lançar Pagamento</DialogTitle>
              <DialogDescription>
                Defina a data e o método de pagamento para a parcela selecionada.
              </DialogDescription>
            </DialogHeader>
            {selectedInstallment && (
              <form onSubmit={handleLaunchPayment} className="space-y-4">
                <div>
                  <Label>Data de Pagamento</Label>
                  <Input
                    type="date"
                    value={paymentDateInput}
                    onChange={(e) => setPaymentDateInput(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Método de Pagamento</Label>
                  <Select
                    value={paymentMethodInput}
                    onValueChange={(value) => setPaymentMethodInput(value)}
                  >
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
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Payments;

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
