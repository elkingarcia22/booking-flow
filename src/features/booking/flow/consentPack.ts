import * as React from "react";
import { useLocale } from "@/i18n";
import { consentPack, type ConsentPack } from "@/features/legal/consent";
import { useBookingFlow } from "./BookingContext";

/** El texto del consentimiento para la sede por la que entra el cliente (o la primera), en su idioma. */
export function useConsentPack(): ConsentPack {
  const { state, shop } = useBookingFlow();
  const { locale } = useLocale();
  const branch = shop.branches.find((item) => item.id === state.branchId) ?? shop.branches[0];
  const contact = branch?.phone || shop.phone || null;
  return React.useMemo(() => consentPack(branch?.country, locale === "en" ? "en" : "es", shop.name, contact), [branch?.country, locale, shop.name, contact]);
}

/** La sede que decide el texto: la elegida o la primera. */
export function useConsentBranchId(): string | null {
  const { state, shop } = useBookingFlow();
  return state.branchId ?? shop.branches[0]?.id ?? null;
}
