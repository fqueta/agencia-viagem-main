import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";

export default function WaitingApproval() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Conta Aguardando Aprovação</CardTitle>
          <CardDescription>
            Sua conta foi criada com sucesso!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Um administrador precisa aprovar seu acesso e atribuir as permissões necessárias antes que você possa usar o sistema.
            </p>
            <p>
              Você receberá um email assim que sua conta for aprovada e estiver pronta para uso.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleLogout}
          >
            Fazer Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}