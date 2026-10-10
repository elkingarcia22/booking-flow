import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { BookingSheet } from "./BookingSheet";
import { CardForm } from "./CardForm";
import { isCardComplete, type CardValues } from "./cardValidation";
import { cardMissing, toastMissing } from "./missingData";

const EMPTY_CARD: CardValues = { number: "", expiry: "", cvc: "", name: "" };

interface NewCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La tarjeta nueva que ya se había escrito, para corregirla. */
  initial: CardValues | null;
  initialSave: boolean;
  /** Sin perfil no se ofrece guardarla. */
  canSave: boolean;
  onConfirm: (values: CardValues, save: boolean) => void;
}

/**
 * Agregar una tarjeta en su propia hoja, como el catálogo de productos o el
 * perfil del barbero: la tarjeta dibujada y los campos tienen todo el espacio
 * y el pago no se alarga. Al confirmar, la tarjeta queda elegida en la lista.
 */
export function NewCardSheet({ open, onOpenChange, initial, initialSave, canSave, onConfirm }: NewCardSheetProps) {
  const t = useAppT();
  const [values, setValues] = React.useState<CardValues>(initial ?? EMPTY_CARD);
  const [save, setSave] = React.useState(initialSave);
  const [showErrors, setShowErrors] = React.useState(false);

  const confirm = () => {
    if (!isCardComplete(values)) {
      setShowErrors(true);
      toastMissing(t, cardMissing(t, values));
      return;
    }
    onConfirm(values, save);
    onOpenChange(false);
  };

  return (
    <BookingSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("booking.payment.newCard")}
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
      <CardForm values={values} onChange={setValues} showErrors={showErrors} save={save} onSaveChange={canSave ? setSave : undefined} bare />
    </BookingSheet>
  );
}
