import { z } from "zod";

// Customer validation schema
export const customerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  phone: z
    .string()
    .trim()
    .min(1, "Telefone é obrigatório")
    .regex(/^[\d\s\(\)\-\+]+$/, "Telefone deve conter apenas números e símbolos válidos")
    .max(20, "Telefone deve ter no máximo 20 caracteres"),
  cpf: z
    .string()
    .trim()
    .refine((val) => val === "" || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(val), "CPF deve estar no formato 000.000.000-00")
    .transform((val) => val || undefined),
  birth_date: z
    .string()
    .refine((val) => val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val), "Data inválida")
    .transform((val) => val || undefined),
  address: z
    .string()
    .trim()
    .max(200, "Endereço deve ter no máximo 200 caracteres")
    .transform((val) => val || undefined),
  city: z
    .string()
    .trim()
    .max(100, "Cidade deve ter no máximo 100 caracteres")
    .transform((val) => val || undefined),
  state: z
    .string()
    .trim()
    .max(2, "Estado deve ter 2 caracteres")
    .transform((val) => val || undefined),
  zip_code: z
    .string()
    .trim()
    .refine(
      (val) => val === "" || /^\d{5}-\d{3}$/.test(val), 
      "CEP deve estar no formato 00000-000"
    )
    .transform((val) => val || undefined),
});

// Quick add customer validation schema (essential fields only)
export const quickAddCustomerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  phone: z
    .string()
    .trim()
    .min(1, "Telefone é obrigatório")
    .regex(/^[\d\s\(\)\-\+]+$/, "Telefone deve conter apenas números e símbolos válidos")
    .max(20, "Telefone deve ter no máximo 20 caracteres"),
  cpf: z
    .string()
    .trim()
    .refine((val) => val === "" || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(val), "CPF deve estar no formato 000.000.000-00")
    .optional()
    .or(z.literal("")),
  birth_date: z
    .string()
    .refine((val) => val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val), "Data inválida")
    .optional()
    .or(z.literal("")),
});

// Travel package validation schema
export const packageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  description: z
    .string()
    .trim()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .transform((val) => val || undefined),
  destination: z
    .string()
    .trim()
    .min(1, "Destino é obrigatório")
    .max(200, "Destino deve ter no máximo 200 caracteres"),
  duration_days: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Duração deve ser maior que 0")
    .refine((val) => Number(val) <= 365, "Duração deve ser no máximo 365 dias"),
  price: z
    .string()
    .transform((val) => {
      // Remove formatação de moeda (R$, pontos e vírgulas)
      const cleanValue = val.replace(/[R$\s.]/g, '').replace(',', '.');
      return cleanValue;
    })
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Preço deve ser maior que 0")
    .refine((val) => Number(val) <= 1000000, "Preço deve ser no máximo R$ 1.000.000"),
  available_spots: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Vagas deve ser 0 ou maior")
    .refine((val) => Number(val) <= 1000, "Vagas deve ser no máximo 1000"),
});

// Order validation schema
export const orderSchema = z.object({
  customer_id: z.string().uuid("Selecione um cliente válido"),
  package_id: z.string().uuid("Selecione um pacote válido"),
  number_of_travelers: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Número de viajantes deve ser maior que 0")
    .refine((val) => Number(val) <= 100, "Número de viajantes deve ser no máximo 100"),
  travel_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  special_requests: z
    .string()
    .trim()
    .max(1000, "Solicitações especiais deve ter no máximo 1000 caracteres")
    .transform((val) => val || undefined),
});

// Authentication validation schemas
export const authLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  password: z
    .string()
    .min(1, "Senha é obrigatória"),
});

export const authSignupSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(72, "Senha deve ter no máximo 72 caracteres"),
  fullName: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(72, "Senha deve ter no máximo 72 caracteres")
    .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "A senha deve conter ao menos um número"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// User management schemas (admin)
export const userCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  full_name: z
    .string()
    .trim()
    .min(3, "O nome deve ter no mínimo 3 caracteres")
    .max(100, "O nome deve ter no máximo 100 caracteres"),
  phone: z
    .string()
    .trim()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional(),
  role: z.enum(["admin", "agent", "user"], {
    required_error: "Selecione um role",
  }),
  organization_id: z.string().uuid({
    message: "Selecione uma organização válida"
  }),
  org_role: z.enum(["owner", "admin", "agent", "viewer"], {
    required_error: "Selecione o papel na organização"
  }),
});

export const userUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, "O nome deve ter no mínimo 3 caracteres")
    .max(100, "O nome deve ter no máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255, "Email deve ter no máximo 255 caracteres"),
  phone: z
    .string()
    .trim()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional(),
  role: z.enum(["admin", "agent", "user"], {
    required_error: "Selecione um role",
  }),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type QuickAddCustomerFormData = z.infer<typeof quickAddCustomerSchema>;
export type PackageFormData = z.infer<typeof packageSchema>;
export type OrderFormData = z.infer<typeof orderSchema>;
export type AuthLoginData = z.infer<typeof authLoginSchema>;
export type AuthSignupData = z.infer<typeof authSignupSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type UserCreateData = z.infer<typeof userCreateSchema>;
export type UserUpdateData = z.infer<typeof userUpdateSchema>;
