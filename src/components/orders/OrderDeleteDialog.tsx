import React, { useState, forwardRef, isValidElement } from "react";
import { useNavigate } from "react-router-dom";
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

interface OrderDeleteDialogProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  onSuccess?: () => void;
  // Trigger render element; must accept ref for Radix asChild composition
  // If not provided, a default Button will be used.
  trigger?: React.ReactNode;
}

/**
 * Componente: OrderDeleteDialog
 *
 * Exibe um diálogo de confirmação para exclusão de pedidos.
 * Compatível com Radix `asChild` por meio de React.forwardRef:
 * - Encaminha `ref` e quaisquer props recebidas para o elemento de `trigger`.
 * - Quando `trigger` não é fornecido, utiliza um `Button` padrão que aceita `ref`.
 */
export const OrderDeleteDialog = forwardRef<HTMLElement, OrderDeleteDialogProps & React.HTMLAttributes<HTMLElement>>(({ 
  orderId,
  orderNumber,
  customerName,
  onSuccess,
  trigger,
  ...triggerProps
}, ref) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { organizationId } = useOrganization();
  const { isOrgAdmin, role, isAgent } = useOrganizationRole();

  // Permissão efetiva para excluir: Admin/Owner ou Agent
  // EN: Effective delete permission: Admin/Owner or Agent
  const canDelete = isOrgAdmin || isAgent;

  /**
   * handleDelete
   *
   * Executa a exclusão do pedido por `orderId`.
   * Usa `.select('id')` após `.delete()` para confirmar que ao menos um registro foi removido,
   * evitando falso positivo quando o filtro não encontra linhas (PostgREST retorna sucesso sem erro).
   * Também valida permissões de admin na organização atual antes de executar a exclusão.
   */
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
          description: "Selecione uma organização ativa para excluir pedidos.",
          variant: "destructive",
        });
        return;
      }

      if (!canDelete) {
        toast({
          title: "Sem permissão",
          description: "Você não tem permissão para excluir pedidos nesta organização.",
          variant: "destructive",
        });
        return;
      }

      // Delete order (payments and installments will be deleted by CASCADE)
      const { error, data } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId)
        .eq("organization_id", organizationId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Pedido não encontrado para exclusão.");
      }

      toast({
        title: "Pedido excluído",
        description: "O pedido e seus pagamentos foram removidos com sucesso.",
      });

      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/orders");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao excluir pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Preparar o elemento de trigger, clonando quando fornecido para aplicar ref e props
  const preparedTrigger = isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement, { ref, ...triggerProps })
    : (
        <Button ref={ref as any} {...triggerProps} variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </Button>
      );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {preparedTrigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O pedido{" "}
            <span className="font-semibold">{orderNumber}</span> do cliente{" "}
            <span className="font-semibold">{customerName}</span> será permanentemente excluído.
            <span className="block text-destructive font-medium mt-2">
              ⚠️ Todos os pagamentos e parcelas relacionados também serão excluídos.
            </span>
            {!canDelete && (
              <span className="block text-destructive font-medium mt-2">
                Você não tem permissão para excluir pedidos nesta organização.
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
            {isDeleting ? "Excluindo..." : canDelete ? "Excluir Pedido" : "Sem permissão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

OrderDeleteDialog.displayName = "OrderDeleteDialog";
