import { db } from "../db";
import { hashOf } from "../customers/seed";
import { sampleDataOn } from "../sampleData";
import type { MockFunnelEvent } from "./state";

/**
 * El embudo de la reserva en línea: cada vez que alguien llega a un paso se guarda un evento
 * anónimo (sesión, paso, canal y de dónde vino). Las visitas desde la vista previa del panel no
 * cuentan. Sin datos reales todavía, se muestra un embudo de ejemplo (marcado `demo`).
 */

export const FUNNEL_STEPS = ["phone", "verify", "services", "barber", "time", "review", "payment", "confirmed"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
const MAX_EVENTS = 5000;
const DAY_MS = 86_400_000;

const events = (): MockFunnelEvent[] => db.booking.funnel ?? [];

export function recordEvent(event: MockFunnelEvent): void {
  if (event.surface === "preview") return;
  db.booking.funnel = [...events(), event].slice(-MAX_EVENTS);
}

/** Un embudo de ejemplo, determinista: cuántas sesiones llegan a cada paso en 30 días. */
function demoEvents(now: Date): MockFunnelEvent[] {
  const sources = ["instagram", "google", "whatsapp", "directo"] as const;
  // Lo que sigue de un paso al siguiente, como en una reserva móvil típica.
  const keep = [1, 0.82, 0.9, 0.86, 0.8, 0.84, 0.78, 0.88];
  const out: MockFunnelEvent[] = [];
  for (let index = 0; index < 640; index += 1) {
    const h = hashOf(`funnel_${index}`);
    const at = new Date(now.getTime() - (h % 30) * DAY_MS - (h % 86_400) * 1000).toISOString();
    const source = sources[(h >>> 4) % sources.length];
    let alive = 1;
    FUNNEL_STEPS.forEach((step, position) => {
      alive *= keep[position];
      if (hashOf(`funnel_${index}_${step}`) % 1000 < alive * 1000) out.push({ sessionId: `demo_${index}`, step, at, surface: "link", source });
    });
  }
  return out;
}

/**
 * Las sesiones que empezaron la reserva en un rango y cuántas terminaron reservando, por de dónde
 * vinieron: las reales o, solo en la demo, las de ejemplo. Las dos cifras salen del mismo embudo:
 * nunca se cruzan visitas de ejemplo con reservas reales.
 */
export function sessionsBySource(from: Date, to: Date, now = new Date()): { bySource: Map<string, { sessions: number; bookings: number }>; sample: boolean } {
  const inRange = (event: MockFunnelEvent) => new Date(event.at) >= from && new Date(event.at) <= to;
  const real = events().filter(inRange);
  const sample = real.length === 0 && sampleDataOn();
  const list = sample ? demoEvents(now).filter(inRange) : real;
  const booked = new Set(list.filter((event) => event.step === "confirmed").map((event) => event.sessionId));
  const bySource = new Map<string, { sessions: number; bookings: number }>();
  const started = new Map<string, string>();
  for (const event of list.filter((item) => item.step === "phone")) started.set(event.sessionId, event.source);
  for (const [sessionId, source] of started) {
    const row = bySource.get(source) ?? { sessions: 0, bookings: 0 };
    bySource.set(source, { sessions: row.sessions + 1, bookings: row.bookings + (booked.has(sessionId) ? 1 : 0) });
  }
  return { bySource, sample };
}

export function funnelSummary(days: number, now = new Date()) {
  const from = now.getTime() - days * DAY_MS;
  const real = events().filter((event) => new Date(event.at).getTime() >= from);
  const demo = real.length === 0 && sampleDataOn();
  const list = demo ? demoEvents(now) : real;
  const sessionsAt = (step: FunnelStep) => new Set(list.filter((event) => event.step === step).map((event) => event.sessionId));
  const started = sessionsAt("phone").size;
  const steps = FUNNEL_STEPS.map((step) => {
    const count = sessionsAt(step).size;
    return { step, sessions: count, rate: started === 0 ? 0 : Math.round((count / started) * 1000) / 10 };
  });
  const booked = sessionsAt("confirmed");
  const bySource = new Map<string, { sessions: Set<string>; bookings: number }>();
  for (const event of list.filter((item) => item.step === "phone")) {
    const entry = bySource.get(event.source) ?? { sessions: new Set<string>(), bookings: 0 };
    entry.sessions.add(event.sessionId);
    bySource.set(event.source, entry);
  }
  for (const [, entry] of bySource) entry.bookings = [...entry.sessions].filter((id) => booked.has(id)).length;
  const sources = [...bySource.entries()].map(([source, entry]) => ({ source, sessions: entry.sessions.size, bookings: entry.bookings })).sort((a, b) => b.sessions - a.sessions);
  return { days, demo, started, bookings: booked.size, conversion: started === 0 ? 0 : Math.round((booked.size / started) * 1000) / 10, steps, sources };
}
