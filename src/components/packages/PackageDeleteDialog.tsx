import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";

interface PackageDeleteDialogProps {
  package: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackageDeleted: () => void;
}

const PackageDeleteDialog = ({ package: pkg, open, onOpenChange, onPackageDeleted }: PackageDeleteDialogProps) => {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (!organizationId) {
        toast.error("Organização não encontrada");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("travel_packages")
        .delete()
        .eq("id", pkg.id)
        .eq("organization_id", organizationId);

      if (error) {
        if (error.code === '23503') {
          toast.error("Este pacote possui pedidos vinculados e não pode ser excluído");
        } else {
          toast.error("Erro ao excluir pacote");
        }
        setLoading(false);
        return;
      }

      toast.success("Pacote excluído com sucesso!");
      onOpenChange(false);
      onPackageDeleted();
    } catch (error) {
      toast.error("Erro ao excluir pacote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso irá deletar permanentemente o pacote <strong>"{pkg?.name}"</strong>. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Excluindo..." : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PackageDeleteDialog;
