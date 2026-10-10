import { useAppT, type AppMessageKey } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { defaultBranchId, PROGRESS_STEPS, progressIndex, progressSteps } from "../bookingState";
import { useBookingFlow } from "./BookingContext";
import { ShopBrand } from "./ShopBrand";

const STEP_LABELS: Record<(typeof PROGRESS_STEPS)[number], AppMessageKey> = {
  branch: "booking.step.branch",
  services: "booking.step.services",
  barber: "booking.step.barber",
  time: "booking.step.time",
  review: "booking.step.review",
  payment: "booking.step.payment",
};

interface BookingHeaderProps {
  onBack: (() => void) | null;
  /** El widget trae su propio cierre en la esquina. */
  trailing?: React.ReactNode;
}

/**
 * La cabecera de la reserva: quién es la barbería (y en qué sede), volver y
 * cuánto falta. El progreso solo aparece mientras se arma la cita: una línea
 * con «Paso X de Y», igual en celular, tablet y monitor.
 */
export function BookingHeader({ onBack, trailing }: BookingHeaderProps) {
  const t = useAppT();
  const { shop, state, dispatch, layout } = useBookingFlow();
  const branch = shop.branches.find((item) => item.id === state.branchId);
  const flow = progressSteps(defaultBranchId(state.customer, shop.branches.map((item) => item.id)) === null);
  const index = progressIndex(state.step, flow);
  const showProgress = index >= 0 && index < flow.length;
  const steps = flow.map((id) => ({ id, label: t(STEP_LABELS[id]) }));

  const isWide = layout === "wide";
  const back = (
    <div className={cn("flex shrink-0 justify-start", !isWide && "w-10")}>
      {onBack && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("booking.header.back")}>
          <ThemaIcon name="chevronLeft" />
        </Button>
      )}
    </div>
  );
  const end = (
    <div className="flex shrink-0 items-center justify-end gap-1">
      {state.customer && state.step !== "manage" && state.step !== "confirmed" && (
        <Button type="button" variant="ghost" size={isWide ? "sm" : "icon-sm"} onClick={() => dispatch({ type: "openManage" })} aria-label={t("booking.header.myAppointments")}>
          <ThemaIcon name="calendar" />
          {isWide && t("booking.header.myAppointments")}
        </Button>
      )}
      {trailing}
    </div>
  );

  const stepLabel = t("booking.header.stepOf", { current: index + 1, total: flow.length });
  const progress = showProgress && (
    <div className={cn("flex min-w-0 items-center gap-3", isWide ? "flex-1" : "px-5 pb-3")}>
      <Progress value={((index + 1) / flow.length) * 100} className="flex-1" aria-label={stepLabel} />
      <Text size="xs" tone="muted" tabular className="shrink-0">
        {stepLabel} · {steps[index]?.label}
      </Text>
    </div>
  );

  // En monitor todo va en una sola fila: volver y la marca, el progreso al centro y «Mis citas» a la derecha.
  if (isWide) {
    return (
      <header className="relative z-sticky shrink-0 border-b border-border bg-surface/90 backdrop-blur">
        <div className="flex h-[4.5rem] items-center gap-6 px-6">
          {back}
          <ShopBrand shop={shop} tagline={branch?.name} className="shrink-0" />
          {progress || <div className="flex-1" />}
          {end}
        </div>
      </header>
    );
  }

  return (
    <header className="relative z-sticky shrink-0 border-b border-border bg-surface/90 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3">
        {back}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <ShopBrand shop={shop} tagline={branch?.name} />
        </div>
        {end}
      </div>
      {progress}
    </header>
  );
}
