import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

interface Customer {
  id: string;
  full_name: string;
}

interface Package {
  id: string;
  name: string;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  package_id: string;
  number_of_travelers: number;
  travel_date: string;
  special_requests: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  total_amount: number;
}

const OrderEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [formData, setFormData] = useState<Order | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const [orderRes, customersRes, packagesRes] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("customers").select("id, full_name"),
      supabase.from("travel_packages").select("id, name, price").eq("is_active", true)
    ]);

    if (orderRes.data) {
      setFormData(orderRes.data as Order);
    }
    if (customersRes.data) setCustomers(customersRes.data);
    if (packagesRes.data) setPackages(packagesRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (!formData) return;

    const selectedPackage = packages.find(p => p.id === formData.package_id);
    if (!selectedPackage) return;

    const total = selectedPackage.price * formData.number_of_travelers;

    const { error } = await supabase
      .from("orders")
      .update({
        customer_id: formData.customer_id,
        package_id: formData.package_id,
        number_of_travelers: formData.number_of_travelers,
        travel_date: formData.travel_date,
        special_requests: formData.special_requests,
        status: formData.status,
        total_amount: total
      })
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro ao atualizar pedido",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pedido atualizado com sucesso!",
      });
      navigate(`/orders/${id}`);
    }
  };

  if (loading || !formData) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/orders/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Editar Pedido {formData.order_number}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-lg border">
          <div className="space-y-2">
            <Label htmlFor="customer">Cliente</Label>
            <Select value={formData.customer_id} onValueChange={(value) => setFormData({...formData, customer_id: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="package">Pacote</Label>
            <Select value={formData.package_id} onValueChange={(value) => setFormData({...formData, package_id: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {packages.map(pkg => (
                  <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="travelers">Número de Viajantes</Label>
            <Input
              id="travelers"
              type="number"
              min="1"
              value={formData.number_of_travelers}
              onChange={(e) => setFormData({...formData, number_of_travelers: parseInt(e.target.value)})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="travel_date">Data da Viagem</Label>
            <Input
              id="travel_date"
              type="date"
              value={formData.travel_date}
              onChange={(e) => setFormData({...formData, travel_date: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: "pending" | "confirmed" | "completed" | "cancelled") => setFormData({...formData, status: value})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requests">Pedidos Especiais</Label>
            <Textarea
              id="requests"
              value={formData.special_requests || ""}
              onChange={(e) => setFormData({...formData, special_requests: e.target.value})}
              rows={4}
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit">Salvar Alterações</Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/orders/${id}`)}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderEdit;
