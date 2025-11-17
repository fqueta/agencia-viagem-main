import { Button } from "@/components/ui/button";

interface QuickFilterButtonsProps {
  value: string;
  onChange: (value: string) => void;
}

const filters = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "year", label: "Este Ano" },
  { value: "7days", label: "Últimos 7d" },
  { value: "30days", label: "Últimos 30d" },
  { value: "90days", label: "Últimos 90d" },
  { value: "all", label: "Tudo" },
];

export function QuickFilterButtons({ value, onChange }: QuickFilterButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={value === filter.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
