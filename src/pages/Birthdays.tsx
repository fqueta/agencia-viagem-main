import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, Cake } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";

const Birthdays = () => {
  const navigate = useNavigate();
  const { organizationId } = useOrganization();
  const [birthdays, setBirthdays] = useState<any[]>([]);

  useEffect(() => {
    if (organizationId) {
      loadBirthdays();
    }
  }, [organizationId]);

  const loadBirthdays = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (!organizationId) {
      setBirthdays([]);
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .not("birth_date", "is", null)
      .order("birth_date", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar aniversários");
      return;
    }

    const today = new Date();
    const sortedData = (data || []).sort((a, b) => {
      const dateA = new Date(a.birth_date);
      const dateB = new Date(b.birth_date);
      const dayA = (dateA.getMonth() * 31 + dateA.getDate() - today.getMonth() * 31 - today.getDate() + 372) % 372;
      const dayB = (dateB.getMonth() * 31 + dateB.getDate() - today.getMonth() * 31 - today.getDate() + 372) % 372;
      return dayA - dayB;
    });

    setBirthdays(sortedData);
  };

  const getDaysUntilBirthday = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    
    if (thisYear < today) {
      thisYear.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = thisYear.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje!";
    if (diffDays === 1) return "Amanhã";
    if (diffDays <= 7) return `Em ${diffDays} dias`;
    return `${diffDays} dias`;
  };

  const isUpcoming = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    
    if (thisYear < today) {
      thisYear.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = thisYear.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 30;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-gradient-to-r from-secondary to-accent rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Aniversários</h1>
              <p className="text-sm text-muted-foreground">Datas especiais dos clientes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Próximos Aniversários</CardTitle>
            <CardDescription>Clientes com aniversário nos próximos meses</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data de Nascimento</TableHead>
                  <TableHead>Próximo Aniversário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {birthdays.map((customer) => (
                  <TableRow 
                    key={customer.id}
                    className={isUpcoming(customer.birth_date) ? "bg-accent/10" : ""}
                  >
                    <TableCell className="font-medium flex items-center gap-2">
                      {customer.full_name}
                      {isUpcoming(customer.birth_date) && (
                        <Cake className="w-4 h-4 text-secondary" />
                      )}
                    </TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>
                      {new Date(customer.birth_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getDaysUntilBirthday(customer.birth_date)}
                    </TableCell>
                  </TableRow>
                ))}
                {birthdays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum cliente com data de nascimento cadastrada
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

export default Birthdays;
