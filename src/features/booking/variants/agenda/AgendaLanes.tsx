import { useAppT } from "@/app/i18n";
import { TimeSlotGroups } from "@/components/scheduling";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { ThemaIcon } from "@/icons";
import { initialsOf } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import type { BookingBarber } from "../../types";
import type { DayWindow, TimeOption } from "./agendaModel";

const AVATAR_STACK = 3;

const WINDOW_LABEL = { morning: "booking.waitlist.morning", afternoon: "booking.waitlist.afternoon", evening: "booking.waitlist.evening" } as const;

interface TimeWindowsProps {
  groups: readonly { window: DayWindow; options: TimeOption[] }[];
  timeLabel: (time: string) => string;
  /** Si ya se eligió con quién: las horas se anuncian «con» esa persona. */
  withName?: string;
  /** La hora ya elegida (una sola cita): se queda a la vista, marcada, en vez de desaparecer. */
  selectedTime?: string | null;
  /** La hora y quienes están libres a esa hora (el primero es el que asigna la agenda sin preferencia). */
  onPick: (time: string, barberIds: readonly string[]) => void;
  className?: string;
}

/**
 * Las horas del día sin pensar en quién: `TimeSlotGroups` del sistema, con las caras de quienes pueden
 * a la derecha de cada hora; en el celular, sin barbero elegido, el icono de «Sin preferencia». Tocar
 * una es reservar «con quien esté libre».
 */
export function TimeWindows({ groups, timeLabel, withName, selectedTime = null, onPick, className }: TimeWindowsProps) {
  const t = useAppT();
  const { catalog, isPhone, touch } = useBookingFlow();
  const faces = (ids: readonly string[]) => ids.map((id) => catalog?.barbers.find((barber) => barber.id === id)).filter((barber): barber is BookingBarber => barber !== undefined);
  const byTime = new Map(groups.flatMap((group) => group.options.map((option) => [option.time, option] as const)));

  const trailing = (ids: readonly string[]) => {
    const people = faces(ids);
    if (people.length === 0) return undefined;
    if (withName || !isPhone) {
      return (
        <AvatarGroup aria-hidden>
          {people.slice(0, AVATAR_STACK).map((barber) => (
            <Avatar key={barber.id} size="sm">
              {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
              <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
      );
    }
    // En el celular, sin preferencia: el icono del selector en vez de la fila de caras.
    return (
      <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
        <ThemaIcon name="users" size="xs" />
      </span>
    );
  };

  return (
    <TimeSlotGroups
      className={className}
      size={touch === "lg" ? "lg" : "default"}
      onPick={(time) => onPick(time, byTime.get(time)?.barberIds ?? [])}
      groups={groups.map((group) => ({
        id: group.window,
        label: t(WINDOW_LABEL[group.window]),
        options: group.options.map((option) => ({
          time: option.time,
          label: timeLabel(option.time),
          ariaLabel: withName ? t("booking.agenda.pickWith", { time: timeLabel(option.time), name: withName }) : t("booking.agenda.pickAny", { time: timeLabel(option.time), count: option.barberIds.length }),
          selected: option.time === selectedTime,
          disabled: option.taken && option.barberIds.length === 0,
          trailing: trailing(option.barberIds),
        })),
      }))}
    />
  );
}
