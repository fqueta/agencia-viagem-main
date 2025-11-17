import { useState } from "react";
import { useCombobox } from "downshift";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TravelPackage {
  id: string;
  name: string;
  destination: string;
  duration_days: number;
  price: number;
  available_spots: number;
}

interface PackageComboboxProps {
  value: string;
  onChange: (packageId: string) => void;
  packages: TravelPackage[];
  onCreateNew: () => void;
}

export const PackageCombobox = ({
  value,
  onChange,
  packages,
  onCreateNew,
}: PackageComboboxProps) => {
  const [inputValue, setInputValue] = useState("");

  const filteredPackages = packages.filter((pkg) => {
    const search = inputValue.toLowerCase();
    return (
      pkg.name.toLowerCase().includes(search) ||
      pkg.destination.toLowerCase().includes(search)
    );
  });

  const selectedPackage = packages.find((p) => p.id === value);

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    openMenu,
  } = useCombobox({
    items: filteredPackages,
    inputValue,
    onInputValueChange: ({ inputValue }) => {
      setInputValue(inputValue || "");
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) {
        onChange(selectedItem.id);
        setInputValue(selectedItem.name);
      }
    },
    itemToString: (item) => item?.name || "",
    selectedItem: selectedPackage || null,
  });

  return (
    <div className="space-y-2">
      <Label>Pacote *</Label>
      <div className="relative">
        <div className="relative">
          <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            {...getInputProps({
              onFocus: openMenu,
              placeholder: selectedPackage
                ? selectedPackage.name
                : "Digite para buscar pacote...",
              className: "pl-9",
            })}
          />
          {selectedPackage && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          )}
        </div>

        {isOpen && (
          <div
            {...getMenuProps()}
            className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-80 overflow-auto"
          >
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-2 border-b rounded-none"
              onClick={() => {
                onCreateNew();
              }}
            >
              <Plus className="h-4 w-4" />
              Criar Novo Pacote
            </Button>

            {filteredPackages.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Nenhum pacote encontrado
              </div>
            ) : (
              filteredPackages.map((pkg, index) => (
                <div
                  key={pkg.id}
                  {...getItemProps({ item: pkg, index })}
                  className={cn(
                    "px-3 py-2 cursor-pointer border-b last:border-b-0",
                    highlightedIndex === index && "bg-accent",
                    value === pkg.id && "bg-accent/50"
                  )}
                >
                  <div className="font-medium">{pkg.name}</div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {pkg.destination}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">
                      R$ {Number(pkg.price).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {pkg.duration_days} dias
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {pkg.available_spots} vagas
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
