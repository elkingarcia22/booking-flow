import { colombianHolidays, type Holiday } from "./colombia";
import { unitedStatesHolidays } from "./unitedStates";

export type { Holiday } from "./colombia";
export { colombianHolidays, colombianHolidayOn, easterSunday } from "./colombia";
export { unitedStatesHolidays } from "./unitedStates";

/** Los festivos del país de la sede («Colombia», «Estados Unidos»); otro país, ninguno por ahora. */
export function holidaysFor(country: string, year: number): Holiday[] {
  const normalized = country.trim().toLowerCase();
  if (normalized === "colombia") return colombianHolidays(year);
  if (normalized === "estados unidos" || normalized === "united states" || normalized === "usa") return unitedStatesHolidays(year);
  return [];
}

export function holidayOn(country: string, date: string): Holiday | undefined {
  return holidaysFor(country, Number(date.slice(0, 4))).find((item) => item.date === date);
}
