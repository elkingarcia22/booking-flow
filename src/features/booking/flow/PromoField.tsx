import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { useAppT, type AppMessageKey } from "@/app/i18n";
import { Chip } from "@/components/ai-interaction";
import { Field } from "@/components/forms";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api";
import { bookingApi } from "../api";
import type { PromoProblem } from "../pricing";
import { useBookingFlow } from "./BookingContext";

const PROBLEM_KEYS: Record<PromoProblem, AppMessageKey> = {
  unknown: "booking.payment.promo.unknown",
  firstVisitOnly: "booking.payment.promo.firstVisitOnly",
  minAppointments: "booking.payment.promo.minAppointments",
  notYet: "booking.payment.promo.notYet",
  expired: "booking.payment.promo.expired",
  exhausted: "booking.payment.promo.exhausted",
  usedByClient: "booking.payment.promo.usedByClient",
  services: "booking.payment.promo.services",
};

const problemOf = (error: unknown): PromoProblem => {
  const details = isApiError(error) ? error.details : undefined;
  const problem = details && typeof details === "object" && "problem" in details ? (details as { problem?: unknown }).problem : undefined;
  return typeof problem === "string" && problem in PROBLEM_KEYS ? (problem as PromoProblem) : "unknown";
};

/** El cupón: se valida en el servidor y, si aplica, queda como un chip que se puede quitar, con lo que ahorra. */
export function PromoField() {
  const t = useAppT();
  const { state, dispatch, totals, fmt, shop } = useBookingFlow();
  const scope = { appointments: state.items.length, branchId: state.branchId, serviceIds: state.items.flatMap((item) => item.serviceIds) };
  const [code, setCode] = React.useState("");
  // El cliente nuevo no tiene que saberse el cupón de bienvenida: se aplica solo, una vez (si lo quita, no vuelve).
  const autoTried = React.useRef(false);
  React.useEffect(() => {
    if (autoTried.current || state.promo || !state.customer?.isNew || !shop.welcomePromo) return;
    autoTried.current = true;
    bookingApi
      .checkPromo(state.token, { ...scope, code: shop.welcomePromo })
      .then((promo) => dispatch({ type: "setPromo", promo }))
      .catch(() => undefined);
    // `scope` cambia con las citas; basta con mirarlas por su número, como antes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, shop.welcomePromo, state.customer?.isNew, state.items.length, state.promo, state.token]);
  const check = useMutation({ mutationFn: () => bookingApi.checkPromo(state.token, { ...scope, code }) });

  if (state.promo) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Chip label={t("booking.payment.promoApplied", { code: state.promo.code })} tone="positive" icon="ticket" removable onRemove={() => dispatch({ type: "setPromo", promo: null })} />
        <Text size="sm" tone="positive" tabular>
          {state.promo.type === "percent"
            ? t("booking.payment.promoSavesPercent", { amount: fmt.money(totals.discount), rule: `${state.promo.value} %` })
            : t("booking.payment.promoSaves", { amount: fmt.money(totals.discount) })}
        </Text>
      </div>
    );
  }

  const apply = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!code.trim()) return;
    check.mutate(undefined, { onSuccess: (promo) => dispatch({ type: "setPromo", promo }) });
  };

  return (
    <Field label={t("booking.payment.promo")} error={check.isError ? t(PROBLEM_KEYS[problemOf(check.error)]) : undefined}>
      <div className="flex gap-2">
        <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={t("booking.payment.promoPlaceholder")} onKeyDown={(event) => event.key === "Enter" && apply(event)} autoCapitalize="characters" />
        <Button type="button" variant="outline" onClick={() => apply()} disabled={!code.trim() || check.isPending}>
          {t("booking.payment.promoApply")}
        </Button>
      </div>
    </Field>
  );
}
