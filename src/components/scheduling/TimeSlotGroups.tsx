import * as React from "react";
import { Text } from "@/components/typography";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";

export interface TimeSlotOption {
  /** Lo que vuelve en `onPick`: la hora tal como la conoce quien llama («09:30»). */
  time: string;
  /** Lo que se lee: «9:30 a. m.». */
  label: string;
  /** Lo que anuncia el lector de pantalla; por defecto, `label`. */
  ariaLabel?: string;
  /** La hora ya elegida: marcada y con su check. */
  selected?: boolean;
  disabled?: boolean;
  /** Algo a la derecha de la hora: las caras de quienes pueden. */
  trailing?: React.ReactNode;
}

export interface TimeSlotGroup {
  id: string;
  /** El título de la franja: «Mañana». */
  label: string;
  options: readonly TimeSlotOption[];
}

export interface TimeSlotGroupsProps {
  groups: readonly TimeSlotGroup[];
  onPick: (time: string) => void;
  size?: "default" | "lg";
  className?: string;
}

/**
 * Las horas del día por franja —mañana, tarde, noche—, cada una una pastilla que se toca para
 * elegirla. La elegida se queda a la vista con su check; cada hora puede llevar algo a la derecha
 * (las caras de los barberos libres). Quien llama arma las franjas: el componente solo las pinta.
 */
export function TimeSlotGroups({ groups, onPick, size = "default", className }: TimeSlotGroupsProps) {
  return (
    <div data-slot="time-slot-groups" className={cn("flex flex-col gap-5", className)}>
      {groups.map((group) => (
        <section key={group.id} aria-label={group.label} className="flex flex-col gap-2.5">
          <Text size="xs" weight="semibold" tone="muted" className="uppercase tracking-wide">
            {group.label}
          </Text>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => (
              <button
                key={option.time}
                type="button"
                aria-label={option.ariaLabel ?? option.label}
                aria-pressed={Boolean(option.selected)}
                disabled={option.disabled || option.selected}
                onClick={() => onPick(option.time)}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-full border px-3 tabular-nums transition-[background-color,border-color,transform] duration-fast ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-reduce:transition-none",
                  size === "lg" ? "h-11 min-w-[5.5rem]" : "h-9 min-w-[4.75rem]",
                  option.selected ? "border-primary bg-primary/10" : "border-border bg-surface hover:-translate-y-px hover:border-primary hover:bg-primary/5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:bg-surface"
                )}
              >
                {option.selected && <ThemaIcon name="check" size="xs" tone="primary" />}
                <Text as="span" size="sm" weight="medium" tone={option.selected ? "primary" : "default"}>
                  {option.label}
                </Text>
                {option.trailing}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
