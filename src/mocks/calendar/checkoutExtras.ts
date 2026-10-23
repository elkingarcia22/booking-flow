import { db } from "../db";
import { findGiftCard } from "../booking/giftCards";
import type { MockPaymentMethod } from "./seed";

/**
 * Lo que el cobro de la caja trae además de la cuenta: un descuento, la tarjeta
 * de regalo con que paga (o una que se vende), el datáfono con que se pasa la
 * tarjeta y el pago dividido en partes. Se valida aquí, sin tocar nada; el
 * cobro lo aplica si todo cuadra.
 */

export type CheckoutPartMethod = "cash" | "card" | "link" | "transfer";

export interface CheckoutPart {
  method: CheckoutPartMethod;
  amount: number;
  deviceId?: string;
}

export interface CheckoutExtras {
  /** Lo descontado en la caja, ya en dinero. */
  discount: number;
  discountReason: string | null;
  gift: { code: string; amount: number } | null;
  giftSale: { amount: number; recipientName: string; recipientContact: string } | null;
  parts: CheckoutPart[] | null;
  deviceId: string | null;
  /** Por dónde llegó la transferencia y su referencia (con `transfer` o una parte por transferencia). */
  transfer: { via: string; reference: string | null } | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const PART_METHODS: readonly CheckoutPartMethod[] = ["cash", "card", "link", "transfer"];
const MAX_VIA = 24;
const MAX_REFERENCE = 40;
const GIFT_SALE_MIN = 5;
const GIFT_SALE_MAX = 500;

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const deviceExists = (id: string) => db.settings.lists.devices.some((item) => item.id === id);

/** El descuento pedido, en dinero sobre `base` (lo que vale la cuenta antes de impuestos). */
export function discountOf(input: unknown, base: number): { amount: number; reason: string | null } | string {
  if (input === undefined || input === null) return { amount: 0, reason: null };
  const record = asRecord(input);
  const value = Number(record.value);
  if (!(value >= 0)) return "El descuento no es válido.";
  const amount = record.type === "percent" ? (value > 100 ? NaN : round2((base * value) / 100)) : round2(value);
  if (Number.isNaN(amount) || amount > base) return "El descuento no puede pasar lo que vale la cuenta.";
  return { amount, reason: text(record.reason) || null };
}

/** Valida la tarjeta de regalo, la venta de una, el datáfono y las partes. Devuelve el error si algo no sirve. */
export function parseExtras(input: Record<string, unknown>, method: MockPaymentMethod): Omit<CheckoutExtras, "discount" | "discountReason"> | string {
  let gift: CheckoutExtras["gift"] = null;
  const giftCode = text(input.giftCode);
  if (giftCode) {
    const card = findGiftCard(giftCode);
    const amount = round2(Number(input.giftAmount) || 0);
    if (!card) return "No encontramos esa tarjeta de regalo.";
    if (amount <= 0 || amount > card.balance) return "La tarjeta de regalo no tiene ese saldo.";
    gift = { code: card.code, amount };
  }
  let giftSale: CheckoutExtras["giftSale"] = null;
  if (input.giftSale) {
    const sale = asRecord(input.giftSale);
    const amount = round2(Number(sale.amount) || 0);
    const recipientName = text(sale.recipientName);
    if (!(amount >= GIFT_SALE_MIN && amount <= GIFT_SALE_MAX)) return `La tarjeta de regalo va de ${GIFT_SALE_MIN} a ${GIFT_SALE_MAX}.`;
    if (recipientName.length < 2) return "¿Para quién es la tarjeta de regalo?";
    giftSale = { amount, recipientName, recipientContact: text(sale.recipientContact) };
  }
  const deviceId = text(input.deviceId) || null;
  if (deviceId && !deviceExists(deviceId)) return "Ese datáfono no está registrado.";
  let parts: CheckoutPart[] | null = null;
  if (Array.isArray(input.parts)) {
    parts = input.parts.map((part) => {
      const record = asRecord(part);
      const partDevice = text(record.deviceId);
      return { method: record.method as CheckoutPartMethod, amount: round2(Number(record.amount) || 0), ...(partDevice ? { deviceId: partDevice } : {}) };
    });
    if (parts.length < 2) return "Para dividir el pago hacen falta al menos dos partes.";
    if (parts.some((part) => !PART_METHODS.includes(part.method) || part.amount <= 0)) return "Cada parte necesita su método y un monto.";
    if (parts.some((part) => part.deviceId && !deviceExists(part.deviceId))) return "Ese datáfono no está registrado.";
    if (method !== "mixed" && new Set(parts.map((part) => part.method)).size > 1) return "Con partes de varios métodos el pago es mixto.";
  }
  // La transferencia dice por dónde llegó (Nequi, Bre-B, banco…) y, si la hay, la referencia del comprobante.
  const usesTransfer = method === "transfer" || (parts ?? []).some((part) => part.method === "transfer");
  const transferInput = asRecord(input.transfer);
  const via = text(transferInput.via).slice(0, MAX_VIA);
  if (usesTransfer && !via) return "Di por dónde llegó la transferencia.";
  const transfer = usesTransfer ? { via, reference: text(transferInput.reference).slice(0, MAX_REFERENCE) || null } : null;
  return { gift, giftSale, parts, deviceId, transfer };
}

/** Con partes, cuánto fue en efectivo y cuánto por fuera del cajón (tarjeta, link o transferencia). */
export const splitOfParts = (parts: readonly CheckoutPart[]): { cash: number; card: number } => ({
  cash: round2(parts.filter((part) => part.method === "cash").reduce((sum, part) => sum + part.amount, 0)),
  card: round2(parts.filter((part) => part.method !== "cash").reduce((sum, part) => sum + part.amount, 0)),
});
