import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Field, PhoneInput } from "@/components/forms";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/feedback/Spinner";
import { ThemaIcon } from "@/icons";
import { describeError, isApiError } from "@/lib/api";
import { useBookingFlow } from "../flow/BookingContext";
import { toastMissing } from "../flow/missingData";
import { StepLayout } from "../flow/StepLayout";
import { defaultBranchId } from "../bookingState";
import { useCreateCustomerMutation } from "../queries";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_NAME = 2;

/** Quien reserva por primera vez: lo justo para crear su ficha en la barbería. */
export function ProfileStep() {
  const t = useAppT();
  const { state, dispatch, shop, layout } = useBookingFlow();
  const create = useCreateCustomerMutation(state.token);
  // El permiso para promociones lo da el cliente: empieza sin marcar (Ley 1581).
  const [values, setValues] = React.useState({ firstName: "", lastName: "", email: "", marketing: false });
  const [touched, setTouched] = React.useState(false);
  const serverFields = isApiError(create.error) ? create.error.fieldErrors : undefined;
  const errors = {
    firstName: values.firstName.trim().length < MIN_NAME ? t("booking.profile.firstNameError") : serverFields?.firstName?.[0],
    lastName: values.lastName.trim().length < MIN_NAME ? t("booking.profile.lastNameError") : serverFields?.lastName?.[0],
    email: !EMAIL.test(values.email.trim()) ? t("booking.profile.emailError") : serverFields?.email?.[0],
  };
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (toastMissing(t, [errors.firstName, errors.lastName, errors.email])) return;
    create.mutate(
      { firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim(), marketing: values.marketing },
      { onSuccess: (customer) => dispatch({ type: "profileSaved", customer, onlyBranchId: defaultBranchId(customer, shop.branches.map((item) => item.id)) }) }
    );
  };

  return (
    <form onSubmit={submit} noValidate className="contents">
      <StepLayout
        title={t("booking.profile.title")}
        lead={t("booking.profile.lead")}
        footer={
          <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
            {create.isPending && <Spinner size="sm" tone="inverse" />}
            {t("booking.profile.continue")}
            {!create.isPending && <ThemaIcon name="arrowRight" />}
          </Button>
        }
      >
        <div className={layout === "wide" ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
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
        <Field label={t("booking.profile.phone")}>
          <PhoneInput value={state.phone} disabled />
        </Field>
        <div className="flex items-start gap-3">
          <Checkbox id="booking-marketing" checked={values.marketing} onCheckedChange={(checked) => setValues((current) => ({ ...current, marketing: checked === true }))} />
          <Label htmlFor="booking-marketing" className="font-normal">
            {t("booking.profile.marketing")}
          </Label>
        </div>
        {create.isError && !serverFields && (
          <Text size="sm" tone="negative" role="alert">
            {describeError(create.error).description}
          </Text>
        )}
        <Text size="xs" tone="muted" className="flex items-center gap-1.5">
          <ThemaIcon name="lock" size="xs" />
          {t("booking.profile.privacy")}
        </Text>
      </StepLayout>
    </form>
  );
}
