import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

interface ValueRangeFilterProps {
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  label?: string;
}

export function ValueRangeFilter({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  label = "Faixa de Valor",
}: ValueRangeFilterProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        {label}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="min-value" className="text-xs text-muted-foreground">
            Mínimo
          </Label>
          <Input
            id="min-value"
            type="number"
            placeholder="R$ 0,00"
            value={minValue}
            onChange={(e) => onMinChange(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="max-value" className="text-xs text-muted-foreground">
            Máximo
          </Label>
          <Input
            id="max-value"
            type="number"
            placeholder="R$ 0,00"
            value={maxValue}
            onChange={(e) => onMaxChange(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
      </div>
    </div>
  );
}
