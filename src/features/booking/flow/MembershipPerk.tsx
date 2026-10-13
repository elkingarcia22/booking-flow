import * as React from "react";
import { useAppT } from "@/app/i18n";
import { ProgressRing } from "@/components/data-display/ProgressRing";
import { Text } from "@/components/typography";
import { Switch } from "@/components/ui/switch";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "./BookingContext";

const RING_START = 0.01;

/**
 * La membresía del cliente, en el pago: cada tantas visitas gana un servicio de cortesía. Enseña lo
 * que suma esta cita y, si ya tiene una cortesía, deja usarla ahora o guardarla para otra vez.
 */
export function MembershipPerk() {
  const t = useAppT();
  const { state, dispatch, fmt, totals } = useBookingFlow();
  const loyalty = state.customer?.loyalty;
  // El anillo se llena al aparecer: se nota qué suma esta cita sin tener que leerlo.
  const [isFilled, setIsFilled] = React.useState(false);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsFilled(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  if (!loyalty) return null;
  const reward = loyalty.rewardName || t("booking.loyalty.rewardFallback");
  const hasReward = loyalty.available > 0;
  // Esta cita cuenta como una visita más hacia la próxima cortesía.
  const next = Math.min(loyalty.progress + 1, loyalty.every);
  const left = loyalty.every - next;

  // Una fila corta: lo que gana o lleva arriba, y en gris de qué se trata y cuánto descuenta.
  const title = hasReward ? t("booking.loyalty.rewardShort", { reward }) : t("booking.loyalty.count", { count: next, total: loyalty.every });
  const detail = hasReward
    ? // Si el paquete ya pagó los servicios, la cortesía no se gasta: queda para otra vez.
      !state.useReward
      ? t("booking.loyalty.metaOff")
      : totals.reward > 0
        ? t("booking.loyalty.metaOn", { amount: fmt.money(totals.reward) })
        : t("booking.loyalty.metaKept")
    : left === 0
      ? t("booking.loyalty.earnsShort", { reward })
      : t("booking.loyalty.leftShort", { count: left, reward });

  const content = (
    <>
      {/* Con la cortesía ganada el anillo va completo: es el premio, no el avance hacia el siguiente. */}
      <ProgressRing
        size="sm"
        // Arranca casi en cero (no en cero: el arco tiene que existir para que la transición se vea).
        value={isFilled ? (hasReward ? loyalty.every : loyalty.progress) : RING_START}
        pending={hasReward ? 0 : isFilled ? 1 : RING_START}
        className="[&_circle]:duration-slow"
        max={loyalty.every}
        aria-label={hasReward ? t("booking.loyalty.ready", { reward }) : t("booking.loyalty.progress", { count: next, total: loyalty.every })}
      >
        {hasReward ? (
          <ThemaIcon name="award" size="xs" tone="primary" />
        ) : (
          <Text as="span" size="xs" weight="semibold" tabular>
            {next}
          </Text>
        )}
      </ProgressRing>
      <span className="flex min-w-0 flex-1 flex-col">
        <Text as="span" size="xs" weight="semibold" tone="primary" className="uppercase tracking-wide">
          {t("booking.loyalty.title")}
        </Text>
        <Text as="span" size="sm" weight="medium" truncate>
          {title}
        </Text>
        <Text as="span" size="xs" tone="muted" tabular truncate>
          {detail}
        </Text>
      </span>
    </>
  );
  // Sin filo: es información de la cuenta, no una acción. Un degradado tenue la separa de las tarjetas que se tocan.
  const frame = "flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-3 py-2.5";

  if (!hasReward) {
    return (
      <section aria-label={t("booking.loyalty.title")} className={frame}>
        {content}
      </section>
    );
  }
  return (
    <label className={cn(frame, "cursor-pointer")}>
      {content}
      <Switch checked={state.useReward} onCheckedChange={(checked) => dispatch({ type: "setUseReward", useReward: checked })} aria-label={t("booking.loyalty.use", { reward })} />
    </label>
  );
}
