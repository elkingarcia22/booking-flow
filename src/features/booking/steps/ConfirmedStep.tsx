import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { ConfirmedActions } from "../flow/ConfirmedActions";
import { ConfirmedBarberNote } from "../flow/ConfirmedBarberNote";
import { useBookingFlow } from "../flow/BookingContext";
import { ReceiptView } from "../flow/ReceiptView";
import { STEP_WIDTH } from "../flow/stepWidth";

/**
 * Hecho. Lo primero es la certeza —visto, número de reserva— y enseguida la
 * orden; debajo, lo útil en cuatro botones que abren su hoja (recibo,
 * calendario, dejarla fija, detalle), y reservar otra sin volver a empezar.
 */
export function ConfirmedStep({ onFinish }: { onFinish?: () => void }) {
  const t = useAppT();
  const { state, dispatch, shop, fmt, layout } = useBookingFlow();
  const reservation = state.reservation;
  if (!reservation) return null;
  const isPaid = reservation.payment.status === "paid";

  return (
    <div className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-5 py-8", STEP_WIDTH[layout])}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative flex size-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-success/15 motion-safe:animate-ping motion-safe:[animation-iteration-count:1.5]" aria-hidden />
          <span className="relative flex size-20 items-center justify-center rounded-full bg-success text-primary-foreground shadow-lg motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
            <ThemaIcon name="check" size="lg" tone="inverse" />
          </span>
        </span>
        <Heading level={2}>{t("booking.confirmed.title", { name: state.customer?.firstName ?? "" })}</Heading>
        <Text tone="secondary">{t("booking.confirmed.lead")}</Text>
        <Badge variant="outline">{t("booking.confirmed.number", { number: reservation.number })}</Badge>
      </div>

      <section className="rounded-2xl border border-border bg-surface-subtle p-4">
        <ReceiptView reservation={reservation} fmt={fmt} />
        {!isPaid && (
          <Text size="sm" tone="secondary" className="mt-3">
            {t("booking.confirmed.payAtShop", { amount: fmt.money(Math.max(0, reservation.totals.total - reservation.payment.paid)) })}
          </Text>
        )}
      </section>

      <ConfirmedActions reservation={reservation} />

      <ConfirmedBarberNote reservationId={reservation.id} />

      <Text size="sm" tone="muted" className="flex items-start gap-2">
        <ThemaIcon name="info" size="sm" />
        {t("booking.confirmed.arrive", { hours: shop.cancelHours })}
      </Text>

      <div className="mt-auto flex flex-col gap-2">
        <Button type="button" size="lg" onClick={() => dispatch({ type: "bookAgain" })}>
          <ThemaIcon name="plus" />
          {t("booking.confirmed.again")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => dispatch({ type: "openManage" })}>
          {t("booking.confirmed.manage")}
        </Button>
        {/* Salir: el widget se cierra; en la página, vuelve al inicio sin la sesión. */}
        <Button type="button" variant="ghost" onClick={onFinish ?? (() => dispatch({ type: "restart" }))}>
          <ThemaIcon name="logout" />
          {t("booking.confirmed.done")}
        </Button>
      </div>
    </div>
  );
}
