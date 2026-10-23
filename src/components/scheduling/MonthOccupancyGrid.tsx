import * as React from "react";
import { addDays, eachDayOfInterval, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import type { Locale } from "date-fns";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n";
import { calendarLocale } from "@/components/date/calendarLocale";
import { Progress } from "@/components/ui/progress";

/**
 * MONTH OCCUPANCY GRID
 *
 * El mes de un barbero (o del equipo) día por día: cuánta de su jornada
 * está reservada, con el porcentaje en grande, la barra que lo dibuja y
 * cuántas citas hay. Un día sin jornada se atenúa y lo dice. Cada día es un
 * botón: tocarlo lleva a ese día en la rejilla.
 *
 * La semana empieza en lunes y los nombres de los días salen del idioma
 * activo, no de una lista escrita a mano.
 */

export interface MonthOccupancyDay {
  date: Date;
  /** 0–1 de la jornada reservada; `null` si no trabaja ese día. */
  occupancy: number | null;
  /** Cuántas citas lleva el día. */
  count: number;
  /** Una marca pequeña junto al número del día (p. ej. «día pesado»); va fuera del botón, con su propio tooltip. */
  marker?: React.ReactNode;
}

export interface MonthOccupancyGridProps {
  month: Date;
  days: readonly MonthOccupancyDay[];
  selected?: Date | null;
  onSelectDay?: (date: Date) => void;
  today?: Date;
  locale?: Locale;
  className?: string;
}

const WEEK_STARTS_ON = 1 as const;
const WEEKS = 6;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Con más de esto la barra avisa: el día está casi lleno. */
const BUSY_FROM = 0.8;

export function MonthOccupancyGrid({ month, days, selected, onSelectDay, today, locale, className }: MonthOccupancyGridProps) {
  const t = useT();
  const { locale: activeLocale, formatNumber } = useLocale();
  const dateLocale = locale ?? calendarLocale(activeLocale);
  const todayDate = React.useMemo(() => today ?? new Date(), [today]);

  const gridDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
    return eachDayOfInterval({ start, end: addDays(start, WEEKS * 7 - 1) });
  }, [month]);
  const labels = React.useMemo(() => {
    const reference = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: WEEK_STARTS_ON });
    return Array.from({ length: 7 }, (_, index) => capitalize(format(addDays(reference, index), "EEE", { locale: dateLocale })));
  }, [dateLocale]);
  const byDay = React.useMemo(() => new Map(days.map((day) => [format(day.date, "yyyy-MM-dd"), day])), [days]);

  return (
    <div role="grid" aria-label={t("schedule.monthGrid")} className={cn("overflow-hidden rounded-xl border border-border bg-surface", className)}>
      <div role="row" className="grid grid-cols-7 border-b border-border bg-surface-subtle">
        {labels.map((label) => (
          <div key={label} role="columnheader" className="px-2 py-2 text-center text-xs font-semibold text-text-secondary">
            {label}
          </div>
        ))}
      </div>
      {Array.from({ length: WEEKS }, (_, week) => (
        <div key={week} role="row" className="grid grid-cols-7">
          {gridDays.slice(week * 7, week * 7 + 7).map((date) => {
            const info = byDay.get(format(date, "yyyy-MM-dd"));
            const outside = !isSameMonth(date, month);
            const isToday = isSameDay(date, todayDate);
            const isSelected = selected ? isSameDay(date, selected) : false;
            const percent = info?.occupancy === null || info?.occupancy === undefined ? null : Math.round(info.occupancy * 100);
            const countLabel = info ? (info.count === 0 ? t("schedule.noAppointments") : t("schedule.appointments", { count: info.count })) : "";
            const label = `${capitalize(format(date, "EEEE d 'de' MMMM", { locale: dateLocale }))}${percent === null ? `, ${t("schedule.notWorking")}` : `, ${t("schedule.occupancy")} ${percent}%`}${countLabel ? `, ${countLabel}` : ""}`;
            return (
              <div key={date.toISOString()} role="gridcell" className="relative border-b border-r border-border p-1 last:border-r-0">
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={isSelected}
                  disabled={outside}
                  onClick={() => onSelectDay?.(date)}
                  className={cn(
                    "flex min-h-[6.5rem] w-full flex-col gap-1.5 rounded-lg p-2 text-left",
                    "transition-colors duration-fast ease-out-expo motion-reduce:transition-none",
                    outside ? "cursor-default opacity-30" : "hover:bg-surface-subtle",
                    isSelected && "bg-primary/10 ring-1 ring-primary/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday ? "bg-primary font-semibold text-primary-foreground" : "text-text-secondary"
                    )}
                  >
                    {format(date, "d")}
                  </span>
                  {!outside && info && (
                    percent === null ? (
                      <span className="text-xs text-text-muted">{t("schedule.notWorking")}</span>
                    ) : (
                      <>
                        <span className={cn("text-lg font-semibold tabular-nums leading-none", percent >= BUSY_FROM * 100 ? "text-warning" : "text-text-primary")}>
                          {formatNumber(percent)}%
                        </span>
                        <Progress value={percent} aria-hidden="true" className="h-1.5" />
                        <span className="text-xs text-text-muted">{countLabel}</span>
                      </>
                    )
                  )}
                </button>
                {!outside && info?.marker && <span className="absolute right-2 top-2">{info.marker}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
