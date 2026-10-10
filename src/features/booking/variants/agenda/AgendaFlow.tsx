import * as React from "react";
import { useAppT } from "@/app/i18n";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { defaultBranchId, type BookingStep } from "../../bookingState";
import { useBookingFlow } from "../../flow/BookingContext";
import { AsideSlotProvider } from "../../flow/asideSlot";
import { BookingSummaryAside } from "../../flow/BookingSummaryAside";
import { BookingSheet } from "../../flow/BookingSheet";
import { HIDE_SCROLLBAR } from "../../flow/drawerFit";
import { toastMissing } from "../../flow/missingData";
import { ConfirmedStep } from "../../steps/ConfirmedStep";
import { GiftStep } from "../../steps/GiftStep";
import { ManageStep } from "../../steps/ManageStep";
import { PackagesStep } from "../../steps/PackagesStep";
import { WaitlistedStep } from "../../steps/WaitlistedStep";
import { defaultServiceId } from "./agendaModel";
import { AgendaBoard } from "./AgendaBoard";
import { AgendaCartBar } from "./AgendaCart";
import { AgendaHeader } from "./AgendaHeader";
import { AgendaIdentity } from "./AgendaIdentity";
import { AgendaSelectCheckout, AgendaSelectPay } from "./AgendaSelectCheckout";

interface AgendaFlowProps {
  headerTrailing?: React.ReactNode;
  onFinish?: () => void;
}

/** Pantallas que no son la agenda: el final, «Mis citas» y lo que se compra aparte. */
const OWN_SCREENS: ReadonlySet<BookingStep> = new Set(["confirmed", "waitlisted", "manage", "gift", "packages"]);

/**
 * Agenda con selector: la reserva que parte del «¿cuándo?». Sede, servicios y
 * barbero se eligen en campos que abren su lista (sin cuenta abren vacíos: nada
 * elegido por la persona, y la sede va primero); luego se aparta una hora con un
 * toque; en «Confirma tu cita» se revisa, se suman productos u otra cita y se
 * pregunta quién es, y el pago va aparte, en su propia pantalla.
 */
