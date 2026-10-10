import { toast } from "../flow/bookingToast";
import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import type { WaitlistEntry } from "../bookingState";
import { parseStart } from "../bookingFormat";
import { useBookingFlow } from "../flow/BookingContext";
import { STEP_WIDTH } from "../flow/stepWidth";
import { WINDOW_KEYS } from "../flow/waitlist";
import { useLeaveWaitlistMutation } from "../queries";

/**
 * El final de quien no apartó hora pero se apuntó en la lista de espera: la
 * certeza de que quedó apuntado, en qué (sede, servicio, barbero, día y franja)
 * y qué pasa ahora. Desde aquí puede salir de la lista o volver a buscar hora; si ya
 * tenía una reserva armada (otra cita en el carrito), «Seguir con tu reserva» lo lleva a ella.
 */
export function WaitlistedStep({ onFinish }: { onFinish?: () => void }) {
  const t = useAppT();
  const { state, dispatch, layout } = useBookingFlow();
  if (state.waitlist.length === 0) return null;
  const hasBooking = state.items.length > 0;

  return (
    <div className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-5 py-8", STEP_WIDTH[layout])}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative flex size-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-ping motion-safe:[animation-iteration-count:1.5]" aria-hidden />
          <span className="relative flex size-20 items-center justify-center rounded-full bg-primary shadow-lg motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
            <ThemaIcon name="notification" size="lg" tone="inverse" />
          </span>
        </span>
        <Heading level={2}>{t("booking.waitlisted.title", { name: state.customer?.firstName ?? "" })}</Heading>
        <Text tone="secondary">{t("booking.waitlisted.lead")}</Text>
      </div>

      <ul className="flex flex-col gap-3">
        {state.waitlist.map((entry) => (
          <WaitlistEntryCard key={entry.id} entry={entry} />
        ))}
      </ul>

      <Text size="sm" tone="muted" className="flex items-start gap-2">
        <ThemaIcon name="info" size="sm" />
        {t("booking.waitlisted.noCharge")}
      </Text>

      <div className="mt-auto flex flex-col gap-2">
        {hasBooking && (
          // La cita que se armaba se suelta: la reserva vuelve a su resumen, lista para pagar.
          <Button type="button" size="lg" onClick={() => dispatch({ type: "discardDraft" })}>
            {t("booking.waitlisted.backToBooking", { count: state.items.length })}
            <ThemaIcon name="arrowRight" />
          </Button>
        )}
        <Button type="button" size="lg" variant={hasBooking ? "outline" : "default"} onClick={() => dispatch({ type: "goTo", step: "time" })}>
          <ThemaIcon name="calendar" />
          {t("booking.waitlisted.more")}
        </Button>
        {onFinish && (
          <Button type="button" variant="ghost" onClick={onFinish}>
            {t("booking.confirmed.done")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Una entrada: dónde, qué, con quién, qué día y en qué franja; con su «Salir de la lista». */
function WaitlistEntryCard({ entry }: { entry: WaitlistEntry }) {
  const t = useAppT();
  const { state, dispatch, shop, catalog, fmt } = useBookingFlow();
  const leave = useLeaveWaitlistMutation(state.token);
  const branch = shop.branches.find((item) => item.id === entry.branchId);
  const barber = catalog?.barbers.find((item) => item.id === entry.barberId);
  const services = entry.serviceIds.map((id) => catalog?.services.find((service) => service.id === id)?.name).filter(Boolean);
  const rows = [
    { key: "services", icon: "scissors" as const, text: services.join(" + ") },
    { key: "barber", icon: "users" as const, text: barber ? t("booking.waitlisted.with", { name: barber.name }) : t("booking.waitlisted.withAny") },
    { key: "day", icon: "calendar" as const, text: `${fmt.dayLong(parseStart(`${entry.date}T00:00`))} · ${t(WINDOW_KEYS[entry.window])}` },
  ];

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-4">
      {branch && (
        <div className="flex items-center gap-3">
          <IconTile size="md" src={branch.imageUrl} icon={<ThemaIcon name="building" />} />
          <div className="flex min-w-0 flex-col">
            <Text size="sm" weight="semibold" truncate>
              {branch.name}
            </Text>
            <Text size="xs" tone="muted" truncate>
              {branch.address}, {branch.city}
            </Text>
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start gap-2">
            <ThemaIcon name={row.icon} size="sm" tone="primary" />
            <Text size="sm" className="first-letter:uppercase">
              {row.text}
            </Text>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="self-start px-0"
        disabled={leave.isPending}
        onClick={() =>
          leave.mutate(entry.id, {
            onSuccess: () => (dispatch({ type: "waitlistLeft", id: entry.id }), toast(t("booking.waitlist.left"))),
            onError: () => toast.error(t("booking.waitlist.error")),
          })
        }
      >
        {t("booking.waitlist.leave")}
      </Button>
    </li>
  );
}
