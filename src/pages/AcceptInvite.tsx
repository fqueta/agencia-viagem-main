import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvite();
  }, [token]);

  const loadInvite = async () => {
    if (!token) {
      setError("Token de convite inválido");
      setLoading(false);
      return;
    }

    // Buscar convite
    const { data: inviteData, error: inviteError } = await supabase
      .from("organization_invites")
      .select("*, organizations(id, name)")
      .eq("token", token)
      .is("accepted_at", null)
      .single();

    if (inviteError || !inviteData) {
      setError("Convite não encontrado ou já aceito");
      setLoading(false);
      return;
    }

    // Verificar se expirou
    if (new Date(inviteData.expires_at) < new Date()) {
      setError("Este convite expirou");
      setLoading(false);
      return;
    }

    setInvite(inviteData);
    setOrganization(inviteData.organizations);
    setLoading(false);
  };

  const handleAccept = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado para aceitar o convite");
      navigate("/auth");
      return;
    }

    // Verificar se email do convite corresponde ao email do usuário
    if (user.email !== invite.email) {
      toast.error("Este convite é para outro email");
      setLoading(false);
      return;
    }

    // Adicionar membro à organização
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
        invited_by: invite.invited_by,
        invited_at: invite.created_at,
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      if (memberError.code === "23505") {
        toast.error("Você já é membro desta organização");
      } else {
        toast.error("Erro ao aceitar convite");
      }
      setLoading(false);
      return;
    }

    // Marcar convite como aceito
    await supabase
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Definir como organização padrão se for a primeira
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id);

    if (memberships && memberships.length === 1) {
      await supabase
        .from("profiles")
        .update({ default_organization_id: invite.organization_id })
        .eq("id", user.id);
    }

    toast.success("Convite aceito com sucesso!");
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando convite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-center">Convite Inválido</CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")} className="w-full" variant="outline">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-center">Convite para Organização</CardTitle>
          <CardDescription className="text-center">
            Você foi convidado para se juntar a
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg text-center">
            <h3 className="text-xl font-bold">{organization.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Como {invite.role === "admin" ? "Admin" : invite.role === "agent" ? "Agente" : "Visualizador"}
            </p>
          </div>
          <div className="space-y-2">
            <Button onClick={handleAccept} disabled={loading} className="w-full" variant="gradient">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {loading ? "Aceitando..." : "Aceitar Convite"}
            </Button>
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
              Recusar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
