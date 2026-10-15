import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { dayKeyOf, parseStart } from "../bookingFormat";
import { useEarliestQuery } from "../queries";
import { useBookingFlow } from "./BookingContext";

interface EarliestSlotProps {
  /** La hora se cruza con otra cita de la misma persona: no se propone. */
  isBlocked?: (start: Date) => boolean;
}

/**
 * «Lo antes posible»: el primer hueco libre desde hoy, arriba de todo y en un toque, para quien
 * quiere cortarse ya (la barbería es de último minuto). Sin preferencia de barbero dice con
 * quién sería; si ya está elegida esa hora, no se repite.
 */
export function EarliestSlot({ isBlocked }: EarliestSlotProps = {}) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt } = useBookingFlow();
  const draft = state.draft;
  const query = useEarliestQuery({ branchId: state.branchId, serviceIds: draft?.serviceIds ?? [], barberId: draft?.barberId ?? null });
  const slot = query.data?.slot ?? null;

  if (query.isLoading) return <Skeleton className="h-[4.5rem] rounded-2xl" />;
  if (!draft || !slot) return null;

  const start = `${slot.date}T${slot.time}`;
  const when = parseStart(start);
  if (draft.start === start || isBlocked?.(when)) return null;
  const isToday = slot.date === dayKeyOf(new Date());
  const day = isToday ? t("booking.earliest.today") : fmt.dayShort(when);
  const withName = draft.barberId ? null : catalog?.barbers.find((barber) => barber.id === slot.barberId)?.name.split(" ")[0];

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3">
      <IconTile size="md" shape="circle" icon={<ThemaIcon name="bolt" />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="xs" tone="secondary">
          {t("booking.earliest.title")}
        </Text>
        <Text size="sm" weight="semibold" tabular truncate>
          {day} · {fmt.time(when)}
          {withName && <Text as="span" size="sm" tone="secondary" weight="normal">{` · ${t("booking.earliest.with", { name: withName })}`}</Text>}
        </Text>
      </div>
      <Button type="button" size="sm" onClick={() => dispatch({ type: "chooseTime", start, assignedBarberId: slot.barberId })} aria-label={t("booking.earliest.book", { when: `${day} ${fmt.time(when)}` })}>
        {t("booking.earliest.cta")}
      </Button>
    </div>
  );
}
