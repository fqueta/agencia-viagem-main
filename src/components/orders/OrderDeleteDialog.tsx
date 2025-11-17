import { useState } from "react";
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

interface OrderDeleteDialogProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function OrderDeleteDialog({
  orderId,
  orderNumber,
  customerName,
  onSuccess,
  trigger,
}: OrderDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      // Delete order (payments and installments will be deleted by CASCADE)
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;

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

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Esta ação não pode ser desfeita. O pedido{" "}
              <span className="font-semibold">{orderNumber}</span> do cliente{" "}
              <span className="font-semibold">{customerName}</span> será
              permanentemente excluído.
            </p>
            <p className="text-destructive font-medium">
              ⚠️ Todos os pagamentos e parcelas relacionados também serão
              excluídos.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir Pedido"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
