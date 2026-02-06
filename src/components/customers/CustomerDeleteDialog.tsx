import React, { useState, forwardRef, isValidElement } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";

interface CustomerDeleteDialogProps {
  customerId: string;
  customerName: string;
  onSuccess?: () => void;
  // Trigger render element; must accept ref for Radix asChild composition
  trigger?: React.ReactNode;
}

/**
 * Componente: CustomerDeleteDialog
 *
 * Exibe um diálogo de confirmação para exclusão de clientes.
 */
export const CustomerDeleteDialog = forwardRef<HTMLElement, CustomerDeleteDialogProps & React.HTMLAttributes<HTMLElement>>(({ 
  customerId,
  customerName,
  onSuccess,
  trigger,
  ...triggerProps
}, ref) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { organizationId } = useOrganization();
  const { isOrgAdmin } = useOrganizationRole();

  // Permissão efetiva para excluir: Apenas Admin/Owner (conforme RLS)
  const canDelete = isOrgAdmin;

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para continuar.",
          variant: "destructive",
        });
        return;
      }

      if (!organizationId) {
        toast({
          title: "Organização não encontrada",
          description: "Selecione uma organização ativa para excluir clientes.",
          variant: "destructive",
        });
        return;
      }

      if (!canDelete) {
        toast({
          title: "Sem permissão",
          description: "Apenas administradores podem excluir clientes.",
          variant: "destructive",
        });
        return;
      }

      const { error, data } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId)
        .eq("organization_id", organizationId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Cliente não encontrado para exclusão ou você não tem permissão.");
      }

      toast({
        title: "Cliente excluído",
        description: "O cliente foi removido com sucesso.",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir cliente",
        description: error.message || "Verifique se o cliente possui pedidos ou registros vinculados.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const preparedTrigger = isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement, { ref, ...triggerProps })
    : (
        <Button ref={ref as any} {...triggerProps} variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="w-4 h-4" />
        </Button>
      );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {preparedTrigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O cliente{" "}
            <span className="font-semibold">{customerName}</span> será permanentemente excluído.
            <span className="block text-destructive font-medium mt-2">
              ⚠️ Se o cliente possuir pedidos ou pagamentos, a exclusão poderá falhar ou remover todos os dados vinculados (dependendo da configuração do sistema).
            </span>
            {!canDelete && (
              <span className="block text-destructive font-medium mt-2">
                Você não tem permissão para excluir clientes nesta organização.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || !canDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : canDelete ? "Excluir Cliente" : "Sem permissão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

CustomerDeleteDialog.displayName = "CustomerDeleteDialog";
