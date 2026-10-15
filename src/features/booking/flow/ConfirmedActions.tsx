import * as React from "react";
import { useAppT } from "@/app/i18n";
import { ActionTile, IconTile } from "@/components/utility";
import { ThemaIcon, type IconName } from "@/icons";
import type { Reservation } from "../types";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";
import { useBookingFlow } from "./BookingContext";
import { CalendarSheet } from "./CalendarSheet";
import { RepeatSheet } from "./RepeatSheet";
import { SendReceiptDialog } from "./SendReceiptDialog";

type ActionId = "receipt" | "calendar" | "repeat" | "detail";

/** Una acción de la cita confirmada: `ActionTile` apilada del sistema, con el icono en círculo. */
function ConfirmedAction({ icon, label, hint, onClick }: { icon: IconName; label: string; hint: string; onClick: () => void }) {
  return <ActionTile layout="stacked" leading={<IconTile size="md" shape="circle" icon={<ThemaIcon name={icon} />} />} title={label} description={hint} onClick={onClick} />;
}

/**
 * Lo que se hace con la cita ya confirmada: enviar el recibo, agregarla al calendario, dejarla
 * fija y ver su detalle. Cada una abre su hoja, para no alargar la pantalla.
 */
export function ConfirmedActions({ reservation }: { reservation: Reservation }) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const [open, setOpen] = React.useState<ActionId | null>(null);
  const close = (next: boolean) => !next && setOpen(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <ConfirmedAction icon="mail" label={t("booking.confirmed.receipt")} hint={t("booking.confirmed.receiptHint")} onClick={() => setOpen("receipt")} />
        <ConfirmedAction icon="calendarAdd" label={t("booking.confirmed.calendar")} hint={t("booking.confirmed.calendarHint")} onClick={() => setOpen("calendar")} />
        {state.token && <ConfirmedAction icon="refresh" label={t("booking.confirmed.repeat")} hint={t("booking.confirmed.repeatHint")} onClick={() => setOpen("repeat")} />}
        <ConfirmedAction icon="info" label={t("booking.confirmed.detail")} hint={t("booking.confirmed.detailHint")} onClick={() => setOpen("detail")} />
      </div>

      <SendReceiptDialog reservation={open === "receipt" ? reservation : null} onOpenChange={close} />
      <CalendarSheet reservation={reservation} open={open === "calendar"} onOpenChange={close} />
      <AppointmentDetailSheet reservation={reservation} open={open === "detail"} onOpenChange={close} />
      {state.token && <RepeatSheet reservation={reservation} open={open === "repeat"} onOpenChange={close} />}
    </>
  );
}
