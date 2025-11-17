export const PAYMENT_METHODS = [
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "PIX", label: "PIX" },
  { value: "Boleto", label: "Boleto" },
  { value: "Depósito", label: "Depósito" },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]["value"];
