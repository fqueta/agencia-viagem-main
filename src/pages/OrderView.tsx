import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Plus, Trash2, CalendarDays, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderDeleteDialog } from "@/components/orders/OrderDeleteDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganization } from "@/hooks/useOrganization";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  number_of_travelers: number;
  travel_date: string;
  special_requests: string | null;
  customer: { full_name: string; phone: string; email: string };
  package: { name: string; destination: string };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
}

interface Installment {
  id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
}

const OrderView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const { isOrgAdmin, role, isAgent } = useOrganizationRole();
  // Pode excluir: admin/owner ou agent (inclui fallback de role de sistema)
  const canDelete = isOrgAdmin || isAgent;
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [editInstallmentOpen, setEditInstallmentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [isEditDueDateOpen, setIsEditDueDateOpen] = useState(false);
  const [dueDateOnly, setDueDateOnly] = useState<string>("");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentDateInput, setPaymentDateInput] = useState<string>("");
  const [paymentMethodInput, setPaymentMethodInput] = useState<string>("");
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
    loadOrderData();
  }, [id]);

  const loadOrderData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: orderData } = await supabase
      .from("orders")
      .select(`
        *,
        customer:customers(full_name, phone, email),
        package:travel_packages(name, destination)
      `)
      .eq("id", id)
      .single();

    if (orderData) {
      setOrder(orderData as unknown as OrderDetails);
      loadPaymentData(orderData.id);
    }
  };

  const loadPaymentData = async (orderId: string) => {
    const { data: paymentData } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (paymentData) {
      setPayment(paymentData as Payment);
      loadInstallments(paymentData.id);
    }
  };

  const loadInstallments = async (paymentId: string) => {
    const { data } = await supabase
      .from("installments")
      .select("*")
      .eq("payment_id", paymentId)
      .order("installment_number");

    if (data) setInstallments(data as Installment[]);
  };

  const handleCreateInstallments = async () => {
    if (!payment) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!organizationId) {
      toast({
        title: "Erro",
        description: "Organização não encontrada",
        variant: "destructive",
      });
      return;
    }

    const amountPerInstallment = payment.amount / installmentCount;
    const baseDate = new Date(payment.due_date);

    const newInstallments = Array.from({ length: installmentCount }, (_, i) => {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      return {
        payment_id: payment.id,
        installment_number: i + 1,
        total_installments: installmentCount,
        amount: amountPerInstallment,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending" as "pending" | "paid" | "overdue" | "partial",
        organization_id: organizationId,
        created_by: user.id,
      };
    });

    const { error } = await supabase.from("installments").insert(newInstallments);

    if (error) {
      toast({
        title: "Erro ao criar parcelas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Parcelas criadas com sucesso!" });
      setInstallmentDialogOpen(false);
      loadInstallments(payment.id);
    }
  };

  /**
   * Atualiza a parcela selecionada, permitindo editar status,
   * data de pagamento, método de pagamento, notas e agora também
   * a data de vencimento (due_date).
   */
  const handleUpdateInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;

    const { error } = await supabase
      .from("installments")
      .update({
        status: selectedInstallment.status as "pending" | "paid" | "overdue" | "partial",
        payment_date: selectedInstallment.payment_date,
        due_date: selectedInstallment.due_date,
        payment_method: selectedInstallment.payment_method,
        notes: selectedInstallment.notes,
      })
      .eq("id", selectedInstallment.id);

    if (error) {
      toast({
        title: "Erro ao atualizar parcela",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Parcela atualizada!" });
      setEditInstallmentOpen(false);
      if (payment) loadInstallments(payment.id);
    }
  };

  /**
   * Atualiza apenas o campo de vencimento (due_date) da parcela selecionada.
   * Não altera status, payment_date, método ou notas.
   */
  const handleUpdateDueDateOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;

    const { error } = await supabase
      .from("installments")
      .update({ due_date: dueDateOnly })
      .eq("id", selectedInstallment.id);

    if (error) {
      toast({
        title: "Erro ao atualizar vencimento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Vencimento atualizado!" });
      setIsEditDueDateOpen(false);
      if (payment) loadInstallments(payment.id);
    }
  };

  /**
   * Lança pagamento para a parcela selecionada, definindo data, método
   * e marcando o status como "paid". Após salvar, atualiza o estado local
   * e recalcula o status do pagamento principal (paid/partial).
   * EN: Launches a payment for the selected installment, setting date, method
   * and marking the status as "paid". After saving, updates local state and
   * recalculates the main payment status (paid/partial).
   */
  const handleLaunchPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment || !payment) return;

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
      toast({ title: "Erro ao lançar pagamento", description: error.message, variant: "destructive" });
      return;
    }

    // Atualiza estado local
    setInstallments((prev) => prev.map((i) => (
      i.id === selectedInstallment.id ? { ...i, status: "paid", payment_date: effectiveDate, payment_method: effectiveMethod } : i
    )));

    // Recalcula status do pagamento principal
    const allPaid = installments.every((i) => (i.id === selectedInstallment.id ? true : i.status === "paid"));
    const newStatus = allPaid ? "paid" : "partial";
    const { error: payErr } = await supabase
      .from("payments")
      .update({ status: newStatus })
      .eq("id", payment.id);

    if (payErr) {
      toast({ title: "Pagamento atualizado, mas falhou status geral", description: payErr.message, variant: "destructive" });
    } else {
      setPayment((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    toast({ title: "Pagamento lançado com sucesso" });
    setIsPaymentDialogOpen(false);
    setPaymentDateInput("");
    setPaymentMethodInput("");
  };

  /**
   * Atualiza o valor (amount) de uma parcela de forma inline.
   * Recebe o id da parcela e o novo valor numérico.
   */
  const handleInlineAmountChange = async (installmentId: string, newAmount: number) => {
    // Bloqueia edição para parcelas pagas e garante número válido com duas casas
    const target = installments.find((i) => i.id === installmentId);
    if (target && target.status === "paid") return;
    if (isNaN(newAmount)) return;
    const rounded = Math.round(newAmount * 100) / 100;

    const { error } = await supabase
      .from("installments")
      .update({ amount: rounded })
      .eq("id", installmentId);

    if (error) {
      toast({ title: "Erro ao atualizar valor", description: error.message, variant: "destructive" });
      return;
    }

    // PT-BR: Após editar o valor de uma parcela, redistribui o restante
    // entre as parcelas em aberto (status diferente de 'paid') para refletir o
    // restante não quitado do pagamento principal.
    // EN: After editing one installment, redistribute the remaining unpaid
    // amount across other open installments (status not 'paid').
    if (!payment) return;

    const paidSum = installments
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const openOthers = installments.filter((i) => i.status !== "paid" && i.id !== installmentId);
    const remainingRaw = Number(payment.amount) - paidSum - rounded;
    const remaining = Math.max(0, Math.round(remainingRaw * 100) / 100);

    if (remainingRaw < 0) {
      toast({
        title: "Valor excede o total do pagamento",
        description: "O restante foi ajustado para 0 nas demais parcelas.",
        variant: "destructive",
      });
    }

    if (openOthers.length > 0) {
      const distributed = distributeEvenly(remaining, openOthers.length);

      // Atualiza em lote no banco (um update por parcela)
      const updates = openOthers.map((i, idx) => ({ id: i.id, amount: distributed[idx] }));
      const results = await Promise.all(
        updates.map((u) => supabase.from("installments").update({ amount: u.amount }).eq("id", u.id))
      );
      const updateError = results.find((r: any) => r.error)?.error;
      if (updateError) {
        toast({ title: "Erro ao redistribuir parcelas", description: updateError.message, variant: "destructive" });
      }

      // Atualiza estado local para refletir os novos valores imediatamente
      setInstallments((prev) =>
        prev.map((i) => {
          if (i.id === installmentId) {
            return { ...i, amount: rounded };
          }
          const found = updates.find((u) => u.id === i.id);
          return found ? { ...i, amount: found.amount } : i;
        })
      );
    } else {
      // Nenhuma outra parcela em aberto; apenas confirma o valor editado localmente
      setInstallments((prev) => prev.map((i) => (i.id === installmentId ? { ...i, amount: rounded } : i)));
    }
  };

  /**
   * Atualiza o vencimento (due_date) de uma parcela de forma inline.
   * Recebe o id da parcela e a nova data no formato YYYY-MM-DD.
   */
  const handleInlineDueDateChange = async (installmentId: string, newDate: string) => {
    const target = installments.find((i) => i.id === installmentId);
    if (target && target.status === "paid") return;
    if (!newDate) return;

    const { error } = await supabase
      .from("installments")
      .update({ due_date: newDate })
      .eq("id", installmentId);

    if (error) {
      toast({ title: "Erro ao atualizar vencimento", description: error.message, variant: "destructive" });
      return;
    }
  };

  /**
   * Agenda atualização debounced do valor da parcela, evitando múltiplas escritas.
   */
  const queueAmountUpdate = (installmentId: string, newAmount: number) => {
    if (amountDebounceRef.current) {
      clearTimeout(amountDebounceRef.current);
    }
    amountDebounceRef.current = window.setTimeout(() => {
      handleInlineAmountChange(installmentId, newAmount);
    }, DEBOUNCE_MS);
  };

  /**
   * Agenda atualização debounced do vencimento da parcela.
   */
  const queueDueDateUpdate = (installmentId: string, newDate: string) => {
    if (dueDateDebounceRef.current) {
      clearTimeout(dueDateDebounceRef.current);
    }
    dueDateDebounceRef.current = window.setTimeout(() => {
      handleInlineDueDateChange(installmentId, newDate);
    }, DEBOUNCE_MS);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      confirmed: "default",
      completed: "secondary",
      cancelled: "destructive",
      paid: "default",
      partial: "secondary",
      overdue: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
      paid: "Pago",
      partial: "Parcial",
      overdue: "Atrasado",
    };

    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  if (!order) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Pedido {order.order_number}</h1>
              <p className="text-muted-foreground">Detalhes e pagamentos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/orders/${id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar Pedido
            </Button>
            {order && (canDelete ? (
              <OrderDeleteDialog
                orderId={order.id}
                orderNumber={order.order_number}
                customerName={order.customer?.full_name || "N/A"}
                trigger={
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                }
              />
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" size="sm" disabled>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Sem permissão para excluir. Usuários com papel "viewer" não podem excluir.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(order.status)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pacote</p>
                <p className="font-medium">{order.package.name}</p>
                <p className="text-sm">{order.package.destination}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data da Viagem</p>
                <p className="font-medium">{format(new Date(order.travel_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Viajantes</p>
                <p className="font-medium">{order.number_of_travelers}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="font-medium text-lg">R$ {order.total_amount.toFixed(2)}</p>
              </div>
              {order.special_requests && (
                <div>
                  <p className="text-sm text-muted-foreground">Pedidos Especiais</p>
                  <p className="font-medium">{order.special_requests}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{order.customer.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{order.customer.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{order.customer.email}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Gestão de Pagamentos</CardTitle>
              {payment && installments.length === 0 && (
                <Dialog open={installmentDialogOpen} onOpenChange={setInstallmentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Parcelas
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Parcelas</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Número de Parcelas</Label>
                        <Input
                          type="number"
                          min="2"
                          max="12"
                          value={installmentCount}
                          onChange={(e) => setInstallmentCount(parseInt(e.target.value))}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Valor por parcela: R$ {(payment.amount / installmentCount).toFixed(2)}
                      </p>
                      <Button onClick={handleCreateInstallments} className="w-full">
                        Criar Parcelas
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {payment ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Pagamento Principal</p>
                    <p className="text-sm text-muted-foreground">Valor: R$ {payment.amount.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Vencimento: {format(new Date(payment.due_date), "dd/MM/yyyy")}</p>
                  </div>
                  {getStatusBadge(payment.status)}
                </div>

                {installments.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Parcelas</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {installments.map((inst) => (
                          <TableRow key={inst.id}>
                            <TableCell>{inst.installment_number}/{inst.total_installments}</TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="numeric"
                                className="w-40"
                                value={formatCurrencyBRL(inst.amount)}
                                disabled={inst.status === "paid"}
                                onChange={(e) => {
                                  const masked = parseMaskedCurrency(e.target.value);
                                  // Atualiza localmente valor numérico; exibição é controlada por formatCurrencyBRL
                                  setInstallments((prev) => prev.map((i) => (i.id === inst.id ? { ...i, amount: masked.value } : i)));
                                  // Agenda gravação debounced já com número em BRL
                                  queueAmountUpdate(inst.id, masked.value);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                className="w-40"
                                value={inst.due_date || ""}
                                disabled={inst.status === "paid"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  setInstallments((prev) => prev.map((i) => (i.id === inst.id ? { ...i, due_date: val } : i)));
                                  queueDueDateUpdate(inst.id, val);
                                }}
                              />
                            </TableCell>
                            <TableCell>{getStatusBadge(inst.status)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedInstallment(inst);
                                  setEditInstallmentOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedInstallment(inst);
                                  setPaymentDateInput(inst.payment_date || new Date().toISOString().split("T")[0]);
                                  setPaymentMethodInput(inst.payment_method || "");
                                  setIsPaymentDialogOpen(true);
                                }}
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum pagamento encontrado para este pedido.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editInstallmentOpen} onOpenChange={setEditInstallmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Parcela</DialogTitle>
          </DialogHeader>
          {selectedInstallment && (
            <form onSubmit={handleUpdateInstallment} className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={selectedInstallment.status}
                  onValueChange={(value: "pending" | "paid" | "overdue") =>
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
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={selectedInstallment.due_date || ""}
                  onChange={(e) =>
                    setSelectedInstallment({ ...selectedInstallment, due_date: e.target.value })
                  }
                  disabled={selectedInstallment.status === "paid"}
                />
              </div>
              <div>
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={selectedInstallment.payment_date || ""}
                  onChange={(e) =>
                    setSelectedInstallment({ ...selectedInstallment, payment_date: e.target.value })
                  }
                  disabled={selectedInstallment.status === "paid"}
                />
              </div>
              <div>
                <Label>Método de Pagamento</Label>
                <Select
                  value={selectedInstallment.payment_method || ""}
                  onValueChange={(value) =>
                    setSelectedInstallment({ ...selectedInstallment, payment_method: value })
                  }
                  disabled={selectedInstallment.status === "paid"}
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
                <Label>Notas</Label>
                <Textarea
                  value={selectedInstallment.notes || ""}
                  onChange={(e) =>
                    setSelectedInstallment({ ...selectedInstallment, notes: e.target.value })
                  }
                  disabled={selectedInstallment.status === "paid"}
                />
              </div>
              <Button type="submit" className="w-full">
                Salvar
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDueDateOpen} onOpenChange={setIsEditDueDateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vencimento</DialogTitle>
          </DialogHeader>
          {selectedInstallment && (
            <form onSubmit={handleUpdateInstallment} className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={selectedInstallment.status}>
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
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  name="due_date"
                  value={dueDateOnly}
                  onChange={(e) => setDueDateOnly(e.target.value)}
                  disabled={selectedInstallment.status === "paid"}
                />
              </div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar Pagamento</DialogTitle>
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
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderView;
