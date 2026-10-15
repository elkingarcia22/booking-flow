import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { isSameDayAs } from "../bookingFormat";
import { overlapsBusy, type BusyRange } from "../visit";
import { useBookingFlow } from "./BookingContext";

const MINUTE_MS = 60_000;

interface NextToPartProps {
  /** El día que se está mirando: solo se proponen horas de ese día. */
  day: Date;
  /** Las otras partes de la visita, ya con su hora. */
  parts: readonly BusyRange[];
  /** Todo lo que la persona ya tiene ocupado (incluye las partes). */
  busy: readonly BusyRange[];
  /** Minutos de esta parte. */
  minutes: number;
  isFree: (start: Date) => boolean;
  onPick: (start: Date) => void;
}

/**
 * Al separar un servicio, lo natural es encadenarlo: justo después (o justo antes) de la otra parte
 * de la visita, si ese rato está libre. Sin ninguna libre, no se muestra.
 */
export function NextToPart({ day, parts, busy, minutes, isFree, onPick }: NextToPartProps) {
  const t = useAppT();
  const { catalog, fmt } = useBookingFlow();
  const serviceName = (range: BusyRange) => range.item.serviceIds.map((id) => catalog?.services.find((service) => service.id === id)?.name ?? id).join(" + ");
  const options = parts.flatMap((part) => [
    { key: `${part.item.key}-after`, start: new Date(part.end), label: t("booking.visit.rightAfter", { service: serviceName(part) }) },
    { key: `${part.item.key}-before`, start: new Date(part.start - minutes * MINUTE_MS), label: t("booking.visit.rightBefore", { service: serviceName(part) }) },
  ]);
  const usable = options.filter((option) => isSameDayAs(option.start, day) && isFree(option.start) && !overlapsBusy(option.start, minutes, busy));

  if (usable.length === 0) return null;

  return (
    <section aria-label={t("booking.visit.nextTitle")} className="flex flex-col gap-2 rounded-2xl border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-3">
        <IconTile size="md" shape="circle" icon={<ThemaIcon name="link" />} />
        <Text size="sm" weight="medium">
          {t("booking.visit.nextTitle")}
        </Text>
      </div>
      <ul className="flex flex-col gap-1">
        {usable.map((option) => (
          <li key={option.key} className="flex items-center gap-3 pl-1">
            <Text size="sm" tone="secondary" className="min-w-0 flex-1" truncate>
              {option.label}
            </Text>
            <Button type="button" size="sm" variant="outline" onClick={() => onPick(option.start)}>
              {fmt.time(option.start)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
