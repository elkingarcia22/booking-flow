import * as React from "react";
import { useAppT } from "@/app/i18n";
import { describeError } from "@/lib/api";
import { useBookingFlow } from "../../flow/BookingContext";
import { toastMissing } from "../../flow/missingData";
import { useRequestCodeMutation } from "../../queries";

/** Dígitos mínimos de un celular nacional (Colombia y EE. UU. tienen 10). */
const MIN_DIGITS = 10;
const nationalDigits = (e164: string): number => e164.replace(/\D/g, "").length - 2;

/**
 * Lo que comparten los tres diseños de la entrada: el celular, su validación y el envío del
 * código. Cada diseño decide dónde lo pone; la puerta es la misma.
 */
export function usePhoneEntry() {
  const t = useAppT();
  const { state, dispatch, shop } = useBookingFlow();
  const lookup = useRequestCodeMutation();
  const [phone, setPhone] = React.useState(state.phone);
  const [touched, setTouched] = React.useState(false);
  const isValid = nationalDigits(phone) >= MIN_DIGITS;
  // Con varias sedes, desde que abre la primera hasta que cierra la última.
  const opensAt = shop.branches.map((branch) => branch.opensAt).sort()[0] ?? "09:00";
  const closesAt = shop.branches.map((branch) => branch.closesAt).sort().at(-1) ?? "19:00";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (toastMissing(t, [!isValid && t("booking.phone.invalid")])) return;
    lookup.mutate(phone, { onSuccess: (sent) => dispatch({ type: "codeSent", phone, sentTo: sent.sentTo, channel: sent.channel }) });
  };

  const error = touched && !isValid ? t("booking.phone.invalid") : lookup.isError ? describeError(lookup.error).description : undefined;
  return { phone, setPhone, submit, error, isPending: lookup.isPending, opensAt, closesAt };
}

export type PhoneEntry = ReturnType<typeof usePhoneEntry>;

