import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const organizationSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  cnpj: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  tertiaryColor: z.string().optional(),
});

export default function CreateOrganization() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cnpj: "",
    primaryColor: "#2563eb",
    secondaryColor: "#1e40af",
    tertiaryColor: "#f59e0b",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar dados
      const validatedData = organizationSchema.parse(formData);

      // Criar organização via função do banco
      const { data: orgId, error: createError } = await supabase
        .rpc('create_organization_with_membership', {
          org_name: validatedData.name,
          org_email: validatedData.email,
          org_cnpj: validatedData.cnpj || null,
        });

      if (createError) {
        // Verificar se é erro de permissão
        if (createError.message?.includes('Apenas administradores')) {
          toast.error("Você não tem permissão para criar organizações");
          navigate("/dashboard");
        } else {
          toast.error("Erro ao criar organização: " + createError.message);
        }
        setLoading(false);
        return;
      }

      if (!orgId) {
        toast.error("Erro: organização não foi criada");
        setLoading(false);
        return;
      }

      // Upload da Logo e Atualização das Cores
      let logoUrl = null;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `${orgId}/logo.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('organization-assets')
          .upload(filePath, logoFile, {
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading logo:', uploadError);
          toast.error("Erro ao fazer upload da logo, mas a organização foi criada.");
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('organization-assets')
            .getPublicUrl(filePath);
          logoUrl = publicUrl;
        }
      }

      // Atualizar organização com logo e cores
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          logo_url: logoUrl,
          primary_color: validatedData.primaryColor,
          secondary_color: validatedData.secondaryColor,
          tertiary_color: validatedData.tertiaryColor
        })
        .eq('id', orgId);

      if (updateError) {
        console.error('Error updating organization settings:', updateError);
        toast.error("Organização criada, mas houve erro ao salvar configurações visuais.");
      } else {
        toast.success("Organização criada com sucesso!");
      }

      navigate("/dashboard");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao criar organização");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Nova Organização</h1>
            <p className="text-sm text-muted-foreground">Crie uma nova organização</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Criar Nova Organização</CardTitle>
              <CardDescription>
                Preencha os dados para criar uma nova organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Organização *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Minha Empresa"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium">Personalização Visual</h3>
                  
                  <div className="space-y-2">
                    <Label>Logo da Organização</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/50">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                        ) : (
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="max-w-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Cor Primária</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          id="primaryColor"
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="w-12 h-10 p-1 px-1"
                        />
                        <Input
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="secondaryColor">Cor Secundária</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          id="secondaryColor"
                          value={formData.secondaryColor}
                          onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                          className="w-12 h-10 p-1 px-1"
                        />
                        <Input
                          value={formData.secondaryColor}
                          onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="tertiaryColor">Cor Terciária / Hover (Destaque)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          id="tertiaryColor"
                          value={formData.tertiaryColor}
                          onChange={(e) => setFormData({ ...formData, tertiaryColor: e.target.value })}
                          className="w-12 h-10 p-1 px-1"
                        />
                        <Input
                          value={formData.tertiaryColor}
                          onChange={(e) => setFormData({ ...formData, tertiaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} variant="gradient" className="flex-1">
                    {loading ? "Criando..." : "Criar Organização"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}