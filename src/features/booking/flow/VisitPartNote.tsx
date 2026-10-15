import * as React from "react";
import { useAppT } from "@/app/i18n";
import { TicketCard } from "@/components/data-display";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import type { DraftItem } from "../bookingState";
import { parseStart } from "../bookingFormat";
import { visitPartOf } from "../visit";
import { useBookingFlow } from "./BookingContext";
import { BookingOverlay } from "./BookingOverlay";
import { HeldCards } from "./HeldCards";
import { PersonPicker } from "./PersonPicker";


interface VisitPartNoteProps {
  /** El carrito sin la hora que se va a reemplazar (la Agenda). */
  items?: readonly DraftItem[];
  /** Preguntar aquí para quién es esta parte (con cuenta: sin ella no hay a quién más elegir). */
  withPerson?: boolean;
  /** Las ya apartadas de la visita, en una línea que abre su hoja (Paso a paso; la Agenda ya las enseña arriba). */
  showDone?: boolean;
}

/**
 * Al armar una parte de una visita, un `TicketCard` del sistema: qué parte es
 * («2 de 3»), de qué servicio, qué sigue y, en el mismo talón, para quién es: cada parte puede ser
 * de alguien distinto (yo el corte, mi hijo el suyo). «Juntar todo» sale del «por separado» y vuelve
 * a una sola cita. Fuera de una visita no se muestra.
 */
export function VisitPartNote({ items, withPerson = false, showDone = false }: VisitPartNoteProps) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt } = useBookingFlow();
  const [isDoneOpen, setIsDoneOpen] = React.useState(false);
  const draft = state.draft;
  const part = visitPartOf(state, items);
  // Cada parte nueva se trae a la vista: el interruptor queda abajo y el cambio pasa arriba (la Agenda).
  const ref = React.useRef<HTMLElement>(null);
  const partKey = part ? draft?.key : undefined;
  React.useEffect(() => {
    if (!partKey) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [partKey]);
  if (!draft || !part) return null;
  const nameOf = (ids: readonly string[]) => ids.map((id) => catalog?.services.find((service) => service.id === id)?.name ?? id).join(" + ");
  const service = nameOf(draft.serviceIds);
  const pending = (state.pendingParts ?? []).map((id) => nameOf([id]));
  const done = (items ?? state.items).filter((item, index) => item.visitId === draft.visitId && index !== state.editingIndex && item.start);
  const lastDone = done.at(-1);

  return (
    <>
    <TicketCard
      ref={ref}
      aria-label={t("booking.visit.part", part)}
      className="scroll-mt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300"
      stub={
        <>
          <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("booking.visit.stubPart")}</span>
          <span className="text-3xl font-semibold tabular-nums">{part.current}</span>
          <span className="text-xs tabular-nums opacity-80">{t("booking.visit.stubOf", { total: part.total })}</span>
        </>
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          {/* Hasta dos líneas: con «Juntar todo» al lado, «Arreglo de barba» no cabía en una. */}
          <Text size="lg" weight="semibold" className="line-clamp-2">
            {service}
          </Text>
          <Text size="xs" tone="muted" truncate>
            {pending.length > 0 ? t("booking.visit.next", { services: pending.join(", ") }) : t("booking.visit.lastPart")}
          </Text>
        </div>
        <Button type="button" variant="ghost" size="sm" className="-mr-2 -mt-1 h-7 shrink-0 text-text-secondary hover:text-text-primary" onClick={() => dispatch({ type: "exitVisit" })} aria-label={t("booking.visit.exitAria")}>
          {t("booking.visit.exit")}
        </Button>
      </div>
      {withPerson && <PersonPicker label={t("booking.visit.forWho")} compact />}

      {showDone && lastDone?.start && (
        // Lo ya apartado, discreto: una línea que abre la hoja con esas citas. Volver a la anterior es «Atrás».
        <div className="-mb-1.5 border-t border-border pt-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsDoneOpen(true)} aria-haspopup="dialog" className="-mx-2 h-auto w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal text-text-secondary hover:text-text-primary">
            <ThemaIcon name="check" size="xs" tone="positive" />
            <span className="min-w-0 flex-1 truncate text-left">{t("booking.visit.doneLine", { count: done.length, service: nameOf(lastDone.serviceIds), time: fmt.time(parseStart(lastDone.start)) })}</span>
            <span className="shrink-0 font-medium text-primary">{t("booking.agenda.heldSee")}</span>
          </Button>
        </div>
      )}
    </TicketCard>
    {showDone && (
        <BookingOverlay open={isDoneOpen} onOpenChange={setIsDoneOpen} title={t("booking.agenda.heldTitle", { count: done.length })} description={t("booking.agenda.heldLead")}>
          <HeldCards
            items={done}
            onEdit={(item) => {
              setIsDoneOpen(false);
              dispatch({ type: "reopenPart", key: item.key });
            }}
          />
        </BookingOverlay>
      )}
    </>
  );
}
