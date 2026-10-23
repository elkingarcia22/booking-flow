import type { Holiday } from "./colombia";

/**
 * Los festivos federales de Estados Unidos de cualquier año (los que cierran oficinas federales):
 * fechas fijas y «el n-ésimo lunes/jueves del mes». Los nombres van en español, como la app.
 */

const key = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** El n-ésimo día de la semana del mes (`n = -1`: el último). */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month - 1, 1);
    return new Date(year, month - 1, 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7);
  }
  const last = new Date(year, month, 0);
  return new Date(year, month - 1, last.getDate() - ((last.getDay() - weekday + 7) % 7));
}

export function unitedStatesHolidays(year: number): Holiday[] {
  const items: Holiday[] = [
    { date: key(new Date(year, 0, 1)), name: "Año Nuevo" },
    { date: key(nthWeekday(year, 1, 1, 3)), name: "Día de Martin Luther King Jr." },
    { date: key(nthWeekday(year, 2, 1, 3)), name: "Día de los Presidentes" },
    { date: key(nthWeekday(year, 5, 1, -1)), name: "Día de los Caídos" },
    { date: key(new Date(year, 5, 19)), name: "Juneteenth" },
    { date: key(new Date(year, 6, 4)), name: "Día de la Independencia" },
    { date: key(nthWeekday(year, 9, 1, 1)), name: "Día del Trabajo" },
    { date: key(nthWeekday(year, 10, 1, 2)), name: "Día de Colón" },
    { date: key(new Date(year, 10, 11)), name: "Día de los Veteranos" },
    { date: key(nthWeekday(year, 11, 4, 4)), name: "Acción de Gracias" },
    { date: key(new Date(year, 11, 25)), name: "Navidad" },
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
