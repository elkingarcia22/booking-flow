import * as React from "react";
import { toast } from "../../flow/bookingToast";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { personName } from "../../bookingState";
import { initialsOf, parseStart } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { BookingSheet } from "../../flow/BookingSheet";
import { itemPrice } from "../../useBookingTotals";

interface CartProps {
  /** Al tocar «Cambiar»: la agenda vuelve a la vista con esa cita abierta. */
  onEdit: () => void;
  /** Ir a confirmar; sin esto (ya en el cierre) no hay botón. */
  onContinue?: () => void;
}

/** Las citas apartadas, una por fila: quién, qué, con quién y cuándo, con cambiar y quitar. */
export function AgendaCartLines({ onEdit, readOnly = false }: { onEdit: () => void; readOnly?: boolean }) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt } = useBookingFlow();

  const remove = (index: number) => {
    const item = state.items[index];
    if (!item) return;
    dispatch({ type: "removeItem", index });
    toast(t("booking.review.removed"), { action: { label: t("booking.review.undo"), onClick: () => dispatch({ type: "restoreItem", index, item }) } });
  };

  return (
    <ul className="flex flex-col divide-y divide-border">
      {state.items.map((item, index) => {
        const barber = catalog?.barbers.find((entry) => entry.id === item.barberId);
        const when = item.start ? parseStart(item.start) : null;
        const services = item.serviceIds.map((id) => catalog?.services.find((service) => service.id === id)?.name ?? id).join(" + ");
        const who = item.person.kind === "self" ? t("booking.person.self") : personName(item.person, state.customer);
        return (
          <li key={item.key} className={cn("flex items-start gap-3 py-3 first:pt-0 last:pb-0", state.editingIndex === index && "opacity-50")}>
            {barber ? (
              <Avatar>
                {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
                <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
              </Avatar>
            ) : (
              <IconTile size="sm" shape="circle" icon={<ThemaIcon name="users" />} />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Text size="sm" weight="semibold" tabular>
                {when ? fmt.when(when) : ""}
              </Text>
              <Text size="xs" tone="secondary" className="line-clamp-2">
                {services} · {barber?.name ?? t("booking.review.noPreference")}
              </Text>
              <Text size="xs" tone="muted">
                {who}
              </Text>
              {!readOnly && (
                <div className="-ml-2 mt-1 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      dispatch({ type: "editItem", index });
                      onEdit();
                    }}
                  >
                    <ThemaIcon name="edit" />
                    {t("booking.review.edit")}
                  </Button>
                  <Button type="button" variant="ghost" size="xs" onClick={() => remove(index)}>
                    <ThemaIcon name="close" />
                    {t("booking.review.remove")}
                  </Button>
                </div>
              )}
            </div>
            <Text size="sm" weight="medium" tabular className="shrink-0">
              {fmt.money(itemPrice(item, catalog))}
            </Text>
          </li>
        );
      })}
    </ul>
  );
}

/** El total y el botón de seguir, iguales en la columna y en la barra. */
function CartTotal({ onContinue }: { onContinue?: () => void }) {
  const t = useAppT();
  const { state, totals, fmt } = useBookingFlow();
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="xs" tone="muted">
          {t("booking.agenda.cart.count", { count: state.items.length })}
        </Text>
        <Text size="lg" weight="semibold" tabular>
          {fmt.money(totals.total)}
        </Text>
      </div>
      {onContinue && (
        <Button type="button" size="lg" disabled={state.items.length === 0} onClick={onContinue}>
          {t("booking.agenda.cart.continue")}
          <ThemaIcon name="arrowRight" />
        </Button>
      )}
    </div>
  );
}

/**
 * «Tu reserva» en celular, tablet y widget: una barra pegada abajo con cuántas
 * citas y cuánto, que se abre en una hoja para cambiarlas o quitarlas.
 */
export function AgendaCartBar({ onEdit, onContinue }: CartProps) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const [isOpen, setIsOpen] = React.useState(false);
  if (state.items.length === 0) return null;

  return (
    <div className="sticky bottom-0 z-sticky border-t border-border bg-surface px-5 py-3 shadow-[0_-8px_16px_-12px_hsl(var(--foreground)/0.25)] motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-lg" onClick={() => setIsOpen(true)} aria-label={t("booking.agenda.cart.see")}>
          <ThemaIcon name="layers" />
        </Button>
        <div className="min-w-0 flex-1">
          <CartTotal onContinue={onContinue} />
        </div>
      </div>
      <BookingSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title={t("booking.agenda.cart.title")}
        description={t("booking.agenda.cart.another")}
        actions={
          onContinue && (
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                onContinue();
              }}
            >
              {t("booking.agenda.cart.continue")}
              <ThemaIcon name="arrowRight" />
            </Button>
          )
        }
      >
        <AgendaCartLines
          onEdit={() => {
            setIsOpen(false);
            onEdit();
          }}
        />
      </BookingSheet>
    </div>
  );
}
