import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isSystemAdmin, loading } = useSystemAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSystemAdmin) {
      navigate("/dashboard");
    }
  }, [isSystemAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isSystemAdmin) {
    return null;
  }

  return <>{children}</>;
}
