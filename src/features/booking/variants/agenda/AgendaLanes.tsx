import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { initialsOf } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import type { BookingBarber } from "../../types";
import type { DayWindow, TimeOption } from "./agendaModel";

const AVATAR_STACK = 3;

const WINDOW_LABEL = { morning: "booking.waitlist.morning", afternoon: "booking.waitlist.afternoon", evening: "booking.waitlist.evening" } as const;

/** Una hora como pastilla: libre, apartada en el carrito o mientras se reserva. */
function TimePill({ label, taken, onPick, ariaLabel, children }: { label: string; taken: boolean; onPick: () => void; ariaLabel: string; children?: React.ReactNode }) {
  const { touch } = useBookingFlow();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={taken}
      disabled={taken}
      onClick={onPick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border px-3 tabular-nums transition-[background-color,border-color,transform] duration-fast ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-reduce:transition-none",
        touch === "lg" ? "h-11 min-w-[5.5rem]" : "h-9 min-w-[4.75rem]",
        taken ? "border-primary bg-primary/10" : "border-border bg-surface hover:-translate-y-px hover:border-primary hover:bg-primary/5"
      )}
    >
      {taken && <ThemaIcon name="check" size="xs" tone="primary" />}
      <Text as="span" size="sm" weight="medium" tone={taken ? "primary" : "default"}>
        {label}
      </Text>
      {children}
    </button>
  );
}

interface TimeWindowsProps {
  groups: readonly { window: DayWindow; options: TimeOption[] }[];
  timeLabel: (time: string) => string;
  /** Si ya se eligió con quién: las horas se anuncian «con» esa persona. */
  withName?: string;
  /** La hora ya elegida (una sola cita): se queda a la vista, marcada, en vez de desaparecer. */
  selectedTime?: string | null;
  onPick: (time: string) => void;
  className?: string;
}

/**
 * Las horas del día sin pensar en quién: por franja, cada hora con las caras de
 * quienes pueden; en el celular, sin barbero elegido, el icono de «Sin preferencia». Tocar una es reservar «con quien esté libre».
 */
export function TimeWindows({ groups, timeLabel, withName, selectedTime = null, onPick, className }: TimeWindowsProps) {
  const t = useAppT();
  const { catalog, isPhone } = useBookingFlow();
  const faces = (ids: readonly string[]) => ids.map((id) => catalog?.barbers.find((barber) => barber.id === id)).filter((barber): barber is BookingBarber => barber !== undefined);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {groups.map((group) => (
        <section key={group.window} aria-label={t(WINDOW_LABEL[group.window])} className="flex flex-col gap-2.5">
          <Text size="xs" weight="semibold" tone="muted" className="uppercase tracking-wide">
            {t(WINDOW_LABEL[group.window])}
          </Text>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const people = faces(option.barberIds);
              return (
                <TimePill
                  key={option.time}
                  label={timeLabel(option.time)}
                  taken={option.time === selectedTime || (option.taken && option.barberIds.length === 0)}
                  onPick={() => onPick(option.time)}
                  ariaLabel={withName ? t("booking.agenda.pickWith", { time: timeLabel(option.time), name: withName }) : t("booking.agenda.pickAny", { time: timeLabel(option.time), count: option.barberIds.length })}
                >
                  {withName || !isPhone
                    ? people.length > 0 && (
                        <AvatarGroup aria-hidden>
                          {people.slice(0, AVATAR_STACK).map((barber) => (
                            <Avatar key={barber.id} size="sm">
                              {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
                              <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
                            </Avatar>
                          ))}
                        </AvatarGroup>
                      )
                    : people.length > 0 && (
                        // En el celular, sin preferencia: el icono del selector en vez de la fila de caras.
                        <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
                          <ThemaIcon name="users" size="xs" />
                        </span>
                      )}
                </TimePill>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
