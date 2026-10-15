import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Spinner } from "@/components/feedback/Spinner";
import { Heading, Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { describeError, isApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../flow/BookingContext";
import { PayIdentity } from "../flow/PayIdentity";
import { toastMissing } from "../flow/missingData";
import { brandFromName, isCvcComplete, type CardValues } from "../flow/cardValidation";
import { NewCardSheet } from "../flow/NewCardSheet";
import { NEW_CARD, SavedCardPicker } from "../flow/SavedCardPicker";
import { SelectMark } from "@/components/selection";
import { MagicCard } from "@/components/ui/magic-card";
import { StepLayout } from "../flow/StepLayout";
import { useSavedCardManager } from "../flow/useSavedCardManager";
import { useBuyPackageMutation } from "../queries";

/**
 * Paquetes prepagados: N visitas de un servicio por menos de lo que valen sueltas. Se pagan aquí
 * con tarjeta y, al reservar, cada servicio cubierto gasta una visita (el pago lo descuenta solo).
 */
export function PackagesStep() {
  const t = useAppT();
  const { state } = useBookingFlow();
  // Se paga con su tarjeta: primero el código (al cliente de siempre se le reconoce sin él al entrar).
  if (!state.verified || !state.customer) {
    return (
      <StepLayout title={t("booking.payIdentity.title")} lead={t("booking.payIdentity.leadBuy")}>
        <PayIdentity />
      </StepLayout>
    );
  }
  return <PackagesBody key={state.customer.id} />;
}

function PackagesBody() {
  const t = useAppT();
  const { state, dispatch, shop, fmt } = useBookingFlow();
  const buy = useBuyPackageMutation(state.token);
  const offers = shop.packages;
  const owned = state.customer?.packages ?? [];
  const savedCards = state.customer?.cards ?? [];
  const [packageId, setPackageId] = React.useState<string>(offers[0]?.id ?? "");
  const [cardChoice, setCardChoice] = React.useState<string>(() => savedCards.find((card) => new Date(card.expYear, card.expMonth, 1).getTime() > Date.now())?.id ?? NEW_CARD);
  const [savedCvc, setSavedCvc] = React.useState("");
  const [card, setCard] = React.useState<CardValues | null>(null);
  const [saveCard, setSaveCard] = React.useState(false);
  const [sheet, setSheet] = React.useState<{ open: boolean; prefill: boolean }>({ open: false, prefill: false });
  const [showErrors, setShowErrors] = React.useState(false);
  const chosen = offers.find((offer) => offer.id === packageId) ?? null;
  const chosenSaved = savedCards.find((item) => item.id === cardChoice) ?? null;
  const chooseCard = (value: string) => {
    setCardChoice(value);
    setSavedCvc("");
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
  if (buy.isSuccess) {
    const bought = buy.data.package;
    return (
      <StepLayout title={t("booking.packages.doneTitle")} lead={t("booking.packages.doneLead", { count: bought.remaining, date: fmt.day(new Date(bought.expiresAt)) })}>
        <div className="flex items-center gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <IconTile size="lg" shape="circle" icon={<ThemaIcon name="ticket" />} />
          <div className="flex min-w-0 flex-col">
            <Heading level={5}>{bought.name}</Heading>
            <Text size="sm" tone="secondary" tabular>
              {t("booking.packages.visitsLeft", { count: bought.remaining })}
            </Text>
          </div>
        </div>
        <Text size="sm" tone="muted">
          {t("booking.packages.paidWith", { method: buy.data.paidWith })}
        </Text>
        <Button type="button" size="lg" onClick={() => dispatch({ type: "startFresh", onlyBranchId: shop.branches.length === 1 ? (shop.branches[0]?.id ?? null) : null })}>
          <ThemaIcon name="calendarAdd" />
          {t("booking.packages.bookNow")}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => dispatch({ type: "goTo", step: "welcome" })}>
          {t("booking.gift.back")}
        </Button>
      </StepLayout>
    );
  }

  const pay = () => {
    setShowErrors(true);
    if (toastMissing(t, [!chosen && t("booking.packages.chooseError")]) || !chosen) return;
    if (!chosenSaved && !card) {
      toastMissing(t, [t("booking.payment.cardMissing")]);
      setSheet({ open: true, prefill: false });
      return;
    }
    if (chosenSaved && toastMissing(t, [!isCvcComplete(savedCvc, brandFromName(chosenSaved.brand)) && t("booking.payment.cvcMissing")])) return;
    buy.mutate(
      { packageId: chosen.id, savedCardId: chosenSaved?.id, card: !chosenSaved && card ? { number: card.number, name: card.name, expiry: card.expiry, save: saveCard } : undefined },
      {
        onSuccess: (data) => {
          if (state.customer) dispatch({ type: "customerUpdated", customer: { ...state.customer, packages: [...owned, data.package] } });
        },
      },
    );
  };
  const fieldErrors = isApiError(buy.error) ? buy.error.fieldErrors : undefined;

  return (
    <StepLayout
      title={t("booking.packages.title")}
      lead={t("booking.packages.lead")}
      footer={
        <Button type="button" size="lg" className="w-full" disabled={buy.isPending} onClick={pay}>
          {buy.isPending ? <Spinner size="sm" tone="inverse" /> : <ThemaIcon name="lock" />}
          {t("booking.packages.pay", { amount: fmt.money(chosen?.price ?? 0) })}
        </Button>
      }
    >
      {owned.length > 0 && (
        <section className="flex flex-col gap-2">
          <Heading level={6}>{t("booking.packages.yours")}</Heading>
          {owned.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
              <Text size="sm" weight="medium" truncate>
                {item.name}
              </Text>
              <Text size="xs" tone="secondary" tabular className="shrink-0">
                {t("booking.packages.ownedLine", { count: item.remaining, date: fmt.day(new Date(item.expiresAt)) })}
              </Text>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <Heading level={6} className={cn(showErrors && !chosen && "text-destructive")}>{t("booking.packages.choose")}</Heading>
        {showErrors && !chosen && (
          <Text role="alert" size="sm" tone="negative" weight="medium">
            {t("booking.packages.chooseError")}
          </Text>
        )}
        <div role="radiogroup" aria-label={t("booking.packages.choose")} className="flex flex-col gap-2">
          {offers.map((offer) => {
            const saving = Math.max(0, offer.regular - offer.price);
            const selected = offer.id === packageId;
            return (
              <MagicCard
                key={offer.id}
                role="radio"
                aria-checked={selected}
                aria-label={`${offer.name} · ${fmt.money(offer.price)}`}
                isSelected={selected}
                onClick={() => setPackageId(offer.id)}
                className="w-full"
                contentClassName="items-center gap-3 text-left"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Text as="span" size="sm" weight="semibold">
                    {offer.name}
                  </Text>
                  <Text as="span" size="xs" tone="secondary">
                    {t("booking.packages.offerLine", { count: offer.sessions, days: offer.validDays })}
                  </Text>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Text as="span" size="sm" weight="semibold" tabular>
                    {fmt.money(offer.price)}
                  </Text>
                  {saving > 0 && <Badge variant="secondary">{t("booking.packages.saving", { amount: fmt.money(saving) })}</Badge>}
                </span>
                <SelectMark kind="radio" checked={selected} />
              </MagicCard>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Heading level={6}>{t("booking.gift.payWith")}</Heading>
        <SavedCardPicker
          cards={savedCards}
          value={cardChoice}
          onChange={chooseCard}
          pending={card}
          onAddNew={() => setSheet({ open: true, prefill: false })}
          onEditPending={() => setSheet({ open: true, prefill: true })}
          onRemovePending={cardManager.onRemovePending}
          onEditCard={cardManager.onEditCard}
          onRemoveCard={cardManager.onRemoveCard}
          cvc={savedCvc}
          onCvcChange={setSavedCvc}
          showErrors={showErrors}
        />
        {buy.isError && (
          <Text size="sm" tone="negative">
            {fieldErrors?.card?.[0] ?? describeError(buy.error).description}
          </Text>
        )}
        <Text size="xs" tone="muted" className="flex items-center gap-1.5">
          <ThemaIcon name="securityLock" size="xs" />
          {t("booking.payment.secure")}
        </Text>
      </section>

      {cardManager.sheets}
      <NewCardSheet
        key={`${sheet.open}-${sheet.prefill}`}
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        initial={sheet.prefill ? card : null}
        initialSave={saveCard}
        canSave
        onConfirm={(values, save) => {
          setCard(values);
          setSaveCard(save);
          setCardChoice(NEW_CARD);
        }}
      />
    </StepLayout>
  );
}
