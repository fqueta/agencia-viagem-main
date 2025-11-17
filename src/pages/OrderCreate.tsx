import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { CustomerCombobox } from "@/components/orders/CustomerCombobox";
import { PackageCombobox } from "@/components/orders/PackageCombobox";
import { QuickAddCustomer } from "@/components/orders/QuickAddCustomer";
import { QuickAddPackage } from "@/components/orders/QuickAddPackage";
import { z } from "zod";

const orderCreateSchema = z.object({
  customer_id: z.string().uuid("Selecione um cliente"),
  package_id: z.string().uuid("Selecione um pacote"),
  number_of_travelers: z.number().min(1, "Mínimo 1 viajante").max(50, "Máximo 50 viajantes"),
  travel_date: z.string().refine(
    (date) => new Date(date) > new Date(),
    "Data deve ser futura"
  ),
  special_requests: z.string().max(500, "Máximo 500 caracteres").optional(),
});

const OrderCreate = () => {
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useOrganization();
  const [customers, setCustomers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    package_id: "",
    number_of_travelers: 1,
    travel_date: "",
    special_requests: "",
  });

  useEffect(() => {
    if (organizationId) loadData();
  }, [organizationId]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (!organizationId) return;

    const [customersRes, packagesRes] = await Promise.all([
      supabase.from("customers").select("*").eq("organization_id", organizationId),
      supabase.from("travel_packages").select("*").eq("organization_id", organizationId),
    ]);

    if (customersRes.error || packagesRes.error) {
      toast.error("Erro ao carregar dados");
      return;
    }

    setCustomers(customersRes.data || []);
    setPackages(packagesRes.data || []);
  };

  const handleCustomerCreated = (customerId: string) => {
    loadData();
    setFormData({ ...formData, customer_id: customerId });
    setCustomerDialogOpen(false);
  };

  const handlePackageCreated = (packageId: string) => {
    loadData();
    setFormData({ ...formData, package_id: packageId });
    setPackageDialogOpen(false);
  };

  const selectedPackage = packages.find((p) => p.id === formData.package_id);
  const totalAmount = selectedPackage
    ? Number(selectedPackage.price) * formData.number_of_travelers
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificação robusta de organizationId
    if (!organizationId) {
      if (orgLoading) {
        toast.error("Aguarde o carregamento dos dados da organização");
      } else {
        toast.error("Organização não encontrada. Verifique suas permissões.");
      }
      return;
    }
    
    setLoading(true);

    try {
      const validatedData = orderCreateSchema.parse({
        ...formData,
        number_of_travelers: Number(formData.number_of_travelers),
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        setLoading(false);
        return;
      }

      const orderNumber = `ORD-${Date.now()}`;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            order_number: orderNumber,
            customer_id: validatedData.customer_id,
            package_id: validatedData.package_id,
            number_of_travelers: validatedData.number_of_travelers,
            travel_date: validatedData.travel_date,
            special_requests: validatedData.special_requests || null,
            total_amount: totalAmount,
            status: "pending",
            organization_id: organizationId,
            created_by: session.user.id,
          },
        ])
        .select()
        .single();

      if (orderError || !order) {
        toast.error("Erro ao criar pedido");
        setLoading(false);
        return;
      }

      const { error: paymentError } = await supabase.from("payments").insert([
        {
          order_id: order.id,
          amount: totalAmount,
          due_date: validatedData.travel_date,
          status: "pending",
          organization_id: organizationId,
          created_by: session.user.id,
        },
      ]);

      if (paymentError) {
        toast.error("Pedido criado, mas erro ao criar pagamento");
        navigate(`/orders/${order.id}`);
        return;
      }

      toast.success("Pedido criado com sucesso!");
      navigate(`/orders/${order.id}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error("Erro ao validar dados");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Criar Novo Pedido</h1>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados para registrar uma nova venda
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Cliente */}
              <CustomerCombobox
                value={formData.customer_id}
                onChange={(val) => setFormData({ ...formData, customer_id: val })}
                customers={customers}
                onCreateNew={() => setCustomerDialogOpen(true)}
              />

              {/* Pacote */}
              <PackageCombobox
                value={formData.package_id}
                onChange={(val) => setFormData({ ...formData, package_id: val })}
                packages={packages}
                onCreateNew={() => setPackageDialogOpen(true)}
              />

              {/* Detalhes da viagem */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="travelers">Número de Viajantes *</Label>
                  <Input
                    id="travelers"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.number_of_travelers}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        number_of_travelers: parseInt(e.target.value) || 1,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="travel_date">Data da Viagem *</Label>
                  <Input
                    id="travel_date"
                    type="date"
                    value={formData.travel_date}
                    onChange={(e) =>
                      setFormData({ ...formData, travel_date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="special_requests">Observações (opcional)</Label>
                <Textarea
                  id="special_requests"
                  value={formData.special_requests}
                  onChange={(e) =>
                    setFormData({ ...formData, special_requests: e.target.value })
                  }
                  placeholder="Adicione informações adicionais sobre o pedido..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Valor total */}
              {selectedPackage && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Valor Total:</span>
                      <span className="text-2xl font-bold text-primary">
                        R${" "}
                        {totalAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Botões */}
              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/orders")}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || orgLoading}
                  variant="gradient"
                >
                  {loading ? "Criando..." : "Criar Pedido"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Dialogs */}
        <QuickAddCustomer
          open={customerDialogOpen}
          onOpenChange={setCustomerDialogOpen}
          onCustomerCreated={handleCustomerCreated}
          organizationId={organizationId}
        />

        <QuickAddPackage
          open={packageDialogOpen}
          onOpenChange={setPackageDialogOpen}
          onPackageCreated={handlePackageCreated}
          organizationId={organizationId}
        />
      </main>
    </div>
  );
};

export default OrderCreate;
