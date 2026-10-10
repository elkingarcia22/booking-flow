import * as React from "react";
import { Ticket, CreditCard } from "lucide-react";
import { toast } from "./bookingToast";
import { useAppT } from "@/app/i18n";
import { Spinner } from "@/components/feedback/Spinner";
import { OptionTile } from "@/components/selection";
import { Text } from "@/components/typography";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { describeError } from "@/lib/api";
import { parseStart } from "../bookingFormat";
import { cancellationTerms } from "../pricing";
import { useCancelMutation } from "../queries";
import type { BookedAppointment } from "../types";
import { useBookingFlow } from "./BookingContext";
import { BookingSheet } from "./BookingSheet";

interface CancelDialogProps {
  appointment: BookedAppointment | null;
  token: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cancelar, con las cuentas a la vista antes de confirmar: si todavía es
 * gratis, hasta cuándo; si no, cuánto se cobra; y, si pagó en línea, cuánto
 * se le devuelve y a dónde (su tarjeta o saldo a favor, al instante).
 */
export function CancelDialog({ appointment, token, onOpenChange }: CancelDialogProps) {
  const t = useAppT();
  const { shop, fmt } = useBookingFlow();
  const cancel = useCancelMutation(token);
  const [refundTo, setRefundTo] = React.useState<"card" | "credit">("card");
  const terms = appointment
    ? cancellationTerms({ start: parseStart(appointment.start), now: new Date(), cancelHours: shop.cancelHours, lateFeePercent: shop.lateFeePercent, price: appointment.price, paid: appointment.paid })
    : null;

  const confirm = () => {
    if (!appointment) return;
    cancel.mutate(
      { id: appointment.id, refundTo },
      {
        onSuccess: (result) => {
          toast.success(
            result.refund > 0
              ? t("booking.cancel.doneRefund", { amount: fmt.money(result.refund), to: result.refundTo === "credit" ? t("booking.cancel.toCreditShort") : t("booking.cancel.toCardShort") })
              : t("booking.cancel.done")
          );
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <BookingSheet
      open={appointment !== null}
      onOpenChange={onOpenChange}
      title={t("booking.cancel.title")}
      description={appointment ? `${appointment.serviceNames.join(" + ")} · ${fmt.when(parseStart(appointment.start))}` : undefined}
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("booking.cancel.keep")}
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={cancel.isPending}>
            {cancel.isPending && <Spinner size="sm" tone="inverse" />}
            {t("booking.cancel.confirm")}
          </Button>
        </>
      }
    >
      {terms && (
        <div className="flex flex-col gap-4">
          <Alert variant={terms.isFree ? "success" : "warning"}>
            <ThemaIcon name={terms.isFree ? "success" : "warning"} />
            <AlertDescription>
              {terms.isFree
                ? t("booking.cancel.free", { deadline: fmt.when(terms.deadline) })
                : t("booking.cancel.late", { hours: shop.cancelHours, percent: shop.lateFeePercent, fee: fmt.money(terms.fee) })}
            </AlertDescription>
          </Alert>
          {terms.refund > 0 && (
            <>
              <Text size="sm" weight="medium">
                {t("booking.cancel.refund", { amount: fmt.money(terms.refund) })} {t("booking.cancel.refundTo")}
              </Text>
              <div role="radiogroup" aria-label={t("booking.cancel.refundTo")} className="flex flex-col gap-2">
                {[
                  { value: "card", label: t("booking.cancel.toCard"), description: t("booking.cancel.toCardHint"), icon: CreditCard },
                  { value: "credit", label: t("booking.cancel.toCredit"), description: t("booking.cancel.toCreditHint"), icon: Ticket },
                ].map((option) => (
                  <OptionTile key={option.value} option={option} selected={refundTo === option.value} onSelect={(value) => setRefundTo(value as "card" | "credit")} />
                ))}
              </div>
            </>
          )}
          {terms.owed > 0 && (
            <Text size="sm" tone="secondary">
              {t("booking.cancel.owed", { amount: fmt.money(terms.owed) })}
            </Text>
          )}
          {cancel.isError && (
            <Alert variant="destructive">
              <ThemaIcon name="error" />
              <AlertDescription>{describeError(cancel.error).description}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </BookingSheet>
  );
}
