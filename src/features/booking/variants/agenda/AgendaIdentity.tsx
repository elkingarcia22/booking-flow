import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Spinner } from "@/components/feedback/Spinner";
import { Field, InputOtp, PhoneInput } from "@/components/forms";
import { Text } from "@/components/typography";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemaIcon } from "@/icons";
import { describeError, isApiError } from "@/lib/api";
import { formatPhone } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { toastMissing } from "../../flow/missingData";
import { useCheckPhoneMutation, useCreateCustomerMutation, useRequestCodeMutation, useVerifyCodeMutation } from "../../queries";
import { ConsentFields } from "../../flow/ConsentFields";
import { useConsentBranchId } from "../../flow/consentPack";

const MIN_DIGITS = 10;
const CODE_LENGTH = 6;
const MIN_NAME = 2;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nationalDigits = (e164: string): number => e164.replace(/\D/g, "").length - 2;

/**
 * El celular, sin código: si ya es cliente queda reconocido (su vista previa); si es nuevo, sigue a su
 * ficha. Solo el número que no se reconoce sin código (bloqueado) recibe el código. Con el celular ya
 * dado (en la portada) se busca solo al abrir.
 */
function PhoneLookup() {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const check = useCheckPhoneMutation();
  const request = useRequestCodeMutation();
  const [phone, setPhone] = React.useState(state.phone);
  const [touched, setTouched] = React.useState(false);
  const isValid = nationalDigits(phone) >= MIN_DIGITS;
  // Con el celular de la portada se busca solo: mientras tanto, solo el aviso de que se está buscando.
  const [isAuto] = React.useState(() => Boolean(state.phone));

  const lookup = (value: string) =>
    check.mutate(value, {
      onSuccess: ({ customer, token }) => {
        if (token) return dispatch({ type: "identified", phone: value, customer, token });
        request.mutate(value, { onSuccess: (sent) => dispatch({ type: "codeSent", phone: value, sentTo: sent.sentTo, channel: sent.channel }) });
      },
    });

  const asked = React.useRef(false);
  React.useEffect(() => {
    if (asked.current || !state.phone) return;
    asked.current = true;
    lookup(state.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez, al abrir
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (toastMissing(t, [!isValid && t("booking.phone.invalid")])) return;
    lookup(phone);
  };

  const failed = check.error ?? request.error;
  const isPending = check.isPending || request.isPending;
  if (isAuto && isPending && !touched) {
    return (
      <Text size="sm" tone="muted" className="flex items-center gap-2" aria-live="polite">
        <Spinner size="sm" />
        {t("booking.payIdentity.checking")}
      </Text>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label={t("booking.phone.label")} description={t("booking.agenda.id.phoneHint")} error={touched && !isValid ? t("booking.phone.invalid") : failed ? describeError(failed).description : undefined}>
        <PhoneInput value={phone} onValueChange={setPhone} defaultCountry="CO" autoComplete="tel-national" />
      </Field>
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? <Spinner size="sm" tone="inverse" /> : <ThemaIcon name="arrowRight" />}
        {t("booking.phone.continue")}
      </Button>
    </form>
  );
}

/** El código que llegó: al completarlo se sabe si vuelve, si es nuevo o si está bloqueado. */
function CodeForm({ onBlocked }: { onBlocked: () => void }) {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const verify = useVerifyCodeMutation();
  const resend = useRequestCodeMutation();
  const [code, setCode] = React.useState("");
  const sent = state.codeSentTo;
  if (!sent) return null;

  const check = (value: string) =>
    verify.mutate(
      { phone: state.phone, code: value },
      {
        onSuccess: (result) => {
          if (result.status === "known") dispatch({ type: "customerFound", customer: result.customer, token: result.token });
          else if (result.status === "new") dispatch({ type: "customerIsNew", token: result.token });
          else {
            dispatch({ type: "customerBlocked" });
            onBlocked();
          }
        },
        onError: () => setCode(""),
      }
    );

  return (
    <div className="flex flex-col gap-3">
      <Text size="sm" tone="secondary">
        {t(sent.channel === "whatsapp" ? "booking.verify.leadWhatsapp" : "booking.verify.leadSms", { phone: sent.sentTo })}
      </Text>
      <Field label={t("booking.manage.code")} error={verify.isError ? describeError(verify.error).description : undefined}>
        <InputOtp length={CODE_LENGTH} value={code} onChange={setCode} onComplete={check} groups={[3, 3]} autoFocus disabled={verify.isPending} />
      </Field>
      {verify.isPending && (
        <Text size="sm" tone="muted" className="flex items-center gap-2">
          <Spinner size="sm" />
          {t("booking.verify.checking")}
        </Text>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Button type="button" variant="link" size="sm" className="px-0" disabled={resend.isPending} onClick={() => resend.mutate(state.phone, { onSuccess: (next) => dispatch({ type: "codeSent", phone: state.phone, sentTo: next.sentTo, channel: next.channel }) })}>
          {t("booking.manage.resend")}
        </Button>
        <Button type="button" variant="link" size="sm" className="px-0" onClick={() => dispatch({ type: "signOut" })}>
          {t("booking.verify.changePhone")}
        </Button>
      </div>
    </div>
  );
}

/** Primera vez: lo justo para su ficha. El permiso de promociones empieza sin marcar (Ley 1581). */
export function ProfileForm() {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const create = useCreateCustomerMutation(state.token);
  const consentBranchId = useConsentBranchId();
  const [values, setValues] = React.useState(() => state.pendingProfile ?? { firstName: "", lastName: "", email: "", marketing: false });
  const [touched, setTouched] = React.useState(false);
  // Ya los escribió en «Conozcámonos» (sin código): al confirmar el código la ficha se crea sola. Si falla
  // (un correo ya usado, p. ej.), queda el formulario con sus datos y el error a la vista.
  const pending = state.pendingProfile;
  const autoCreated = React.useRef(false);
  React.useEffect(() => {
    if (!pending || autoCreated.current) return;
    autoCreated.current = true;
    create.mutate(pending, { onSuccess: (customer) => dispatch({ type: "customerUpdated", customer }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez, al confirmar el código
  }, []);
  const serverFields = isApiError(create.error) ? create.error.fieldErrors : undefined;
  const errors = {
    firstName: values.firstName.trim().length < MIN_NAME ? t("booking.profile.firstNameError") : serverFields?.firstName?.[0],
    lastName: values.lastName.trim().length < MIN_NAME ? t("booking.profile.lastNameError") : serverFields?.lastName?.[0],
    email: !EMAIL.test(values.email.trim()) ? t("booking.profile.emailError") : serverFields?.email?.[0],
  };
  const set = (key: "firstName" | "lastName" | "email") => (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (toastMissing(t, [errors.firstName, errors.lastName, errors.email])) return;
    // El perfil se guarda sin moverse de la agenda: lo armado sigue en su sitio.
    create.mutate({ firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim(), marketing: values.marketing, branchId: consentBranchId }, { onSuccess: (customer) => dispatch({ type: "customerUpdated", customer }) });
  };

  if (pending && !create.isError) {
    return (
      <Text size="sm" tone="muted" className="flex items-center gap-2" aria-live="polite">
        <Spinner size="sm" />
        {t("booking.payIdentity.saving")}
      </Text>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Text size="sm" tone="secondary">
        {t("booking.agenda.id.newLead")}
      </Text>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("booking.profile.firstName")} required error={touched ? errors.firstName : undefined}>
          <Input value={values.firstName} onChange={set("firstName")} autoComplete="given-name" autoFocus />
        </Field>
        <Field label={t("booking.profile.lastName")} required error={touched ? errors.lastName : undefined}>
          <Input value={values.lastName} onChange={set("lastName")} autoComplete="family-name" />
        </Field>
      </div>
      <Field label={t("booking.profile.email")} required description={t("booking.profile.emailHint")} error={touched ? errors.email : undefined}>
        <Input type="email" inputMode="email" value={values.email} onChange={set("email")} autoComplete="email" />
      </Field>
      <ConsentFields id="agenda-marketing" marketing={values.marketing} onMarketingChange={(marketing) => setValues((current) => ({ ...current, marketing }))} />
      {create.isError && !serverFields && (
        <Text size="sm" tone="negative" role="alert">
          {describeError(create.error).description}
        </Text>
      )}
      <Button type="submit" size="lg" disabled={create.isPending}>
        {create.isPending && <Spinner size="sm" tone="inverse" />}
        {t("booking.profile.continue")}
      </Button>
    </form>
  );
}

/**
 * Quién reserva, preguntado al final y en el mismo sitio y sin código: el celular (si aún no lo dio)
 * y —si es la primera vez— nombre y correo. El código solo si el número no se reconoce sin él
 * (bloqueado). No cambia de pantalla ni toca lo que ya se apartó en la agenda.
 */
export function AgendaIdentity() {
  const t = useAppT();
  const { state, dispatch, shop } = useBookingFlow();
  const [blocked, setBlocked] = React.useState(false);

  if (blocked) {
    return (
      <Alert variant="warning">
        <ThemaIcon name="warning" />
        <AlertTitle>{t("booking.blocked.title")}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{t("booking.blocked.lead")}</span>
          <span className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={`tel:${shop.phone}`}>
                <ThemaIcon name="phone" />
                {t("booking.blocked.call", { phone: formatPhone(shop.phone) })}
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setBlocked(false);
                dispatch({ type: "signOut" });
              }}
            >
              {t("booking.blocked.other")}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    );
  }
  if (state.customer) return null;
  // Con el código confirmado, o con la sesión sin código del celular nuevo: su ficha.
  if (state.verified || state.token) return <ProfileForm />;
  if (state.codeSentTo) return <CodeForm onBlocked={() => setBlocked(true)} />;
  return <PhoneLookup />;
}
