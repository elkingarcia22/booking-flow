import { cartTotals } from "@/features/branches/tax";
import { db } from "../db";
import { barberServicePrice, productPriceIn } from "../catalogPrices";
import { itemTaxPercent, taxInclusive } from "../settings/branchRules";
import type { MockAppointment } from "./seed";

/**
 * La cuenta de una cita, igual para el cobro de la agenda y para
 * Transacciones: lo que vale (con el impuesto de su sucursal), lo que ya se
 * resolvió en la reserva en línea y lo que queda por cobrar en caja.
 */

export interface AppointmentAccount {
  /** Lo de lista: servicios y productos a su precio. */
  subtotal: number;
  /** Lo descontado en línea (cupón, cortesía, paquete). */
  discount: number;
  tax: number;
  /** Lo que vale la cuenta: con impuesto encima o, si va incluido, sin sumarlo. */
  total: number;
  /** Lo que ya se pagó en línea para esta cuenta (sin propina). */
  prepaid: number;
  /** La propina que ya se dejó en línea. */
  prepaidTip: number;
  /** Lo que falta cobrar en caja, sin propina nueva ni recargo. */
  due: number;
  /** Lo devuelto: desde la caja o al cancelar la reserva en línea. */
  refunded: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const serviceOf = (id: string) => db.services.items.find((item) => item.id === id);

export { barberServicePrice };
const productOf = (id: string) => db.products.items.find((item) => item.id === id);

export function appointmentAccount(
  appointment: MockAppointment,
  serviceIds: readonly string[] = appointment.serviceIds,
  products: readonly { productId: string; qty: number }[] = appointment.products,
  prices: Pick<MockAppointment, "servicePrices" | "productPrices"> = appointment
): AppointmentAccount {
  const branchId = appointment.branchId;
  // El precio que se puso en la caja manda sobre el de lista.
  const lines = [
    ...serviceIds.map((id, index) => ({ amount: prices.servicePrices?.[index] ?? barberServicePrice(appointment.barberId, id, branchId), percent: itemTaxPercent(serviceOf(id)?.taxRate, branchId) })),
    ...products.map((line) => ({ amount: (prices.productPrices?.[line.productId] ?? productPriceIn(line.productId, branchId)) * line.qty, percent: itemTaxPercent(productOf(line.productId)?.taxRate, branchId) })),
  ];
  const online = appointment.online ?? null;
  // Lo descontado en línea y lo descontado en la caja.
  const computed = cartTotals(lines, (online?.discount ?? 0) + (appointment.checkoutDiscount ?? 0), taxInclusive());
  // Ya cobrada, vale con el impuesto que se registró al cobrar (las sembradas no traen); si no, el de hoy.
  const { subtotal, discount } = computed;
  const tax = appointment.payment ? appointment.payment.tax : computed.tax;
  const total = appointment.payment ? round2(subtotal - discount + (taxInclusive() ? 0 : tax)) : computed.total;
  const prepaid = round2(Math.min(total, online?.paid ?? 0));
  const refunded = round2((appointment.refunds ?? []).reduce((sum, item) => sum + item.amount, 0));
  return { subtotal, discount, tax, total, prepaid, prepaidTip: round2(online?.tip ?? 0), due: round2(total - prepaid), refunded };
}
