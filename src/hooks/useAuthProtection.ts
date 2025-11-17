import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const useAuthProtection = () => {
  const navigate = useNavigate();
  const [hasRole, setHasRole] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!roles || roles.length === 0) {
        // Usuário sem role - mostrar tela de espera
        const currentPath = window.location.pathname;
        if (currentPath !== '/waiting-approval') {
          navigate('/waiting-approval');
        }
      } else {
        setHasRole(true);
      }
      
      setLoading(false);
    };

    checkRole();
  }, [navigate]);

  return { hasRole, loading };
};