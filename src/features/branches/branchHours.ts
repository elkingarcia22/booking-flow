/**
 * El horario de cada sucursal, día por día (docs/API_CONTRACT.md, «Configuración › Horario por sucursal»). Antes
 * había un solo horario para todas las sedes y toda la semana; ahora cada sede dice cuándo abre cada día y un día
 * sin horario es un día cerrado. Lo usan la ficha de la sucursal, la reserva (no ofrece horas fuera), la página
 * pública de la sede y la ocupación de Métricas. Sin dependencias: sirve igual en la app y en el backend.
 */

/** Domingo = "0" … sábado = "6", como `Date#getDay`. */
export const WEEKDAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Cómo se muestran: de lunes a domingo. */
export const WEEK_ORDER: readonly WeekdayKey[] = ["1", "2", "3", "4", "5", "6", "0"];

export interface DayHours {
  open: string;
  close: string;
}

export type WeekHours = Record<WeekdayKey, DayHours | null>;

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const minutesOf = (clock: string): number => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** Lunes a sábado con el mismo horario; el domingo cerrado. */
export function defaultWeekHours(open = "09:00", close = "19:00"): WeekHours {
  return { "0": null, "1": { open, close }, "2": { open, close }, "3": { open, close }, "4": { open, close }, "5": { open, close }, "6": { open, close } };
}

/** El horario si tiene la forma correcta (cada día `null` o de «HH:mm» a una hora mayor); si no, `null`. */
export function parseWeekHours(input: unknown): WeekHours | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const week = {} as WeekHours;
  for (const key of WEEKDAY_KEYS) {
    const day = source[key];
    if (day === null || day === undefined) {
      week[key] = null;
      continue;
    }
    if (typeof day !== "object") return null;
    const { open, close } = day as Record<string, unknown>;
    if (typeof open !== "string" || typeof close !== "string" || !CLOCK.test(open) || !CLOCK.test(close) || minutesOf(close) <= minutesOf(open)) return null;
    week[key] = { open, close };
  }
  return week;
}

/** El día de la semana de una fecha «AAAA-MM-DD» (sin depender de la zona del dispositivo). */
export function weekdayOf(date: string): WeekdayKey {
  const day = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))).getUTCDay();
  return WEEKDAY_KEYS[day];
}

/** El horario de ese día, o `null` si la sede cierra. */
export const hoursOnDate = (week: WeekHours, date: string): DayHours | null => week[weekdayOf(date)];

/** Si un tramo (minutos desde la medianoche) cabe entero en el horario del día. */
export function fitsInHours(day: DayHours | null, startMinute: number, durationMin: number): boolean {
  return day !== null && minutesOf(day.open) <= startMinute && startMinute + durationMin <= minutesOf(day.close);
}

/** Los minutos que abre ese día (0 si cierra). */
export const openMinutes = (day: DayHours | null): number => (day ? minutesOf(day.close) - minutesOf(day.open) : 0);

/** Si a esa hora en punto (0–23) la sede está abierta al menos un rato. */
export const openDuringHour = (day: DayHours | null, hour: number): boolean => day !== null && minutesOf(day.open) < (hour + 1) * 60 && hour * 60 < minutesOf(day.close);

/** Lo mismo para cada día: aplica un horario a toda la semana menos a los días cerrados. */
export function applyToOpenDays(week: WeekHours, hours: DayHours): WeekHours {
  return Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, week[key] ? { ...hours } : null])) as WeekHours;
}
