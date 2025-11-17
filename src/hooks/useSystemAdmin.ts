import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSystemAdmin() {
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSystemAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsSystemAdmin(!!data && !error);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsSystemAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isSystemAdmin, loading };
}
