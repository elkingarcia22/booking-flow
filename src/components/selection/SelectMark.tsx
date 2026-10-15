import { cva } from "class-variance-authority";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";

const selectMarkVariants = cva("flex shrink-0 items-center justify-center border transition-colors duration-fast motion-reduce:transition-none", {
  variants: {
    kind: { radio: "rounded-full", checkbox: "rounded-md" },
    size: { default: "size-6", sm: "size-5" },
    checked: {
      true: "border-primary bg-primary text-primary-foreground",
      // El borde se enciende cuando el grupo `row` que la contiene (SelectableRow) recibe el puntero.
      false: "border-input bg-background group-hover/row:border-primary/50",
    },
  },
  defaultVariants: { kind: "radio", size: "default", checked: false },
});

export interface SelectMarkProps {
  /** Círculo si se elige una opción; casilla si se pueden varias. */
  kind?: "radio" | "checkbox";
  checked?: boolean;
  size?: "default" | "sm";
  className?: string;
}

/**
 * La marca de elegir de las opciones que no son un control nativo —tarjetas y filas con foto, texto y
 * acciones—: vacía mientras no se elige y rellena, con su check, al elegirla. Es decorativa: el rol y
 * el estado los lleva el botón que la contiene (`role="radio"` o `"checkbox"` con `aria-checked`).
 */
export function SelectMark({ kind = "radio", checked = false, size = "default", className }: SelectMarkProps) {
  return (
    <span aria-hidden data-slot="select-mark" data-kind={kind} data-checked={checked || undefined} className={cn(selectMarkVariants({ kind, size, checked }), className)}>
      {checked && <ThemaIcon name="check" size="xs" tone="inverse" />}
    </span>
  );
}
