import { db } from "../db";
import { appointmentsOn } from "../calendar/handlers";
import { dateKey, type MockAppointment } from "../calendar/seed";
import { hashOf } from "../customers/seed";
import type { MockStockMovement, MockStockReason } from "./state";

/**
 * El inventario ligero (docs/API_CONTRACT.md, «Inventario»): cuántas unidades de cada producto hay en
 * cada sucursal, el mínimo que dispara la alerta y un historial de movimientos. Lo mueven solas las
 * ventas (cobro de la cita, venta rápida, reserva en línea) y a mano las entradas, los conteos, las
 * mermas y el uso interno.
 */

const DEFAULT_MIN = 4;
const SEED_SPREAD = 23;
const SEED_OFFSET = 4;
/** Deja en Massachusetts un producto agotado y uno por reponer, y la cera (la de las pruebas) con existencias. */
const SEED_SALT = 41;
const key = (branchId: string, productId: string) => `${branchId}:${productId}`;

/** Lo que hay: lo guardado o, la primera vez, una cifra fija por sucursal y producto (alguno bajo o agotado, para la demo). */
export function stockLevel(branchId: string, productId: string): { onHand: number; min: number } {
  const saved = db.inventory.levels[key(branchId, productId)];
  if (saved) return saved;
  const seed = Math.max(0, (hashOf(key(branchId, productId), SEED_SALT) % SEED_SPREAD) - SEED_OFFSET);
  return { onHand: seed, min: DEFAULT_MIN };
}

export const stockStatus = (level: { onHand: number; min: number }): "ok" | "low" | "out" => (level.onHand <= 0 ? "out" : level.onHand <= level.min ? "low" : "ok");

export function setMin(branchId: string, productId: string, min: number): void {
  const current = stockLevel(branchId, productId);
  db.inventory = {
    ...db.inventory,
    levels: {
      ...db.inventory.levels,
      [key(branchId, productId)]: { ...current, min },
    },
  };
}

/** Mueve existencias y deja la línea en el historial. En mostrador puede quedar en negativo: avisa que toca contar. */
export function moveStock(input: { branchId: string; productId: string; delta: number; reason: MockStockReason; ref?: string | null; note?: string; by: string }): MockStockMovement {
  const current = stockLevel(input.branchId, input.productId);
  const onHand = current.onHand + input.delta;
  const movement: MockStockMovement = {
    id: `mv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    branchId: input.branchId,
    productId: input.productId,
    delta: input.delta,
    onHand,
    reason: input.reason,
    ref: input.ref ?? null,
    note: input.note ?? "",
    at: new Date().toISOString(),
    by: input.by,
  };
  db.inventory = {
    levels: {
      ...db.inventory.levels,
      [key(input.branchId, input.productId)]: { ...current, onHand },
    },
    movements: [movement, ...db.inventory.movements],
  };
  return movement;
}

const qtyBy = (lines: readonly { productId: string; qty: number }[]) =>
  lines.reduce<Record<string, number>>(
    (total, line) => ({
      ...total,
      [line.productId]: (total[line.productId] ?? 0) + line.qty,
    }),
    {}
  );

/**
 * Deja descontado lo que lleva la cita: la primera vez todo; al cobrar con más o menos producto, solo
 * la diferencia. `stockTaken` recuerda lo ya descontado para no hacerlo dos veces.
 */
export function syncAppointmentStock(appointment: MockAppointment, reason: "sale" | "online", by: string): MockAppointment {
  const wanted = qtyBy(appointment.products);
  const taken = qtyBy(appointment.stockTaken ?? []);
  for (const productId of new Set([...Object.keys(wanted), ...Object.keys(taken)])) {
    const delta = (taken[productId] ?? 0) - (wanted[productId] ?? 0);
    if (delta !== 0)
      moveStock({
        branchId: appointment.branchId,
        productId,
        delta,
        reason: delta < 0 ? reason : "return",
        ref: appointment.id,
        by,
      });
  }
  return {
    ...appointment,
    stockTaken: appointment.products.map((line) => ({ ...line })),
  };
}

/** Una cita anulada sin cobrar devuelve a la estantería lo que tenía apartado. */
export function releaseAppointmentStock(appointment: MockAppointment, by: string): MockAppointment {
  if (!appointment.stockTaken?.length) return appointment;
  for (const line of appointment.stockTaken)
    moveStock({
      branchId: appointment.branchId,
      productId: line.productId,
      delta: line.qty,
      reason: "return",
      ref: appointment.id,
      by,
    });
  return { ...appointment, stockTaken: [] };
}

/**
 * Lo vendido de cada producto en la sucursal en los últimos `days` días: las citas cobradas y las ventas
 * rápidas (la fuente de verdad del ritmo, aunque el inventario empiece hoy).
 */
export function soldByProduct(branchId: string, days: number, now = new Date()): Record<string, number> {
  const totals: Record<string, number> = {};
  const add = (productId: string, qty: number) => {
    totals[productId] = (totals[productId] ?? 0) + qty;
  };
  for (let index = 0; index < days; index += 1) {
    const day = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - index));
    for (const item of appointmentsOn(branchId, day)) if (item.status === "paid") item.products.forEach((line) => add(line.productId, line.qty));
  }
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  for (const sale of db.calendar.sales) if (sale.branchId === branchId && new Date(sale.paidAt) >= since) sale.items.forEach((line) => add(line.productId, line.qty));
  return totals;
}
