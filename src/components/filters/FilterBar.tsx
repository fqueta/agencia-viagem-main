import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface FilterBarProps {
  children: React.ReactNode;
  onClear: () => void;
  activeFiltersCount: number;
  resultsCount?: number;
  totalCount?: number;
  /**
   * Optional grid class override to control column layout of children.
   * Example: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4".
   */
  gridClassName?: string;
}

/**
 * Componente de barra de filtros com cabeçalho e conteúdo colapsável.
 * Permite exibir contagem de resultados e limpar filtros ativos.
 *
 * EN: Filter bar component with a collapsible content area.
 * Supports showing result counts and clearing active filters.
 */
export function FilterBar({ children, onClear, activeFiltersCount, resultsCount, totalCount, gridClassName }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card className="mb-6 border bg-card rounded-xl shadow-sm">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            {resultsCount !== undefined && totalCount !== undefined && (
              <span className="text-sm text-muted-foreground">
                Mostrando <span className="font-semibold text-foreground">{resultsCount}</span> de{" "}
                <span className="font-semibold text-foreground">{totalCount}</span> resultados
              </span>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="gap-2 text-destructive hover:text-destructive">
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>
          )}
        </div>
        {isExpanded && (
          <div className={gridClassName ?? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"}>{children}</div>
        )}
      </div>
    </Card>
  );
}
