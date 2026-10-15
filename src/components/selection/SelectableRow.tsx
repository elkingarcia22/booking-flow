import * as React from "react";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { SelectMark } from "./SelectMark";

export interface SelectableRowProps {
  /** `radio`: se elige una; `checkbox`: se pueden varias. Pone el rol, el `aria-checked` y la forma de la marca. */
  role: "radio" | "checkbox";
  checked: boolean;
  /** Lo que lee el lector de pantalla: el nombre completo de la opción. */
  label: string;
  /** Lo de la izquierda: una foto, un avatar o un `IconTile`. */
  leading?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Para poner los dedos: `lg` sube el alto mínimo de la fila. */
  size?: "default" | "lg";
  /** Un enlace bajo el texto —«Ver perfil»—: un botón no va dentro de otro, así que va al lado de la fila. */
  action?: { label: string; ariaLabel: string; onClick: () => void };
  /** Algo más bajo el texto, dentro de la misma tarjeta (la cantidad de un producto elegido). */
  below?: React.ReactNode;
  className?: string;
  /** El texto de la opción: se apila en líneas. */
  children: React.ReactNode;
}

/**
 * Una fila de lista para elegir, con foto, texto y la marca de elegir a la derecha (`SelectMark`). El
 * fondo —puntero y elegido— es de la tarjeta entera, también cuando hay un enlace o algo más debajo.
 * Es la fila de las hojas de sede, servicios y barbero de la reserva.
 */
export function SelectableRow({ role, checked, label, leading, onClick, disabled = false, size = "default", action, below, className, children }: SelectableRowProps) {
  const hasBelow = Boolean(action || below);
  // `foreground/5` aclara en oscuro y oscurece en claro: `bg-muted` sobre un popover se veía como un hueco negro.
  const surface = cn("rounded-xl transition-colors duration-fast hover:bg-foreground/5 motion-reduce:transition-none", checked && "bg-primary/10 hover:bg-primary/15");
  const row = (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group/row flex w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        !hasBelow && surface,
        !hasBelow && "active:bg-foreground/10",
        size === "lg" ? "min-h-16 py-2.5" : "min-h-14 py-2",
        hasBelow && "pb-1",
        !hasBelow && className
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      <SelectMark kind={role} checked={checked} />
    </button>
  );
  if (!hasBelow) return row;
  return (
    <div data-slot="selectable-row" className={cn(surface, className)}>
      {row}
      {/* Alineado con el texto de la fila (relleno + foto + hueco): debajo y no al lado, para que la fila conserve su ancho. */}
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 pr-2", size === "lg" ? "pl-[4.25rem]" : "pl-14")}>
        {below}
        {action && (
          <Button type="button" variant="link" size="sm" onClick={action.onClick} aria-label={action.ariaLabel} className="h-auto gap-1 px-0 py-1 text-xs font-medium">
            {action.label}
            <ThemaIcon name="chevronRight" size="xs" data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}
