/**
 * Los festivos de Colombia de cualquier año, calculados (Ley 51 de 1983, «Ley Emiliani»): unos caen
 * en su fecha, otros se corren al lunes siguiente y los de Semana Santa salen de la Pascua. Sin
 * dependencias: lo usan la pantalla y el servidor.
 */

export interface Holiday {
  /** AAAA-MM-DD. */
  date: string;
  name: string;
}

const key = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const plusDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** Al lunes siguiente, si no cae en lunes. */
const nextMonday = (date: Date): Date => plusDays(date, (8 - date.getDay()) % 7);

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const FIXED: readonly [number, number, string][] = [
  [1, 1, "Año Nuevo"],
  [5, 1, "Día del Trabajo"],
  [7, 20, "Día de la Independencia"],
  [8, 7, "Batalla de Boyacá"],
  [12, 8, "Inmaculada Concepción"],
  [12, 25, "Navidad"],
];

const MOVED: readonly [number, number, string][] = [
  [1, 6, "Reyes Magos"],
  [3, 19, "San José"],
  [6, 29, "San Pedro y San Pablo"],
  [8, 15, "Asunción de la Virgen"],
  [10, 12, "Día de la Raza"],
  [11, 1, "Todos los Santos"],
  [11, 11, "Independencia de Cartagena"],
];

/** Los 18 festivos del año, en orden. */
export function colombianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const items: Holiday[] = [
    ...FIXED.map(([month, day, name]) => ({ date: key(new Date(year, month - 1, day)), name })),
    ...MOVED.map(([month, day, name]) => ({ date: key(nextMonday(new Date(year, month - 1, day))), name })),
    { date: key(plusDays(easter, -3)), name: "Jueves Santo" },
    { date: key(plusDays(easter, -2)), name: "Viernes Santo" },
    { date: key(nextMonday(plusDays(easter, 39))), name: "Ascensión del Señor" },
    { date: key(nextMonday(plusDays(easter, 60))), name: "Corpus Christi" },
    { date: key(nextMonday(plusDays(easter, 68))), name: "Sagrado Corazón" },
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/** El festivo de esa fecha (AAAA-MM-DD), si lo es. */
export function colombianHolidayOn(date: string): Holiday | undefined {
  return colombianHolidays(Number(date.slice(0, 4))).find((item) => item.date === date);
}
