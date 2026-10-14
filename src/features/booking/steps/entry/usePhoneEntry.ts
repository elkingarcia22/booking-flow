import * as React from "react";
import { useAppT } from "@/app/i18n";
import { describeError } from "@/lib/api";
import { useBookingFlow } from "../../flow/BookingContext";
import { toastMissing } from "../../flow/missingData";
import { useCheckPhoneMutation, useRequestCodeMutation } from "../../queries";

/** Dígitos mínimos de un celular nacional (Colombia y EE. UU. tienen 10). */
const MIN_DIGITS = 10;
const nationalDigits = (e164: string): number => e164.replace(/\D/g, "").length - 2;

/**
 * Lo que comparten los diseños de la entrada: el celular y su validación. Con un celular válido se
 * pregunta si ya es cliente: al de siempre se le reconoce sin código (su bienvenida); el nuevo arma
 * su ficha («Conozcámonos») y la cita. A los dos se les pide el código al pagar, en la lista de espera o en «Mis citas».
 */
export function usePhoneEntry({ askProfile }: { askProfile: boolean }) {
  const t = useAppT();
  const { state, dispatch, shop } = useBookingFlow();
  const check = useCheckPhoneMutation();
  const request = useRequestCodeMutation();
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
    check.mutate(phone, {
      onSuccess: ({ returning, customer, token }) => {
        // El de siempre: su bienvenida sin código. El código se pide al pagar, en la lista de espera o en «Mis citas».
        if (customer && token) return dispatch({ type: "customerPreview", phone, customer, token });
        if (!returning) return dispatch({ type: "startWithPhone", phone, askProfile, onlyBranchId: shop.branches.length === 1 ? (shop.branches[0]?.id ?? null) : null });
        // Cliente sin perfil que mostrar (bloqueado): lo sabe tras el código, como siempre.
        request.mutate(phone, { onSuccess: (sent) => dispatch({ type: "codeSent", phone, sentTo: sent.sentTo, channel: sent.channel }) });
      },
    });
  };

  const failed = check.error ?? request.error;
  const error = touched && !isValid ? t("booking.phone.invalid") : failed ? describeError(failed).description : undefined;
  return { phone, setPhone, submit, error, isPending: check.isPending || request.isPending, opensAt, closesAt };
}

export type PhoneEntry = ReturnType<typeof usePhoneEntry>;

