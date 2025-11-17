import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, DollarSign, Users, TrendingUp, Send, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FilterBar } from "@/components/filters/FilterBar";
import { SearchInput } from "@/components/filters/SearchInput";
import { StatusFilter } from "@/components/filters/StatusFilter";
import { ValueRangeFilter } from "@/components/filters/ValueRangeFilter";
import { useOrganization } from "@/hooks/useOrganization";

interface OverdueInstallment {
  id: string;
  amount: number;
  due_date: string;
  installment_number: number;
  total_installments: number;
  days_overdue: number;
  payment_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
}

interface DelinquencyStats {
  total_overdue: number;
  total_overdue_amount: number;
  total_customers: number;
  avg_days_overdue: number;
}

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--primary))'];

export default function Delinquency() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [overdueInstallments, setOverdueInstallments] = useState<OverdueInstallment[]>([]);
  const [stats, setStats] = useState<DelinquencyStats>({
    total_overdue: 0,
    total_overdue_amount: 0,
    total_customers: 0,
    avg_days_overdue: 0,
  });
  const [selectedInstallment, setSelectedInstallment] = useState<OverdueInstallment | null>(null);
  const [reminderMessage, setReminderMessage] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    riskLevel: "all",
    daysOverdueRange: "all",
    minValue: "",
    maxValue: "",
  });

  useEffect(() => {
    if (organizationId) {
      checkAuth();
    }
  }, [organizationId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    if (organizationId) {
      loadDelinquencyData(organizationId);
    }
  };

  const loadDelinquencyData = async (orgId: string) => {
    try {
      setLoading(true);

      // Fetch overdue installments with related data
      const { data: installments, error } = await supabase
        .from("installments")
        .select(`
          id,
          amount,
          due_date,
          installment_number,
          total_installments,
          payment_id,
          payments (
            order_id,
            orders (
              order_number,
              customer_id,
              customers (
                full_name,
                phone,
                email
              )
            )
          )
        `)
        .eq("organization_id", orgId)
        .in("status", ["pending", "overdue"])
        .lt("due_date", new Date().toISOString().split("T")[0])
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Transform data
      const overdueData: OverdueInstallment[] = (installments || []).map((inst: any) => {
        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return {
          id: inst.id,
          amount: inst.amount,
          due_date: inst.due_date,
          installment_number: inst.installment_number,
          total_installments: inst.total_installments,
          days_overdue: daysOverdue,
          payment_id: inst.payment_id,
          order_number: inst.payments?.orders?.order_number || "N/A",
          customer_name: inst.payments?.orders?.customers?.full_name || "N/A",
          customer_phone: inst.payments?.orders?.customers?.phone || "",
          customer_email: inst.payments?.orders?.customers?.email || "",
        };
      });

      setOverdueInstallments(overdueData);

      // Calculate stats
      const totalAmount = overdueData.reduce((sum, inst) => sum + Number(inst.amount), 0);
      const uniqueCustomers = new Set(overdueData.map(inst => inst.customer_name)).size;
      const avgDays = overdueData.length > 0 
        ? overdueData.reduce((sum, inst) => sum + inst.days_overdue, 0) / overdueData.length 
        : 0;

      setStats({
        total_overdue: overdueData.length,
        total_overdue_amount: totalAmount,
        total_customers: uniqueCustomers,
        avg_days_overdue: Math.round(avgDays),
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de inadimplência",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedInstallment || !reminderMessage.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a mensagem de lembrete",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingReminder(true);
      
      // Log the reminder attempt in notes
      const { error } = await supabase
        .from("installments")
        .update({
          notes: `${new Date().toISOString()}: Lembrete enviado - ${reminderMessage}\n${selectedInstallment.id}`
        })
        .eq("id", selectedInstallment.id);

      if (error) throw error;

      toast({
        title: "Lembrete registrado",
        description: "O lembrete foi registrado no histórico da parcela",
      });

      setSelectedInstallment(null);
      setReminderMessage("");
      
      // Reload data
      const { data: { session } } = await supabase.auth.getSession();
      if (session) loadDelinquencyData(session.user.id);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar lembrete",
        description: "Não foi possível enviar o lembrete",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getRiskLevel = (daysOverdue: number) => {
    if (daysOverdue <= 7) return { label: "Baixo", variant: "secondary" as const };
    if (daysOverdue <= 30) return { label: "Médio", variant: "default" as const };
    return { label: "Alto", variant: "destructive" as const };
  };

  const filteredInstallments = useMemo(() => {
    return overdueInstallments.filter((installment) => {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        !filters.search ||
        installment.customer_name?.toLowerCase().includes(searchLower) ||
        installment.order_number?.toLowerCase().includes(searchLower);

      const risk = getRiskLevel(installment.days_overdue);
      const matchesRiskLevel =
        filters.riskLevel === "all" ||
        risk.label.toLowerCase() === filters.riskLevel.toLowerCase();

      let matchesDaysRange = true;
      if (filters.daysOverdueRange !== "all") {
        const days = installment.days_overdue;
        switch (filters.daysOverdueRange) {
          case "0-7":
            matchesDaysRange = days <= 7;
            break;
          case "8-30":
            matchesDaysRange = days > 7 && days <= 30;
            break;
          case "31-60":
            matchesDaysRange = days > 30 && days <= 60;
            break;
          case "60+":
            matchesDaysRange = days > 60;
            break;
        }
      }

      const amount = Number(installment.amount);
      const matchesMinValue = !filters.minValue || amount >= Number(filters.minValue);
      const matchesMaxValue = !filters.maxValue || amount <= Number(filters.maxValue);

      return matchesSearch && matchesRiskLevel && matchesDaysRange && matchesMinValue && matchesMaxValue;
    });
  }, [overdueInstallments, filters]);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== "all" && value !== ""
  ).length;

  const clearFilters = () => {
    setFilters({
      search: "",
      riskLevel: "all",
      daysOverdueRange: "all",
      minValue: "",
      maxValue: "",
    });
  };

  // Chart data
  const rangeData = [
    { name: "0-7 dias", value: overdueInstallments.filter(i => i.days_overdue <= 7).length },
    { name: "8-30 dias", value: overdueInstallments.filter(i => i.days_overdue > 7 && i.days_overdue <= 30).length },
    { name: "31-60 dias", value: overdueInstallments.filter(i => i.days_overdue > 30 && i.days_overdue <= 60).length },
    { name: "60+ dias", value: overdueInstallments.filter(i => i.days_overdue > 60).length },
  ];

  const amountByRange = [
    { 
      name: "0-7 dias", 
      amount: overdueInstallments
        .filter(i => i.days_overdue <= 7)
        .reduce((sum, i) => sum + Number(i.amount), 0) 
    },
    { 
      name: "8-30 dias", 
      amount: overdueInstallments
        .filter(i => i.days_overdue > 7 && i.days_overdue <= 30)
        .reduce((sum, i) => sum + Number(i.amount), 0) 
    },
    { 
      name: "31-60 dias", 
      amount: overdueInstallments
        .filter(i => i.days_overdue > 30 && i.days_overdue <= 60)
        .reduce((sum, i) => sum + Number(i.amount), 0) 
    },
    { 
      name: "60+ dias", 
      amount: overdueInstallments
        .filter(i => i.days_overdue > 60)
        .reduce((sum, i) => sum + Number(i.amount), 0) 
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados de inadimplência...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard de Inadimplência</h1>
              <p className="text-sm text-muted-foreground">Gestão e cobrança de pagamentos em atraso</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Parcelas Atrasadas</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.total_overdue}</div>
              <p className="text-xs text-muted-foreground mt-1">Necessitam atenção</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">{formatCurrency(stats.total_overdue_amount)}</div>
              <p className="text-xs text-muted-foreground mt-1">Em atraso</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.total_customers}</div>
              <p className="text-xs text-muted-foreground mt-1">Com pendências</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média de Atraso</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.avg_days_overdue} dias</div>
              <p className="text-xs text-muted-foreground mt-1">Tempo médio</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Período de Atraso</CardTitle>
              <CardDescription>Quantidade de parcelas por faixa de dias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={rangeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {rangeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valor por Período de Atraso</CardTitle>
              <CardDescription>Total em reais por faixa de dias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={amountByRange}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Installments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Parcelas em Atraso</CardTitle>
            <CardDescription>Listagem completa de todas as parcelas vencidas</CardDescription>
          </CardHeader>
          <CardContent>
            <FilterBar
              onClear={clearFilters}
              activeFiltersCount={activeFiltersCount}
              resultsCount={filteredInstallments.length}
              totalCount={overdueInstallments.length}
            >
              <SearchInput
                value={filters.search}
                onChange={(value) => setFilters({ ...filters, search: value })}
                placeholder="Buscar por cliente ou pedido..."
              />
              <StatusFilter
                value={filters.riskLevel}
                onChange={(value) => setFilters({ ...filters, riskLevel: value })}
                options={[
                  { value: "all", label: "Todos os riscos" },
                  { value: "baixo", label: "Risco Baixo" },
                  { value: "médio", label: "Risco Médio" },
                  { value: "alto", label: "Risco Alto" },
                ]}
                label="Nível de Risco"
                placeholder="Todos os riscos"
              />
              <StatusFilter
                value={filters.daysOverdueRange}
                onChange={(value) => setFilters({ ...filters, daysOverdueRange: value })}
                options={[
                  { value: "all", label: "Todos os períodos" },
                  { value: "0-7", label: "0-7 dias" },
                  { value: "8-30", label: "8-30 dias" },
                  { value: "31-60", label: "31-60 dias" },
                  { value: "60+", label: "60+ dias" },
                ]}
                label="Dias de Atraso"
                placeholder="Todos os períodos"
              />
              <ValueRangeFilter
                label="Valor Devido"
                minValue={filters.minValue}
                maxValue={filters.maxValue}
                onMinChange={(value) => setFilters({ ...filters, minValue: value })}
                onMaxChange={(value) => setFilters({ ...filters, maxValue: value })}
              />
            </FilterBar>

            {overdueInstallments.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma inadimplência encontrada</h3>
                <p className="text-muted-foreground">Parabéns! Não há parcelas em atraso no momento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Dias de Atraso</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInstallments.map((installment) => {
                      const risk = getRiskLevel(installment.days_overdue);
                      return (
                        <TableRow key={installment.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{installment.customer_name}</div>
                              <div className="text-xs text-muted-foreground">{installment.customer_phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>{installment.order_number}</TableCell>
                          <TableCell>
                            {installment.installment_number}/{installment.total_installments}
                          </TableCell>
                          <TableCell>{formatDate(installment.due_date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-destructive text-destructive">
                              {installment.days_overdue} dias
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={risk.variant}>{risk.label}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(installment.amount)}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInstallment(installment);
                                    setReminderMessage(
                                      `Olá ${installment.customer_name}, \n\nIdentificamos que a parcela ${installment.installment_number}/${installment.total_installments} do pedido ${installment.order_number} no valor de ${formatCurrency(installment.amount)} está em atraso há ${installment.days_overdue} dias.\n\nPor favor, regularize sua situação o quanto antes.`
                                    );
                                  }}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Cobrar
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Enviar Lembrete de Cobrança</DialogTitle>
                                  <DialogDescription>
                                    Cliente: {selectedInstallment?.customer_name} | Atraso: {selectedInstallment?.days_overdue} dias
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="message">Mensagem</Label>
                                    <Textarea
                                      id="message"
                                      rows={8}
                                      value={reminderMessage}
                                      onChange={(e) => setReminderMessage(e.target.value)}
                                      placeholder="Digite a mensagem de lembrete..."
                                    />
                                  </div>
                                  <div className="flex gap-2 text-sm text-muted-foreground">
                                    <Phone className="h-4 w-4" />
                                    <span>{selectedInstallment?.customer_phone}</span>
                                    <Mail className="h-4 w-4 ml-4" />
                                    <span>{selectedInstallment?.customer_email}</span>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={handleSendReminder}
                                    disabled={sendingReminder}
                                  >
                                    {sendingReminder ? "Registrando..." : "Registrar Lembrete"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredInstallments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhuma parcela encontrada com os filtros aplicados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
