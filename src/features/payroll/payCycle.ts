/**
 * El ciclo de pago de la nómina (Configuración › Nómina), sin dependencias: lo usan la pantalla y el
 * backend simulado. Un periodo de nómina es un ciclo, no una semana o un mes cualquiera.
 *
 * - **Semanal**: siete días desde el día de la semana elegido (1 = lunes … 7 = domingo).
 * - **Quincenal**: dos por mes, como se paga en Colombia y México: del día elegido a 14 días después, y
 *   de ahí al día anterior del mes siguiente (con el día 1: del 1 al 15 y del 16 a fin de mes).
 * - **Mensual**: del día elegido al día anterior del mes siguiente.
 */

export type PayCycle = "weekly" | "biweekly" | "monthly";

export interface PayCycleSettings {
  cycle: PayCycle;
  startDay: number;
}

const DAY_MS = 86_400_000;
const QUINCENA_DAYS = 15;

/** El último día del mes (28 a 31). */
const lastDay = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();
/** El día `day` del mes, sin pasarse de su último día. */
const dayIn = (year: number, month: number, day: number): Date => new Date(year, month, Math.min(day, lastDay(year, month)));

/** El ciclo que contiene ese día (fechas locales a medianoche). */
export function payCycleWindow(day: Date, settings: PayCycleSettings): { from: Date; to: Date } {
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const startDay = Math.min(Math.max(1, Math.round(settings.startDay) || 1), 28);
  if (settings.cycle === "weekly") {
    // Lunes = 1 … domingo = 7; `getDay` cuenta el domingo como 0.
    const weekday = ((date.getDay() + 6) % 7) + 1;
    const back = (weekday - startDay + 7) % 7;
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
    return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6) };
  }
  // El mes del ciclo: el de la fecha, o el anterior si aún no llega el día de inicio.
  const monthStart = date.getDate() >= startDay ? new Date(date.getFullYear(), date.getMonth(), startDay) : new Date(date.getFullYear(), date.getMonth() - 1, startDay);
  const nextStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, startDay);
  const dayBefore = (value: Date) => new Date(value.getTime() - DAY_MS + 12 * 3_600_000);
  const atMidnight = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (settings.cycle === "monthly") return { from: monthStart, to: atMidnight(dayBefore(nextStart)) };
  const middle = dayIn(monthStart.getFullYear(), monthStart.getMonth(), startDay + QUINCENA_DAYS);
  // Con un inicio tardío la segunda quincena puede caer en el mes siguiente.
  const second = middle.getTime() > monthStart.getTime() ? middle : new Date(monthStart.getFullYear(), monthStart.getMonth(), startDay + QUINCENA_DAYS);
  return date < second ? { from: monthStart, to: atMidnight(dayBefore(second)) } : { from: second, to: atMidnight(dayBefore(nextStart)) };
}

/** El ciclo anterior (`-1`) o el siguiente (`1`) al que contiene ese día. */
export function shiftPayCycle(day: Date, settings: PayCycleSettings, delta: -1 | 1): { from: Date; to: Date } {
  const current = payCycleWindow(day, settings);
  const pivot = delta < 0 ? new Date(current.from.getFullYear(), current.from.getMonth(), current.from.getDate() - 1) : new Date(current.to.getFullYear(), current.to.getMonth(), current.to.getDate() + 1);
  return payCycleWindow(pivot, settings);
}

/** Cuántos ciclos hay desde el que contiene `from` hasta el que contiene `day` (0 = el mismo). */
export function cyclesBetween(from: Date, day: Date, settings: PayCycleSettings): number {
  let cursor = payCycleWindow(from, settings);
  const target = payCycleWindow(day, settings).from.getTime();
  if (target < cursor.from.getTime()) return -1;
  let count = 0;
  while (cursor.from.getTime() < target && count < 1000) {
    cursor = shiftPayCycle(cursor.from, settings, 1);
    count += 1;
  }
  return count;
}
