import { rangesOf } from "@/features/team/shiftRanges";
import { holidayOn } from "@/lib/holidays";
import { branchCountry } from "../settings/branchRules";
import { db } from "../db";
import type { MockTeamMember, MockWorkingRange } from "./seed";

/**
 * Las reglas del horario de trabajo en el servidor (docs/WORK_HOURS_RESEARCH.md, P1), en capas:
 * 1. el **plan** que rige la fecha —vigencia desde/hasta y un ciclo de 1 a 4 semanas—, o si no hay,
 *    el horario fijo de la ficha (`member.schedule`);
 * 2. la **excepción** de esa fecha («solo este día»), que sobrevive a los cambios de plan;
 * 3. el **cierre** de la sede (un festivo marcado como cerrado o un cierre propio), que recorta a todos.
 * `hoursOn` (agenda, reserva, nómina, fichajes) sale de aquí.
 */

export type MockWeekPattern = Record<string, MockWorkingRange | null>;

export interface MockSchedulePlan {
  id: string;
  memberId: string;
  /** AAAA-MM-DD desde el que rige (su lunes es la semana 1 del ciclo). */
  from: string;
  /** Último día en que rige; `null`, sin fin. */
  to: string | null;
  cycleWeeks: number;
  /** Una semana por cada semana del ciclo, con `"0".."6"` (domingo = 0). */
  weeks: MockWeekPattern[];
  /** La plantilla de la que salió, si salió de una. */
  templateName?: string | null;
}

export interface MockScheduleTemplate {
  id: string;
  branchId: string;
  name: string;
  cycleWeeks: number;
  weeks: MockWeekPattern[];
}

/** Un cierre de la sede: el día entero o con horario reducido (`open`). */
export interface MockClosure {
  id: string;
  branchId: string;
  date: string;
  name: string;
  open: { start: string; end: string } | null;
}

/** Un festivo que la sede decidió cerrar (por defecto se trabaja: muchas barberías abren). */
export interface MockHolidayClosed {
  branchId: string;
  date: string;
}

export type MockScheduleChangeKind = "day" | "following" | "plan" | "template" | "copy" | "closure";

/** Un cambio de horario: el historial de Equipo y, si `notify`, el aviso al barbero. */
export interface MockScheduleChange {
  id: string;
  memberId: string;
  branchId: string;
  at: string;
  by: string;
  kind: MockScheduleChangeKind;
  /** La fecha (o la primera) a la que afecta. */
  date: string;
  notify: boolean;
}

export const MAX_CYCLE_WEEKS = 4;
const DAY_MS = 86_400_000;

