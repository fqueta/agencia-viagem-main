import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { packageSchema } from "@/lib/validations";
import { z } from "zod";
import { useOrganization } from "@/hooks/useOrganization";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cleanCurrency, formatCurrency } from "@/lib/utils";

interface PackageEditDialogProps {
  package: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageUpdated: () => void;
}

const PackageEditDialog = ({ package: pkg, open, onOpenChange, onPackageUpdated }: PackageEditDialogProps) => {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    destination: "",
    duration_days: "",
    price: "",
    available_spots: "",
  });

  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name || "",
        description: pkg.description || "",
        destination: pkg.destination || "",
        duration_days: pkg.duration_days?.toString() || "",
        price: pkg.price ? formatCurrency(pkg.price) : "",
        available_spots: pkg.available_spots?.toString() || "",
      });
    }
  }, [pkg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = packageSchema.parse(formData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (!organizationId) {
        toast.error("Organização não encontrada");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("travel_packages")
        .update({
          name: validatedData.name,
          destination: validatedData.destination,
          duration_days: parseInt(validatedData.duration_days),
          price: cleanCurrency(validatedData.price),
          available_spots: parseInt(validatedData.available_spots),
          description: validatedData.description || null,
        })
        .eq("id", pkg.id)
        .eq("organization_id", organizationId);

      if (error) {
        toast.error("Erro ao atualizar pacote");
        setLoading(false);
        return;
      }

      toast.success("Pacote atualizado com sucesso!");
      onOpenChange(false);
      onPackageUpdated();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error("Erro ao validar dados do formulário");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Pacote</DialogTitle>
          <DialogDescription>Atualize as informações do pacote de viagem</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome do Pacote</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-destination">Destino</Label>
              <Input
                id="edit-destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Duração (dias)</Label>
              <Input
                id="edit-duration"
                type="number"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Preço</Label>
              <CurrencyInput
                id="edit-price"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-spots">Vagas</Label>
              <Input
                id="edit-spots"
                type="number"
                value={formData.available_spots}
                onChange={(e) => setFormData({ ...formData, available_spots: e.target.value })}
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PackageEditDialog;
