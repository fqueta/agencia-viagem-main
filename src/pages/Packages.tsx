import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Plus, Plane, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { packageSchema } from "@/lib/validations";
import { z } from "zod";
import { useOrganization } from "@/hooks/useOrganization";
import PackageEditDialog from "@/components/packages/PackageEditDialog";
import PackageDeleteDialog from "@/components/packages/PackageDeleteDialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cleanCurrency } from "@/lib/utils";

const Packages = () => {
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useOrganization();
  const [packages, setPackages] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    destination: "",
    duration_days: "",
    price: "",
    available_spots: "",
  });

  useEffect(() => {
    if (organizationId) {
      loadPackages();
    }
  }, [organizationId]);

  const loadPackages = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (!organizationId) {
      setPackages([]);
      return;
    }

    const { data, error } = await supabase
      .from("travel_packages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pacotes");
      return;
    }
    setPackages(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validatedData = packageSchema.parse(formData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (!organizationId) {
        toast.error("Organização não encontrada");
        setLoading(false);
        return;
      }

      // Create insert object with required fields typed correctly
      const insertData: {
        name: string;
        destination: string;
        duration_days: number;
        price: number;
        available_spots: number;
        description?: string;
        organization_id: string;
        created_by: string;
      } = {
        name: validatedData.name,
        destination: validatedData.destination,
        duration_days: parseInt(validatedData.duration_days),
        price: cleanCurrency(validatedData.price),
        available_spots: parseInt(validatedData.available_spots),
        ...(validatedData.description && { description: validatedData.description }),
        organization_id: organizationId,
        created_by: session.user.id,
      };

      const { error } = await supabase.from("travel_packages").insert([insertData]);

      if (error) {
        toast.error("Erro ao criar pacote");
        setLoading(false);
        return;
      }

      toast.success("Pacote criado com sucesso!");
      setOpen(false);
      setFormData({
        name: "",
        description: "",
        destination: "",
        duration_days: "",
        price: "",
        available_spots: "",
      });
      loadPackages();
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

  const handleEditClick = (pkg: any) => {
    setSelectedPackage(pkg);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (pkg: any) => {
    setSelectedPackage(pkg);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pacotes de Viagem</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus pacotes</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4 mr-2" />
                Novo Pacote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Pacote de Viagem</DialogTitle>
                <DialogDescription>Adicione um novo pacote turístico</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Pacote</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination">Destino</Label>
                    <Input
                      id="destination"
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração (dias)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={formData.duration_days}
                      onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço</Label>
                    <CurrencyInput
                      id="price"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spots">Vagas</Label>
                    <Input
                      id="spots"
                      type="number"
                      value={formData.available_spots}
                      onChange={(e) => setFormData({ ...formData, available_spots: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || orgLoading} variant="gradient">
                  {loading ? "Criando..." : "Criar Pacote"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="relative">
                <CardTitle>{pkg.name}</CardTitle>
                <CardDescription>{pkg.destination}</CardDescription>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-4 right-4 h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditClick(pkg)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteClick(pkg)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{pkg.description}</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-bold text-primary">
                    R$ {Number(pkg.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {pkg.duration_days} dias
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {pkg.available_spots} vagas disponíveis
                </div>
              </CardContent>
            </Card>
          ))}
          {packages.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Nenhum pacote cadastrado ainda
            </div>
          )}
        </div>

        {selectedPackage && (
          <>
            <PackageEditDialog
              package={selectedPackage}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              onPackageUpdated={loadPackages}
            />
            <PackageDeleteDialog
              package={selectedPackage}
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onPackageDeleted={loadPackages}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Packages;
