import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemaIcon } from "@/icons";
import { BookingSheet } from "../../flow/BookingSheet";
import { brandFromName, cvcLengthOf, digitsOf } from "../../flow/cardValidation";
import { NewCardSheet } from "../../flow/NewCardSheet";
import type { ChatCardController } from "./chatCard";

/** El CVC de una tarjeta guardada, en su hoja (los campos de la pasarela), no en el chat. */
function SavedCvcSheet({ label, brand, onOpenChange, onConfirm }: { label: string; brand: string; onOpenChange: (open: boolean) => void; onConfirm: (cvc: string) => void }) {
  const t = useAppT();
  const kind = brandFromName(brand);
  const length = cvcLengthOf(kind);
  const [cvc, setCvc] = React.useState("");
  const [showError, setShowError] = React.useState(false);
  const invalid = showError && cvc.length !== length;
  const confirm = () => {
    if (cvc.length !== length) {
      setShowError(true);
      return;
    }
    onConfirm(cvc);
  };
  return (
    <BookingSheet
      open
      onOpenChange={onOpenChange}
      title={t("booking.chat.cvcSheetTitle", { card: label })}
      description={t("booking.payment.secure")}
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={confirm}>
            <ThemaIcon name="lock" />
            {t("booking.payment.useCard")}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <label htmlFor="chat-saved-cvc" className="shrink-0">
          <Text as="span" size="sm" weight="medium">
            CVC
          </Text>
        </label>
        <Input
          id="chat-saved-cvc"
          value={cvc}
          onChange={(event) => setCvc(digitsOf(event.target.value).slice(0, length))}
          onKeyDown={(event) => event.key === "Enter" && confirm()}
          inputMode="numeric"
          autoComplete="cc-csc"
          autoFocus
          placeholder={kind === "amex" ? "1234" : "123"}
          aria-invalid={invalid || undefined}
          aria-describedby="chat-saved-cvc-hint"
          className="h-10 w-24 shrink-0 text-center tabular-nums"
        />
        <Text id="chat-saved-cvc-hint" as="span" size="xs" tone={invalid ? "negative" : "muted"} className="min-w-0">
          {invalid ? t("booking.payment.cvcMissing") : t(kind === "amex" ? "booking.payment.cvcHintAmex" : "booking.payment.cvcHint")}
        </Text>
      </div>
    </BookingSheet>
  );
}

/** Las hojas de la tarjeta que abre la conversación: tarjeta nueva o el CVC de una guardada. */
export function ChatCardSheets({ card }: { card: ChatCardController }) {
  if (card.sheet?.kind === "new") return <NewCardSheet open onOpenChange={card.onOpenChange} initial={null} initialSave={false} canSave={card.sheet.canSave} onConfirm={card.confirmNew} />;
  if (card.sheet?.kind === "cvc") return <SavedCvcSheet key={card.sheet.cardId} label={card.sheet.label} brand={card.sheet.brand} onOpenChange={card.onOpenChange} onConfirm={card.confirmCvc} />;
  return null;
}
