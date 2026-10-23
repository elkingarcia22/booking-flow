import type { useAppT } from "@/app/i18n";
import { tokenizeCard, type CardTokenInput } from "@/features/payments/gateway";
import type { CardValues } from "./cardValidation";
import { toastMissing } from "./missingData";

/**
 * La tarjeta nueva, lista para el cobro: la pasarela la convierte en token y solo eso viaja al
 * servidor. `undefined` si no hay tarjeta nueva (se paga con una guardada u otro método); `false` si
 * la pasarela no la aceptó (ya se avisó).
 */
export async function newCardToken(t: ReturnType<typeof useAppT>, card: CardValues | null | undefined, save: boolean): Promise<CardTokenInput | undefined | false> {
  if (!card) return undefined;
  const token = await tokenizeCard({ number: card.number, name: card.name, expiry: card.expiry });
  if (!token) {
    toastMissing(t, [t("booking.payment.cardRejected")]);
    return false;
  }
  return { ...token, save };
}
