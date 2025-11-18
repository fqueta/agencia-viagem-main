import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import { useAuthProtection } from "@/hooks/useAuthProtection";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * MainLayout
 * PT-BR: Layout compartilhado com Sidebar e Topbar padrão para todas as páginas protegidas.
 * EN: Shared layout with Sidebar and standard Topbar for all protected pages.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const { hasRole, loading } = useAuthProtection();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!hasRole) {
    return null; // useAuthProtection já redirecionou
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <OrganizationSwitcher />
              {session && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={(session.user as any)?.user_metadata?.avatar_url || undefined} />
                        <AvatarFallback>{(session.user.user_metadata?.name?.[0] || session.user.user_metadata?.full_name?.[0] || session.user.email?.[0] || "U").toString().toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      {session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
