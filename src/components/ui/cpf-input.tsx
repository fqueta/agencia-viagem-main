import * as React from "react";
import { cn } from "@/lib/utils";

interface CpfInputProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CpfInput = React.forwardRef<HTMLInputElement, CpfInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      const limited = digits.slice(0, 11);
      
      let formatted = limited;
      if (limited.length > 3) {
        formatted = limited.slice(0, 3) + "." + limited.slice(3);
      }
      if (limited.length > 6) {
        formatted = formatted.slice(0, 7) + "." + limited.slice(6);
      }
      if (limited.length > 9) {
        formatted = formatted.slice(0, 11) + "-" + limited.slice(9);
      }

      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      onChange(syntheticEvent);
    };

    return (
      <input
        type="text"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        value={value}
        onChange={handleChange}
        placeholder="000.000.000-00"
        maxLength={14}
        ref={ref}
        {...props}
      />
    );
  },
);
CpfInput.displayName = "CpfInput";

export { CpfInput };
