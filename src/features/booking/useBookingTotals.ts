import * as React from "react";
import { blendedPercent, linePercent } from "@/features/branches/tax";
import { chargesCardFee, computeTotals, coverByPackages, promoDiscount, tipAmount, type Totals } from "./pricing";
import type { BookingState, DraftItem } from "./bookingState";
import type { BookingBranch, BookingCatalog, BookingService, BookingShop } from "./types";

type PricedItem = Pick<DraftItem, "serviceIds" | "barberId" | "assignedBarberId">;

/** Quién cobra la cita: el elegido o, sin preferencia y con hora, el que asigna la agenda. */
const pricedBarberId = (item: PricedItem): string | null => item.barberId ?? item.assignedBarberId ?? null;

/**
 * Lo que vale una cita: con barbero elegido (o, sin preferencia, el que la agenda asigna a esa
 * hora), su precio; sin hora todavía, el más bajo de quienes la pueden hacer (el «desde»).
 */
export function itemPrice(item: PricedItem, catalog: BookingCatalog | undefined): number {
  if (!catalog) return 0;
  const barberId = pricedBarberId(item);
  const barbers = barberId ? catalog.barbers.filter((barber) => barber.id === barberId) : catalog.barbers;
  const totals = barbers
    .filter((barber) => item.serviceIds.every((id) => barber.prices[id] !== undefined))
    .map((barber) => item.serviceIds.reduce((sum, id) => sum + (barber.prices[id] ?? 0), 0));
  if (totals.length > 0) return Math.min(...totals);
  return item.serviceIds.reduce((sum, id) => sum + (catalog.services.find((service) => service.id === id)?.price ?? 0), 0);
}

/** Lo más barato que cobra alguien de la sede por ese servicio: el «desde». */
export function fromPrice(service: BookingService, catalog: BookingCatalog | undefined): number {
  const values = (catalog?.barbers ?? []).map((barber) => barber.prices[service.id]).filter((value): value is number => value !== undefined);
  return values.length > 0 ? Math.min(...values) : service.price;
}

export const itemDuration = (serviceIds: readonly string[], catalog: BookingCatalog | undefined): number =>
  serviceIds.reduce((sum, id) => sum + (catalog?.services.find((service) => service.id === id)?.durationMin ?? 0), 0);

/** Lo que vale cada servicio de una cita, con el mismo criterio que `itemPrice`. */
function servicePrices(item: PricedItem, catalog: BookingCatalog | undefined): { serviceId: string; price: number }[] {
  const barberId = pricedBarberId(item);
  const barbers = (catalog?.barbers ?? []).filter((barber) => (barberId ? barber.id === barberId : item.serviceIds.every((id) => barber.prices[id] !== undefined)));
  return item.serviceIds.map((serviceId) => {
    const prices = barbers.map((barber) => barber.prices[serviceId]).filter((price): price is number => price !== undefined);
    return { serviceId, price: prices.length > 0 ? Math.min(...prices) : (catalog?.services.find((service) => service.id === serviceId)?.price ?? 0) };
  });
}

/** Cuánto cubren sus paquetes de esta reserva (estimado; el servidor cobra con el barbero asignado). */
export function packageCoverage(state: BookingState, catalog: BookingCatalog | undefined): number {
  const owned = state.customer?.packages ?? [];
  if (!state.usePackages || owned.length === 0) return 0;
  return coverByPackages(state.items.map((item) => servicePrices(item, catalog)), owned).amount;
}

/** La cortesía de cliente frecuente: el servicio de cortesía a lo que lo cobra quien lo hace en esta reserva. */
function rewardAmount(state: BookingState, catalog: BookingCatalog | undefined): number {
  const loyalty = state.customer?.loyalty;
  if (!state.useReward || !loyalty || loyalty.available <= 0) return 0;
  for (const item of state.items) {
    const line = servicePrices(item, catalog).find((entry) => entry.serviceId === loyalty.rewardServiceId);
    if (line) return line.price;
  }
  return loyalty.rewardValue;
}

