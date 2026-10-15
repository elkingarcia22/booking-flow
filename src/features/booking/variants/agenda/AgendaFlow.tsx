import * as React from "react";
import { useAppT } from "@/app/i18n";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { defaultBranchId, previousPartIndex, type BookingStep } from "../../bookingState";
import { useBookingFlow } from "../../flow/BookingContext";
import { AsideSlotProvider } from "../../flow/asideSlot";
import { BookingSummaryAside } from "../../flow/BookingSummaryAside";
import { BookingSheet } from "../../flow/BookingSheet";
import { HIDE_SCROLLBAR } from "../../flow/drawerFit";
import { InPlaceIdentity } from "../../flow/InPlaceIdentity";
import { toast } from "../../flow/bookingToast";
import { toastMissing } from "../../flow/missingData";
import { BlockedStep } from "../../steps/BlockedStep";
import { ConfirmedStep } from "../../steps/ConfirmedStep";
import { GiftStep } from "../../steps/GiftStep";
import { ManageStep } from "../../steps/ManageStep";
import { PackagesStep } from "../../steps/PackagesStep";
import { PhoneStep } from "../../steps/PhoneStep";
import { ProfileStep } from "../../steps/ProfileStep";
import { VerifyStep } from "../../steps/VerifyStep";
import { WaitlistedStep } from "../../steps/WaitlistedStep";
import { defaultServiceId } from "./agendaModel";
import { AgendaBoard } from "./AgendaBoard";
import { AgendaCartBar } from "./AgendaCart";
import { AgendaHeader } from "./AgendaHeader";
import { AgendaSelectCheckout, AgendaSelectPay } from "./AgendaSelectCheckout";

interface AgendaFlowProps {
  headerTrailing?: React.ReactNode;
  onFinish?: () => void;
}

/**
 * La entrada: la portada de Paso a paso con el celular. Quien vuelve no pasa por la bienvenida de
 * Paso a paso: entra directo a su agenda (su sede, su servicio y «Lo de siempre»). El número
 * bloqueado va a su aviso.
 */
const ENTRY_SCREENS: ReadonlySet<BookingStep> = new Set(["phone", "verify", "profile", "blocked"]);
/** Lo que se abre aparte y vuelve a donde estaba: «Mis citas» y lo que se compra aparte. */
const SIDE_SCREENS: ReadonlySet<BookingStep> = new Set(["manage", "gift", "packages"]);
/** Pantallas que no son la agenda: la entrada, el final, «Mis citas» y lo que se compra aparte. */
const OWN_SCREENS: ReadonlySet<BookingStep> = new Set([...ENTRY_SCREENS, ...SIDE_SCREENS, "confirmed", "waitlisted"]);
/** Más que un aviso normal: da tiempo a deshacer «Empezar de nuevo». */
const UNDO_MS = 6000;

