import { useAppT, type AppMessageKey } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { defaultBranchId, PROGRESS_STEPS, progressIndex, progressSteps } from "../bookingState";
import { toast } from "./bookingToast";
import { useBookingFlow } from "./BookingContext";
import { useBookingSkin } from "./bookingSkin";
import { ChatTrigger } from "./ChatTrigger";
import { ShopBrand } from "./ShopBrand";

/** Más que un aviso normal: da tiempo a deshacer «Empezar de nuevo». */
const UNDO_MS = 6000;

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
 * La cabecera de la reserva: quién es la barbería (solo la marca, sin la sede), volver y
 * cuánto falta. El progreso solo aparece mientras se arma la cita: una línea
 * con «Paso X de Y», igual en celular, tablet y monitor.
 */
export function BookingHeader({ onBack, trailing }: BookingHeaderProps) {
  const t = useAppT();
  const { shop, state, dispatch, layout, touch } = useBookingFlow();
  // «Según el cliente» pinta con la cara de la Agenda: el logo a la izquierda, Clipper y empezar de nuevo a la derecha.
  const isAgendaSkin = useBookingSkin() === "agenda";
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
  // Mientras se arma la reserva: empezar de cero, con «Deshacer» por si fue sin querer.
  const startOver = () => {
    const before = state;
    dispatch({ type: "startOver" });
    toast(t("booking.header.startedOver"), { duration: UNDO_MS, action: { label: t("booking.review.undo"), onClick: () => dispatch({ type: "restoreState", state: before }) } });
  };
  const end = (
    <div className={cn("flex shrink-0 items-center justify-end gap-1", !isWide && !isAgendaSkin && "w-10")}>
      {/* Como en la Agenda: «Agenda con Clipper» en los primeros pasos, mientras se elige qué y dónde. */}
      {isAgendaSkin && (state.step === "branch" || state.step === "services") && <ChatTrigger full />}
      {showProgress && (
        <Button type="button" variant="ghost" size={isWide ? "sm" : "icon-sm"} onClick={startOver} aria-label={t("booking.header.startOver")}>
          <ThemaIcon name="refresh" />
          {isWide && t("booking.header.startOver")}
        </Button>
      )}
      {/* «Mis citas» solo en monitor, con texto; en celular y tablet se llega desde la bienvenida. */}
      {isWide && state.customer && state.step !== "manage" && state.step !== "confirmed" && (
        <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "openManage" })}>
          <ThemaIcon name="calendar" />
          {t("booking.header.myAppointments")}
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

  // La cara de la Agenda: volver, el logo a la izquierda (solo el logo en celular) y lo de la derecha;
  // el progreso, fino, en su línea debajo (en monitor, en la misma fila).
  if (isAgendaSkin) {
    return (
      <header className="relative z-sticky shrink-0 border-b border-border bg-surface/90 backdrop-blur">
        <div className={cn("flex h-14 items-center gap-2 px-3", isWide && "h-16 gap-6 px-6")}>
          {onBack && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("booking.header.back")}>
              <ThemaIcon name="chevronLeft" />
            </Button>
          )}
          <div className={cn("flex min-w-0 items-center", !isWide && "flex-1")}>
            <ShopBrand shop={shop} iconOnly={!isWide && touch !== "lg"} />
          </div>
          {isWide && (progress || <div className="flex-1" />)}
          {end}
        </div>
        {!isWide && progress}
      </header>
    );
  }

  // En monitor todo va en una sola fila: volver y la marca, el progreso al centro y «Mis citas» a la derecha.
  if (isWide) {
    return (
      <header className="relative z-sticky shrink-0 border-b border-border bg-surface/90 backdrop-blur">
        <div className="flex h-[4.5rem] items-center gap-6 px-6">
          {back}
          <ShopBrand shop={shop} className="shrink-0" />
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
          <ShopBrand shop={shop} />
        </div>
        {end}
      </div>
      {progress}
    </header>
  );
}
