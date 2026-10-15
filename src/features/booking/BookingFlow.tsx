import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Grain, Halo } from "@/components/atmosphere";
import { ThemaToaster } from "@/components/feedback";
import { ErrorState } from "@/lib/query";
import { PortalContainerProvider } from "@/components/ui/portal-container";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { defaultBranchId, previousPartIndex, type BookingAction, type BookingState } from "./bookingState";
import { BookingFlowProvider, useBookingFlow, type BookingLayout } from "./flow/BookingContext";
import { BookingHeader } from "./flow/BookingHeader";
import { BookingSummaryAside } from "./flow/BookingSummaryAside";
import { BookingSkinContext } from "./flow/bookingSkin";
import { AsideSlotProvider } from "./flow/asideSlot";
import { BOOKING_TOASTER_ID } from "./flow/bookingToast";
import { ReservedHairBurst } from "./flow/ReservedHairBurst";
import { HIDE_SCROLLBAR } from "./flow/drawerFit";
import { requestVoiceOnArrival, SwitchToChatProvider } from "./flow/versionSwitch";
import { BarberStep } from "./steps/BarberStep";
import { BlockedStep } from "./steps/BlockedStep";
import { BranchStep } from "./steps/BranchStep";
import { ConfirmedStep } from "./steps/ConfirmedStep";
import { ManageStep } from "./steps/ManageStep";
import { PaymentStep } from "./steps/PaymentStep";
import { PhoneStep } from "./steps/PhoneStep";
import { VerifyStep } from "./steps/VerifyStep";
import type { BookingSurface } from "./funnel";
import { PackagesStep } from "./steps/PackagesStep";
import { GiftStep } from "./steps/GiftStep";
import { ProfileStep } from "./steps/ProfileStep";
import { ReviewStep } from "./steps/ReviewStep";
import { ServicesStep } from "./steps/ServicesStep";
import { TimeStep } from "./steps/TimeStep";
import { WaitlistedStep } from "./steps/WaitlistedStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import type { BookingShop } from "./types";
import { useBookingEngine } from "./useBookingEngine";
import { AgendaFlow } from "./variants/agenda/AgendaFlow";
import { AgendaSelectCheckout, AgendaSelectPay } from "./variants/agenda/AgendaSelectCheckout";
import { ChatFlow } from "./variants/chat/ChatFlow";
import type { BookingVersion } from "./versions";

export interface BookingFlowProps {
  /** Qué experiencia se monta; por defecto, la guiada. */
  version?: BookingVersion;
  layout?: BookingLayout;
  touch?: "default" | "lg";
  /** Se ve en un celular: algunos detalles se simplifican. */
  isPhone?: boolean;
  /** Cambiar de experiencia desde dentro (el botón «Reservar hablando»); sin él, cambia sola en su sitio. */
  onVersionChange?: (version: BookingVersion) => void;
  /** Lo que va en la esquina de la cabecera (el cierre del widget). */
  headerTrailing?: React.ReactNode;
  /** El widget se cierra al terminar; la página completa no. */
  onFinish?: () => void;
  /** Dónde se abre, para el embudo: la vista previa del panel no cuenta. */
  surface?: BookingSurface;
  className?: string;
}

/** A dónde lleva «Atrás» desde cada paso; `null` = no hay atrás. */
function backAction(state: BookingState, shop: BookingShop): BookingAction | null {
  // Antes de la cita: la bienvenida del de siempre, los datos del nuevo (aún sin ficha) o el inicio.
  const identity: BookingAction =
    state.customer && !state.customer.isNew ? { type: "goTo", step: "welcome" } : !state.customer && state.pendingProfile ? { type: "goTo", step: "profile" } : { type: "restart" };
  switch (state.step) {
    case "verify":
      return { type: "goTo", step: "phone" };
    case "gift":
    case "packages":
      return { type: "goTo", step: "welcome" };
    case "profile":
    case "welcome":
    case "blocked":
      return { type: "restart" };
    case "branch":
      // La sede es el paso 1: antes de ella solo está el inicio. Cambiar de sede desde el resumen
      // va por su propia hoja, así que aquí nunca se vuelve al resumen (era el salto del paso 1 al 5).
      return identity;
    case "services":
      // Vino del resumen a sumar o cambiar una cita: «Atrás» la descarta y vuelve allí.
      if (state.fromReview) return { type: "discardDraft" };
      // Con la sede ya dada (única, o la de siempre del cliente) no hay paso de sede al que volver.
      return defaultBranchId(state.customer, shop.branches.map((branch) => branch.id)) === null ? { type: "goTo", step: "branch" } : identity;
    case "barber":
      // Parte por parte: «Atrás» reabre la parte anterior para corregirla, no los servicios.
      return previousPartIndex(state) >= 0 ? { type: "previousPart" } : { type: "goTo", step: "services" };
    case "time":
      return { type: "goTo", step: "barber" };
    case "review":
      // Atrás es hacia atrás en el flujo: la última cita, en su hora, para retocarla.
      return state.items.length > 0 ? { type: "reopenLast" } : { type: "addAnother", person: { kind: "self" } };
    case "payment":
      return { type: "goTo", step: "review" };
    case "manage":
      return state.reservation ? { type: "goTo", step: "confirmed" } : state.customer ? identity : { type: "restart" };
    default:
      return null;
  }
}

