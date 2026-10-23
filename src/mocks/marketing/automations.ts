import { db } from "../db";
import { WALK_IN_CLIENT, type MockAppointment, type MockClient } from "../calendar/seed";
import { profileOf } from "../customers/handlers";
import { promoNear } from "../customers/promoCap";
import { branchNow, branchSendPlace } from "../settings/branchRules";
import { nextPromoSlot } from "@/features/legal/sendWindow";
import type { MockOutboxMessage } from "../booking/state";

/**
 * Los mensajes que salen solos (docs/API_CONTRACT.md, «Configuración › Marketing»):
 *
 * - **Gracias tras la primera visita** y **pedir reseña**: se programan al cobrar. Son de servicio: van a todos los
 *   que vinieron, sin mirar si quedaron contentos (Google prohíbe pedirle reseña solo a los satisfechos). La reseña,
 *   como mucho una vez cada 30 días por cliente.
 * - **Feliz cumpleaños**: lo revisa cada vuelta de la cola. Es promoción: solo a quien aceptó, en la franja legal de su
 *   sede y sin pasar el tope mensual; una vez al año.
 *
 * Llevan sus valores de plantilla ya listos (`params`), así viajan por la misma cola que el resto.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const REVIEW_COOLDOWN_DAYS = 30;

interface Automation {
  enabled: boolean;
  delayHours?: number;
}

export interface AutomationRules {
  birthday: Automation;
  thanks: Automation;
  review: Automation;
}

export function automationRules(): AutomationRules {
  const marketing = (db.settings.sections as Record<string, Record<string, unknown> | undefined>).marketing;
  const automations = (marketing?.automations ?? {}) as Partial<AutomationRules>;
  const read = (value: Automation | undefined, delay: number): Automation => ({ enabled: value?.enabled === true, delayHours: Number(value?.delayHours ?? delay) || 0 });
  return { birthday: read(automations.birthday, 0), thanks: read(automations.thanks, 3), review: read(automations.review, 2) };
}

const firstName = (name: string) => name.split(" ")[0] || name;
const branchName = (branchId: string) => String(db.settings.lists.branches.find((item) => item.id === branchId)?.name ?? "");

/** El enlace para dejar la reseña: el de Google Maps del negocio, o la reserva en línea si no hay. */
function reviewLink(): string {
  const business = db.settings.sections.business as { googleMaps?: string } | undefined;
  const booking = db.settings.sections.booking as { links?: { bookingUrl?: string } } | undefined;
  return business?.googleMaps?.trim() || booking?.links?.bookingUrl || "";
}

const outbox = (): MockOutboxMessage[] => db.booking.outbox ?? [];

const push = (messages: MockOutboxMessage[]) => {
  if (messages.length === 0) return;
  db.booking.outbox = [...messages, ...outbox()];
  db.persist();
};

const message = (client: MockClient, kind: MockOutboxMessage["kind"], sendAt: Date, params: string[], appointmentId = ""): MockOutboxMessage => ({
  id: `msg_${kind}_${sendAt.getTime().toString(36)}_${client.id}`,
  appointmentId,
  clientId: client.id,
  to: client.phone,
  channel: "whatsapp",
  kind,
  sendAt: sendAt.toISOString(),
  status: "scheduled",
  params,
  by: "Automático",
});

/** Si es la primera visita cobrada del cliente (en la agenda real y en su historia). */
function isFirstVisit(appointment: MockAppointment, client: MockClient): boolean {
  if (client.visits > 0) return false;
  return !db.calendar.appointments.some((item) => item.clientId === client.id && item.id !== appointment.id && item.status === "paid");
}

/** Al cobrar una cita: programa las gracias (si es la primera visita) y el pedido de reseña, si están encendidos. */
export function onVisitPaid(appointment: MockAppointment, now = new Date()): MockOutboxMessage[] {
  const client = db.calendar.clients.find((item) => item.id === appointment.clientId);
  if (!client || client.id === WALK_IN_CLIENT.id || !client.phone || profileOf(client).deleted) return [];
  const rules = automationRules();
  const branch = branchName(appointment.branchId);
  const barber = db.team.members.find((member) => member.id === appointment.barberId);
  const created: MockOutboxMessage[] = [];
  if (rules.thanks.enabled && isFirstVisit(appointment, client)) {
    created.push(message(client, "thanks", new Date(now.getTime() + (rules.thanks.delayHours ?? 0) * HOUR_MS), [firstName(client.name), branch], appointment.id));
  }
  const recentReview = outbox().some((item) => item.clientId === client.id && item.kind === "reviewRequest" && item.status !== "cancelled" && now.getTime() - Date.parse(item.sendAt) < REVIEW_COOLDOWN_DAYS * DAY_MS);
  if (rules.review.enabled && !recentReview) {
    created.push(message(client, "reviewRequest", new Date(now.getTime() + (rules.review.delayHours ?? 0) * HOUR_MS), [firstName(client.name), barber?.firstName ?? branch, reviewLink()], appointment.id));
  }
  push(created);
  return created;
}

/** Si a ese cliente ya se le pidió una reseña en los últimos 30 días. */
export const reviewAskedRecently = (clientId: string, now = new Date()): boolean =>
  outbox().some((item) => item.clientId === clientId && item.kind === "reviewRequest" && item.status !== "cancelled" && now.getTime() - Date.parse(item.sendAt) < REVIEW_COOLDOWN_DAYS * DAY_MS);

/**
 * El barbero pide la reseña de una cita suya (desde «Mi reputación»): el mismo mensaje del pedido automático, ya, con su
 * nombre. No es promoción; respeta el tope de una cada 30 días por cliente. Devuelve lo programado o `null`.
 */
export function askForReview(appointment: MockAppointment, by: string, now = new Date()): MockOutboxMessage | null {
  const client = db.calendar.clients.find((item) => item.id === appointment.clientId);
  if (!client || client.id === WALK_IN_CLIENT.id || !client.phone || profileOf(client).deleted || reviewAskedRecently(client.id, now)) return null;
  const barber = db.team.members.find((member) => member.id === appointment.barberId);
  const created = { ...message(client, "reviewRequest", now, [firstName(client.name), barber?.firstName ?? branchName(appointment.branchId), reviewLink()], appointment.id), by };
  push([created]);
  return created;
}

/**
 * Los cumpleaños de hoy (en la zona de la sede de cada cliente): con permiso de promociones, sin otra promoción a menos
 * de 30 días y sin felicitación este año. Sale en la próxima franja legal. Devuelve lo programado.
 */
export function runBirthdays(now = new Date()): MockOutboxMessage[] {
  if (!automationRules().birthday.enabled) return [];
  const created: MockOutboxMessage[] = [];
  for (const client of db.calendar.clients) {
    if (client.id === WALK_IN_CLIENT.id || !client.phone) continue;
    const profile = profileOf(client);
    if (profile.deleted || profile.blocked || !profile.birthDate || !profile.marketingConsent?.accepted) continue;
    const today = branchNow(profile.branchId, now).slice(0, 10);
    if (profile.birthDate.slice(5, 10) !== today.slice(5, 10)) continue;
    const year = today.slice(0, 4);
    if (outbox().some((item) => item.clientId === client.id && item.kind === "birthday" && item.sendAt.startsWith(year))) continue;
    if (promoNear(client.id, now)) continue;
    created.push(message(client, "birthday", nextPromoSlot(branchSendPlace(profile.branchId), now), [firstName(client.name), branchName(profile.branchId)]));
  }
  push(created);
  return created;
}
