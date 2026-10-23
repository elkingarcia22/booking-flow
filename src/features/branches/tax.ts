/**
 * El impuesto de una cuenta, igual en la reserva en línea, en el cobro de la
 * agenda y en Transacciones.
 *
 * Cada sucursal tiene su impuesto (el estatal en Estados Unidos, el IVA en
 * Colombia). Un servicio o producto con tasa propia usa la suya; si no la
 * tiene, la de la sucursal donde se cobra. Una cuenta con tasas distintas se
 * grava con su tasa media, ponderada por lo que vale cada línea: así un
 * descuento sobre el total se reparte entre todas sin preguntar a cuál toca.
 */

export interface TaxedLine {
  amount: number;
  percent: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** La tasa de una línea: la del artículo o, si no tiene, la de la sucursal. */
export const linePercent = (itemRate: number | null | undefined, branchPercent: number): number => itemRate ?? branchPercent;

/** La tasa media de la cuenta, ponderada por lo que vale cada línea. */
export function blendedPercent(lines: readonly TaxedLine[]): number {
  const base = lines.reduce((sum, line) => sum + Math.max(0, line.amount), 0);
  if (base <= 0) return 0;
  return lines.reduce((sum, line) => sum + Math.max(0, line.amount) * line.percent, 0) / base;
}

/**
 * El impuesto sobre lo que se cobra (ya con descuentos). Con el impuesto
 * incluido en el precio no se suma: es la parte del precio que lo es.
 */
export function taxOn(base: number, percent: number, inclusive: boolean): number {
  if (base <= 0 || percent <= 0) return 0;
  return round2(inclusive ? base - base / (1 + percent / 100) : (base * percent) / 100);
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  /** Lo que vale la cuenta: con el impuesto encima o, si va incluido, sin volver a sumarlo. */
  total: number;
}

/** Las cuentas de un carrito: subtotal de lista, descuento, impuesto (tasa media) y total. */
export function cartTotals(lines: readonly TaxedLine[], discount = 0, inclusive = false): CartTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const applied = round2(Math.min(subtotal, Math.max(0, discount)));
  const base = subtotal - applied;
  const tax = taxOn(base, blendedPercent(lines), inclusive);
  return { subtotal, discount: applied, tax, total: round2(inclusive ? base : base + tax) };
}
