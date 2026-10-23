/**
 * Las cuentas por pagar (docs/API_CONTRACT.md, «Gastos › Por pagar»): en qué días de un mes vence cada gasto fijo,
 * según su frecuencia, su inicio y su día de pago, y en qué estado está cada vencimiento. Sin dependencias: lo usan la
 * pantalla y el servidor.
 */

export type PayableFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual";

export interface PayableExpense {
  kind: "fixed" | "variable";
  frequency: PayableFrequency | null;
  /** AAAA-MM-DD: desde cuándo corre. */
  start: string;
  endDate?: string | null;
  /** Día del mes en que se paga (1–31); sin él, el del inicio. */
  dueDay?: number | null;
}

const DAY_MS = 86_400_000;
const MONTH_STEP: Readonly<Partial<Record<PayableFrequency, number>>> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
const DAY_STEP: Readonly<Partial<Record<PayableFrequency, number>>> = { weekly: 7, biweekly: 14 };
/** Cuántos días antes se avisa que vence. */
export const DUE_SOON_DAYS = 7;

const iso = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const utc = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const fromUtc = (time: number) => {
  const date = new Date(time);
  return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Los días («AAAA-MM-DD») en que vence un gasto fijo dentro del mes «AAAA-MM». Un variable no vence. */
export function dueDatesIn(expense: PayableExpense, month: string): string[] {
  if (expense.kind !== "fixed" || !expense.frequency) return [];
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const first = iso(year, monthNumber, 1);
  const last = iso(year, monthNumber, lastDay(year, monthNumber));
  const alive = (date: string) => date >= expense.start && (!expense.endDate || date <= expense.endDate) && date >= first && date <= last;

  const dayStep = DAY_STEP[expense.frequency];
  if (dayStep) {
    // Cada 7 o 14 días desde el inicio: los que caen en el mes.
    const startTime = utc(expense.start);
    const offset = Math.max(0, Math.ceil((utc(first) - startTime) / (dayStep * DAY_MS)));
    const dates: string[] = [];
    for (let time = startTime + offset * dayStep * DAY_MS; time <= utc(last); time += dayStep * DAY_MS) dates.push(fromUtc(time));
    return dates.filter(alive);
  }

  const monthStep = MONTH_STEP[expense.frequency] ?? 1;
  const startMonths = Number(expense.start.slice(0, 4)) * 12 + Number(expense.start.slice(5, 7)) - 1;
  const months = year * 12 + monthNumber - 1 - startMonths;
  if (months < 0 || months % monthStep !== 0) return [];
  const day = Math.min(expense.dueDay ?? Number(expense.start.slice(8, 10)), lastDay(year, monthNumber));
  const date = iso(year, monthNumber, day);
  return alive(date) ? [date] : [];
}

export type PayableStatus = "paid" | "overdue" | "dueSoon" | "upcoming";

/** El estado de un vencimiento: pagado, vencido, vence en una semana o más adelante. */
export function payableStatus(dueDate: string, today: string, paid: boolean): PayableStatus {
  if (paid) return "paid";
  if (dueDate < today) return "overdue";
  return utc(dueDate) - utc(today) <= DUE_SOON_DAYS * DAY_MS ? "dueSoon" : "upcoming";
}
