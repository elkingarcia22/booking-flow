import type { MockCatalogService } from "../services/seed";
import { isBarberRole, type MockServiceOverride, type MockTeamMember } from "./seed";

/** Cuánto sobre el precio de la carta cobra cada nivel. */
const LEVEL_FACTOR: Readonly<Record<string, number>> = {
  lvl_aprendiz: 0.8,
  lvl_junior: 0.9,
  lvl_senior: 1,
  lvl_master: 1.25,
};

/** Entre −8 % y +8 % según la persona, para que dos del mismo nivel no cobren igual. */
const personalShift = (index: number): number => (((index * 37) % 9) - 4) * 0.02;

const overrideFor = (serviceId: string, price: number): MockServiceOverride => ({
  serviceId,
  offered: true,
  price,
  newClientPrice: null,
  loyaltyPrice: null,
  durationMin: null,
  splitCommission: null,
  extraCommission: null,
});

/**
 * Demo: cada barbero cobra lo suyo por cada servicio, según su nivel y un matiz propio. En una
 * misma sucursal no hay dos barberos con el mismo precio para un servicio: si coinciden, el
 * siguiente sube de a un dólar.
 */
export function withBarberPrices(members: readonly MockTeamMember[], services: readonly MockCatalogService[]): MockTeamMember[] {
  const taken = new Map<string, Set<number>>();
  return members.map((member, index) => {
    if (!isBarberRole(member.role) && !member.isAlsoBarber) return member;
    const factor = (LEVEL_FACTOR[member.levelId ?? ""] ?? 1) + personalShift(index);
    const overrides = services.map((service) => {
      const key = `${member.homeBranchId}:${service.id}`;
      const used = taken.get(key) ?? new Set<number>();
      let price = Math.max(1, Math.round(service.price * factor));
      while (used.has(price)) price += 1;
      taken.set(key, new Set([...used, price]));
      return overrideFor(service.id, price);
    });
    return { ...member, services: overrides };
  });
}
