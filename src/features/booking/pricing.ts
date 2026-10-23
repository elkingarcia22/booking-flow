/**
 * Las cuentas de una reserva en línea, sin interfaz: cuánto suman las citas y
 * los productos, qué descuenta un cupón, cuánto es la propina, el impuesto y
 * qué se devuelve al cancelar. Las usan la pantalla (para enseñar el total
 * antes de pagar) y el backend simulado (que es quien cobra): así el número
 * que ve el cliente es el mismo que se le cobra.
 */

import { taxOn } from "@/features/branches/tax";

export type TipKind = "percent" | "amount";

export interface TipOption {
  id: string;
  type: TipKind;
  value: number;
}

export interface Promo {
  code: string;
  /** Porcentaje (0–100) o monto fijo. */
  type: TipKind;
  value: number;
  /** Solo para quien reserva por primera vez. */
  firstVisitOnly?: boolean;
  /** Pide al menos este número de citas en la misma reserva. */
  minAppointments?: number;
  /** Desde y hasta qué día vale («AAAA-MM-DD», incluidos); sin ellos, siempre. */
  validFrom?: string | null;
  validTo?: string | null;
  /** Solo si la cuenta lleva alguno de estos servicios; vacío = cualquiera. */
  serviceIds?: readonly string[];
  /** Cuántas veces se puede usar en total y por cliente; `null` = sin tope. */
  maxUses?: number | null;
  perClient?: number | null;
  /** Apagado no se acepta (se conserva para el historial). */
  active?: boolean;
}

/** Los cupones con los que nace la demo; la barbería crea los suyos en Configuración › Cupones. */
export const PROMOS: readonly Promo[] = [
  { code: "BIENVENIDO10", type: "percent", value: 10, firstVisitOnly: true },
  { code: "FAMILIA15", type: "percent", value: 15, minAppointments: 2 },
  { code: "BARBER5", type: "amount", value: 5 },
];

export interface OwnedPackageLike {
  id: string;
  serviceId: string;
  remaining: number;
}

/**
 * Lo que cubren sus paquetes: por cada cita, cada servicio con visitas por usar en un paquete se
 * paga con una visita (el precio que habría cobrado el barbero). Devuelve el monto y cuántas
 * visitas se gastan de cada paquete. Lo usan el resumen del cliente y el servidor, igual.
 */
export function coverByPackages(appointments: readonly (readonly { serviceId: string; price: number }[])[], owned: readonly OwnedPackageLike[]): { amount: number; used: Record<string, number> } {
  const left = new Map(owned.map((item) => [item.id, item.remaining]));
  const used: Record<string, number> = {};
  let amount = 0;
  for (const services of appointments) {
    for (const service of services) {
      const pack = owned.find((item) => item.serviceId === service.serviceId && (left.get(item.id) ?? 0) > 0);
      if (!pack) continue;
      left.set(pack.id, (left.get(pack.id) ?? 0) - 1);
      used[pack.id] = (used[pack.id] ?? 0) + 1;
      amount += service.price;
    }
  }
  return { amount: round2(amount), used };
}

export type PromoProblem = "unknown" | "firstVisitOnly" | "minAppointments" | "notYet" | "expired" | "exhausted" | "usedByClient" | "services";

