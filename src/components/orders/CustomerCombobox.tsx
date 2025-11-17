import { useState } from "react";
import { useCombobox } from "downshift";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  cpf?: string;
}

interface CustomerComboboxProps {
  value: string;
  onChange: (customerId: string) => void;
  customers: Customer[];
  onCreateNew: () => void;
}

export const CustomerCombobox = ({
  value,
  onChange,
  customers,
  onCreateNew,
}: CustomerComboboxProps) => {
  const [inputValue, setInputValue] = useState("");

  const filteredCustomers = customers.filter((customer) => {
    const search = inputValue.toLowerCase();
    return (
      customer.full_name.toLowerCase().includes(search) ||
      customer.email.toLowerCase().includes(search) ||
      customer.phone.includes(search) ||
      (customer.cpf && customer.cpf.includes(search))
    );
  });

  const selectedCustomer = customers.find((c) => c.id === value);

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    openMenu,
  } = useCombobox({
    items: filteredCustomers,
    inputValue,
    onInputValueChange: ({ inputValue }) => {
      setInputValue(inputValue || "");
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) {
        onChange(selectedItem.id);
        setInputValue(selectedItem.full_name);
      }
    },
    itemToString: (item) => item?.full_name || "",
    selectedItem: selectedCustomer || null,
  });

  return (
    <div className="space-y-2">
      <Label>Cliente *</Label>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            {...getInputProps({
              onFocus: openMenu,
              placeholder: selectedCustomer
                ? selectedCustomer.full_name
                : "Digite para buscar cliente...",
              className: "pl-9",
            })}
          />
          {selectedCustomer && (
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
              Criar Novo Cliente
            </Button>

            {filteredCustomers.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Nenhum cliente encontrado
              </div>
            ) : (
              filteredCustomers.map((customer, index) => (
                <div
                  key={customer.id}
                  {...getItemProps({ item: customer, index })}
                  className={cn(
                    "px-3 py-2 cursor-pointer border-b last:border-b-0",
                    highlightedIndex === index && "bg-accent",
                    value === customer.id && "bg-accent/50"
                  )}
                >
                  <div className="font-medium">{customer.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {customer.email} • {customer.phone}
                    {customer.cpf && ` • CPF: ${customer.cpf}`}
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
