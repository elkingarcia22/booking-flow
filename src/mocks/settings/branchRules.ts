import { GATEWAY_SPECS, isGatewayProvider, type OnlineMethod } from "@/features/settings/gatewayProviders";
import { blendedPercent, linePercent } from "@/features/branches/tax";
import { db } from "../db";
import { defaultWeekHours, parseWeekHours, type WeekHours } from "@/features/branches/branchHours";
import { instantOf, isTimeZone, wallClock } from "@/lib/time/zoned";
import { consentCountryOf, consentVersionOf } from "@/features/legal/consent";
import { isPromoAllowed, nextPromoSlot, type SendPlace } from "@/features/legal/sendWindow";
import type { MockListItem } from "./seed";

/**
 * Lo que cada sucursal decide en Configuración y el resto del backend
 * respeta: en qué moneda cobra, con qué impuesto y con qué pasarela. Una
 * barbería con sucursales en Estados Unidos y en Colombia cobra cada una con
 * lo suyo.
 */

const FALLBACK_CURRENCY = "USD";

export const branchOf = (branchId: string): MockListItem | undefined => db.settings.lists.branches.find((item) => item.id === branchId);

export const branchCurrency = (branchId: string): string => {
  const currency = branchOf(branchId)?.currency;
  return typeof currency === "string" && currency ? currency : FALLBACK_CURRENCY;
};

const FALLBACK_TIME_ZONE = "America/New_York";

/** La zona de la sucursal (Configuración › Sucursales), o la del negocio si no tiene. */
export const branchTimeZone = (branchId: string): string => {
  const own = branchOf(branchId)?.timezone;
  if (isTimeZone(own)) return own;
  const business = (db.settings.sections.business as { timezone?: string } | undefined)?.timezone;
  return isTimeZone(business) ? business : FALLBACK_TIME_ZONE;
};

/** El horario de la sucursal por día (Configuración › Sucursales); sin él, el del negocio de lunes a sábado. */
export function branchHours(branchId: string): WeekHours {
  const own = parseWeekHours(branchOf(branchId)?.hours);
  if (own) return own;
  const business = db.settings.sections.business as { openTime?: string; closeTime?: string } | undefined;
  return defaultWeekHours(business?.openTime, business?.closeTime);
}

/** El instante real de una cita: su hora local en la zona de su sucursal. */
export const startInstant = (item: { start: string; branchId: string }): Date => instantOf(item.start, branchTimeZone(item.branchId));

/** «Ahora» en la sucursal, como hora de pared («AAAA-MM-DDTHH:mm»). */
export const branchNow = (branchId: string, at: Date = new Date()): string => wallClock(branchTimeZone(branchId), at);

/** El país de la sucursal (Configuración › Sucursales), tal como está escrito. */
export const branchCountry = (branchId: string): string => {
  const country = branchOf(branchId)?.country;
  return typeof country === "string" ? country : "";
};

/** Dónde está la sede para la franja legal de promociones: país, estado y zona (la hora del cliente). */
export const branchSendPlace = (branchId: string): SendPlace => {
  const state = branchOf(branchId)?.state;
  return { country: consentCountryOf(branchCountry(branchId)), state: typeof state === "string" ? state : null, timeZone: branchTimeZone(branchId) };
};

/** Si ahora se puede mandar una promoción en esa sede y, si no, desde cuándo. */
/** `timeZone` va para mostrar la hora como la de la sede, no la de quien mira. */
export const promoWindowOf = (branchId: string, at: Date = new Date()): { allowed: boolean; nextAt: string; timeZone: string } => {
  const place = branchSendPlace(branchId);
  return { allowed: isPromoAllowed(place, at), nextAt: nextPromoSlot(place, at).toISOString(), timeZone: place.timeZone };
};

/** Con qué texto se aceptó un consentimiento en esa sucursal: la versión vigente de su país (la prueba). */
export const consentProof = (branchId: string): { version: string; country: string } => ({ version: consentVersionOf(branchCountry(branchId)), country: consentCountryOf(branchCountry(branchId)) });

/** El impuesto de la sucursal: la suma de las tasas de su grupo (estatal + condado, por ejemplo). */
export function branchTaxPercent(branchId: string): number {
  const group = db.settings.lists.taxGroups.find((item) => item.id === branchOf(branchId)?.taxGroupId);
  return ((group?.taxes as { percent: number }[] | undefined) ?? []).reduce((sum, tax) => sum + tax.percent, 0);
}

/** Si los precios ya traen el impuesto (Configuración › Precios). */
export const taxInclusive = (): boolean => (db.settings.sections.pricing as { taxInclusive?: boolean }).taxInclusive === true;

/** La tasa de un servicio o producto en esa sucursal: la suya, o la de la sucursal si no tiene. */
export const itemTaxPercent = (itemTaxRate: number | null | undefined, branchId: string): number => linePercent(itemTaxRate, branchTaxPercent(branchId));

const serviceRate = (id: string): number | null => db.services.items.find((item) => item.id === id)?.taxRate ?? null;
const productRate = (id: string): number | null => db.products.items.find((item) => item.id === id)?.taxRate ?? null;

export interface TaxableAccount {
  services: readonly { id: string; amount: number }[];
  products: readonly { id: string; amount: number }[];
}

/** La tasa media de una cuenta en esa sucursal (cada línea con la suya). */
export function accountTaxPercent(branchId: string, account: TaxableAccount): number {
  return blendedPercent([
    ...account.services.map((line) => ({ amount: line.amount, percent: itemTaxPercent(serviceRate(line.id), branchId) })),
    ...account.products.map((line) => ({ amount: line.amount, percent: itemTaxPercent(productRate(line.id), branchId) })),
  ]);
}

/** Con qué se puede pagar en línea en esa sucursal: lo de su pasarela, si está conectada. */
export function branchOnlineMethods(branchId: string): OnlineMethod[] {
  const gateway = db.settings.lists.gateways.find((item) => item.id === branchOf(branchId)?.gatewayId);
  if (!gateway || gateway.connected !== true || !isGatewayProvider(gateway.provider)) return [];
  return [...GATEWAY_SPECS[gateway.provider].methods];
}
