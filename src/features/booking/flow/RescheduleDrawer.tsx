import * as React from "react";
import { startOfDay } from "date-fns";
import { toast } from "./bookingToast";
import { useAppT } from "@/app/i18n";
import { Spinner } from "@/components/feedback/Spinner";
import { DrawerShell } from "@/components/overlays";
import { TimeSlotPicker } from "@/components/scheduling";
import { Text } from "@/components/typography";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemaIcon } from "@/icons";
import { describeError } from "@/lib/api";
import { useResetOnChange } from "@/lib/useResetOnChange";
import { clockMinutes, dayKeyOf, isSameDayAs, isTodayOver, parseStart, toStart } from "../bookingFormat";
import { useAvailabilityQuery, useRescheduleMutation } from "../queries";
import type { BookedAppointment } from "../types";
import { useBookingFlow } from "./BookingContext";
import { DRAWER_FIT_STYLE, sheetSide } from "./drawerFit";

const HOUR = 60;
const WINDOW_DAYS = 42;
const clockOf = (date: Date): string => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

interface RescheduleDrawerProps {
  appointment: BookedAppointment | null;
  token: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cambiar la hora sin llamar: las horas libres para el mismo barbero (o para
 * cualquiera, si lo prefiere) y un botón que dice a cuándo se mueve.
 */
export function RescheduleDrawer({ appointment, token, onOpenChange }: RescheduleDrawerProps) {
  const t = useAppT();
  const { shop, fmt, touch, layout } = useBookingFlow();
  const reschedule = useRescheduleMutation(token);
  const [day, setDay] = React.useState(() => startOfDay(new Date()));
  const [picked, setPicked] = React.useState<Date | null>(null);
  const [anyBarber, setAnyBarber] = React.useState(false);
  useResetOnChange(appointment?.id ?? "", () => {
    setDay(appointment ? startOfDay(parseStart(appointment.start)) : startOfDay(new Date()));
    setPicked(null);
    setAnyBarber(appointment?.noPreference ?? false);
  });
  const branch = shop.branches.find((item) => item.id === appointment?.branchId);
  const availability = useAvailabilityQuery({
    branchId: appointment?.branchId ?? null,
    date: dayKeyOf(day),
    serviceIds: appointment?.serviceIds ?? [],
    barberId: anyBarber ? null : (appointment?.barberId ?? null),
    exclude: appointment?.id,
  });
  const free = new Set((availability.data?.date === dayKeyOf(day) ? availability.data.slots : []).map((slot) => slot.time));
  const isWaiting = availability.isLoading || (availability.isFetching && availability.data?.date !== dayKeyOf(day));

  const confirm = () => {
    if (!appointment || !picked) return;
    reschedule.mutate(
      { id: appointment.id, input: { start: toStart(picked), barberId: anyBarber ? null : appointment.barberId } },
      {
        onSuccess: (updated) => {
          toast.success(t("booking.reschedule.done", { when: fmt.when(parseStart(updated.start)) }));
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <DrawerShell
      open={appointment !== null}
      onOpenChange={onOpenChange}
      side={sheetSide({ layout, touch })}
      contentStyle={DRAWER_FIT_STYLE}
      size="lg"
      title={t("booking.reschedule.title")}
      description={appointment ? t("booking.reschedule.lead", { service: appointment.serviceNames.join(" + "), barber: appointment.barberName }) : undefined}
      actions={
        <Button type="button" size="lg" className="w-full" disabled={!picked || reschedule.isPending} onClick={confirm}>
          {reschedule.isPending && <Spinner size="sm" tone="inverse" />}
          {picked ? t("booking.reschedule.confirm", { when: fmt.when(picked) }) : t("booking.reschedule.pick")}
        </Button>
      }
    >
      {appointment && branch && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <Label htmlFor="reschedule-any" className="font-normal">
              {t("booking.reschedule.anyBarber")}
            </Label>
            <Switch id="reschedule-any" checked={anyBarber} onCheckedChange={(checked) => {
              setAnyBarber(checked);
              setPicked(null);
            }} />
          </div>
          <TimeSlotPicker
            value={picked}
            onChange={setPicked}
            day={day}
            onDayChange={setDay}
            daysCount={WINDOW_DAYS}
            startHour={Math.floor(clockMinutes(branch.opensAt) / HOUR)}
            endHour={Math.ceil(clockMinutes(branch.closesAt) / HOUR)}
            slotMinutes={shop.slotMinutes}
            isDayDisabled={(date) => isTodayOver(branch.closesAt, shop.minNoticeMinutes) && isSameDayAs(date, new Date())}
            isSlotDisabled={(date) => !free.has(clockOf(date))}
            hideUnavailable
            loading={isWaiting}
            size={touch}
          />
          {!isWaiting && free.size === 0 && (
            <Text size="sm" tone="secondary">
              {t("booking.time.noSlots")}
            </Text>
          )}
          {reschedule.isError && (
            <Alert variant="destructive">
              <ThemaIcon name="error" />
              <AlertDescription>{describeError(reschedule.error).description}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </DrawerShell>
  );
}