export function AgendaFlow({ headerTrailing, onFinish }: AgendaFlowProps) {
  const t = useAppT();
  const { state, dispatch, shop, catalog, layout } = useBookingFlow();
  const [chosenView, setView] = React.useState<"board" | "checkout" | "pay">("board");
  // Sin citas no hay nada que confirmar: se queda en la agenda.
  const view = state.items.length === 0 ? "board" : chosenView;
  const [signInOpen, setSignInOpen] = React.useState(false);
  // Tocó «Continuar» sin hora: la agenda marca el día y la hora hasta que aparte una.
  const [triedContinue, setTriedContinue] = React.useState(false);
  const timeMissing = triedContinue && state.items.length === 0;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const seededDraft = React.useRef<string | null>(null);
  const isWide = layout === "wide";
  const ownScreen = OWN_SCREENS.has(state.step);

  // La sede: con cuenta, la de siempre o la primera; sin cuenta y con varias, la elige la persona (abre vacía).
  // Con una sola sede no hay nada que elegir.
  React.useEffect(() => {
    if (state.branchId || shop.branches.length === 0) return;
    if (!state.customer && shop.branches.length > 1) return;
    dispatch({ type: "chooseBranch", branchId: defaultBranchId(state.customer, shop.branches.map((item) => item.id)) ?? shop.branches[0].id });
  }, [state.branchId, state.customer, shop.branches, dispatch]);

  // Siempre hay una cita en borrador. Sin cuenta abre vacía: servicio y barbero los elige la persona.
  // Con cuenta abre con el servicio más pedido para enseñar horas desde el primer momento. Tras apartar
  // una hora, la siguiente sigue con lo mismo.
  const isSignedIn = Boolean(state.customer);
  React.useEffect(() => {
    if (!catalog || !state.branchId || ownScreen) return;
    if (!state.draft) {
      const last = state.items.at(-1);
      const fallback = isSignedIn ? defaultServiceId(catalog.services) : null;
      // El barbero es una elección propia: la siguiente cita sigue con el mismo.
      dispatch({ type: "openDraft", person: { kind: "self" }, serviceIds: last ? last.serviceIds : fallback ? [fallback] : [], barberId: last?.barberId ?? null, barberChosen: last?.barberChosen });
      return;
    }
    if (isSignedIn && state.draft.serviceIds.length === 0 && state.items.length === 0 && seededDraft.current !== state.draft.key) {
      seededDraft.current = state.draft.key;
      const fallback = defaultServiceId(catalog.services);
      if (fallback) dispatch({ type: "toggleService", serviceId: fallback });
    }
  }, [catalog, state.branchId, state.draft, state.items, ownScreen, isSignedIn, dispatch]);

  // Las citas ya confirmadas en el cierre (`held`) se quedan; la que se está eligiendo ahora es una sola:
  // la hora que se toca después reemplaza a la anterior. «Agregar otra cita» sube `held`.
  const [actionSlot, setActionSlot] = React.useState<HTMLElement | null>(null);
  const [heldCount, setHeldCount] = React.useState(0);
  const held = Math.min(heldCount, state.items.length);
  React.useEffect(() => {
    if (state.items.length <= held + 1) return;
    for (let extra = state.items.length - 1; extra > held; extra -= 1) dispatch({ type: "removeItem", index: held });
  }, [state.items.length, held, dispatch]);

  // Al entrar desde la cabecera, la hoja se cierra sola: ya se sabe quién es.
  if (signInOpen && state.customer) setSignInOpen(false);

  // Cada vista empieza arriba; apartar horas en la agenda (que mueve el paso por dentro) no la mueve.
  const screen = ownScreen ? state.step : view;
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [screen]);

  // El embudo cuenta «Confirma tu cita» como la revisión y «Pago» como el pago.
  const toBoard = () => {
    setView("board");
    if (state.step === "payment") dispatch({ type: "goTo", step: "review" });
  };
  const toCheckout = () => {
    setView("checkout");
    dispatch({ type: "goTo", step: "review" });
  };
  const toPay = () => {
    setView("pay");
    dispatch({ type: "goTo", step: "payment" });
  };
  // Otra cita: las de ahora se quedan y la agenda abre con lo mismo para elegir otra hora.
  const addAnother = () => {
    setHeldCount(state.items.length);
    const last = state.items.at(-1);
    dispatch({ type: "openDraft", person: { kind: "self" }, serviceIds: last ? last.serviceIds : [], barberId: last?.barberId ?? null, barberChosen: last?.barberChosen });
    toBoard();
  };

  const back: (() => void) | null = ownScreen
    ? () => dispatch({ type: "goTo", step: state.step === "manage" && state.reservation ? "confirmed" : "services" })
    : view === "pay"
      ? toCheckout
      : view === "checkout"
        ? toBoard
        : null;

  const content =
    state.step === "confirmed" ? (
      <ConfirmedStep onFinish={onFinish} />
    ) : state.step === "waitlisted" ? (
      <WaitlistedStep onFinish={onFinish} />
    ) : state.step === "manage" ? (
      <ManageStep />
    ) : state.step === "gift" ? (
      <GiftStep />
    ) : state.step === "packages" ? (
      <PackagesStep />
    ) : view === "pay" ? (
      <AgendaSelectPay />
    ) : view === "checkout" ? (
      <AgendaSelectCheckout onContinue={toPay} onAddAnother={addAnother} />
    ) : (
      <AgendaBoard onNeedSignIn={() => setSignInOpen(true)} timeMissing={timeMissing} heldCount={held} />
    );

  return (
    <>
      {/* «Tu reserva» ocupa todo el alto: la cabecera llega hasta el panel. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <AgendaHeader onBack={state.step === "confirmed" || state.step === "waitlisted" ? null : back} onSignIn={() => setSignInOpen(true)} trailing={headerTrailing} showChat={!ownScreen && view === "board"} />
          <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", !isWide && HIDE_SCROLLBAR)}>
            <div className="flex min-h-full w-full flex-col">
              {/* Columna flexible: el pie de cada paso queda pegado abajo aunque el contenido sea corto. */}
              <div className="flex flex-1 flex-col">
                {/* En monitor, el botón de pagar va al pie de «Tu reserva»; sin panel, en la barra de abajo. */}
                <AsideSlotProvider value={isWide && !ownScreen && view !== "board" ? actionSlot : null}>{content}</AsideSlotProvider>
              </div>
              {!isWide && !ownScreen && view === "board" && <AgendaCartBar onEdit={() => undefined} onContinue={toCheckout} />}
            </div>
          </div>
        </div>
        {isWide && !ownScreen && (
          <div className="w-96 shrink-0 overflow-hidden border-l border-border bg-surface/60">
            {/* El mismo resumen que Paso a paso. */}
            <BookingSummaryAside actionSlotRef={setActionSlot} draftUntilBooked atPayment={view === "pay"} />
          </div>
        )}
        {/* En la agenda (sin pie propio), el botón de seguir va al pie del resumen. */}
        {isWide && !ownScreen && view === "board" && actionSlot &&
          createPortal(
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => {
                setTriedContinue(true);
                if (toastMissing(t, [state.items.length === 0 && t("booking.agenda.pickTime")])) return;
                toCheckout();
              }}
            >
              {t("booking.agenda.cart.continue")}
              <ThemaIcon name="arrowRight" />
            </Button>,
            actionSlot
          )}
      </div>
      <BookingSheet open={signInOpen} onOpenChange={setSignInOpen} title={t("booking.agenda.signInTitle")} description={t("booking.agenda.signInLead")}>
        <AgendaIdentity />
      </BookingSheet>
    </>
  );
}
