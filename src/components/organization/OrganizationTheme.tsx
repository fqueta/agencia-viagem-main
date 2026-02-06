import { useEffect } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const hexToHsl = (hex: string) => {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r /= 255;
  g /= 255;
  b /= 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

export function OrganizationTheme() {
  const { organizationId } = useOrganization();

  const { data: organization } = useQuery({
    queryKey: ['organization-theme', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('primary_color, secondary_color, tertiary_color')
        .eq('id', organizationId)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId
  });

  useEffect(() => {
    if (organization) {
      const root = document.documentElement;
      
      if (organization.primary_color) {
        const hsl = hexToHsl(organization.primary_color);
        if (hsl) root.style.setProperty('--primary', hsl);
      }
      
      if (organization.secondary_color) {
        const hsl = hexToHsl(organization.secondary_color);
        if (hsl) root.style.setProperty('--secondary', hsl);
      }

      if (organization.tertiary_color) {
        const hsl = hexToHsl(organization.tertiary_color);
        if (hsl) root.style.setProperty('--accent', hsl);
      }
    }
  }, [organization]);

  return null;
}