/** «Confirma tu cita» y el pago de la Agenda dentro de Paso a paso (la versión «Según el cliente»). */
function AgendaCheckoutSteps({ step }: { step: "review" | "payment" }) {
  const { state, dispatch } = useBookingFlow();
  if (step === "review") return <AgendaSelectCheckout onContinue={() => dispatch({ type: "goTo", step: "payment" })} onAddAnother={() => dispatch({ type: "addAnother", person: { kind: "self" } })} />;
  // La hora ya no está: con una cita se vuelve a su hora; con varias, a «Confirma tu cita».
  return <AgendaSelectPay onChangeTime={() => dispatch(state.items.length > 1 ? { type: "goTo", step: "review" } : { type: "reopenLast" })} />;
}

function StepSwitch({ state, onFinish, agendaCheckout = false }: { state: BookingState; onFinish?: () => void; agendaCheckout?: boolean }) {
  if (agendaCheckout && (state.step === "review" || state.step === "payment")) return <AgendaCheckoutSteps step={state.step} />;
  switch (state.step) {
    case "phone":
      return <PhoneStep />;
    case "verify":
      return <VerifyStep />;
    case "gift":
      return <GiftStep />;
    case "packages":
      return <PackagesStep />;
    case "profile":
      return <ProfileStep />;
    case "welcome":
      return <WelcomeStep />;
    case "blocked":
      return <BlockedStep />;
    case "branch":
      return <BranchStep />;
    case "services":
      return <ServicesStep />;
    case "barber":
      return <BarberStep />;
    case "time":
      return <TimeStep />;
    case "review":
      return <ReviewStep />;
    case "payment":
      return <PaymentStep />;
    case "confirmed":
      return <ConfirmedStep onFinish={onFinish} />;
    case "waitlisted":
      return <WaitlistedStep onFinish={onFinish} />;
    case "manage":
      return <ManageStep />;
  }
}

/**
 * Paso a paso: la cabecera con el progreso, un paso por pantalla y, en monitor, el resumen al lado.
 * `agendaCheckout`: cierra con «Confirma tu cita» y el pago de la Agenda (versión «Según el cliente»).
 */
function GuidedFlow({ headerTrailing, onFinish, agendaCheckout = false }: Pick<BookingFlowProps, "headerTrailing" | "onFinish"> & { agendaCheckout?: boolean }) {
  const { state, dispatch, shop, layout } = useBookingFlow();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [actionSlot, setActionSlot] = React.useState<HTMLElement | null>(null);

  // Cada paso empieza arriba.
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [state.step]);

  const back = backAction(state, shop);
  const showAside = layout === "wide" && ["branch", "services", "barber", "time", "review", "payment"].includes(state.step);

  return (
    // «Según el cliente» (`agendaCheckout`) pinta estos pasos con la cara de la Agenda.
    <BookingSkinContext.Provider value={agendaCheckout ? "agenda" : "guided"}>
    {/* El resumen ocupa todo el alto, de arriba abajo: la cabecera llega hasta él. */}
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* El inicio no lleva cabecera: la marca ya está en su tarjeta. El widget la conserva por su botón de cerrar. */}
        {(state.step !== "phone" || headerTrailing) && <BookingHeader onBack={back ? () => dispatch(back) : null} trailing={headerTrailing} />}
        <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", layout === "compact" && HIDE_SCROLLBAR)}>
          <div className="flex min-h-full w-full flex-col">
            {/* En monitor, la acción principal de cada paso va al pie del resumen; sin panel, en la barra de abajo. */}
            <AsideSlotProvider value={showAside ? actionSlot : null}>
              <StepSwitch state={state} onFinish={onFinish} agendaCheckout={agendaCheckout} />
            </AsideSlotProvider>
          </div>
        </div>
      </div>
      {showAside && (
        <div className="hidden w-96 shrink-0 overflow-hidden border-l border-border bg-surface/60 lg:block">
          <BookingSummaryAside actionSlotRef={setActionSlot} />
        </div>
      )}
    </div>
    </BookingSkinContext.Provider>
  );
}

/**
 * «Según el cliente»: la portada (el celular) decide el recorrido. Quien vuelve —reconocido por su
 * número— entra a la Agenda en lista, con su sede y «Lo de siempre»; el cliente nuevo va Paso a paso
 * («Conozcámonos», sede, servicios, barbero, hora). Los dos cierran con «Confirma tu cita» y el pago
 * de la Agenda. El nuevo sigue Paso a paso también después de crear su ficha (`isNew`).
 */
