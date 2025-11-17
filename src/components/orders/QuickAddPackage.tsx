import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { packageSchema } from "@/lib/validations";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";

interface QuickAddPackageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageCreated: (packageId: string) => void;
  organizationId: string | null;
}

export const QuickAddPackage = ({ open, onOpenChange, onPackageCreated, organizationId }: QuickAddPackageProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    destination: "",
    duration_days: "",
    price: "",
    available_spots: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationId) {
      toast.error("Organização não encontrada. Por favor, recarregue a página.");
      return;
    }

    setLoading(true);

    try {
      const validatedData = packageSchema.parse(formData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("travel_packages")
        .insert([
          {
            name: validatedData.name,
            destination: validatedData.destination,
            duration_days: parseInt(validatedData.duration_days),
            price: parseFloat(validatedData.price),
            available_spots: parseInt(validatedData.available_spots),
            description: validatedData.description,
            organization_id: organizationId,
            created_by: session.user.id,
          },
        ])
        .select()
        .single();

      if (error || !data) {
        toast.error("Erro ao criar pacote");
        setLoading(false);
        return;
      }

      toast.success("Pacote adicionado com sucesso!");
      setFormData({
        name: "",
        destination: "",
        duration_days: "",
        price: "",
        available_spots: "",
        description: "",
      });
      onPackageCreated(data.id);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="w-3 h-3 mr-1" />
          Novo Pacote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Pacote Rápido</DialogTitle>
          <DialogDescription>Crie um novo pacote de viagem</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick_package_name">Nome do Pacote *</Label>
            <Input
              id="quick_package_name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Pacote Paris 7 dias"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick_destination">Destino *</Label>
              <Input
                id="quick_destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Ex: Paris, França"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick_duration">Duração (dias) *</Label>
              <Input
                id="quick_duration"
                type="number"
                min="1"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                placeholder="7"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick_price">Preço (R$) *</Label>
              <Input
                id="quick_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="5000.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick_spots">Vagas Disponíveis *</Label>
              <Input
                id="quick_spots"
                type="number"
                min="0"
                value={formData.available_spots}
                onChange={(e) => setFormData({ ...formData, available_spots: e.target.value })}
                placeholder="20"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick_description">Descrição (opcional)</Label>
            <Textarea
              id="quick_description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Breve descrição do pacote..."
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} variant="gradient">
              {loading ? "Adicionando..." : "Adicionar Pacote"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
