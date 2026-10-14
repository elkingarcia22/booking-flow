import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Spinner } from "@/components/feedback/Spinner";
import { Field, InputOtp, PhoneInput } from "@/components/forms";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { describeError } from "@/lib/api";
import { formatPhone } from "../bookingFormat";
import { useRecentCode, useRequestCodeMutation, useVerifyCodeMutation } from "../queries";
import type { OtpSent } from "../types";
import { ProfileForm } from "../variants/agenda/AgendaIdentity";
import { useBookingFlow } from "./BookingContext";
import { toastMissing } from "./missingData";

const CODE_LENGTH = 6;
const MIN_DIGITS = 10;
const nationalDigits = (e164: string): number => e164.replace(/\D/g, "").length - 2;

/** Otro celular: el de la portada estaba mal. Al enviarlo, el código va a este. */
function PhoneChange({ onSent }: { onSent: (phone: string) => void }) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const [phone, setPhone] = React.useState(state.phone);
  const [touched, setTouched] = React.useState(false);
  const isValid = nationalDigits(phone) >= MIN_DIGITS;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (toastMissing(t, [!isValid && t("booking.phone.invalid")])) return;
    onSent(phone);
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label={t("booking.phone.label")} error={touched && !isValid ? t("booking.phone.invalid") : undefined}>
        <PhoneInput value={phone} onValueChange={setPhone} defaultCountry="CO" autoComplete="tel-national" autoFocus />
      </Field>
      <Button type="submit" size="lg">
        <ThemaIcon name="smsCode" />
        {t("booking.agenda.id.sendCode")}
      </Button>
    </form>
  );
}

/**
 * El código, pedido al pagar (o al apuntarse a la lista de espera, comprar un paquete…): llega solo al
 * celular que escribió en la portada. Al completarlo se
 * sabe quién es —sin moverse de la pantalla de pago—: el cliente de siempre sigue a pagar con sus
 * tarjetas y su membresía, el nuevo deja su ficha y el número bloqueado va a su aviso.
 */
function CodeGate() {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const request = useRequestCodeMutation();
  const verify = useVerifyCodeMutation();
  const recentCode = useRecentCode();
  // El código que ya tenía (mandado hace poco a este celular), mientras no se pida otro aquí.
  const [reused, setReused] = React.useState<OtpSent | null>(() => (state.phone ? recentCode(state.phone) : null));
  const [code, setCode] = React.useState("");
  const [isChanging, setIsChanging] = React.useState(false);
  const sentFor = React.useRef<string | null>(null);

  const send = React.useCallback(
    (phone: string) => {
      sentFor.current = phone;
      setReused(null);
      setCode("");
      verify.reset();
      request.mutate(phone, { onSuccess: () => dispatch({ type: "phoneEntered", phone }) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las mutaciones son estables
    [dispatch]
  );

  // Al llegar al pago se manda solo, una vez, al celular de la portada; si ya se le mandó uno hace poco
  // (volvió atrás y entró otra vez, o lo pidió la lista de espera), sirve ese.
  React.useEffect(() => {
    if (!state.phone || sentFor.current !== null) return;
    const phone = state.phone;
    sentFor.current = phone;
    if (reused) return;
    request.mutate(phone, { onSuccess: () => dispatch({ type: "phoneEntered", phone }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las mutaciones son estables
  }, [dispatch, state.phone, reused]);

  const check = (value: string) =>
    verify.mutate(
      { phone: state.phone, code: value },
      {
        onSuccess: (result) => {
          if (result.status === "known") dispatch({ type: "signedIn", customer: result.customer, token: result.token });
          else if (result.status === "new") dispatch({ type: "verifiedNew", token: result.token });
          else dispatch({ type: "customerBlocked" });
        },
        onError: () => setCode(""),
      }
    );

  if (isChanging || !state.phone) {
    return (
      <PhoneChange
        onSent={(phone) => {
          setIsChanging(false);
          send(phone);
        }}
      />
    );
  }

  const sent = request.data ?? reused;
  const error = verify.isError ? describeError(verify.error).description : request.isError ? describeError(request.error).description : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Text size="sm" tone="secondary" aria-live="polite">
        {sent
          ? t(sent.channel === "whatsapp" ? "booking.verify.leadWhatsapp" : "booking.verify.leadSms", { phone: sent.sentTo })
          : t("booking.payIdentity.sending", { phone: formatPhone(state.phone) })}
      </Text>
      <Field label={t("booking.manage.code")} error={error}>
        <InputOtp length={CODE_LENGTH} value={code} onChange={setCode} onComplete={check} groups={[3, 3]} autoFocus disabled={verify.isPending || !sent} />
      </Field>
      {(verify.isPending || request.isPending) && (
        <Text size="sm" tone="muted" className="flex items-center gap-2">
          <Spinner size="sm" />
          {verify.isPending ? t("booking.verify.checking") : t("booking.payIdentity.sendingShort")}
        </Text>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Button type="button" variant="link" size="sm" className="px-0" disabled={request.isPending} onClick={() => send(state.phone)}>
          {t("booking.manage.resend")}
        </Button>
        <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setIsChanging(true)}>
          {t("booking.verify.changePhone")}
        </Button>
      </div>
    </div>
  );
}

/** Quién paga, justo antes de pagar: el código y, si es la primera vez, su ficha. */
export function PayIdentity() {
  const { state } = useBookingFlow();
  if (state.verified && state.customer) return null;
  return state.verified ? <ProfileForm /> : <CodeGate />;
}
