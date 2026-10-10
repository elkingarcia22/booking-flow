import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Field, NumberField, PhoneInput } from "@/components/forms";
import { Spinner } from "@/components/feedback/Spinner";
import { Heading, Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { describeError, isApiError } from "@/lib/api";
import { useBookingFlow } from "../flow/BookingContext";
import { toastMissing } from "../flow/missingData";
import { brandFromName, isCvcComplete, type CardValues } from "../flow/cardValidation";
import { NewCardSheet } from "../flow/NewCardSheet";
import { NEW_CARD, SavedCardPicker } from "../flow/SavedCardPicker";
import { useSavedCardManager } from "../flow/useSavedCardManager";
import { StepLayout } from "../flow/StepLayout";
import { useBuyGiftMutation } from "../queries";

const AMOUNTS = [25, 50, 75, 100] as const;
const OTHER = 0;
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 500;
const MAX_MESSAGE = 200;
const MIN_PHONE_DIGITS = 10;

/**
 * Regalar una tarjeta: el monto, para quién (nombre y WhatsApp, a donde le llega el código) y un
 * mensaje; se paga con una tarjeta guardada o una nueva. Quien la recibe la usa al pagar una
 * reserva, y el saldo que sobre le queda para la próxima.
 */
export function GiftStep() {
  const t = useAppT();
  const { state, dispatch, shop, fmt } = useBookingFlow();
  const buy = useBuyGiftMutation(state.token);
  const savedCards = state.customer?.cards ?? [];
  const [preset, setPreset] = React.useState<number>(50);
  const [custom, setCustom] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [cardChoice, setCardChoice] = React.useState<string>(() => savedCards.find((card) => new Date(card.expYear, card.expMonth, 1).getTime() > Date.now())?.id ?? NEW_CARD);
  const [savedCvc, setSavedCvc] = React.useState("");
  const [card, setCard] = React.useState<CardValues | null>(null);
  const [saveCard, setSaveCard] = React.useState(false);
  const [sheet, setSheet] = React.useState<{ open: boolean; prefill: boolean }>({ open: false, prefill: false });
  const [showErrors, setShowErrors] = React.useState(false);
  const amount = preset === OTHER ? (custom ?? 0) : preset;
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
  const fieldErrors = isApiError(buy.error) ? buy.error.fieldErrors : undefined;
  const errors = {
    amount: !(amount >= MIN_AMOUNT && amount <= MAX_AMOUNT) ? t("booking.gift.amountError", { min: fmt.money(MIN_AMOUNT), max: fmt.money(MAX_AMOUNT) }) : undefined,
    name: name.trim().length < 2 ? t("booking.gift.nameError") : fieldErrors?.recipientName?.[0],
    phone: phone.replace(/\D/g, "").length - 2 < MIN_PHONE_DIGITS ? t("booking.phone.invalid") : fieldErrors?.recipientContact?.[0],
  };

  if (buy.isSuccess) {
    return (
      <StepLayout title={t("booking.gift.doneTitle")} lead={t("booking.gift.doneLead", { name: name.trim().split(" ")[0] ?? "", phone: buy.data.sentTo })}>
        <div className="flex items-center gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <IconTile size="lg" shape="circle" icon={<ThemaIcon name="ticket" />} />
          <div className="flex min-w-0 flex-col">
            <Text size="sm" tone="secondary">
              {shop.name}
            </Text>
            <Heading level={4} className="tabular-nums">
              {fmt.money(buy.data.amount)}
            </Heading>
            <Text size="sm" weight="medium" tabular>
              {buy.data.code}
            </Text>
          </div>
        </div>
        <Text size="sm" tone="muted">
          {t("booking.gift.paidWith", { method: buy.data.paidWith })}
        </Text>
        <Button type="button" size="lg" onClick={() => dispatch({ type: "goTo", step: "welcome" })}>
          {t("booking.gift.back")}
        </Button>
      </StepLayout>
    );
  }

  const pay = () => {
    setShowErrors(true);
    if (toastMissing(t, [errors.amount, errors.name, errors.phone])) return;
    if (!chosenSaved && !card) {
      toastMissing(t, [t("booking.payment.cardMissing")]);
      setSheet({ open: true, prefill: false });
      return;
    }
    if (chosenSaved && toastMissing(t, [!isCvcComplete(savedCvc, brandFromName(chosenSaved.brand)) && t("booking.payment.cvcMissing")])) return;
    buy.mutate({
      amount,
      recipientName: name.trim(),
      recipientContact: phone,
      message: message.trim(),
      savedCardId: chosenSaved?.id,
      card: !chosenSaved && card ? { number: card.number, name: card.name, expiry: card.expiry, save: saveCard } : undefined,
    });
  };

  return (
    <StepLayout
      title={t("booking.gift.title")}
      lead={t("booking.gift.lead", { shop: shop.name })}
      footer={
        <Button type="button" size="lg" className="w-full" disabled={buy.isPending} onClick={pay}>
          {buy.isPending ? <Spinner size="sm" tone="inverse" /> : <ThemaIcon name="lock" />}
          {t("booking.gift.pay", { amount: fmt.money(amount || 0) })}
        </Button>
      }
    >
      <section className="flex flex-col gap-2">
        <Heading level={6}>{t("booking.gift.amount")}</Heading>
        <div role="radiogroup" aria-label={t("booking.gift.amount")} className="flex flex-wrap gap-2">
          {[...AMOUNTS, OTHER].map((value) => (
            <Button key={value} type="button" role="radio" aria-checked={preset === value} size="sm" variant={preset === value ? "default" : "outline"} className="min-w-[4.5rem] rounded-full tabular-nums" onClick={() => setPreset(value)}>
              {value === OTHER ? t("booking.gift.other") : fmt.money(value)}
            </Button>
          ))}
        </div>
        {preset === OTHER && (
          <Field label={t("booking.gift.otherLabel")} error={showErrors ? errors.amount : undefined}>
            <NumberField value={custom ?? undefined} onValueChange={(value) => setCustom(value ?? null)} min={MIN_AMOUNT} max={MAX_AMOUNT} prefix="$" />
          </Field>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <Heading level={6}>{t("booking.gift.for")}</Heading>
        <Field label={t("booking.gift.name")} error={showErrors ? errors.name : undefined}>
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("booking.gift.phone")} description={t("booking.gift.phoneHint")} error={showErrors ? errors.phone : undefined}>
          <PhoneInput value={phone} onValueChange={setPhone} defaultCountry="CO" />
        </Field>
        <Field label={t("booking.gift.message")}>
          <Textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE))} rows={2} placeholder={t("booking.gift.messagePlaceholder")} />
        </Field>
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
