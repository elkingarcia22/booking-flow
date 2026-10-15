import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { parseStart } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { BookingOverlay } from "../../flow/BookingOverlay";
import { HeldCards } from "../../flow/HeldCards";

/**
 * Las citas ya apartadas mientras se arma otra: una tarjeta que dice cuántas hay y cuándo es la
 * última, y al tocarla abre su detalle (desde abajo en celular y tablet, modal en monitor), con
 * «Editar» en cada una. Volver a «Confirma tu cita» sin sumar otra es «Atrás» de la cabecera.
 */
export function HeldAppointments({ count }: { count: number }) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt } = useBookingFlow();
  const [open, setOpen] = React.useState(false);
  const held = state.items.slice(0, count);
  const last = held.at(-1);
  if (!last) return null;
  const serviceNames = (serviceIds: readonly string[]) => serviceIds.map((id) => catalog?.services.find((service) => service.id === id)?.name ?? id);
  const when = last.start ? `${fmt.dayShort(parseStart(last.start))} · ${fmt.time(parseStart(last.start))}` : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-xs outline-none transition-colors duration-fast hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <IconTile size="md" shape="circle" tone="positive" icon={<ThemaIcon name="check" />} />
        <span className="flex min-w-0 flex-1 flex-col">
          <Text as="span" size="sm" weight="semibold">
            {t("booking.agenda.heldTitle", { count })}
          </Text>
          <Text as="span" size="xs" tone="muted" tabular className="truncate first-letter:uppercase">
            {[when, serviceNames(last.serviceIds).join(" + ")].filter(Boolean).join(" · ")}
          </Text>
        </span>
        <Text as="span" size="xs" weight="medium" tone="primary" className="flex shrink-0 items-center gap-1">
          {t("booking.agenda.heldSee")}
          <ThemaIcon name="chevronRight" size="xs" className="transition-transform duration-fast group-hover:translate-x-0.5" />
        </Text>
      </button>

      <BookingOverlay open={open} onOpenChange={setOpen} title={t("booking.agenda.heldTitle", { count })} description={t("booking.agenda.heldLead")}>
        <HeldCards
          items={held}
          onEdit={(item) => {
            // La agenda se queda donde está: la cita se cambia aquí mismo («Estás cambiando…»).
            setOpen(false);
            dispatch({ type: "editItem", index: state.items.indexOf(item) });
          }}
        />
      </BookingOverlay>
    </>
  );
}
