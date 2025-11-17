import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface StatusCheckboxGroupProps {
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
}

const statuses = [
  { value: "pending", label: "Pendente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "completed", label: "Completo" },
  { value: "cancelled", label: "Cancelado" },
];

export function StatusCheckboxGroup({ selectedStatuses, onChange }: StatusCheckboxGroupProps) {
  const handleToggle = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Status dos Pedidos</Label>
      <div className="flex flex-wrap gap-4">
        {statuses.map((status) => (
          <div key={status.value} className="flex items-center gap-2">
            <Checkbox
              id={`status-${status.value}`}
              checked={selectedStatuses.includes(status.value)}
              onCheckedChange={() => handleToggle(status.value)}
            />
            <Label
              htmlFor={`status-${status.value}`}
              className="text-sm cursor-pointer"
            >
              {status.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
