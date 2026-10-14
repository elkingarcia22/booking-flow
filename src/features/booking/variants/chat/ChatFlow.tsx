import * as React from "react";
import { useAppT } from "@/app/i18n";
import { ClipperOrb } from "@/components/ai-interaction";
import { ChatComposer, ChatMarkdown, ChatQuestionCard, ChatThinking, ChatUserMessage } from "@/components/chat";
import { Heading, Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { describeError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import { BookingSummaryAside } from "../../flow/BookingSummaryAside";
import { HIDE_SCROLLBAR } from "../../flow/drawerFit";
import { GalleryViewer } from "../../flow/GalleryViewer";
import { PhotoStrip } from "../../flow/PhotoStrip";
import { PaymentSheets } from "../../flow/PaymentPanel";
import { usePaymentController, type PaymentController } from "../../flow/usePaymentController";
import { GiftStep } from "../../steps/GiftStep";
import { PackagesStep } from "../../steps/PackagesStep";
import type { ChatTurn, PaymentEvent } from "./chatKit";
import { ChatHome } from "./ChatHome";
import { useChatBooking, type ChatEngine } from "./useChatBooking";
import { BookingVoice } from "./BookingVoice";
import { useVoiceBridge } from "./useVoiceBridge";
import { clearVoiceOnArrival, peekVoiceOnArrival } from "../../flow/versionSwitch";

interface ChatFlowProps {
  headerTrailing?: React.ReactNode;
  onFinish?: () => void;
}

/**
 * El cobro montado junto a la conversación (con sus tarjetas guardadas, ya se
 * sabe quién es): la conversación lo usa por `controllerRef` y aquí viven sus
 * hojas (la tarjeta nueva). Avisa cuando se agrega una tarjeta o la pasarela falla.
 */
function PaymentBridge({ controllerRef, onEvent }: { controllerRef: React.RefObject<PaymentController | null>; onEvent: (event: PaymentEvent) => void }) {
  const payment = usePaymentController();
  const onEventRef = React.useRef(onEvent);
  React.useLayoutEffect(() => {
    controllerRef.current = payment;
    onEventRef.current = onEvent;
  });
  const last4 = payment.card ? payment.card.number.replace(/\D/g, "").slice(-4) : null;
  React.useEffect(() => {
    if (last4) onEventRef.current({ kind: "cardAdded", last4 });
  }, [last4]);
  const error = payment.reserve.error;
  React.useEffect(() => {
    if (error) onEventRef.current({ kind: "failed", message: describeError(error).description });
  }, [error]);
  return <PaymentSheets payment={payment} />;
}

/** Un mensaje del asistente: su marca, lo que dice y, si es la pregunta abierta, su lista para responder. */
function AgentTurn({ turn, isOpen, engine }: { turn: ChatTurn; isOpen: boolean; engine: ChatEngine }) {
  const t = useAppT();
  const [viewing, setViewing] = React.useState<number | null>(null);
  const photos = turn.photos ?? [];
  // Respondida o ya superada, la pregunta se queda como texto en el hilo (la respuesta va como mensaje del cliente).
  const asked = turn.question && !isOpen ? turn.question.title : undefined;
  const text = [turn.text, asked && (turn.text ? `**${asked}**` : asked)].filter(Boolean).join("\n\n") || undefined;
  return (
    <div className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300" data-testid="booking-chat-agent">
      {text && (
        <div className="flex items-start gap-3">
          <ClipperOrb size={24} bare className="mt-1" />
          <div className="min-w-0 rounded-2xl rounded-tl-md bg-surface-subtle px-4 py-2.5">
            <ChatMarkdown text={text} />
          </div>
        </div>
      )}
      {turn.attachment && (
        // Un archivo dentro del chat, como los que se mandan por WhatsApp: se descarga con un toque.
        <div className="ml-9 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm">
          <IconTile size="md" icon={<ThemaIcon name="calendarAdd" />} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Text size="sm" weight="medium" truncate>
              {turn.attachment.name}
            </Text>
            {turn.attachment.description && (
              <Text size="xs" tone="muted" truncate>
                {turn.attachment.description}
              </Text>
            )}
          </div>
          <Button asChild size="sm" variant="outline">
            <a href={turn.attachment.url} download={turn.attachment.name}>
              <ThemaIcon name="download" />
              {t("booking.chat.download")}
            </a>
          </Button>
        </div>
      )}
      {photos.length > 0 && (
        // Las fotos van bajo el mensaje, como en un chat: se recorren y se abren en la galería.
        <div className="pl-9">
          <PhotoStrip photos={photos} onOpen={setViewing} className="mx-0" />
          <GalleryViewer photos={photos} index={viewing} title={turn.photosTitle ?? ""} onClose={() => setViewing(null)} />
        </div>
      )}
      {turn.question && isOpen && <ChatQuestionCard question={turn.question} active onAnswer={(label) => engine.answer(turn.id, label)} />}
    </div>
  );
}

/** Lo que escribió el cliente; si mandó fotos (para el barbero), van encima, como en un chat. */
function UserTurn({ turn }: { turn: ChatTurn }) {
  const t = useAppT();
  const [viewing, setViewing] = React.useState<number | null>(null);
  const photos = turn.photos ?? [];
  return (
    <div className="flex flex-col items-end gap-2">
      {photos.length > 0 && (
        <ul className="flex flex-wrap justify-end gap-2" aria-label={t("booking.photo.added")}>
          {photos.map((photo, index) => (
            <li key={index}>
              <button type="button" onClick={() => setViewing(index)} className="block overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <img src={photo} alt={t("booking.photo.alt")} className="size-24 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && <GalleryViewer photos={photos} index={viewing} title={t("booking.photo.added")} onClose={() => setViewing(null)} />}
      {turn.text && <ChatUserMessage message={{ id: turn.id, role: "user", text: turn.text, createdAt: 0, status: "done" }} />}
    </div>
  );
}

/**
 * Conversación: se reserva hablando con el asistente de la barbería, como por
 * WhatsApp. Lo que se escribe (el celular, el código, el nombre, una frase como
 * «corte mañana a las 5 con Andrés») va en la caja; cada elección llega como una
 * pregunta con su lista numerada y, al responder, queda como un mensaje más.
 */
export function ChatFlow({ headerTrailing, onFinish }: ChatFlowProps) {
  const t = useAppT();
  const { state, dispatch, shop, layout } = useBookingFlow();
  const controllerRef = React.useRef<PaymentController | null>(null);
  // La portada primero: decir o escribir qué cita quiere; el chat arranca con eso.
  const [isHome, setIsHome] = React.useState(true);
  // Desde «Agenda con Clipper» en otra experiencia, se llega hablando: la voz ya está abierta.
  const [arrival] = React.useState(peekVoiceOnArrival);
  const [isVoiceOpen, setIsVoiceOpen] = React.useState(arrival !== null);
  React.useEffect(() => clearVoiceOnArrival(), []);
  // Cada experiencia conserva su orden: desde la Agenda, el celular se pide al final.
  const engine = useChatBooking({ onFinish, payment: controllerRef, deferStart: true, identityAt: arrival === "agenda-list" ? "last" : "first" });
  const startChat = (text?: string) => {
    setIsHome(false);
    engine.begin(text);
  };
  const [draft, setDraft] = React.useState("");
  // Una sola conversación por voz para la portada y el chat: empieza en la portada y sigue en el chat.
  const voice = useVoiceBridge(engine, {
    started: !isHome,
    start: startChat,
    shopName: shop.name,
    hasPackages: shop.packages.length > 0,
    openSide: (step) => {
      setIsVoiceOpen(false);
      dispatch({ type: "goTo", step });
    },
  });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isWide = layout === "wide";
  const onSideScreen = state.step === "gift" || state.step === "packages";

  // Lo último siempre a la vista: cada mensaje nuevo baja el hilo.
  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollTo?.({ top: node.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [engine.turns, engine.typing]);

  return (
    <>

      <BookingVoice
        open={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        ask={voice.ask}
        // Clipper saluda al abrir la llamada (aún sin conversación): desde Paso a paso pide quién eres;
        // desde la Agenda o la portada, qué quieres hacer hoy.
        opening={isHome ? () => voice.greet(arrival === "guided" ? "guided" : "menu") : undefined}
        secret={engine.secret}
        onWrite={(text) => {
          // «Escribir»: lo dicho queda en la caja del chat (desde la portada, el chat se abre primero).
          if (isHome) startChat();
          setDraft(text);
        }}
      />
      {state.customer && <PaymentBridge key={state.customer.id} controllerRef={controllerRef} onEvent={engine.onPaymentEvent} />}

      {/* El resumen ocupa todo el alto: la cabecera llega hasta el panel. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* En la portada no hay cabecera de conversación: la portada es la entrada. */}
          {!(isHome && !onSideScreen) && (
            <header className="relative z-sticky shrink-0 border-b border-border bg-surface/90 backdrop-blur">
              <div className={cn("flex h-14 items-center gap-3 px-3", isWide && "h-16 px-6")}>
                {onSideScreen ? (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => dispatch({ type: "goTo", step: "welcome" })} aria-label={t("booking.header.back")}>
                    <ThemaIcon name="chevronLeft" />
                  </Button>
                ) : (
                  <ClipperOrb size={36} bare state={engine.typing ? "thinking" : "idle"} />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <Heading level={6} className="truncate">
                    {t("booking.chat.title", { shop: shop.name })}
                  </Heading>
                  <Text size="xs" tone="muted" className="flex items-center gap-1.5">
                    <span aria-hidden className="size-1.5 rounded-full bg-success" />
                    {t("booking.chat.subtitle")}
                  </Text>
                </div>
                <Button type="button" variant="ghost" size={isWide ? "sm" : "icon-sm"} onClick={() => engine.reply("manage", t("booking.header.myAppointments"))} aria-label={t("booking.header.myAppointments")}>
                  <ThemaIcon name="calendar" />
                  {isWide && t("booking.header.myAppointments")}
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => engine.reply("restart", t("booking.chat.reply.restart"))} aria-label={t("booking.chat.reply.restart")}>
                  <ThemaIcon name="refresh" />
                </Button>
                {headerTrailing}
              </div>
            </header>
          )}
          {onSideScreen ? (
            <div className="min-h-0 flex-1 overflow-y-auto">{state.step === "gift" ? <GiftStep /> : <PackagesStep />}</div>
          ) : isHome ? (
            <>
              {/* El cierre del widget sigue a mano aunque no haya cabecera. */}
              {headerTrailing && <div className="absolute right-3 top-3 z-raised">{headerTrailing}</div>}
              <ChatHome onStart={startChat} onVoice={() => setIsVoiceOpen(true)} />
            </>
          ) : (
            <>
              <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", !isWide && HIDE_SCROLLBAR)}>
                <div role="log" aria-live="polite" aria-label={t("booking.chat.threadLabel")} className={cn("mx-auto flex w-full flex-col gap-4 px-4 py-6", isWide ? "max-w-2xl" : "max-w-xl")}>
                  {engine.turns.map((turn) =>
                    turn.from === "agent" ? (
                      <AgentTurn key={turn.id} turn={turn} isOpen={turn.id === engine.activeTurnId} engine={engine} />
                    ) : (
                      <UserTurn key={turn.id} turn={turn} />
                    )
                  )}
                  {engine.typing && <ChatThinking label={t("booking.chat.typing")} />}
                </div>
              </div>
              <div className="shrink-0 border-t border-border bg-surface/80 px-4 py-3 backdrop-blur">
                <div className={cn("mx-auto w-full", isWide ? "max-w-2xl" : "max-w-xl")}>
                  <ChatComposer
                    value={draft}
                    onChange={setDraft}
                    onSend={(text, files) => engine.send(text, files)}
                    placeholder={engine.placeholder}
                    compact
                    attach={engine.photoRoom > 0}
                    attachKind="photos"
                    maxFiles={engine.photoRoom}
                    disclaimer={false}
                    onVoice={() => setIsVoiceOpen(true)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        {!onSideScreen && isWide && state.items.length + (state.draft ? 1 : 0) > 0 && (
          <div className="w-96 shrink-0 overflow-hidden border-l border-border bg-surface/60">
            <BookingSummaryAside />
          </div>
        )}
      </div>
    </>
  );
}
