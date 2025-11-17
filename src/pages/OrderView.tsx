import { useEffect, useState } from "react";
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
import { ArrowLeft, Edit, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderDeleteDialog } from "@/components/orders/OrderDeleteDialog";
import { useOrganization } from "@/hooks/useOrganization";
import { PAYMENT_METHODS } from "@/lib/constants";

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
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [editInstallmentOpen, setEditInstallmentOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [installmentCount, setInstallmentCount] = useState(2);

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

  const handleUpdateInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;

    const { error } = await supabase
      .from("installments")
      .update({
        status: selectedInstallment.status as "pending" | "paid" | "overdue" | "partial",
        payment_date: selectedInstallment.payment_date,
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
            {order && (
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
            )}
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
                            <TableCell>R$ {inst.amount.toFixed(2)}</TableCell>
                            <TableCell>{format(new Date(inst.due_date), "dd/MM/yyyy")}</TableCell>
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
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={selectedInstallment.payment_date || ""}
                  onChange={(e) =>
                    setSelectedInstallment({ ...selectedInstallment, payment_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Método de Pagamento</Label>
                <Select
                  value={selectedInstallment.payment_method || ""}
                  onValueChange={(value) =>
                    setSelectedInstallment({ ...selectedInstallment, payment_method: value })
                  }
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
                />
              </div>
              <Button type="submit" className="w-full">
                Salvar
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderView;
