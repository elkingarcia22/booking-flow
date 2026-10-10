import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { useAppT } from "@/app/i18n";
import { Field, InputOtp, PhoneInput } from "@/components/forms";
import { Spinner } from "@/components/feedback/Spinner";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/api";
import { bookingApi } from "../api";
import { useBookingFlow } from "./BookingContext";
import { toastMissing } from "./missingData";

const CODE_LENGTH = 6;
const MIN_PHONE_DIGITS = 12;

/**
 * Entrar a «Mis citas»: el celular y un código por SMS. Ver o cancelar citas
 * ajenas no puede costar solo saberse un número de teléfono.
 */
export function ManageSignIn() {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const [notFound, setNotFound] = React.useState(false);
  const [phone, setPhone] = React.useState(state.phone);
  const [touched, setTouched] = React.useState(false);
  const phoneMissing = phone.replace(/\D/g, "").length < MIN_PHONE_DIGITS;
  const [code, setCode] = React.useState("");
  const request = useMutation({ mutationFn: () => bookingApi.requestOtp(phone) });
  const verify = useMutation({ mutationFn: (value: string) => bookingApi.verifyOtp(phone, value) });

  const check = (value: string) =>
    verify.mutate(value, {
      onSuccess: (result) => {
        // Un número sin perfil (o bloqueado) no tiene citas que ver: se dice después del código, no antes.
        if (result.status !== "known") {
          setNotFound(true);
          setCode("");
          return;
        }
        dispatch({ type: "signedIn", customer: result.customer, token: result.token });
      },
      onError: () => setCode(""),
    });

  if (!request.isSuccess) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (toastMissing(t, [phoneMissing && t("booking.phone.invalid")])) return;
          request.mutate();
        }}
      >
        <Field label={t("booking.phone.label")} error={touched && phoneMissing ? t("booking.phone.invalid") : request.isError ? describeError(request.error).description : undefined}>
          <PhoneInput value={phone} onValueChange={setPhone} defaultCountry="CO" />
        </Field>
        <Button type="submit" size="lg" disabled={request.isPending}>
          {request.isPending && <Spinner size="sm" tone="inverse" />}
          {t("booking.manage.sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Text weight="semibold">{t("booking.manage.codeTitle")}</Text>
        <Text size="sm" tone="secondary">
          {t("booking.manage.codeLead", { phone: request.data.sentTo })}
        </Text>
      </div>
      <Field label={t("booking.manage.code")} error={notFound ? t("booking.manage.notFound") : verify.isError ? describeError(verify.error).description : undefined}>
        <InputOtp length={CODE_LENGTH} value={code} onChange={setCode} onComplete={check} groups={[3, 3]} autoFocus disabled={verify.isPending} />
      </Field>
      <Button type="button" variant="link" size="sm" className="self-start" onClick={() => request.mutate()} disabled={request.isPending}>
        {t("booking.manage.resend")}
      </Button>
    </div>
  );
}
