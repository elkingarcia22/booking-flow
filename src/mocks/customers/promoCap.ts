import { db } from "../db";

/**
 * El tope de promociones por cliente en la app, el mismo que pone la cola del servidor
 * (`server/whatsapp/queue.ts`, `PROMO_CAP`): una cada 30 días, cuente la reactivación, el cumpleaños automático o el
 * «te toca volver» y el cumpleaños escritos a mano. Lo anulado o fallido no cuenta.
 */

const DAY_MS = 86_400_000;
export const PROMO_CAP_DAYS = 30;
const PROMO_PURPOSES: ReadonlySet<string> = new Set(["rebook", "birthday"]);

/** La promoción más cercana a `at` (antes o después) a menos de 30 días, si la hay. */
export function promoNear(clientId: string, at: Date = new Date()): { sendAt: string } | null {
  const near = (db.booking.outbox ?? []).find(
    (message) =>
      message.clientId === clientId &&
      (message.kind === "reactivation" || message.kind === "birthday" || message.kind === "campaign" || (message.kind === "manual" && PROMO_PURPOSES.has(message.purpose ?? ""))) &&
      message.status !== "cancelled" &&
      message.status !== "failed" &&
      Math.abs(at.getTime() - new Date(message.sendAt).getTime()) < PROMO_CAP_DAYS * DAY_MS
  );
  return near ? { sendAt: near.sendAt } : null;
}
