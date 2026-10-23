import { db } from "../db";
import type { MockAppointment } from "../calendar/seed";
import type { MockOutboxMessage } from "./state";
import { startInstant } from "../settings/branchRules";

/**
 * Los mensajes que la reserva deja programados, como haría el servidor real con su proveedor de
 * WhatsApp/SMS: la confirmación al reservar (con «Confirmo» / «Reprogramar») y hasta tres
 * recordatorios a las horas que eligió la barbería (Configuración › Recordatorios, por defecto 24 h y
 * 2 h). Lo que se apaga ahí para el cliente por WhatsApp no se programa. Mover la cita los reprograma;
 * cancelarla los anula. Quedan en
 * `db.booking.outbox` y los envía `dispatch.ts` cuando les toca (por WhatsApp si está conectado;
 * si no, simulados). Las citas de recepción y las de la reserva en línea programan lo mismo.
 */

const HOUR_MS = 3_600_000;
const DEFAULT_HOURS = [24, 2];
const MAX_REMINDERS = 3;

interface NotificationPrefs {
  toggles?: Record<string, boolean>;
  reminderHours?: number[];
}
const prefs = (): NotificationPrefs => (db.settings.sections.notifications ?? {}) as NotificationPrefs;
/** Lo que no se ha tocado está encendido, como en la pantalla de Configuración. */
const clientWhatsApp = (eventId: string): boolean => prefs().toggles?.[`clients.${eventId}.whatsapp`] ?? true;

/** Los recordatorios que tocan: las horas de Configuración, sin repetir, de la más lejana a la más cercana. */
export function reminderPlan(): { kind: MockOutboxMessage["kind"]; hoursBefore: number }[] {
  if (!clientWhatsApp("bookingReminder")) return [];
  const hours = [...new Set((prefs().reminderHours ?? DEFAULT_HOURS).filter((value) => Number.isInteger(value) && value >= 1 && value <= 168))].sort((a, b) => b - a).slice(0, MAX_REMINDERS);
  return hours.map((hoursBefore) => ({ kind: hoursBefore === 24 ? "reminder24h" : hoursBefore === 2 ? "reminder2h" : "reminder", hoursBefore }));
}

const outbox = (): MockOutboxMessage[] => db.booking.outbox ?? [];
let seq = 0;
const nextId = () => `msg_${Date.now().toString(36)}_${(seq += 1)}`;

/** Programa la confirmación y los recordatorios que aún estén en el futuro. */
export function scheduleMessages(appointment: MockAppointment, phone: string, now = new Date()): void {
  // La cita es a la hora de su sucursal: el recordatorio sale a ese instante, esté donde esté el servidor.
  const start = startInstant(appointment).getTime();
  const base = { appointmentId: appointment.id, clientId: appointment.clientId, to: phone, channel: "whatsapp" as const, status: "scheduled" as const };
  const messages: MockOutboxMessage[] = clientWhatsApp("bookingConfirmed") ? [{ ...base, id: nextId(), kind: "confirmation", sendAt: now.toISOString() }] : [];
  for (const reminder of reminderPlan()) {
    const sendAt = start - reminder.hoursBefore * HOUR_MS;
    if (sendAt > now.getTime()) messages.push({ ...base, id: nextId(), kind: reminder.kind, sendAt: new Date(sendAt).toISOString(), ...(reminder.kind === "reminder" ? { hoursBefore: reminder.hoursBefore } : {}) });
  }
  db.booking.outbox = [...outbox(), ...messages];
}

/** Anula lo pendiente de una cita (al cancelarla o antes de reprogramarla). */
export function cancelMessages(appointmentId: string): void {
  db.booking.outbox = outbox().map((message) => (message.appointmentId === appointmentId && message.status === "scheduled" ? { ...message, status: "cancelled" } : message));
}

/** La cita cambió de hora: los recordatorios se mueven con ella (sin repetir la confirmación). */
export function rescheduleMessages(appointment: MockAppointment, phone: string, now = new Date()): void {
  cancelMessages(appointment.id);
  scheduleMessages(appointment, phone, now);
  // El aviso del cambio sale ya (si está encendido); los recordatorios quedan para la hora nueva.
  const notifyChange = clientWhatsApp("bookingRescheduled");
  db.booking.outbox = outbox().flatMap((message) => (message.appointmentId === appointment.id && message.kind === "confirmation" && message.status === "scheduled" ? (notifyChange ? [{ ...message, kind: "rescheduled" as const }] : []) : [message]));
  if (notifyChange && !outbox().some((message) => message.appointmentId === appointment.id && message.kind === "rescheduled" && message.status === "scheduled")) {
    db.booking.outbox = [...outbox(), { appointmentId: appointment.id, clientId: appointment.clientId, to: phone, channel: "whatsapp", status: "scheduled", id: nextId(), kind: "rescheduled", sendAt: now.toISOString() }];
  }
}

/** A cuántos de la lista de espera se avisa por cada hueco que se libera (gana el primero que reserva). */
const REFILL_NOTIFY = 3;
const durationOfService = (serviceId: string): number => db.services.items.find((item) => item.id === serviceId)?.durationMin ?? 30;

/**
 * Se liberó una hora (alguien canceló): avisa por WhatsApp a los primeros de la lista de espera de
 * ese día cuya franja la incluye, cuyo barbero (si pidieron uno) es el mismo y cuyo servicio cabe.
 * El primero que la reserve se la queda. Devuelve a quién se avisó.
 */
export function offerFreedSlot(freed: MockAppointment, now = new Date()): string[] {
  const day = freed.start.slice(0, 10);
  const hour = `${freed.start.slice(11, 13)}:00`;
  const matches = db.calendar.waitlist
    .filter((entry) => entry.branchId === freed.branchId && entry.clientId !== freed.clientId)
    .filter((entry) => entry.slots.some((slot) => slot.date === day && slot.time === hour))
    .filter((entry) => entry.barberId === null || entry.barberId === freed.barberId)
    .filter((entry) => durationOfService(entry.serviceId) <= freed.durationMin)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, REFILL_NOTIFY);
  const messages: MockOutboxMessage[] = matches.map((entry) => ({
    id: nextId(),
    appointmentId: freed.id,
    clientId: entry.clientId,
    to: db.calendar.clients.find((client) => client.id === entry.clientId)?.phone ?? "",
    channel: "whatsapp",
    kind: "slotFreed",
    sendAt: now.toISOString(),
    status: "scheduled",
    offer: { start: freed.start, barberId: freed.barberId, branchId: freed.branchId },
  }));
  db.booking.outbox = [...outbox(), ...messages];
  return matches.map((entry) => entry.clientId);
}

/** El token del enlace «Confirmar» de una cita: difícil de adivinar, uno por cita. */
export const newConfirmToken = (): string => `cf_${crypto.randomUUID().replace(/-/g, "")}`;
