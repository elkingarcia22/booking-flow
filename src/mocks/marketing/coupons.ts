import { delay, http, HttpResponse } from "msw";
import { findPromo, normalizePromoCode, type Promo, type PromoProblem } from "@/features/booking/pricing";
import { sessionOf, unauthorized } from "../session";
import { db } from "../db";
import { branchNow } from "../settings/branchRules";
import type { MockListItem } from "../settings/seed";

/**
 * Los cupones de la barbería (docs/API_CONTRACT.md, «Configuración › Cupones»): los crea el dueño en Configuración y
 * valen igual en la reserva en línea y en la caja. Cada uso queda anotado (quién, dónde y cuándo), con eso se
 * respetan el tope total y el de por cliente. Antes eran tres códigos fijos en el navegador.
 */

export interface MockCouponRedemption {
  code: string;
  clientId: string;
  at: string;
  /** Dónde se usó: al reservar en línea o al cobrar en la caja. */
  source: "booking" | "checkout";
  /** La reserva o la cita. */
  ref: string;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const numberOrNull = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null);

/** Un cupón de la lista de Configuración como lo entiende `findPromo`. */
export function toPromo(item: MockListItem): Promo {
  return {
    code: normalizePromoCode(text(item.code)),
    type: item.type === "amount" ? "amount" : "percent",
    value: Number(item.value) || 0,
    firstVisitOnly: item.firstVisitOnly === true,
    minAppointments: numberOrNull(item.minAppointments) ?? undefined,
    validFrom: text(item.validFrom) || null,
    validTo: text(item.validTo) || null,
    serviceIds: Array.isArray(item.serviceIds) ? item.serviceIds.filter((id): id is string => typeof id === "string") : [],
    maxUses: numberOrNull(item.maxUses),
    perClient: numberOrNull(item.perClient),
    active: item.active !== false,
  };
}

export const coupons = (): Promo[] => (db.settings.lists.coupons ?? []).map(toPromo);

const redemptions = (): MockCouponRedemption[] => db.booking.couponRedemptions ?? [];

/** Cuántas veces se usó un código, en total y por un cliente. */
export const usesOf = (code: string, clientId?: string | null): number => redemptions().filter((item) => item.code === normalizePromoCode(code) && (clientId === undefined || item.clientId === clientId)).length;

export interface CouponCheck {
  clientId: string | null;
  isNewClient: boolean;
  appointments: number;
  serviceIds: readonly string[];
  branchId: string;
}

/** Si un código vale para esta cuenta, con todas las reglas del cupón y lo ya usado. */
export function checkCoupon(code: string, context: CouponCheck): { promo: Promo } | { problem: PromoProblem } {
  return findPromo(
    code,
    {
      isNewClient: context.isNewClient,
      appointments: context.appointments,
      serviceIds: context.serviceIds,
      today: branchNow(context.branchId).slice(0, 10),
      uses: usesOf(code),
      clientUses: context.clientId ? usesOf(code, context.clientId) : 0,
    },
    coupons()
  );
}

/** Anota un uso del cupón. */
export function redeemCoupon(code: string, clientId: string, source: MockCouponRedemption["source"], ref: string, at = new Date()): void {
  db.booking = { ...db.booking, couponRedemptions: [...redemptions(), { code: normalizePromoCode(code), clientId, source, ref, at: at.toISOString() }] };
  db.persist();
}

/** El de bienvenida que se aplica solo al cliente nuevo: el primer cupón activo «solo primera visita». */
export const welcomeCoupon = (): string | null => coupons().find((promo) => promo.active !== false && promo.firstVisitOnly)?.code ?? null;

/** Lo que dice un problema, para el mensaje del servidor. */
export const COUPON_PROBLEMS: Readonly<Record<PromoProblem, string>> = {
  unknown: "Ese cupón no existe o está apagado.",
  firstVisitOnly: "Ese cupón es solo para la primera visita.",
  minAppointments: "Ese cupón pide más citas en la misma reserva.",
  notYet: "Ese cupón todavía no empieza.",
  expired: "Ese cupón ya venció.",
  exhausted: "Ese cupón ya se usó todas las veces que permitía.",
  usedByClient: "Este cliente ya usó ese cupón.",
  services: "Ese cupón no aplica a estos servicios.",
};

/** Probar un cupón en la caja: el mismo veredicto que dará el cobro, sin anotar el uso todavía. */
export const couponHandlers = [
  http.post("*/api/coupons/check", async ({ request }) => {
    await delay(150);
    if (!sessionOf(request)) return unauthorized();
    const input = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const clientId = text(input.clientId);
    const client = db.calendar.clients.find((item) => item.id === clientId);
    const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.filter((id): id is string => typeof id === "string") : [];
    const result = checkCoupon(text(input.code), { clientId: client?.id ?? null, isNewClient: (client?.visits ?? 0) === 0, appointments: 1, serviceIds, branchId: text(input.branchId) || "ma" });
    if ("problem" in result) return HttpResponse.json({ code: "promo_invalid", message: COUPON_PROBLEMS[result.problem], details: { problem: result.problem } }, { status: 422 });
    return HttpResponse.json(result.promo);
  }),
];