function MixedFlow({ headerTrailing, onFinish }: Pick<BookingFlowProps, "headerTrailing" | "onFinish">) {
  const { state } = useBookingFlow();
  const isReturning = Boolean(state.customer && !state.customer.isNew);
  if (isReturning) return <AgendaFlow headerTrailing={headerTrailing} onFinish={onFinish} />;
  return <GuidedFlow headerTrailing={headerTrailing} onFinish={onFinish} agendaCheckout />;
}

/**
 * La reserva en línea entera, lista para montarse donde haga falta: a
 * pantalla completa en una tablet del local o un monitor, o dentro del
 * panel flotante del widget en el sitio de la barbería. Se adapta al sitio
 * que le dan (`layout`), no al ancho de la ventana.
 *
 * Las tres versiones comparten el motor (`useBookingEngine`): los datos de la
 * barbería, el estado de la reserva, las cuentas y el cobro. Lo que cambia es
 * el recorrido.
 */
/** Debajo de la cabecera de la reserva (h-14 en celular y tablet, 4.5rem en monitor), con aire. */
const COMPACT_TOAST_TOP_PX = 64;
const WIDE_TOAST_TOP_PX = 84;

export function BookingFlow({ version = "guided", layout = "compact", touch = "default", isPhone = false, onVersionChange, headerTrailing, onFinish, surface = "preview", className }: BookingFlowProps) {
  const t = useAppT();
  const engine = useBookingEngine({ layout, touch, surface, isPhone });
  // Las ventanas (drawers, modales) se abren dentro de la reserva, no en la
  // ventana: en el marco del celular o en el panel del widget no se salen.
  const [portalRoot, setPortalRoot] = React.useState<HTMLElement | null>(null);
  // Desde Paso a paso y la Agenda se puede pasar a la Conversación sin salir.
  const [switched, setSwitched] = React.useState<BookingVersion | null>(null);
  const active = switched ?? version;
  const switchToChat = React.useCallback(() => {
    // Llega a Clipper hablando, con el saludo de la experiencia de la que viene (ver `ChatFlow`).
    requestVoiceOnArrival(active);
    if (onVersionChange) onVersionChange("chat");
    else setSwitched("chat");
  }, [onVersionChange, active]);

  if (engine.shopQuery.isError) {
    return (
      <div className={cn("flex h-full items-center justify-center p-6", className)}>
        <ErrorState error={engine.shopQuery.error} onRetry={() => void engine.shopQuery.refetch()} />
      </div>
    );
  }
  if (!engine.value) {
    return (
      <div className={cn("flex h-full flex-col gap-4 p-6", className)} aria-busy>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <BookingFlowProvider value={engine.value}>
      <PortalContainerProvider value={portalRoot}>
        {/* `translateZ(0)` hace de esta sección el bloque contenedor de lo `fixed`: las ventanas se miden contra ella.
            `overflow-clip`, no `hidden`: una sección `hidden` se puede desplazar por código, y el navegador la movía al
            enfocar un campo de una hoja que aún subía (la pantalla saltaba al abrir «Confirma que eres tú»). */}
        <section
          ref={setPortalRoot}
          aria-label={t("booking.phone.title")}
          data-version={active}
          className={cn("relative isolate flex h-full min-h-0 flex-col overflow-clip bg-background text-foreground [transform:translateZ(0)]", className)}
        >
          <Halo x="85%" y="0%" size="60% 40%" strength={0.12} />
          <Grain scope="container" />
          <SwitchToChatProvider value={active !== "chat" ? switchToChat : null}>
            {active === "agenda-list" ? (
              <AgendaFlow headerTrailing={headerTrailing} onFinish={onFinish} />
            ) : active === "mixed" ? (
              <MixedFlow headerTrailing={headerTrailing} onFinish={onFinish} />
            ) : active === "chat" ? (
              <ChatFlow headerTrailing={headerTrailing} onFinish={onFinish} />
            ) : (
              <GuidedFlow headerTrailing={headerTrailing} onFinish={onFinish} />
            )}
          </SwitchToChatProvider>
          {/* La Conversación con Clipper no suelta pelo: ahí la celebración la lleva el propio chat. */}
          {active !== "chat" && <ReservedHairBurst />}
          {/* Los avisos salen dentro de la reserva (su marco), libres de la cabecera: arriba al centro en
              celular, tablet y widget; arriba a la derecha en monitor. */}
          <ThemaToaster id={BOOKING_TOASTER_ID} position={layout === "wide" ? "top-right" : "top-center"} topOffset={layout === "wide" ? WIDE_TOAST_TOP_PX : COMPACT_TOAST_TOP_PX} />
        </section>
      </PortalContainerProvider>
    </BookingFlowProvider>
  );
}
