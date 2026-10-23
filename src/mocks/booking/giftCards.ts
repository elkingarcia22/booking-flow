import { db } from "../db";
import type { MockGiftCard } from "./state";

/**
 * Tarjetas de regalo: se compran con tarjeta para alguien (llega su código por WhatsApp) y se
 * usan al pagar una reserva; el saldo que sobra queda para la próxima. La demo trae una de
 * prueba (`DEMO_GIFT_CODE`). Los códigos no distinguen mayúsculas ni guiones.
 */

export const DEMO_GIFT_CODE = "REGALO-50";
const DEMO_GIFT: MockGiftCard = {
  code: DEMO_GIFT_CODE,
  initial: 50,
  balance: 50,
  buyerId: null,
  recipientName: "Cliente de prueba",
  recipientContact: "",
  message: "",
  createdAt: "2026-09-01T12:00:00.000Z",
};

const normalize = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
const all = (): MockGiftCard[] => {
  const cards = db.booking.giftCards ?? [];
  return cards.some((card) => card.code === DEMO_GIFT_CODE) ? cards : [DEMO_GIFT, ...cards];
};

export const findGiftCard = (code: string): MockGiftCard | undefined => all().find((card) => normalize(card.code) === normalize(code));

/** Un código legible y difícil de adivinar: «BL-7KQ4-M2XP». */
function newCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => alphabet[value % alphabet.length]).join("");
  return `BL-${pick()}-${pick()}`;
}

export function createGiftCard(input: Omit<MockGiftCard, "code" | "balance" | "createdAt">): MockGiftCard {
  const card: MockGiftCard = { ...input, code: newCode(), balance: input.initial, createdAt: new Date().toISOString() };
  db.booking.giftCards = [...all(), card];
  return card;
}

/** Descuenta lo usado; devuelve el saldo que queda. */
export function spendGiftCard(code: string, amount: number): number {
  const card = findGiftCard(code);
  if (!card) return 0;
  const balance = Math.round(Math.max(0, card.balance - amount) * 100) / 100;
  db.booking.giftCards = all().map((item) => (item.code === card.code ? { ...item, balance } : item));
  return balance;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * Le manda el código a quien recibe la tarjeta: por la misma cola de WhatsApp que los recordatorios (plantilla
 * `tarjeta_regalo`, de servicio: no pide el permiso de promociones). Lo que la reserva promete («te mandamos el
 * código») ahora sale. Devuelve el id del mensaje; queda en la tarjeta para mostrar si llegó y reenviarlo.
 */
export function sendGiftCard(card: MockGiftCard, fromName: string, branchId: string, by: string): string {
  const branch = db.settings.lists.branches.find((item) => item.id === branchId);
  const currency = typeof branch?.currency === "string" ? branch.currency : "USD";
  const amount = new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(card.balance);
  const id = `msg_gift_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const to = `+${card.recipientContact.replace(/\D/g, "")}`;
  const now = new Date().toISOString();
  db.booking.outbox = [
    ...(db.booking.outbox ?? []),
    { id, appointmentId: "", clientId: card.buyerId ?? "", to, channel: "whatsapp", kind: "giftCard", sendAt: now, status: "scheduled", params: [firstName(card.recipientName), firstName(fromName), amount, card.code], by },
  ];
  db.booking.giftCards = all().map((item) => (item.code === card.code ? { ...item, messageId: id } : item));
  return id;
}