export const weekdayOf = (day: string): string => String(new Date(`${day}T00:00:00`).getDay());
export const addDaysKey = (day: string, days: number): string => {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export const mondayOf = (day: string): string => addDaysKey(day, -((new Date(`${day}T00:00:00`).getDay() + 6) % 7));

/** En qué semana del ciclo cae la fecha (0 = la primera). */
export function cycleIndex(plan: Pick<MockSchedulePlan, "from" | "cycleWeeks">, day: string): number {
  const weeks = Math.round((new Date(`${mondayOf(day)}T00:00:00`).getTime() - new Date(`${mondayOf(plan.from)}T00:00:00`).getTime()) / (7 * DAY_MS));
  return ((weeks % plan.cycleWeeks) + plan.cycleWeeks) % plan.cycleWeeks;
}

const plansOf = (memberId: string): MockSchedulePlan[] => (db.team.plans ?? []).filter((plan) => plan.memberId === memberId);

/** El plan que rige esa fecha: el que empezó más tarde de los que la cubren. */
export function planOn(memberId: string, day: string): MockSchedulePlan | undefined {
  return plansOf(memberId)
    .filter((plan) => plan.from <= day && (plan.to === null || day <= plan.to))
    .sort((a, b) => b.from.localeCompare(a.from))[0];
}

/** El horario fijo de esa fecha: el del plan (en su semana del ciclo) o el de la ficha. */
export function patternRange(member: MockTeamMember, day: string): MockWorkingRange | null {
  const plan = planOn(member.id, day);
  if (plan) return plan.weeks[cycleIndex(plan, day)]?.[weekdayOf(day)] ?? null;
  return member.schedule[weekdayOf(day)] ?? null;
}

/** El turno de la fecha antes de los cierres: la excepción o el fijo. */
export function shiftRange(member: MockTeamMember, day: string): { range: MockWorkingRange | null; overridden: boolean } {
  const override = db.team.overrides.find((item) => item.memberId === member.id && item.date === day);
  return override ? { range: override.range, overridden: true } : { range: patternRange(member, day), overridden: false };
}

export interface ClosureOn {
  kind: "holiday" | "closure";
  name: string;
  /** La sede no abre ese día (un festivo cerrado o un cierre de día entero). */
  closed: boolean;
  /** Con horario reducido, la franja en que abre. */
  open: { start: string; end: string } | null;
  id: string | null;
}

/** Lo que pasa en la sede ese día: un cierre propio gana; si no, el festivo de su país (cerrado o abierto). */
export function closureOn(branchId: string, day: string): ClosureOn | null {
  const own = (db.team.closures ?? []).find((item) => item.branchId === branchId && item.date === day);
  if (own) return { kind: "closure", name: own.name, closed: own.open === null, open: own.open, id: own.id };
  const holiday = holidayOn(branchCountry(branchId) || "Colombia", day);
  if (!holiday) return null;
  const closed = (db.team.holidaysClosed ?? []).some((item) => item.branchId === branchId && item.date === day);
  return { kind: "holiday", name: holiday.name, closed, open: null, id: null };
}

const minutes = (clock: string): number => {
  const [hours, mins] = clock.split(":").map(Number);
  return hours * 60 + (mins || 0);
};

/** Las franjas recortadas por el cierre: nada si cierra, solo lo que cae dentro si abre menos. */
export function clipToClosure(ranges: readonly { start: string; end: string }[], closure: ClosureOn | null): { start: string; end: string }[] {
  if (!closure) return [...ranges];
  if (closure.closed) return [];
  if (!closure.open) return [...ranges];
  const open = closure.open;
  return ranges.flatMap((range) => {
    const start = Math.max(minutes(range.start), minutes(open.start));
    const end = Math.min(minutes(range.end), minutes(open.end));
    return end > start ? [{ start: start === minutes(range.start) ? range.start : open.start, end: end === minutes(range.end) ? range.end : open.end }] : [];
  });
}

/** Las franjas en que trabaja esa persona esa fecha, con todo aplicado. */
export function workingRangesOn(member: MockTeamMember, day: string, branchId = member.branchIds[0] ?? "ma"): { start: string; end: string }[] {
  const { range } = shiftRange(member, day);
  return clipToClosure(range ? rangesOf(range) : [], closureOn(branchId, day));
}

/**
 * Pone un plan nuevo para alguien sin pisar el resto: el que rige antes se corta el día anterior y,
 * si el nuevo tiene fin, el que regía sigue después (con su ciclo en la misma fase).
 */
export function insertPlan(plan: MockSchedulePlan): void {
  const others = (db.team.plans ?? []).filter((item) => item.memberId !== plan.memberId);
  const mine = plansOf(plan.memberId);
  const before = addDaysKey(plan.from, -1);
  const after = plan.to ? addDaysKey(plan.to, 1) : null;
  const kept = mine.flatMap((item): MockSchedulePlan[] => {
    const ends = item.to ?? "9999-12-31";
    if (ends < plan.from || (plan.to !== null && item.from > plan.to)) return [item];
    const pieces: MockSchedulePlan[] = [];
    if (item.from < plan.from) pieces.push({ ...item, to: before });
    if (after && (item.to === null || item.to >= after)) pieces.push({ ...item, id: `${item.id}_r${Date.now().toString(36)}`, from: after, weeks: rotate(item, after) });
    return pieces;
  });
  // Sin plan antes, lo que regía era la ficha: si el nuevo tiene fin, la ficha vuelve sola después.
  db.team.plans = [...others, ...kept, plan];
}

/** Las semanas de un plan empezando por la que toca en `from`, para que el ciclo siga en fase. */
function rotate(plan: MockSchedulePlan, from: string): MockWeekPattern[] {
  const start = cycleIndex(plan, from);
  return Array.from({ length: plan.cycleWeeks }, (_, index) => plan.weeks[(start + index) % plan.cycleWeeks]);
}

/** «Este y los siguientes»: desde `from`, ese día de la semana cambia en todas las semanas del ciclo que rige. */
export function changeWeekdayFrom(member: MockTeamMember, from: string, range: MockWorkingRange | null): void {
  const current = planOn(member.id, from);
  const weekday = weekdayOf(from);
  const weeks = current ? rotate(current, from) : [{ ...member.schedule }];
  insertPlan({
    id: `plan_${member.id}_${from}_${Date.now().toString(36)}`,
    memberId: member.id,
    from,
    to: current?.to ?? null,
    cycleWeeks: weeks.length,
    weeks: weeks.map((week) => ({ ...week, [weekday]: range })),
    templateName: current?.templateName ?? null,
  });
}

/** Deja constancia del cambio (historial y, si se pide, el aviso al barbero). */
export function logChange(change: Omit<MockScheduleChange, "id" | "at">): void {
  const entry: MockScheduleChange = { ...change, id: `sch_${change.memberId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() };
  db.team.scheduleLog = [entry, ...(db.team.scheduleLog ?? [])].slice(0, 300);
}

export function validCycle(weeks: unknown): weeks is unknown[] {
  return Array.isArray(weeks) && weeks.length >= 1 && weeks.length <= MAX_CYCLE_WEEKS;
}
