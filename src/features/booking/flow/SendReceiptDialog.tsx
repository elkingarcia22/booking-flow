import * as React from "react";
import { toast } from "./bookingToast";
import { useAppT } from "@/app/i18n";
import { Field, PhoneInput } from "@/components/forms";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/feedback/Spinner";
import { ThemaIcon, type IconName } from "@/icons";
import { describeError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useResetOnChange } from "@/lib/useResetOnChange";
import { useSendReceiptMutation } from "../queries";
import type { Reservation } from "../types";
import { BookingSheet } from "./BookingSheet";
import { toastMissing } from "./missingData";

type Channel = "email" | "sms";

interface SendReceiptDialogProps {
  reservation: Reservation | null;
  onOpenChange: (open: boolean) => void;
}

/** Un canal: se marca y, marcado, muestra a dónde va. */
function ChannelCard({ id, icon, label, checked, onCheckedChange, children }: { id: string; icon: IconName; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col rounded-2xl border transition-colors", checked ? "border-primary/60 bg-primary/5" : "border-border")}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 p-3">
        <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
        <ThemaIcon name={icon} size="sm" tone={checked ? "primary" : "muted"} />
        <Text size="sm" weight="medium">
          {label}
        </Text>
      </label>
      {checked && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

/**
 * Enviar el recibo por correo, por SMS o por los dos a la vez. Trae los datos del cliente ya
 * puestos; cada canal se marca y se puede cambiar a dónde va.
 */
export function SendReceiptDialog({ reservation, onOpenChange }: SendReceiptDialogProps) {
  const t = useAppT();
  const send = useSendReceiptMutation();
  const [channels, setChannels] = React.useState<readonly Channel[]>(["email"]);
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<Channel, string>>>({});

  // Al abrir con otro recibo, los datos de ese cliente.
  useResetOnChange(reservation?.id ?? "", () => {
    setEmail(reservation?.email ?? "");
    setPhone(reservation?.phone.replace(/[^\d+]/g, "") ?? "");
    setChannels(reservation?.email ? ["email"] : ["sms"]);
    setErrors({});
  });

  const toggle = (channel: Channel) => (checked: boolean) => setChannels((current) => (checked ? [...current, channel] : current.filter((entry) => entry !== channel)));

  const submit = async () => {
    if (!reservation || toastMissing(t, [channels.length === 0 && t("booking.receipt.pickChannel")])) return;
    const sent: string[] = [];
    const failed: Partial<Record<Channel, string>> = {};
    for (const channel of channels) {
      try {
        const result = await send.mutateAsync({ reservationId: reservation.id, channel, to: channel === "email" ? email.trim() : phone });
        sent.push(result.to);
      } catch (error) {
        failed[channel] = describeError(error).description;
      }
    }
    setErrors(failed);
    if (sent.length > 0) toast.success(t("booking.receipt.sent", { to: sent.join(t("booking.receipt.and")) }));
    if (Object.keys(failed).length === 0) onOpenChange(false);
  };

  return (
    <BookingSheet
      open={reservation !== null}
      onOpenChange={onOpenChange}
      title={t("booking.receipt.sendTitle")}
      description={t("booking.receipt.sendLead")}
      actions={
        <Button type="button" className="w-full" onClick={() => void submit()} disabled={send.isPending}>
          {send.isPending ? <Spinner size="sm" tone="inverse" /> : <ThemaIcon name="mail" />}
          {channels.length > 1 ? t("booking.receipt.sendBoth") : t("booking.receipt.send")}
        </Button>
      }
    >
      <div role="group" aria-label={t("booking.receipt.to")} className="flex flex-col gap-3">
        <ChannelCard id="receipt-email" icon="mail" label={t("booking.receipt.email")} checked={channels.includes("email")} onCheckedChange={toggle("email")}>
          <Field label={t("booking.receipt.to")} error={errors.email}>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </Field>
        </ChannelCard>
        <ChannelCard id="receipt-sms" icon="smsCode" label={t("booking.receipt.sms")} checked={channels.includes("sms")} onCheckedChange={toggle("sms")}>
          <Field label={t("booking.receipt.to")} error={errors.sms}>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </Field>
        </ChannelCard>
      </div>
    </BookingSheet>
  );
}
