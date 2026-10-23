import * as React from "react";
import type { useAppT } from "@/app/i18n";
import type { BookingState } from "../../bookingState";
import type { CardValues } from "../../flow/cardValidation";
import { NEW_CARD } from "../../flow/SavedCardPicker";
import type { PaymentController } from "../../flow/usePaymentController";
import type { MessageInput } from "./chatKit";

/**
 * La tarjeta en la conversación. Los datos de la tarjeta **no se escriben en el chat**: se abre la hoja
 * de la tarjeta, cuyos campos son de la pasarela (Stripe Elements, Wompi…), y al servidor solo llega
 * el token. Lo mismo con el CVC de una tarjeta guardada. El hilo solo dice qué tarjeta quedó.
 */

/** La hoja abierta: tarjeta nueva, o el CVC de una guardada. */
/** `canSave`: sin perfil no se ofrece guardarla. */
export type ChatCardSheet = { kind: "new"; canSave: boolean } | { kind: "cvc"; cardId: string; label: string; brand: string } | null;

export interface CardKit {
  t: ReturnType<typeof useAppT>;
  say: (...messages: MessageInput[]) => void;
  stateRef: { readonly current: BookingState };
  payment: { readonly current: PaymentController | null };
  /** Volver a elegir cómo pagar (si cierra la hoja sin terminar). */
  askMethod: (lead?: string) => void;
  /** Con el CVC de la guardada ya puesto, sigue el resumen para pagar. */
  onCvcReady: () => void;
}

export function useChatNewCard(kit: CardKit) {
  const { t, say, stateRef, payment, askMethod, onCvcReady } = kit;
  const [sheet, setSheet] = React.useState<ChatCardSheet>(null);
  // La hoja avisa que se cierra también después de confirmar: eso no es «la dejó».
  const settled = React.useRef(false);

  const open = (next: NonNullable<ChatCardSheet>) => {
    settled.current = false;
    setSheet(next);
  };

  const start = (lead?: string) => {
    say({ text: [lead, t("booking.chat.cardInSheet")].filter(Boolean).join("\n\n") });
    open({ kind: "new", canSave: Boolean(stateRef.current.customer) });
  };

  const askSavedCvc = (card: { id: string; brand: string; last4: string }) => {
    const label = `${card.brand} •••• ${card.last4}`;
    say({ text: t("booking.chat.cvcInSheet", { card: label }) });
    open({ kind: "cvc", cardId: card.id, label, brand: card.brand });
  };

  /** Entrega la tarjeta al cobro; el cobro avisa (`cardAdded`) y la conversación sigue con el resumen. */
  const confirmNew = (values: CardValues, save: boolean) => {
    settled.current = true;
    setSheet(null);
    const controller = payment.current;
    if (!controller) return;
    controller.setCard({ ...values });
    controller.setSaveCard(save);
    controller.setCardChoice(NEW_CARD);
    controller.setShowCardErrors(false);
    if (controller.reserve.isError) controller.reserve.reset();
  };

  const confirmCvc = (cvc: string) => {
    settled.current = true;
    setSheet(null);
    payment.current?.setSavedCvc(cvc);
    onCvcReady();
  };

  const onOpenChange = (next: boolean) => {
    if (next) return;
    setSheet(null);
    if (settled.current) return;
    settled.current = true;
    askMethod(t("booking.chat.cardStopped"));
  };

  return { start, askSavedCvc, sheet, confirmNew, confirmCvc, onOpenChange };
}

export type ChatCardController = ReturnType<typeof useChatNewCard>;
