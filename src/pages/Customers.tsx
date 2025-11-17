import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Users, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { customerSchema } from "@/lib/validations";
import { z } from "zod";
import { FilterBar } from "@/components/filters/FilterBar";
import { SearchInput } from "@/components/filters/SearchInput";
import { MonthFilter } from "@/components/filters/MonthFilter";
import { useOrganization } from "@/hooks/useOrganization";
import { CpfInput } from "@/components/ui/cpf-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { CepInput } from "@/components/ui/cep-input";
import { cleanCpf, cleanPhone, cleanCep } from "@/lib/utils";

const Customers = () => {
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useOrganization();
  const [customers, setCustomers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    birth_date: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [filters, setFilters] = useState({
    search: "",
    birthMonth: "all",
    city: "all",
  });

  useEffect(() => {
    if (organizationId) {
      loadCustomers();
    }
  }, [organizationId]);

  const loadCustomers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (!organizationId) {
      setCustomers([]);
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar clientes");
      return;
    }
    setCustomers(data || []);
  };

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
      // Validate form data
      const validatedData = customerSchema.parse(formData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // Create insert object with required fields typed correctly
      const insertData: {
        full_name: string;
        email: string;
        phone: string;
        cpf?: string;
        birth_date?: string;
        address?: string;
        city?: string;
        state?: string;
        zip_code?: string;
        organization_id: string;
        created_by: string;
      } = {
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: cleanPhone(validatedData.phone),
        ...(validatedData.cpf && { cpf: cleanCpf(validatedData.cpf) }),
        ...(validatedData.birth_date && { birth_date: validatedData.birth_date }),
        ...(validatedData.address && { address: validatedData.address }),
        ...(validatedData.city && { city: validatedData.city }),
        ...(validatedData.state && { state: validatedData.state }),
        ...(validatedData.zip_code && { zip_code: cleanCep(validatedData.zip_code) }),
        organization_id: organizationId,
        created_by: session.user.id,
      };

      const { error } = await supabase.from("customers").insert([insertData]);

      if (error) {
        toast.error("Erro ao criar cliente");
        setLoading(false);
        return;
      }

      toast.success("Cliente cadastrado com sucesso!");
      setOpen(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        cpf: "",
        birth_date: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
      });
      loadCustomers();
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

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        !filters.search ||
        customer.full_name?.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.phone?.toLowerCase().includes(searchLower) ||
        customer.city?.toLowerCase().includes(searchLower);

      const matchesBirthMonth =
        filters.birthMonth === "all" ||
        (customer.birth_date &&
          new Date(customer.birth_date).getMonth() + 1 === parseInt(filters.birthMonth));

      const matchesCity = filters.city === "all" || customer.city === filters.city;

      return matchesSearch && matchesBirthMonth && matchesCity;
    });
  }, [customers, filters]);

  const cities = useMemo(() => {
    const uniqueCities = [...new Set(customers.map((c) => c.city).filter(Boolean))];
    return uniqueCities.sort();
  }, [customers]);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== "all" && value !== ""
  ).length;

  const clearFilters = () => {
    setFilters({
      search: "",
      birthMonth: "all",
      city: "all",
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
            <div className="w-10 h-10 bg-gradient-to-r from-accent to-secondary rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Clientes</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus clientes</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Cliente</DialogTitle>
                <DialogDescription>Adicione um novo cliente ao sistema</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <PhoneInput
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <CpfInput
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth_date">Data de Nascimento</Label>
                    <Input
                      id="birth_date"
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">CEP</Label>
                    <CepInput
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      onAddressFound={(address) => {
                        setFormData(prev => ({
                          ...prev,
                          address: address.street,
                          city: address.city,
                          state: address.state,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || orgLoading} variant="gradient">
                  {loading ? "Cadastrando..." : "Cadastrar Cliente"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <FilterBar
          onClear={clearFilters}
          activeFiltersCount={activeFiltersCount}
          resultsCount={filteredCustomers.length}
          totalCount={customers.length}
        >
          <SearchInput
            value={filters.search}
            onChange={(value) => setFilters({ ...filters, search: value })}
            placeholder="Buscar por nome, email, telefone ou cidade..."
          />
          <MonthFilter
            value={filters.birthMonth}
            onChange={(value) => setFilters({ ...filters, birthMonth: value })}
          />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cidade</Label>
            <Select value={filters.city} onValueChange={(value) => setFilters({ ...filters, city: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as cidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>Todos os clientes cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Aniversário</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.full_name}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.city || "-"}</TableCell>
                    <TableCell>
                      {customer.birth_date
                        ? new Date(customer.birth_date).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/customers/${customer.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/customers/${customer.id}/edit`)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {customers.length === 0 
                        ? "Nenhum cliente cadastrado ainda"
                        : "Nenhum cliente encontrado com os filtros aplicados"}
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

export default Customers;
