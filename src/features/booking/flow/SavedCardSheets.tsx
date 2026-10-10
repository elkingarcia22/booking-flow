import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Field } from "@/components/forms";
import { Spinner } from "@/components/feedback/Spinner";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemaIcon } from "@/icons";
import { describeError } from "@/lib/api";
import { useRemoveCardMutation, useUpdateCardMutation } from "../queries";
import type { BookingCustomer, SavedCard } from "../types";
import { BookingSheet } from "./BookingSheet";
import { useBookingFlow } from "./BookingContext";
import { CardBrandTile } from "./CardBrandMark";
import { brandFromName, expiryOk, groupExpiry, savedCardExpiry } from "./cardValidation";
import { toastMissing } from "./missingData";

const MIN_HOLDER = 3;

/** La tarjeta de la que se habla, arriba de la hoja: marca, •••• últimos 4 y vencimiento. */
function CardSummary({ card }: { card: SavedCard }) {
  const t = useAppT();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-3">
      <CardBrandTile brand={brandFromName(card.brand)} />
      <span className="flex min-w-0 flex-col">
        <Text as="span" size="sm" weight="medium" tabular>
          {card.brand} •••• {card.last4}
        </Text>
        <Text as="span" size="xs" tone="muted" tabular>
          {t("booking.payment.savedCardExpires", { date: savedCardExpiry(card) })}
        </Text>
      </span>
    </div>
  );
}

interface SavedCardSheetProps {
  /** La tarjeta de la hoja; se conserva al cerrar para que no se vacíe mientras sale. */
  card: SavedCard | null;
  open: boolean;
  onClose: () => void;
  /** El perfil con la lista ya al día, para elegir otra si hace falta. */
  onDone: (customer: BookingCustomer) => void;
}

/**
 * Editar una tarjeta guardada: solo el titular y el vencimiento, que es lo que
 * la pasarela deja cambiar del token (la renovación trae otra fecha). Para otro
 * número se agrega una tarjeta nueva.
 */
export function EditSavedCardSheet({ card, open, onClose, onDone }: SavedCardSheetProps) {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const update = useUpdateCardMutation(state.token);
  const [holder, setHolder] = React.useState(card?.holder ?? "");
  const [expiry, setExpiry] = React.useState(card ? savedCardExpiry(card) : "");
  const [showErrors, setShowErrors] = React.useState(false);
  const holderError = holder.trim().length < MIN_HOLDER;
  const expiryError = !expiryOk(expiry);

  const save = () => {
    if (!card) return;
    if (holderError || expiryError) {
      setShowErrors(true);
      toastMissing(t, [holderError && t("booking.payment.cardError"), expiryError && t("booking.payment.cardExpiryError")]);
      return;
    }
    const [month, year] = expiry.split("/").map(Number);
    update.mutate(
      { id: card.id, input: { holder: holder.trim(), expMonth: month, expYear: 2000 + year } },
      {
        onSuccess: (customer) => {
          dispatch({ type: "customerUpdated", customer });
          onDone(customer);
          onClose();
        },
      }
    );
  };

  return (
    <BookingSheet
      open={open && card !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("booking.payment.editCardTitle")}
      description={t("booking.payment.editCardHint")}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={update.isPending}>
            {update.isPending ? <Spinner size="sm" tone="inverse" /> : <ThemaIcon name="check" />}
            {t("booking.payment.saveCardChanges")}
          </Button>
        </>
      }
    >
      {card && (
        <div className="flex flex-col gap-5">
          <CardSummary card={card} />
          <Field label={t("booking.payment.cardName")} error={showErrors && holderError ? t("booking.payment.cardError") : undefined}>
            <Input value={holder} onChange={(event) => setHolder(event.target.value)} autoComplete="cc-name" placeholder={t("booking.card.holderExample")} />
          </Field>
          <Field label={t("booking.payment.cardExpiry")} error={showErrors && expiryError ? t("booking.payment.cardExpiryError") : undefined}>
            <Input value={expiry} onChange={(event) => setExpiry(groupExpiry(event.target.value))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" className="w-28 tabular-nums" />
          </Field>
          {update.isError && (
            <Text size="sm" tone="negative">
              {describeError(update.error).description}
            </Text>
          )}
        </div>
      )}
    </BookingSheet>
  );
}

/** Quitar una tarjeta guardada, con una confirmación: deja de aparecer en las próximas reservas. */
export function RemoveSavedCardSheet({ card, open, onClose, onDone }: SavedCardSheetProps) {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const remove = useRemoveCardMutation(state.token);

  const confirm = () => {
    if (!card) return;
    remove.mutate(card.id, {
      onSuccess: (customer) => {
        dispatch({ type: "customerUpdated", customer });
        onDone(customer);
        onClose();
      },
    });
  };

  return (
    <BookingSheet
      open={open && card !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("booking.payment.removeCardTitle")}
      description={t("booking.payment.removeCardHint")}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={remove.isPending}>
            {remove.isPending ? <Spinner size="sm" tone="inverse" /> : null}
            {t("booking.payment.removeCard")}
          </Button>
        </>
      }
    >
      {card && (
        <div className="flex flex-col gap-3">
          <CardSummary card={card} />
          {remove.isError && (
            <Text size="sm" tone="negative">
              {describeError(remove.error).description}
            </Text>
          )}
        </div>
      )}
    </BookingSheet>
  );
}