/** La sucursal elegida en la reserva: de ella salen la moneda, el impuesto y los métodos de pago. */
export const activeBranch = (shop: BookingShop | undefined, branchId: string | null): BookingBranch | undefined => shop?.branches?.find((branch) => branch.id === branchId);

/** La tasa media del carrito: cada servicio y producto con la suya o, si no tiene, la de la sucursal. */
function cartPercent(state: BookingState, catalog: BookingCatalog | undefined, branchPercent: number): number {
  const rateOf = (rate: number | null | undefined) => linePercent(rate, branchPercent);
  return blendedPercent([
    ...state.items.flatMap((item) => servicePrices(item, catalog).map((line) => ({ amount: line.price, percent: rateOf(catalog?.services.find((service) => service.id === line.serviceId)?.taxPercent) }))),
    ...Object.entries(state.products).map(([id, qty]) => {
      const product = catalog?.products.find((item) => item.id === id);
      return { amount: (product?.price ?? 0) * qty, percent: rateOf(product?.taxPercent) };
    }),
  ]);
}

export function useBookingTotals(state: BookingState, catalog: BookingCatalog | undefined, shop: BookingShop | undefined): Totals {
  return React.useMemo(() => {
    const services = state.items.reduce((sum, item) => sum + itemPrice(item, catalog), 0);
    const products = Object.entries(state.products).reduce((sum, [id, qty]) => sum + (catalog?.products.find((product) => product.id === id)?.price ?? 0) * qty, 0);
    // Propina y recargo por tarjeta se eligen en el pago: antes de llegar ahí no se suman, porque la
    // persona aún no ha decidido nada. En el pago cuentan la propina marcada y, sin método elegido,
    // la tarjeta si la barbería cobra en línea (así abre esa pantalla).
    const atPayment = state.step === "payment";
    const method = atPayment ? (state.method ?? (shop?.payment.card ? "card" : "shop")) : null;
    // Quien paga en la barbería deja la propina allá: no se pregunta ni se suma.
    const tip = atPayment && method !== "shop" ? (shop?.tipOptions.find((option) => option.id === state.tipId) ?? null) : null;
    // Igual los descuentos (cupón y cortesía de la membresía): antes del pago, el total es el de lista.
    return computeTotals({
      services,
      products,
      discount: atPayment ? promoDiscount(state.promo, services + products) : 0,
      taxPercent: cartPercent(state, catalog, activeBranch(shop, state.branchId)?.taxPercent ?? 0),
      taxInclusive: shop?.taxInclusive === true,
      tip: tipAmount(tip, services),
      cardFee: method && chargesCardFee(method) ? (shop?.cardFee ?? null) : null,
      giftBalance: state.gift?.balance ?? 0,
      prepaid: packageCoverage(state, catalog),
      reward: atPayment ? rewardAmount(state, catalog) : 0,
    });
  }, [catalog, shop, state.branchId, state.items, state.products, state.promo, state.tipId, state.method, state.gift, state.useReward, state.usePackages, state.customer, state.step]);
}

export interface DraftOrderLine {
  id: string;
  label: string;
  detail: string;
  amount: number;
}

/** Las líneas del ticket antes de reservar: una por cita y una por producto. */
export function draftOrderLines(state: BookingState, catalog: BookingCatalog | undefined, describe: (item: DraftItem) => string): DraftOrderLine[] {
  const appointments = state.items.map((item) => ({
    id: item.key,
    label: item.serviceIds.map((id) => catalog?.services.find((service) => service.id === id)?.name ?? id).join(" + "),
    detail: describe(item),
    amount: itemPrice(item, catalog),
  }));
  const products = Object.entries(state.products).flatMap(([id, qty]) => {
    const product = catalog?.products.find((entry) => entry.id === id);
    return product ? [{ id, label: qty > 1 ? `${product.name} × ${qty}` : product.name, detail: "", amount: product.price * qty }] : [];
  });
  return [...appointments, ...products];
}