export interface PromoContext {
  isNewClient: boolean;
  appointments: number;
  /** Hoy en la sede («AAAA-MM-DD»), para las fechas del cupón. */
  today?: string;
  /** Los servicios de la cuenta, para los cupones de ciertos servicios. */
  serviceIds?: readonly string[];
  /** Cuántas veces ya se usó en total y cuántas este cliente. */
  uses?: number;
  clientUses?: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Un código escrito como sea («ver ano10 ») a como se guarda («VERANO10»). */
export const normalizePromoCode = (code: string): string => code.trim().toUpperCase().replace(/\s+/g, "");

/**
 * El cupón por su código (sin importar mayúsculas), o por qué no aplica. La lista es la de la barbería (por defecto,
 * la de la demo); el contexto trae lo que solo sabe el servidor: hoy en la sede, los servicios y cuántas veces se usó.
 */
export function findPromo(code: string, context: PromoContext, list: readonly Promo[] = PROMOS): { promo: Promo } | { problem: PromoProblem } {
  const promo = list.find((item) => item.code === normalizePromoCode(code) && item.active !== false);
  if (!promo) return { problem: "unknown" };
  if (context.today && promo.validFrom && context.today < promo.validFrom) return { problem: "notYet" };
  if (context.today && promo.validTo && context.today > promo.validTo) return { problem: "expired" };
  if (promo.maxUses && (context.uses ?? 0) >= promo.maxUses) return { problem: "exhausted" };
  if (promo.perClient && (context.clientUses ?? 0) >= promo.perClient) return { problem: "usedByClient" };
  if (promo.firstVisitOnly && !context.isNewClient) return { problem: "firstVisitOnly" };
  if (promo.minAppointments && context.appointments < promo.minAppointments) return { problem: "minAppointments" };
  if (promo.serviceIds?.length && context.serviceIds && !context.serviceIds.some((id) => promo.serviceIds?.includes(id))) return { problem: "services" };
  return { promo };
}

/** Lo que descuenta un cupón sobre lo que se compra; nunca más que el total. */
export function promoDiscount(promo: Promo | null, base: number): number {
  if (!promo || base <= 0) return 0;
  const amount = promo.type === "percent" ? (base * promo.value) / 100 : promo.value;
  return round2(Math.min(base, amount));
}

/** La propina de una opción sobre los servicios (no se deja propina por un producto). */
export function tipAmount(option: TipOption | null, servicesTotal: number): number {
  if (!option) return 0;
  return round2(option.type === "percent" ? (servicesTotal * option.value) / 100 : option.value);
}

export interface CardFeeRule {
  name: string;
  rate: number;
  type: "percent" | "amount";
}

export interface TotalsInput {
  services: number;
  products: number;
  discount: number;
  taxPercent: number;
  /** El precio ya trae el impuesto (lo normal con IVA): se informa, no se suma. */
  taxInclusive?: boolean;
  tip: number;
  /** El recargo por tarjeta, solo si se paga con tarjeta o billetera. */
  cardFee?: CardFeeRule | null;
  /** El saldo de una tarjeta de regalo que se usa en esta reserva. */
  giftBalance?: number;
  /** La cortesía de cliente frecuente que se usa: se descuenta de los servicios. */
  reward?: number;
  /** Lo que cubre un paquete prepagado (los servicios que ya pagó). */
  prepaid?: number;
}

export interface Totals {
  services: number;
  products: number;
  discount: number;
  subtotal: number;
  tax: number;
  /** El impuesto va dentro del subtotal: se muestra como «incluido» y no se suma. */
  taxIncluded?: boolean;
  tip: number;
  fee: number;
  feeName: string | null;
  /** Lo que paga la tarjeta de regalo. */
  gift: number;
  /** La cortesía de cliente frecuente descontada. */
  reward: number;
  /** Lo que cubre su paquete prepagado. */
  prepaid: number;
  /** Lo que queda por pagar, ya restada la tarjeta de regalo. */
  total: number;
}

/** Los métodos que pasan por la pasarela y por eso llevan el recargo por tarjeta. */
export const chargesCardFee = (method: string | null): boolean => method === "card" || method === "wallet";

/**
 * El impuesto va sobre lo comprado ya con el descuento; la propina va aparte, sin
 * impuesto. La tarjeta de regalo paga primero; el recargo por tarjeta sale de la
 * parte del subtotal que queda por pagar con tarjeta, como en el cobro de la agenda.
 */
export function computeTotals(input: TotalsInput): Totals {
  // La cortesía no puede valer más que los servicios (no se regala un producto).
  const servicesLeft = Math.max(0, input.services - input.discount);
  // Lo ya pagado en un paquete sale primero; la cortesía, de lo que quede de servicios.
  const prepaid = round2(Math.min(Math.max(0, input.prepaid ?? 0), servicesLeft));
  const reward = round2(Math.min(Math.max(0, input.reward ?? 0), servicesLeft - prepaid));
  const subtotal = round2(Math.max(0, input.services + input.products - input.discount - reward - prepaid));
  const taxIncluded = input.taxInclusive === true;
  const tax = taxOn(subtotal, input.taxPercent, taxIncluded);
  const charged = taxIncluded ? subtotal : subtotal + tax;
  const tip = round2(Math.max(0, input.tip));
  const gift = round2(Math.min(Math.max(0, input.giftBalance ?? 0), charged + tip));
  const feeBase = Math.max(0, subtotal - gift);
  const rule = input.cardFee ?? null;
  const fee = rule && feeBase > 0 ? round2(rule.type === "percent" ? (feeBase * rule.rate) / 100 : rule.rate) : 0;
  return { services: round2(input.services), products: round2(input.products), discount: round2(input.discount), subtotal, tax, ...(taxIncluded ? { taxIncluded } : {}), tip, fee, feeName: fee > 0 && rule ? rule.name : null, gift, reward, prepaid, total: round2(charged + tip + fee - gift) };
}

/** El anticipo para pagar en la barbería: el porcentaje de lo comprado con impuesto (sin propina ni recargo). */
export const depositOf = (totals: Pick<Totals, "subtotal" | "tax"> & { taxIncluded?: boolean; total?: number }, percent: number): number => {
  const amount = round2(((totals.subtotal + (totals.taxIncluded ? 0 : totals.tax)) * percent) / 100);
  // Con tarjeta de regalo puede quedar menos por pagar que el anticipo.
  return totals.total === undefined ? amount : Math.min(amount, totals.total);
};

/** Cuánto es el recargo: «3 %» o «US$ 2». */
export const feeLabel = (rule: CardFeeRule, money: (value: number) => string): string => (rule.type === "percent" ? `${rule.rate} %` : money(rule.rate));

export interface CancellationInput {
  start: Date;
  now: Date;
  /** Hasta cuántas horas antes se cancela gratis. */
  cancelHours: number;
  /** El porcentaje del servicio que se cobra al cancelar tarde. */
  lateFeePercent: number;
  /** Lo que vale la cita. */
  price: number;
  /** Lo que el cliente ya pagó por ella (0 si paga en la barbería). */
  paid: number;
}

export interface CancellationTerms {
  /** Todavía se cancela sin cargo. */
  isFree: boolean;
  /** Ya empezó o pasó: no se cancela en línea. */
  isPast: boolean;
  /** Hasta cuándo es gratis. */
  deadline: Date;
  fee: number;
  /** Lo que se devuelve de lo pagado, ya restado el cargo. */
  refund: number;
  /** El cargo que queda pendiente si no había nada pagado. */
  owed: number;
}

/** Qué pasa si se cancela ahora, según la política de la barbería. */
export function cancellationTerms(input: CancellationInput): CancellationTerms {
  const deadline = new Date(input.start.getTime() - input.cancelHours * 3_600_000);
  const isPast = input.now.getTime() >= input.start.getTime();
  const isFree = input.now.getTime() <= deadline.getTime();
  const fee = isFree ? 0 : round2((input.price * input.lateFeePercent) / 100);
  const refund = round2(Math.max(0, input.paid - fee));
  const owed = round2(Math.max(0, fee - input.paid));
  return { isFree, isPast, deadline, fee, refund, owed };
}

/** La política de la barbería con sus valores puestos, tal como la redactó en Configuración. */
export function renderPolicy(template: string, values: { cancelHours: number; lateFeePercent: number; maxCancellations: number }): string {
  return template
    .replaceAll("<<time_for_cancel>>", `${values.cancelHours} h`)
    .replaceAll("<<fee_cancellation>>", String(values.lateFeePercent))
    .replaceAll("<<max_cancellations>>", String(values.maxCancellations));
}
