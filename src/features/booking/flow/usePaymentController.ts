import * as React from "react";
import { CreditCard, Smartphone, Store, Wallet } from "lucide-react";
import { useAppT } from "@/app/i18n";
import type { SelectionOption } from "@/components/selection";
import { isApiError } from "@/lib/api";
import { depositOf, feeLabel } from "../pricing";
import { useReserveMutation } from "../queries";
import type { PayMethod } from "../types";
import { useBookingFlow } from "./BookingContext";
import { cardMissing, toastMissing } from "./missingData";
import { brandFromName, digitsOf, firstUsableCard, isCardComplete, isCvcComplete, type CardValues } from "./cardValidation";
import { NEW_CARD } from "./SavedCardPicker";
import { useSavedCardManager } from "./useSavedCardManager";

/**
 * El cobro de la reserva, sin la pantalla alrededor: la propina, los descuentos,
 * cómo se paga, la tarjeta y el resumen. Lo comparten las tres versiones de la
 * reserva —el paso «Pagar», el cierre de la agenda y la tarjeta de pago
 * dentro de la conversación—, así el dinero se calcula y se cobra igual en todas.
 */
export function usePaymentController() {
  const t = useAppT();
  const { state, dispatch, shop, totals, fmt, utm } = useBookingFlow();
  const reserve = useReserveMutation(state.token);
  // La tarjeta nueva, ya escrita y revisada en su hoja (null mientras no se agrega).
  const [card, setCard] = React.useState<CardValues | null>(null);
  const [sheet, setSheet] = React.useState<{ open: boolean; prefill: boolean }>({ open: false, prefill: false });
  const [showCardErrors, setShowCardErrors] = React.useState(false);
  // Varias citas pagadas en el local: se explica cómo se cobra antes de que lleguen.
  const [shopNoticeOpen, setShopNoticeOpen] = React.useState(false);
  // La propina se pregunta en un modal al pulsar «Pagar», no dentro del cobro.
  const [tipOpen, setTipOpen] = React.useState(false);
  const customer = state.customer;
  const credit = customer?.credit ?? 0;
  // Con tarjetas guardadas abre en la primera que no esté vencida; si no, en «tarjeta nueva».
  const savedCards = customer?.cards ?? [];
  const [cardChoice, setCardChoice] = React.useState<string>(() => firstUsableCard(savedCards, NEW_CARD));
  const [savedCvc, setSavedCvc] = React.useState("");
  // Guardar la tarjeta es una decisión del cliente: empieza sin marcar.
  const [saveCard, setSaveCard] = React.useState(false);
  const chosenSaved = savedCards.find((item) => item.id === cardChoice) ?? null;
  // Anticipo: a quien la barbería se lo pide (nuevo o con inasistencias), pagar en la barbería cobra una parte ya.
  const depositPercent = customer?.depositRequired && shop.deposit ? shop.deposit.percent : null;

  // El recargo se dice en la opción que lo lleva, antes de elegirla, y pagar en la barbería lo evita.
  const fee = shop.cardFee ? t("booking.payment.feeHint", { fee: feeLabel(shop.cardFee, fmt.money) }) : "";
  const methods: SelectionOption[] = [
    ...(shop.payment.card
      ? [
          { value: "card", label: t("booking.payment.card"), description: [t("booking.payment.cardHint"), fee].filter(Boolean).join(" "), icon: CreditCard },
          { value: "wallet", label: t("booking.payment.wallet"), description: [t("booking.payment.walletHint"), fee].filter(Boolean).join(" "), icon: Smartphone },
        ]
      : []),
    // «Solo en línea» no esconde la opción: se ve apagada y dice por qué.
    ...(shop.payment.payAtShop
      ? [
          customer?.onlineOnly
            ? { value: "shop", label: t("booking.payment.shop"), description: t("booking.payment.onlineOnly"), icon: Store, disabled: true }
            : {
                value: "shop",
                label: t("booking.payment.shop"),
                description: depositPercent !== null ? t("booking.payment.shopDepositHint", { percent: depositPercent }) : [t("booking.payment.shopHint"), shop.cardFee ? t("booking.payment.shopNoFee") : ""].filter(Boolean).join(" "),
                icon: Store,
              },
        ]
      : []),
    ...(credit >= totals.total && totals.total > 0 ? [{ value: "credit", label: t("booking.payment.credit"), description: t("booking.payment.creditHint", { amount: fmt.money(credit) }), icon: Wallet }] : []),
  ];
  const available = methods.filter((option) => !option.disabled);
  // Si la tarjeta de regalo cubre todo, no hay nada más que cobrar.
  const coveredByGift = totals.total === 0 && totals.gift > 0;
  const method: PayMethod | null = coveredByGift ? "gift" : state.method && available.some((option) => option.value === state.method) ? state.method : ((available[0]?.value as PayMethod | undefined) ?? null);
  // La tarjeta elegida (guardada o la nueva ya escrita), dicha como en el recibo.
  const payCard = chosenSaved ? `${chosenSaved.brand} •••• ${chosenSaved.last4}` : card && digitsOf(card.number).length >= 4 ? `${t("booking.payment.card")} •••• ${digitsOf(card.number).slice(-4)}` : null;
  React.useEffect(() => {
    if (payCard !== state.payCard) dispatch({ type: "setPayCard", card: payCard });
  }, [payCard, state.payCard, dispatch]);
  // El método que se ve marcado queda también en el estado: el resumen de «Tu reserva» lo muestra.
  React.useEffect(() => {
    if (method && method !== "gift" && method !== state.method) dispatch({ type: "setMethod", method });
  }, [method, state.method, dispatch]);
  const deposit = method === "shop" && depositPercent !== null ? depositOf(totals, depositPercent) : 0;
  /** Pide tarjeta: el pago con tarjeta o el anticipo de quien paga en la barbería. */
  const usesCard = method === "card" || deposit > 0;

  const serverCardError = isApiError(reserve.error) ? reserve.error.fieldErrors?.card?.[0] : undefined;
  const payLabel =
    coveredByGift ? t("booking.gift.payCovered") : deposit > 0 ? t("booking.payment.payDeposit", { amount: fmt.money(deposit) }) : method === "shop" ? t("booking.payment.payShop") : method === "credit" ? t("booking.payment.payCredit") : method === "wallet" ? t("booking.payment.payWallet", { amount: fmt.money(totals.total) }) : t("booking.payment.payNow", { amount: fmt.money(totals.total) });

  /** Revisa que el cobro esté completo; avisa de lo que falta y dice si se puede seguir. */
  const validate = () => {
    if (!customer || !state.branchId || !method) return false;
    if (usesCard && !chosenSaved && !card) {
      toastMissing(t, [t("booking.payment.cardMissing")]);
      setSheet({ open: true, prefill: false });
      return false;
    }
    if (usesCard && (chosenSaved ? !isCvcComplete(savedCvc, brandFromName(chosenSaved.brand)) : !card || !isCardComplete(card))) {
      setShowCardErrors(true);
      toastMissing(t, chosenSaved ? [t("booking.payment.cvcMissing")] : card ? cardMissing(t, card) : [t("booking.payment.cardMissing")]);
      return false;
    }
    return true;
  };

  const submit = (tipId: string | null) => {
    if (!customer || !state.branchId || !method) return;
    reserve.mutate(
      {
        branchId: state.branchId,
        items: state.items.map((item) => ({
          guestId: item.person.kind === "guest" ? item.person.guestId : null,
          guestName: item.person.kind === "new" ? item.person.name : undefined,
          guestRelation: item.person.kind === "new" ? item.person.relation : undefined,
          serviceIds: item.serviceIds,
          barberId: item.barberId,
          start: item.start ?? "",
        })),
        products: Object.entries(state.products).map(([productId, qty]) => ({ productId, qty })),
        tipId,
        promoCode: state.promo?.code ?? null,
        giftCode: state.gift?.code,
        useReward: totals.reward > 0,
        usePackages: totals.prepaid > 0,
        referencePhotos: state.referencePhotos.length > 0 ? [...state.referencePhotos] : undefined,
        utm: utm ?? undefined,
        method,
        // El CVC no se manda: va a la pasarela. De una guardada solo viaja su id (el token).
        card: usesCard && !chosenSaved && card ? { number: card.number, name: card.name, expiry: card.expiry, save: saveCard } : undefined,
        savedCardId: usesCard && chosenSaved ? chosenSaved.id : undefined,
        notes: state.notes.trim() || undefined,
      },
      { onSuccess: (reservation) => dispatch({ type: "reserved", reservation }) }
    );
  };

  /**
   * «Pagar»: si la barbería recibe propinas, antes de cobrar se pregunta en un modal.
   * La conversación ya la preguntó con sus propias respuestas: pasa `askTip: false`.
   */
  const pay = ({ askTip = true }: { askTip?: boolean } = {}) => {
    if (!validate()) return;
    if (askTip && shop.tipOptions.length > 0 && !coveredByGift) {
      setTipOpen(true);
      return;
    }
    submit(state.tipId);
  };
  /** Lo que se eligió en el modal de la propina (null = sin propina) y se cobra. */
  const confirmTip = (tipId: string | null) => {
    dispatch({ type: "setTip", tipId });
    setTipOpen(false);
    submit(tipId);
  };

  const chooseCard = (value: string) => {
    setCardChoice(value);
    setSavedCvc("");
    setShowCardErrors(false);
    if (reserve.isError) reserve.reset();
  };
  const cardManager = useSavedCardManager({
    choice: cardChoice,
    newCard: NEW_CARD,
    hasPending: card !== null,
    choose: chooseCard,
    clearPending: () => {
      setCard(null);
      setSaveCard(false);
    },
  });

  return {
    reserve,
    methods,
    method,
    deposit,
    depositPercent,
    usesCard,
    coveredByGift,
    payLabel,
    pay,
    serverCardError,
    savedCards,
    cardChoice,
    chooseCard,
    card,
    setCard,
    saveCard,
    setSaveCard,
    setCardChoice,
    savedCvc,
    setSavedCvc,
    showCardErrors,
    setShowCardErrors,
    sheet,
    setSheet,
    shopNoticeOpen,
    setShopNoticeOpen,
    tipOpen,
    setTipOpen,
    confirmTip,
    cardManager,
  };
}

export type PaymentController = ReturnType<typeof usePaymentController>;
