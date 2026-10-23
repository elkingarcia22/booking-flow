import { chargesCardFee, type Totals } from "@/features/booking/pricing";
import type { MockOnlineSettlement } from "../calendar/seed";
import type { MockReservation } from "./state";

/**
 * Lo que una reserva en línea ya dejó resuelto, repartido entre sus citas:
 * lo pagado, la propina y lo descontado. Con esto la caja de la agenda cobra
 * solo lo que falta y Transacciones no muestra «Por cobrar» lo que ya se pagó.
 */

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Reparte un monto en proporción a los pesos; la última parte se lleva el redondeo para que sume exacto. */
function split(amount: number, weights: readonly number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const parts = weights.map((weight) => round2((amount * weight) / total));
  const drift = round2(amount - parts.reduce((sum, part) => sum + part, 0));
  return parts.map((part, index) => (index === parts.length - 1 ? round2(part + drift) : part));
}

export interface SettlementInput {
  /** Lo que vale cada cita (la primera lleva los productos). */
  values: readonly number[];
  /** Lo que valen sus servicios: la propina se reparte por ahí, como se calculó. */
  serviceValues: readonly number[];
  totals: Totals;
  payment: MockReservation["payment"];
  reservation: string;
}

export function settlementsOf({ values, serviceValues, totals, payment, reservation }: SettlementInput): MockOnlineSettlement[] {
  const paidNow = payment.status === "paid";
  const tip = paidNow ? totals.tip : 0;
  const fee = payment.paid > 0 && chargesCardFee(payment.method) ? totals.fee : 0;
  // Lo pagado que va a la cuenta: sin la propina (es del barbero) ni el recargo (es de la pasarela).
  const paid = Math.max(0, round2(payment.paid - tip - fee));
  const discount = round2(totals.discount + totals.reward + totals.prepaid);
  const paidParts = split(paid, values);
  const tipParts = split(tip, serviceValues);
  const discountParts = split(discount, values);
  return values.map((_, index) => ({ reservation, method: payment.method, paid: paidParts[index], tip: tipParts[index], discount: discountParts[index] }));
}
