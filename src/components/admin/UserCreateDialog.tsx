import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { userCreateSchema, type UserCreateData } from "@/lib/validations";
import { PhoneInput } from "@/components/ui/phone-input";

interface UserCreateDialogProps {
  onSuccess: () => void;
}

/**
 * Componente: UserCreateDialog
 *
 * Dialog de criação de usuário pelo administrador. Coleta dados básicos,
 * permite definir uma senha inicial opcional, chama o Edge Function
 * `create-user` e exibe a senha (definida ou temporária) para cópia.
 */
export function UserCreateDialog({ onSuccess }: UserCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const form = useForm<UserCreateData>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      email: "",
      full_name: "",
      phone: "",
      role: "agent",
      organization_id: "",
      org_role: "agent",
      initial_password: undefined,
    },
  });

  /**
   * Gera uma senha forte contendo letras maiúsculas, minúsculas,
   * números e símbolos, com comprimento configurável.
   */
  const generateStrongPassword = (length = 12) => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+[]{}|;:,.<>?";
    const all = upper + lower + numbers + symbols;

    // Garantir pelo menos um de cada tipo
    let pwd =
      upper[Math.floor(Math.random() * upper.length)] +
      lower[Math.floor(Math.random() * lower.length)] +
      numbers[Math.floor(Math.random() * numbers.length)] +
      symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = pwd.length; i < length; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    return pwd
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  const onSubmit = async (values: UserCreateData) => {
    setLoading(true);
    setTempPassword(null);

    try {
      // Remove senha inicial vazia para evitar validação no backend
      const payload: any = { ...values };
      if (!payload.initial_password) {
        delete payload.initial_password;
      }

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: payload,
      });

      if (error) throw error;

      if (data.success) {
        // Exibe a senha definida (se fornecida) ou a temporária retornada
        setTempPassword(values.initial_password || data.temporary_password);
        setCreatedEmail(values.email);
        setCreatedName(values.full_name);
        toast.success("Usuário criado com sucesso!");
        form.reset();
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast.success("Senha copiada!");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTempPassword(null);
    setCreatedEmail(null);
    setCreatedName(null);
    form.reset();
  };

  /**
   * Quando existe apenas uma organização ativa, pré-seleciona
   * automaticamente para agilizar o cadastro.
   */
  useEffect(() => {
    if (organizations && organizations.length === 1) {
      form.setValue("organization_id", organizations[0].id);
    }
  }, [organizations]);

  /**
   * Copia um texto de instruções completo para enviar ao novo usuário,
   * incluindo link de acesso, email e senha criada.
   */
  const copyInstructions = () => {
    if (!tempPassword || !createdEmail) return;
    const BASE_URL = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;
    const message = `Olá${createdName ? ` ${createdName}` : ""},\n\n` +
      `Sua conta na Agência de Viagem foi criada.\n` +
      `Acesse: ${BASE_URL}/auth\n` +
      `Email: ${createdEmail}\n` +
      `Senha provisória: ${tempPassword}\n\n` +
      `Por segurança, altere sua senha após o primeiro acesso em Perfil > Segurança.`;
    navigator.clipboard.writeText(message);
    toast.success("Instruções copiadas!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo usuário no sistema
          </DialogDescription>
        </DialogHeader>

        {tempPassword && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p className="font-semibold">Senha temporária gerada:</p>
              <div className="flex items-center gap-2">
                <Input
                  value={tempPassword}
                  type={showPassword ? "text" : "password"}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={copyPassword}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Copie esta senha e envie ao usuário. Ela não será mostrada novamente.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={copyInstructions}>
                  Copiar instruções para o usuário
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="usuario@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <PhoneInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role do Sistema *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="organization_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organização *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a organização" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {organizations?.map(org => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="org_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel na Organização *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="owner">Proprietário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="initial_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha inicial (opcional)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type={showInitialPassword ? "text" : "password"}
                        placeholder="Defina uma senha forte"
                        {...field}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => setShowInitialPassword(!showInitialPassword)}
                      >
                        {showInitialPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => form.setValue("initial_password", generateStrongPassword())}
                        title="Gerar senha forte"
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    A senha deve ter entre 8 e 72 caracteres e conter letras maiúsculas, minúsculas e números.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {tempPassword ? "Fechar" : "Cancelar"}
              </Button>
              {!tempPassword && (
                <Button type="submit" disabled={loading}>
                  {loading ? "Criando..." : "Criar Usuário"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
