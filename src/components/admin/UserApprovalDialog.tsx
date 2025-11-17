import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

interface UserApprovalDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UserApprovalDialog({ user, open, onOpenChange, onSuccess }: UserApprovalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'admin' | 'agent' | 'user'>('user');
  const [organizationId, setOrganizationId] = useState('');
  const [orgRole, setOrgRole] = useState<'owner' | 'admin' | 'agent' | 'viewer'>('agent');

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

  const handleApprove = async () => {
    if (!user || !organizationId) {
      toast.error('Selecione uma organização');
      return;
    }

    setLoading(true);

    try {
      // 1. Criar user_role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: role
        });

      if (roleError) throw roleError;

      // 2. Criar membership
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          role: orgRole,
          is_active: true,
          joined_at: new Date().toISOString()
        });

      if (memberError) {
        // Rollback: remover role
        await supabase.from('user_roles').delete().eq('user_id', user.id);
        throw memberError;
      }

      // 3. Atualizar default_organization_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ default_organization_id: organizationId })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Usuário aprovado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao aprovar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Aprovar Usuário</DialogTitle>
          <DialogDescription>
            Defina as permissões para {user?.full_name || 'o usuário'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role do Sistema *</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Organização *</Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a organização" />
              </SelectTrigger>
              <SelectContent>
                {organizations?.map(org => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Papel na Organização *</Label>
            <Select value={orgRole} onValueChange={(value: any) => setOrgRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Proprietário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApprove} disabled={loading || !organizationId}>
            <UserCheck className="mr-2 h-4 w-4" />
            {loading ? 'Aprovando...' : 'Aprovar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}