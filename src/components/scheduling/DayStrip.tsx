import * as React from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { Text } from "@/components/typography";
import { useDragScroll } from "@/hooks/useDragScroll";
import { useLocale, useT } from "@/i18n";
import { cn } from "@/lib/utils";

export interface DayStripProps {
  /** El primer día que se ofrece (hoy, o mañana si hoy ya cerró). */
  first: Date;
  /** Cuántos días hacia delante. */
  count: number;
  value: Date;
  onChange: (day: Date) => void;
  /** Días (`AAAA-MM-DD`) que llevan un punto: con citas, con algo pendiente. */
  marked?: ReadonlySet<string>;
  /** `lg` agranda cada día para el dedo: tablet o kiosco. */
  size?: "default" | "lg";
  /** Lo que lee el lector de pantalla para el grupo; por defecto, «Elige el día». */
  ariaLabel?: string;
  className?: string;
}

const dayKey = (day: Date): string => format(day, "yyyy-MM-dd");

/**
 * La tira de días: el día de la semana arriba y el número grande, en fila y deslizable (con el dedo,
 * arrastrando con el ratón o con la rueda). El de hoy se llama «Hoy». Lo que se toca aquí cambia todo
 * lo de debajo —las horas libres de ese día—.
 */
export function DayStrip({ first, count, value, onChange, marked, size = "default", ariaLabel, className }: DayStripProps) {
  const t = useT();
  const { formatDate } = useLocale();
  const row = useDragScroll<HTMLDivElement>({ follow: dayKey(value) });
  const days = React.useMemo(() => Array.from({ length: count }, (_, index) => addDays(startOfDay(first), index)), [first, count]);
  const today = new Date();

  return (
    <div ref={row} role="radiogroup" aria-label={ariaLabel ?? t("schedule.pickDay")} data-slot="day-strip" className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {days.map((day) => {
        const selected = isSameDay(day, value);
        return (
          <button
            key={dayKey(day)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-pressed={selected}
            aria-label={formatDate(day, { weekday: "long", day: "numeric", month: "long" })}
            onClick={() => onChange(day)}
            className={cn(
              "relative flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-[background-color,border-color,transform] duration-fast ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:transition-none",
              size === "lg" ? "h-20 w-16" : "h-16 w-14",
              selected ? "border-primary bg-primary shadow-md" : "border-border bg-surface hover:border-primary/40 hover:bg-surface-subtle"
            )}
          >
            {/* Sobre el color principal va su propio texto (`primary-foreground`), no el «inverso»: así contrasta en todo tema. */}
            <Text as="span" size="xs" weight="medium" tone={selected ? undefined : "muted"} className={cn("uppercase tracking-wide", selected && "text-primary-foreground/80")}>
              {isSameDay(day, today) ? t("schedule.today") : formatDate(day, { weekday: "short" }).replace(".", "")}
            </Text>
            <Text as="span" size="xl" weight="semibold" tabular className={selected ? "text-primary-foreground" : undefined}>
              {day.getDate()}
            </Text>
            {marked?.has(dayKey(day)) && <span aria-hidden className={cn("absolute bottom-1.5 size-1.5 rounded-full", selected ? "bg-primary-foreground" : "bg-primary")} />}
          </button>
        );
      })}
    </div>
  );
}
