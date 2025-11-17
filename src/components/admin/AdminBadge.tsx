import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AdminBadge() {
  return (
    <Badge variant="default" className="gap-1">
      <Shield className="w-3 h-3" />
      Admin do Sistema
    </Badge>
  );
}
