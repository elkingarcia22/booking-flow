import { db } from "./db";

/**
 * Cuánto vale cada cosa en cada sucursal. Un servicio o producto puede tener un precio propio por
 * sucursal (otro país, otra moneda, otro barrio); sin él, el general. Un barbero que tiene su
 * precio en Equipo cobra el suyo. Lo leen la agenda, la caja, la reserva, Transacciones, Nómina y
 * Métricas, así que todas cobran y cuentan lo mismo.
 */

const serviceOf = (id: string) => db.services.items.find((item) => item.id === id);
const productOf = (id: string) => db.products.items.find((item) => item.id === id);

/** El precio de un servicio en una sucursal: el suyo de esa sucursal o el general. */
export const servicePriceIn = (serviceId: string, branchId: string): number => {
  const service = serviceOf(serviceId);
  return service?.branchPrices?.[branchId] ?? service?.price ?? 0;
};

/** El precio de un producto en una sucursal: el suyo de esa sucursal o el general. */
export const productPriceIn = (productId: string, branchId: string): number => {
  const product = productOf(productId);
  return product?.branchPrices?.[branchId] ?? product?.price ?? 0;
};

/** Lo que cobra ese barbero por el servicio: su precio en Equipo, o el de la sucursal, o el general. */
export function barberServicePrice(barberId: string, serviceId: string, branchId: string): number {
  const own = db.team.members.find((member) => member.id === barberId)?.services.find((item) => item.serviceId === serviceId)?.price;
  return own ?? servicePriceIn(serviceId, branchId);
}

/**
 * El precio propio de una sucursal tal como llega del formulario: un número lo fija y `null` (o
 * vacío) lo quita, y esa sucursal vuelve al general. Devuelve el mapa nuevo, sin tocar el anterior.
 */
export function withBranchPrice(current: Record<string, number> | undefined, branchId: string, value: unknown): Record<string, number> | undefined {
  if (value === undefined) return current;
  const rest = Object.fromEntries(Object.entries(current ?? {}).filter(([id]) => id !== branchId));
  const next = typeof value === "number" && Number.isFinite(value) && value >= 0 ? { ...rest, [branchId]: Math.round(value * 100) / 100 } : rest;
  return Object.keys(next).length > 0 ? next : undefined;
}
