import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";

interface Organization {
  id: string;
  name: string;
  email: string;
  cnpj?: string;
  max_users: number;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  tertiary_color?: string;
}

export default function OrganizationEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSystemAdmin, loading: adminLoading } = useSystemAdmin();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cnpj: "",
    primary_color: "",
    secondary_color: "",
    tertiary_color: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!adminLoading && !isSystemAdmin) {
      navigate("/dashboard");
      return;
    }
  }, [isSystemAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (id && isSystemAdmin) {
      loadOrganization();
    }
  }, [id, isSystemAdmin]);

  const loadOrganization = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error("Organização não encontrada");
        navigate("/admin/organizations");
        return;
      }

      setOrganization(data);
      setFormData({
        name: data.name || "",
        email: data.email || "",
        cnpj: data.cnpj || "",
        primary_color: data.primary_color || "#2563eb",
        secondary_color: data.secondary_color || "#1e40af",
        tertiary_color: data.tertiary_color || "#f59e0b",
      });
      setLogoPreview(data.logo_url || null);
    } catch (error) {
      console.error("Erro ao carregar organização:", error);
      toast.error("Erro ao carregar dados da organização");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);

    try {
      let logoUrl = organization?.logo_url;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `${id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('organization-assets')
          .upload(filePath, logoFile, {
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading logo:', uploadError);
          toast.error("Erro ao fazer upload da logo.");
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('organization-assets')
            .getPublicUrl(filePath);
          logoUrl = publicUrl;
        }
      }

      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          email: formData.email,
          cnpj: formData.cnpj || null,
          logo_url: logoUrl,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          tertiary_color: formData.tertiary_color,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Organização atualizada com sucesso!");
      navigate("/admin/organizations");
    } catch (error) {
      console.error("Erro ao salvar organização:", error);
      toast.error("Erro ao salvar organização");
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!organization) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/organizations")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Editar Organização</h1>
              <p className="text-sm text-muted-foreground">{organization.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/organizations")} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Dados da Organização</CardTitle>
            <CardDescription>Edite as informações e a identidade visual da organização</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={saving} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={saving} 
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input 
                  value={formData.cnpj} 
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  disabled={saving} 
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Limite de Usuários</Label>
                <Input value={organization.max_users} disabled />
                <p className="text-xs text-muted-foreground">O limite de usuários não pode ser alterado por aqui.</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Personalização</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Logo da Organização</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative w-16 h-16 border rounded bg-muted flex items-center justify-center overflow-hidden">
                        <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 border rounded bg-muted flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        disabled={saving}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Recomendado: PNG ou JPG, máx 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        disabled={saving}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.primary_color}
                        onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                        disabled={saving}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.secondary_color}
                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        disabled={saving}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.secondary_color}
                        onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                        disabled={saving}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Cor Terciária / Hover (Destaque)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.tertiary_color}
                        onChange={(e) => setFormData({ ...formData, tertiary_color: e.target.value })}
                        disabled={saving}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.tertiary_color}
                        onChange={(e) => setFormData({ ...formData, tertiary_color: e.target.value })}
                        disabled={saving}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
