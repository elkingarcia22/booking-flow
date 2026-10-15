import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { useBookingFlow } from "./BookingContext";

/** «¿Qué día y a qué hora?» y el día que se mira: el título del calendario, el mismo en todas las experiencias. */
export function ScheduleHeading({ id, day, label, missing = false }: { id?: string; day: Date; /** Por separado: de qué servicio es la hora. */ label?: string; /** Tocó seguir sin hora: se marca en rojo. */ missing?: boolean }) {
  const t = useAppT();
  const { fmt } = useBookingFlow();
  return (
    <div className="flex min-h-8 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <Text id={id} size="sm" weight="medium" tone={missing ? "negative" : undefined} className="flex items-center gap-2.5">
        {label ?? t("booking.agenda.whenLabel")}
      </Text>
      <Text size="sm" tone="muted" className="first-letter:uppercase">
        {fmt.dayLong(day)}
      </Text>
    </div>
  );
}

/** Al final del calendario: si aquí no hay horario o algo falla, se agenda por teléfono. */
export function CallCard({ phone }: { phone: string }) {
  const t = useAppT();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-subtle p-3">
      <IconTile size="md" shape="circle" tone="neutral" icon={<ThemaIcon name="phone" />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="sm" weight="medium">
          {t("booking.time.callTitle")}
        </Text>
        <Text size="xs" tone="muted">
          {t("booking.time.callLead")}
        </Text>
      </div>
      <Button asChild variant="outline" size="sm">
        <a href={`tel:${phone}`} aria-label={t("booking.time.callAria", { phone })}>
          <ThemaIcon name="phone" />
          {t("booking.time.call")}
        </a>
      </Button>
    </div>
  );
}
