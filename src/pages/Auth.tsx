import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plane, Eye, EyeOff } from "lucide-react";
import { authLoginSchema, authSignupSchema } from "@/lib/validations";

/**
 * Auth Page
 *
 * PT-BR: Tela de autenticação (login/cadastro/recuperação). Adiciona
 * alternância de visibilidade no campo de senha para melhorar a UX.
 * EN: Authentication screen (login/signup/recovery). Adds password
 * visibility toggle to improve UX.
 */
const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // Resolve redirect base URL from env for Supabase email redirect validation
  // Falls back to current origin when not set.
  const REDIRECT_BASE_URL = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;

  /**
   * handleForgotPassword
   *
   * PT-BR: Envia email de recuperação usando o método nativo do Supabase
   * (resetPasswordForEmail), com redirect configurado via env. Mantém
   * validação de email e feedback de UI.
   * EN: Sends a password recovery email using Supabase's native method
   * (resetPasswordForEmail), with redirect configured via env. Keeps
   * email validation and UI feedback.
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = authLoginSchema.pick({ email: true }).safeParse({ email });
      if (!result.success) {
        toast.error(result.error.errors[0].message);
        setLoading(false);
        return;
      }

      // Fallback nativo: usa Supabase Auth para enviar email de recuperação
      // Redirect configurado via VITE_AUTH_REDIRECT_URL
      const redirectTo = `${import.meta.env.VITE_AUTH_REDIRECT_URL}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setIsForgotPassword(false);
      setEmail("");
    } catch (error: any) {
      console.error("Erro ao enviar email de recuperação:", error);
      toast.error("Erro ao enviar email de recuperação");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle authentication submit (login or signup).
   *
   * Signup specifics:
   * - Uses `emailRedirectTo` built from `VITE_AUTH_REDIRECT_URL` (or current origin).
   * - Supabase requires the redirect origin to be whitelisted in Auth settings
   *   (Site URL or Additional Redirect URLs). Otherwise, `signUp` returns 400.
   * - Common 400 causes: invalid redirect URL, signups disabled, password policy.
   *
   * Login specifics:
   * - Validates credentials and navigates to dashboard on success.
   */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Validate login credentials
        const result = authLoginSchema.safeParse({ email, password });
        if (!result.success) {
          toast.error(result.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password,
        });
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      } else {
        // Validate signup data
        const result = authSignupSchema.safeParse({ email, password, fullName });
        if (!result.success) {
          toast.error(result.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: result.data.email,
          password: result.data.password,
          options: {
            data: {
              full_name: result.data.fullName,
            },
            // Ensure this origin is whitelisted in Supabase Auth settings
            emailRedirectTo: `${REDIRECT_BASE_URL}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você pode fazer login agora.");
        setIsLogin(true);
      }
    } catch (error: any) {
      // In development, surface the specific error message for debugging.
      if (import.meta.env.DEV && error?.message) {
        console.error("Auth error:", error);
        toast.error(error.message);
      } else {
        // Use generic messages in production to avoid leaking info
        toast.error(isLogin ? "Credenciais inválidas" : "Erro ao criar conta");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
            <Plane className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl">
            {isForgotPassword 
              ? "Recuperar senha" 
              : isLogin 
                ? "Bem-vindo de volta" 
                : "Criar conta"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Digite seu email para receber o link de recuperação"
              : isLogin
                ? "Entre para gerenciar sua agência de viagens"
                : "Cadastre-se para começar a gerenciar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleAuth} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading} variant="gradient">
              {loading 
                ? "Processando..." 
                : isForgotPassword 
                  ? "Enviar link de recuperação"
                  : isLogin 
                    ? "Entrar" 
                    : "Cadastrar"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm space-y-2">
            {!isForgotPassword && isLogin && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="text-primary hover:underline block w-full"
              >
                Esqueci minha senha
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setIsLogin(!isLogin);
              }}
              className="text-primary hover:underline block w-full"
            >
              {isForgotPassword 
                ? "Voltar ao login"
                : isLogin 
                  ? "Não tem conta? Cadastre-se" 
                  : "Já tem conta? Faça login"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
