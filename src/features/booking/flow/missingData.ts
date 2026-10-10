import { toast } from "./bookingToast";
import type { useAppT } from "@/app/i18n";
import { cardErrors, type CardValues } from "./cardValidation";

/** Un solo aviso a la vez: tocar «Seguir» varias veces no apila toasts. */
const TOAST_ID = "booking-missing-data";

type Translate = ReturnType<typeof useAppT>;

/**
 * Lo que falta para seguir, dicho en un toast, además del error en su campo. Recibe
 * los mensajes de error de los campos (los vacíos no cuentan); con uno, el toast es ese
 * mensaje; con varios, dice cuántos y nombra el primero. Devuelve si había algo que avisar.
 */
export function toastMissing(t: Translate, messages: readonly (string | null | undefined | false)[]): boolean {
  const missing = messages.filter((message): message is string => Boolean(message));
  if (missing.length === 0) return false;
  if (missing.length === 1) toast.error(missing[0], { id: TOAST_ID });
  else toast.error(t("booking.form.missingMany", { count: missing.length }), { id: TOAST_ID, description: missing[0] });
  return true;
}

const CARD_LABELS = { number: "booking.payment.cardNumber", expiry: "booking.payment.cardExpiry", cvc: "booking.payment.cardCvc", name: "booking.payment.cardName" } as const;

/** Qué campos de la tarjeta faltan o están mal, uno por mensaje («Revisa «Vence».»). */
export function cardMissing(t: Translate, values: CardValues): string[] {
  const errors = cardErrors(values);
  return (Object.keys(CARD_LABELS) as (keyof typeof CARD_LABELS)[]).filter((key) => errors[key]).map((key) => t("booking.payment.cardFieldMissing", { field: t(CARD_LABELS[key]) }));
}
