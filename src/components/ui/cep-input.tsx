import * as React from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface CepInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddressFound?: (address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  }) => void;
}

const CepInput = React.forwardRef<HTMLInputElement, CepInputProps>(
  ({ className, value, onChange, onAddressFound, ...props }, ref) => {
    const [loading, setLoading] = React.useState(false);
    const lastFetchedCep = React.useRef<string>("");

    const formatCep = (inputValue: string): string => {
      const digits = inputValue.replace(/\D/g, "");
      const limited = digits.slice(0, 8);
      
      if (limited.length > 5) {
        return limited.slice(0, 5) + "-" + limited.slice(5);
      }
      
      return limited;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCep(e.target.value);
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(newEvent);
    };

    const fetchAddress = React.useCallback(async (cep: string) => {
      const cleanedCep = cep.replace(/\D/g, "");
      
      if (cleanedCep.length !== 8) return;
      
      setLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data: ViaCepResponse = await response.json();
        
        if (data.erro) {
          toast.error("CEP não encontrado");
          return;
        }
        
        onAddressFound?.({
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
        });
        
        toast.success("Endereço encontrado!");
      } catch (error) {
        toast.error("Erro ao buscar CEP");
      } finally {
        setLoading(false);
      }
    }, [onAddressFound]);

    React.useEffect(() => {
      const cleanedCep = value.replace(/\D/g, "");
      
      // Reseta referência se CEP incompleto
      if (cleanedCep.length < 8) {
        lastFetchedCep.current = "";
        return;
      }
      
      // Só consulta se CEP diferente do último consultado
      if (cleanedCep.length === 8 && cleanedCep !== lastFetchedCep.current) {
        lastFetchedCep.current = cleanedCep;
        fetchAddress(cleanedCep);
      }
    }, [value, fetchAddress]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          className={cn(className, loading && "pr-10")}
          value={value}
          onChange={handleChange}
          placeholder="00000-000"
          {...props}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }
);

CepInput.displayName = "CepInput";

export { CepInput };
