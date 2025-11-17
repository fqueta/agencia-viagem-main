import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Remove formatação de CPF (pontos e traço)
 * Entrada: "123.456.789-00"
 * Saída: "12345678900"
 */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Remove formatação de telefone (parênteses, espaços e traço)
 * Entrada: "(11) 98765-4321"
 * Saída: "11987654321"
 */
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Remove formatação de moeda e converte para número
 * Entrada: "R$ 1.234,56"
 * Saída: 1234.56
 */
export function cleanCurrency(value: string): number {
  const cleaned = value.replace(/[R$\s.]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

/**
 * Formata número para moeda brasileira
 * Entrada: 1234.56
 * Saída: "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Formata telefone brasileiro
 * Entrada: "11987654321"
 * Saída: "(11) 98765-4321"
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const limited = digits.slice(0, 11);
  
  let formatted = limited;
  if (limited.length > 0) {
    formatted = "(" + limited;
  }
  if (limited.length > 2) {
    formatted = formatted.slice(0, 3) + ") " + limited.slice(2);
  }
  if (limited.length > 7) {
    formatted = formatted.slice(0, 10) + "-" + limited.slice(7);
  } else if (limited.length > 6) {
    formatted = formatted.slice(0, 9) + "-" + limited.slice(6);
  }
  
  return formatted;
}

/**
 * Formata CPF
 * Entrada: "12345678900"
 * Saída: "123.456.789-00"
 */
export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  const limited = digits.slice(0, 11);
  
  let formatted = limited;
  if (limited.length > 3) {
    formatted = limited.slice(0, 3) + "." + limited.slice(3);
  }
  if (limited.length > 6) {
    formatted = formatted.slice(0, 7) + "." + limited.slice(6);
  }
  if (limited.length > 9) {
    formatted = formatted.slice(0, 11) + "-" + limited.slice(9);
  }
  
  return formatted;
}

/**
 * Remove formatação de CEP
 * Entrada: "12345-678"
 * Saída: "12345678"
 */
export function cleanCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

/**
 * Formata CEP brasileiro
 * Entrada: "12345678"
 * Saída: "12345-678"
 */
export function formatCep(cep: string): string {
  const digits = cep.replace(/\D/g, "");
  const limited = digits.slice(0, 8);
  
  if (limited.length > 5) {
    return limited.slice(0, 5) + "-" + limited.slice(5);
  }
  
  return limited;
}
