import { db } from "../db";
import type { MockAppointment } from "./seed";

/**
 * Riesgo de que el cliente no venga (docs/API_CONTRACT.md, «Calendario»). Es una estimación por su
 * historial, no un modelo entrenado: una regresión logística con pesos fijados a mano a partir de los
 * factores que la literatura de citas médicas encuentra (no-shows previos, antelación, cliente nuevo,
 * falta de confirmación, sin anticipo). Cuando haya historia suficiente, los pesos se entrenan con los
 * datos de cada barbería; la forma de la respuesta no cambia.
 */

export type RiskReason = "pastNoShows" | "cancels" | "newClient" | "farAhead" | "unconfirmed" | "prepaid" | "confirmed";
export interface NoShowRisk {
  level: "low" | "medium" | "high";
  probability: number;
  /** Lo que más pesa, en orden; los que bajan el riesgo también se dicen. */
  reasons: RiskReason[];
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const INTERCEPT = -2.6;
const WEIGHTS: Readonly<Record<RiskReason, number>> = { pastNoShows: 4, cancels: 1.5, newClient: 0.7, farAhead: 0.6, unconfirmed: 0.8, prepaid: -1.2, confirmed: -0.6 };
const FAR_AHEAD_DAYS = 14;
const SOON_HOURS = 24;
const HIGH = 0.3;
const MEDIUM = 0.15;

export function noShowRisk(appointment: MockAppointment, now = new Date()): NoShowRisk | null {
  if (appointment.status !== "scheduled" || appointment.walkIn) return null;
  const start = new Date(appointment.start).getTime();
  if (start < now.getTime() - HOUR_MS) return null;
  const client = db.calendar.clients.find((item) => item.id === appointment.clientId);
  if (!client) return null;
  const factors: Partial<Record<RiskReason, number>> = {
    pastNoShows: client.noShows / Math.max(1, client.visits + client.noShows),
    cancels: client.cancellations / Math.max(1, client.visits + client.cancellations),
    newClient: client.type === "new" || client.visits === 0 ? 1 : 0,
    farAhead: (start - new Date(appointment.createdAt).getTime()) / DAY_MS > FAR_AHEAD_DAYS ? 1 : 0,
    unconfirmed: !appointment.confirmation && start - now.getTime() < SOON_HOURS * HOUR_MS ? 1 : 0,
    prepaid: (appointment.online?.paid ?? 0) > 0 ? 1 : 0,
    confirmed: appointment.confirmation?.status === "confirmed" ? 1 : 0,
  };
  const contributions = (Object.keys(factors) as RiskReason[]).map((reason) => ({ reason, value: WEIGHTS[reason] * (factors[reason] ?? 0) })).filter((item) => item.value !== 0);
  const logit = INTERCEPT + contributions.reduce((sum, item) => sum + item.value, 0);
  const probability = Math.round((1 / (1 + Math.exp(-logit))) * 100) / 100;
  return {
    level: probability >= HIGH ? "high" : probability >= MEDIUM ? "medium" : "low",
    probability,
    reasons: contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map((item) => item.reason),
  };
}

/** La cita con su riesgo, tal como la entrega la agenda. */
/** Horas sin respuesta después del mensaje de confirmación o recordatorio para darlo por «no contestó». */
const NO_ANSWER_HOURS = 2;
/** Los mensajes que piden confirmar: el de la reserva y los recordatorios. */
const ASKS: ReadonlySet<string> = new Set(["confirmation", "reminder", "reminder24h", "reminder2h"]);

/**
 * «No contestó»: le salió el mensaje de confirmación o el recordatorio hace más de dos horas, no respondió
 * nada y la cita sigue sin confirmar. Recepción lo llama o le reenvía el mensaje.
 */
export function noAnswerOf(appointment: MockAppointment, now = new Date()): boolean {
  if (appointment.status !== "scheduled" || appointment.confirmation) return false;
  const sent = (db.booking.outbox ?? []).filter((message) => message.appointmentId === appointment.id && ASKS.has(message.kind) && message.status === "sent" && message.sentAt);
  if (sent.length === 0) return false;
  const first = sent.reduce((min, message) => (message.sentAt! < min ? message.sentAt! : min), sent[0].sentAt!);
  const last = sent.reduce((max, message) => (message.sentAt! > max ? message.sentAt! : max), sent[0].sentAt!);
  if (now.getTime() - Date.parse(last) < NO_ANSWER_HOURS * 3_600_000) return false;
  return !(db.booking.inbound ?? []).some((reply) => reply.appointmentId === appointment.id && reply.at >= first);
}

export const withRisk = (appointment: MockAppointment, now = new Date()) => ({ ...appointment, risk: noShowRisk(appointment, now), noAnswer: noAnswerOf(appointment, now) });
