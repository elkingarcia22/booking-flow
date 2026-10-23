import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayKeyOf, initialsOf, parseStart } from "../bookingFormat";
import { useAvailabilityQuery } from "../queries";
import type { BookingBarber } from "../types";
import { windowAlternatives, type DayWindow } from "../variants/agenda/agendaModel";
import { useBookingFlow } from "./BookingContext";

/** Cuántos barberos se proponen por franja y cuántas horas de cada uno. */
const MAX_BARBERS = 3;
const MAX_TIMES = 4;

const WHEN = { morning: "booking.windowAlt.morning", afternoon: "booking.windowAlt.afternoon", evening: "booking.windowAlt.evening" } as const;

interface WindowAlternativesProps {
  day: Date;
  /** Las franjas en que el barbero elegido sí tiene horas ese día. */
  barberWindows: readonly DayWindow[];
  /** Horas que esta persona no puede tomar (ya tiene otra parte de su visita a esa hora). */
  isBlocked?: (time: string) => boolean;
}

interface WindowOffer {
  window: DayWindow;
  barbers: { barber: BookingBarber; times: string[] }[];
}

/**
 * El barbero elegido tiene horas ese día, pero no en todas las franjas: en la que le falta
 * (mañana, tarde o noche) se proponen otros que hacen los mismos servicios y sí tienen horas
 * ahí, con esas horas. Tocar una reserva con él; «+N horas más» lo elige para ver todas.
 * Si el barbero no tiene ninguna hora ese día, lo resuelve `AlternativeBarbers`.
 */
export function WindowAlternatives({ day, barberWindows, isBlocked }: WindowAlternativesProps) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt, layout } = useBookingFlow();
  const draft = state.draft;
  const chosenId = draft?.barberId ?? null;
  const dayKey = dayKeyOf(day);
  const active = chosenId !== null && barberWindows.length > 0;
  // La agenda de todos ese día: cada hora trae quiénes están libres (solo quienes hacen lo pedido).
  const everyone = useAvailabilityQuery({ branchId: state.branchId, date: dayKey, serviceIds: active ? (draft?.serviceIds ?? []) : [], barberId: null });
  const chosen = catalog?.barbers.find((barber) => barber.id === chosenId);
  if (!active || !chosen || everyone.data?.date !== dayKey) return null;

  // Primero quien tiene más horas en esa franja: más fácil de cuadrar. Sin ficha en el catálogo, fuera.
  const offers: WindowOffer[] = windowAlternatives(everyone.data.slots, chosen.id, barberWindows, isBlocked, MAX_BARBERS)
    .map((offer) => ({
      window: offer.window,
      barbers: offer.barbers
        .map(({ barberId, times }) => ({ barber: catalog?.barbers.find((barber) => barber.id === barberId), times }))
        .filter((entry): entry is { barber: BookingBarber; times: string[] } => entry.barber !== undefined),
    }))
    .filter((offer) => offer.barbers.length > 0);
  if (offers.length === 0) return null;

  const firstName = chosen.name.split(" ")[0] ?? chosen.name;
  const pick = (barberId: string, time: string) => {
    dispatch({ type: "chooseBarber", barberId });
    dispatch({ type: "chooseTime", start: `${dayKey}T${time}` });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="window-alternatives">
      {offers.map((offer) => (
        <section key={offer.window} aria-labelledby={`window-alt-${offer.window}`} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <Heading level={6} id={`window-alt-${offer.window}`}>
              {t("booking.windowAlt.title", { name: firstName, when: t(WHEN[offer.window]) })}
            </Heading>
            <Text size="sm" tone="secondary">
              {t("booking.windowAlt.lead")}
            </Text>
          </div>
          <ul className={cn("grid gap-3", layout === "wide" && "grid-cols-2")}>
            {offer.barbers.map(({ barber, times }) => (
              <li key={barber.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4" data-testid={`window-alt-${offer.window}-${barber.id}`}>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
                    <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Text size="sm" weight="semibold" truncate>
                      {barber.name}
                    </Text>
                    <Text size="xs" tone="muted" tabular truncate>
                      {[barber.level, barber.reviews > 0 ? `★ ${barber.rating.toFixed(1)}` : null].filter(Boolean).join(" · ")}
                    </Text>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {times.slice(0, MAX_TIMES).map((time) => {
                    const label = fmt.time(parseStart(`${dayKey}T${time}`));
                    return (
                      <Button key={time} type="button" variant="outline" size="sm" onClick={() => pick(barber.id, time)} aria-label={t("booking.alt.pick", { name: barber.name, time: label })}>
                        {label}
                      </Button>
                    );
                  })}
                </div>
                {times.length > MAX_TIMES && (
                  // Elegirlo deja ver todas sus horas del día en la lista de arriba.
                  <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => dispatch({ type: "chooseBarber", barberId: barber.id })}>
                    {t("booking.windowAlt.more", { count: times.length - MAX_TIMES })}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
