import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  label?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  label = "Período",
}: DateRangeFilterProps) {
  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-medium flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        {label}
      </Label>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="start-date" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end-date" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
