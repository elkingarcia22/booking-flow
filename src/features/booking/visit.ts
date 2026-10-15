import type { BookingPerson, BookingState, DraftItem } from "./bookingState";
import { parseStart } from "./bookingFormat";

const MINUTE_MS = 60_000;

/** Quién va a la cita: una misma persona no puede estar en dos sillas a la vez. */
export function personKey(person: BookingPerson): string {
  if (person.kind === "self") return "self";
  if (person.kind === "guest") return `guest:${person.guestId}`;
  return `new:${person.name.trim().toLowerCase()}`;
}

export interface BusyRange {
  start: number;
  end: number;
  /** La cita que ocupa ese rato, para decir «justo después de tu corte». */
  item: DraftItem;
}

/**
 * Lo que ya tiene en el carrito la persona de `draft`, sin contar la cita que se está cambiando.
 * `durationOf` da los minutos de cada cita (los del catálogo).
 */
export function busyRanges(items: readonly DraftItem[], draft: DraftItem, editingIndex: number | null, durationOf: (item: DraftItem) => number): BusyRange[] {
  const who = personKey(draft.person);
  return items.flatMap((item, index) => {
    if (index === editingIndex || !item.start || personKey(item.person) !== who) return [];
    const start = parseStart(item.start).getTime();
    return [{ start, end: start + durationOf(item) * MINUTE_MS, item }];
  });
}

/** Si una cita que empieza en `start` y dura `minutes` se cruza con lo ya ocupado. */
export function overlapsBusy(start: Date, minutes: number, busy: readonly BusyRange[]): boolean {
  const from = start.getTime();
  const to = from + minutes * MINUTE_MS;
  return busy.some((range) => from < range.end && range.start < to);
}

export type CartGroup = { kind: "single"; item: DraftItem; index: number } | { kind: "visit"; visitId: string; parts: { item: DraftItem; index: number }[] };

/**
 * El carrito como se lee en el resumen: las partes de una visita juntas y en orden de hora; una
 * visita con una sola parte (se quitó la otra) es una cita más.
 */
export function cartGroups(items: readonly DraftItem[]): CartGroup[] {
  const groups: CartGroup[] = [];
  items.forEach((item, index) => {
    const parts = item.visitId ? items.flatMap((other, at) => (other.visitId === item.visitId ? [{ item: other, index: at }] : [])) : [];
    if (parts.length < 2) {
      groups.push({ kind: "single", item, index });
      return;
    }
    if (parts[0].index !== index) return;
    const byTime = [...parts].sort((a, b) => (a.item.start ?? "").localeCompare(b.item.start ?? ""));
    groups.push({ kind: "visit", visitId: item.visitId ?? "", parts: byTime });
  });
  return groups;
}

/**
 * Qué parte de su visita se está armando («2 de 3»), o nada si la cita en curso no es una parte.
 * `items`: el carrito sin la hora que se va a reemplazar (la Agenda).
 */
export function visitPartOf(state: BookingState, items: readonly DraftItem[] = state.items): { current: number; total: number } | null {
  const draft = state.draft;
  if (!draft?.visitId) return null;
  const others = items.filter((item, index) => item.visitId === draft.visitId && index !== state.editingIndex).length;
  const current = others + 1;
  return { current, total: current + (state.pendingParts?.length ?? 0) };
}