/**
 * Agenda: la reserva que parte del «¿cuándo?». Entra por la portada de Paso a
 * paso (el celular; quien vuelve va directo a su agenda). Sede, servicios y
 * barbero se eligen en campos que abren su lista (sin cuenta abren vacíos: nada
 * elegido por la persona, y la sede va primero); luego se aparta una hora con un
 * toque; en «Confirma tu cita» se revisa y se suman productos u otra cita, y el
 * pago va aparte, en su propia pantalla, que antes de cobrar pide el código.
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
  const isEntry = ENTRY_SCREENS.has(state.step);


  // La sede: con cuenta, la de siempre o la primera; sin cuenta y con varias, la elige la persona (abre vacía).
  // Con una sola sede no hay nada que elegir.
  React.useEffect(() => {
    // En la portada todavía no: elegir sede mueve el paso. Quien vuelve sale de ella con su sede de siempre.
    if (isEntry || state.branchId || shop.branches.length === 0) return;
    if (!state.customer && shop.branches.length > 1) return;
    dispatch({ type: "chooseBranch", branchId: defaultBranchId(state.customer, shop.branches.map((item) => item.id)) ?? shop.branches[0].id });
  }, [isEntry, state.branchId, state.customer, shop.branches, dispatch]);

  // Siempre hay una cita en borrador. Sin cuenta abre vacía: servicio y barbero los elige la persona.
  // Con cuenta abre con el servicio más pedido para enseñar horas desde el primer momento. Tras apartar
  // una hora, la siguiente sigue con lo mismo.
  const isSignedIn = Boolean(state.customer);
  // Las citas ya confirmadas en el cierre: la que viene después de ellas es la que se está eligiendo.
  const [heldCount, setHeldCount] = React.useState(0);
  const held = Math.min(heldCount, state.items.length);
  React.useEffect(() => {
    if (!catalog || !state.branchId || ownScreen) return;
    if (!state.draft) {
      const last = state.items.at(-1);
      const fallback = isSignedIn ? defaultServiceId(catalog.services) : null;
      // El barbero es una elección propia: la siguiente cita sigue con el mismo.
      // Si la última es la parte de una visita que se está eligiendo, la que se reabre sigue en esa visita.
      const visitId = last && state.items.length - 1 >= held ? last.visitId : undefined;
      dispatch({ type: "openDraft", person: visitId && last ? last.person : { kind: "self" }, serviceIds: last ? last.serviceIds : fallback ? [fallback] : [], barberId: last?.barberId ?? null, barberChosen: last?.barberChosen, visitId });
      return;
    }
    if (isSignedIn && state.draft.serviceIds.length === 0 && state.items.length === 0 && seededDraft.current !== state.draft.key) {
      seededDraft.current = state.draft.key;
      const fallback = defaultServiceId(catalog.services);
      if (fallback) dispatch({ type: "toggleService", serviceId: fallback });
    }
  }, [catalog, state.branchId, state.draft, state.items, ownScreen, isSignedIn, held, dispatch]);

  // Las citas ya confirmadas en el cierre (`held`) se quedan; la que se está eligiendo ahora es una sola:
  // la hora que se toca después reemplaza a la anterior. «Agregar otra cita» sube `held`.
  const [actionSlot, setActionSlot] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (state.items.length <= held + 1) return;
    for (let extra = state.items.length - 1; extra > held; extra -= 1) dispatch({ type: "removeItem", index: held });
  }, [state.items.length, held, dispatch]);

  // La hora apartada es de un barbero y unos servicios: si en la agenda se cambia cualquiera de los dos,
  // esa hora ya no vale (ni su precio) y se suelta para elegir otra.
  const pending = state.items[held];
  const draftBarberId = state.draft?.barberId ?? null;
  const draftServices = state.draft?.serviceIds;
  const sameAsPending = Boolean(pending && draftServices && pending.serviceIds.length === draftServices.length && pending.serviceIds.every((id) => draftServices.includes(id)));
  // «Cada servicio con su barbero u hora»: la siguiente parte de la visita no reemplaza a la apartada, se suma.
  const isNextPart = Boolean(pending && state.draft?.visitId && pending.visitId === state.draft.visitId && !sameAsPending);
  if (isNextPart && heldCount !== state.items.length) setHeldCount(state.items.length);
  React.useEffect(() => {
    if (!pending || !draftServices || view !== "board" || ownScreen || isNextPart) return;
    if ((pending.barberId ?? null) !== draftBarberId || !sameAsPending) dispatch({ type: "removeItem", index: held });
  }, [pending, draftBarberId, draftServices, sameAsPending, isNextPart, view, ownScreen, held, dispatch]);

  // Al entrar desde la cabecera, la hoja se cierra sola: ya se sabe quién es.
  if (signInOpen && state.customer && state.verified) setSignInOpen(false);

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
  // Otra cita: las de ahora se quedan y la agenda vuelve a empezar (misma sede, sin barbero ni servicio), como en Paso a paso.
  const addAnother = () => {
    setHeldCount(state.items.length);
    dispatch({ type: "openDraft", person: { kind: "self" }, serviceIds: [], barberId: null, barberChosen: false });
    toBoard();
  };
  // Se arrepiente de sumar otra: la que estaba armando se suelta y vuelve a «Confirma tu cita» con las de antes.
  // `heldCount` no se toca: son las citas guardadas, y bajarlo borraría las que sobran.
  const keepHeld = () => {
    // Venía de separar o juntar una visita: el carrito vuelve como estaba.
    if (state.undoItems) dispatch({ type: "discardDraft" });
    else if (state.items.length > held) dispatch({ type: "removeItem", index: held });
    toCheckout();
  };
  // «Empezar de nuevo», como en Paso a paso: la reserva a cero (y la agenda vacía), con «Deshacer».
  const hasBooking = state.items.length > 0 || (state.draft?.serviceIds.length ?? 0) > 0;
  const startOver = () => {
    const before = { state, heldCount, view: chosenView };
    setHeldCount(0);
    setView("board");
    dispatch({ type: "startOver" });
    toast(t("booking.header.startedOver"), {
      duration: UNDO_MS,
      action: {
        label: t("booking.review.undo"),
        onClick: () => {
          dispatch({ type: "restoreState", state: before.state });
          setHeldCount(before.heldCount);
          setView(before.view);
        },
      },
    });
  };
  // Separar o juntar desde «Confirma tu cita»: la parte se elige en la agenda, como otra cita más.
  const splitService = (index: number, serviceId: string) => {
    setHeldCount(state.items.length);
    dispatch({ type: "splitService", index, serviceId });
    setView("board");
  };
  const joinVisit = (visitId: string) => {
    setHeldCount(state.items.length);
    dispatch({ type: "joinVisit", visitId });
    setView("board");
  };

  const back: (() => void) | null =
    state.step === "phone"
      ? null
      : state.step === "verify"
        ? () => dispatch({ type: "goTo", step: "phone" })
        : isEntry
          ? () => dispatch({ type: "restart" })
          : ownScreen
            ? () => dispatch({ type: "goTo", step: state.step === "manage" && state.reservation ? "confirmed" : "services" })
            : view === "pay"
      ? toCheckout
      : view === "checkout"
        ? toBoard
        : previousPartIndex(state) >= 0
          ? // Por separado, como en Paso a paso: «Atrás» reabre la parte anterior para corregirla.
            () => dispatch({ type: "previousPart" })
          : held > 0
            ? keepHeld
            : null;

  const content =
    state.step === "phone" ? (
      <PhoneStep askProfile={false} />
    ) : state.step === "verify" ? (
      <VerifyStep />
    ) : state.step === "profile" ? (
      <ProfileStep />
    ) : state.step === "blocked" ? (
      <BlockedStep />
    ) : state.step === "confirmed" ? (
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
      // La hora ya no está: de vuelta a la agenda, donde la nueva reemplaza a la anterior.
      <AgendaSelectPay onChangeTime={toBoard} />
    ) : view === "checkout" ? (
      <AgendaSelectCheckout onContinue={toPay} onAddAnother={addAnother} onSplit={splitService} onJoin={joinVisit} />
    ) : (
      <AgendaBoard onNeedSignIn={() => setSignInOpen(true)} timeMissing={timeMissing} heldCount={held} />
    );

  return (
    <>
      {/* «Tu reserva» ocupa todo el alto: la cabecera llega hasta el panel. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* La portada no lleva cabecera: la marca ya está en su tarjeta. El widget la conserva por su botón de cerrar. */}
          {(state.step !== "phone" || headerTrailing) && (
            <AgendaHeader onBack={state.step === "confirmed" || state.step === "waitlisted" ? null : back} onSignIn={() => setSignInOpen(true)} trailing={headerTrailing} showChat={!ownScreen && view === "board"} onStartOver={!ownScreen && hasBooking ? startOver : undefined} />
          )}
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
      <BookingSheet
        open={signInOpen}
        onOpenChange={setSignInOpen}
        // Con el celular ya dado (en la portada) la hoja solo confirma con el código.
        title={t(state.phone ? "booking.payIdentity.title" : "booking.agenda.signInTitle")}
        description={t(state.phone ? "booking.payIdentity.codeLead" : "booking.agenda.signInLead")}
      >
        {/* El código se resuelve en la hoja: la agenda de detrás no pasa a «Escribe el código». */}
        <InPlaceIdentity />
      </BookingSheet>
    </>
  );
}
