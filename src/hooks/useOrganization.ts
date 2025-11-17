import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const useOrganization = () => {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        // Verificar se usuário tem role (usando limit(1) para lidar com múltiplas roles)
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        // Se não tem role, não redirecionar - deixar useAuthProtection lidar
        if (!roleData) {
          setLoading(false);
          return;
        }

        // Buscar organização padrão do perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_organization_id')
          .eq('id', user.id)
          .single();

        if (profile?.default_organization_id) {
          setOrganizationId(profile.default_organization_id);
        } else {
          // Fallback: buscar primeira organização do usuário
          const { data: membership } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('joined_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (membership) {
            setOrganizationId(membership.organization_id);
            // Atualizar como padrão
            await supabase
              .from('profiles')
              .update({ default_organization_id: membership.organization_id })
              .eq('id', user.id);
          } else {
            // Usuário não tem organização - redirecionar para criar
            const currentPath = window.location.pathname;
            if (currentPath !== '/organization/create' && currentPath !== '/auth' && !currentPath.startsWith('/invite/')) {
              navigate('/organization/create');
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar organização:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrganization();
  }, [navigate]);

  return { organizationId, loading };
};

