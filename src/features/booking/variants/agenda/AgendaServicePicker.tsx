import * as React from "react";
import { useAppT } from "@/app/i18n";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import { toastMissing } from "../../flow/missingData";
import type { BookingService } from "../../types";
import { fromPrice, itemDuration, itemPrice } from "../../useBookingTotals";
import { PICKER_SEARCH_FROM, PickerField, PickerOverlay, PickerRow, PickerSearch, plainText as plain } from "./AgendaPicker";

/** Cuántos nombres caben en el campo antes de resumir con «y N más». */
const NAMES_SHOWN = 2;

/**
 * «Qué te vas a hacer» en la Agenda con selector: un campo que se lee como un
 * select —lo elegido, cuánto dura y desde cuánto— y que al tocarlo abre la
 * carta entera. Así la cabecera del tablero mide lo mismo con 3 servicios que
 * con 30, y las horas libres quedan a la vista. Se elige dentro y se aplica con
 * «Ver horas»; cerrar sin aplicar no cambia nada.
 */
export function AgendaServiceField({ labelledBy, eyebrow, step, onNeedBranch }: { labelledBy: string; eyebrow?: string; step?: number; /** Sin sede no hay carta (es de cada sede): tocar el campo abre primero la sede. */ onNeedBranch?: () => void }) {
  const t = useAppT();
  const { state, dispatch, catalog, catalogLoading, fmt, touch } = useBookingFlow();
  const [open, setOpen] = React.useState(false);
  const selected = state.draft?.serviceIds ?? [];
  const services = catalog?.services ?? [];
  const chosen = selected.map((id) => services.find((service) => service.id === id)).filter((service): service is BookingService => Boolean(service));

  const apply = (next: readonly string[]) => {
    setOpen(false);
    const draft = state.draft;
    if (!draft) {
      dispatch({ type: "openDraft", person: { kind: "self" }, serviceIds: next, barberId: null });
      return;
    }
    // De a uno, para no perder la cita que se está cambiando (abrir otro borrador la soltaría).
    const changed = [...draft.serviceIds.filter((id) => !next.includes(id)), ...next.filter((id) => !draft.serviceIds.includes(id))];
    changed.forEach((serviceId) => dispatch({ type: "toggleService", serviceId }));
    // Si el barbero elegido no hace todo lo nuevo, vuelve a «sin preferencia» en vez de dejar la agenda vacía.
    const barber = catalog?.barbers.find((item) => item.id === draft.barberId);
    if (barber && !next.every((id) => barber.prices[id] !== undefined)) dispatch({ type: "chooseBarber", barberId: null });
  };

  if (catalogLoading) return <Skeleton className={cn("w-full rounded-xl", touch === "lg" ? "h-[4.5rem]" : "h-16")} />;

  const names =
    chosen.length > NAMES_SHOWN
      ? t("booking.agenda.whatMore", { names: chosen.slice(0, NAMES_SHOWN - 1).map((service) => service.name).join(" + "), count: chosen.length - (NAMES_SHOWN - 1) })
      : chosen.map((service) => service.name).join(" + ");

  return (
    <>
      <PickerField
        asCard
        eyebrow={eyebrow}
        step={step}
        // Sin sede no hay barberos ni carta: el campo espera apagado.
        disabled={!state.branchId}
        labelledBy={labelledBy}
        imageUrl={chosen[0]?.imageUrl}
        icon="scissors"
        value={chosen.length > 0 ? names : undefined}
        detail={t("booking.agenda.whatSummary", { minutes: itemDuration(selected, catalog), price: fmt.money(itemPrice({ serviceIds: selected, barberId: null }, catalog)) })}
        placeholder={t("booking.agenda.whatPlaceholder")}
        open={open}
        onOpen={() => (!state.branchId && onNeedBranch ? onNeedBranch() : setOpen(true))}
        testId="agenda-service-field"
      />
      <ServicePickerOverlay open={open} onOpenChange={setOpen} initial={selected} onApply={apply} />
    </>
  );
}

interface ServicePickerOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: readonly string[];
  onApply: (serviceIds: readonly string[]) => void;
}

function ServicePickerOverlay({ open, onOpenChange, initial, onApply }: ServicePickerOverlayProps) {
  const t = useAppT();
  const { catalog, fmt } = useBookingFlow();
  const [picked, setPicked] = React.useState<readonly string[]>(initial);
  // Tocó «Ver horas» sin elegir: el pie lo dice en rojo hasta que elija uno.
  const [triedApply, setTriedApply] = React.useState(false);
  const missingService = triedApply && picked.length === 0;
  const apply = () => {
    setTriedApply(true);
    if (toastMissing(t, [picked.length === 0 && t("booking.services.pick")])) return;
    onApply(picked);
  };
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  // Cada vez que se abre arranca de lo que ya está elegido, sin búsqueda vieja.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPicked(initial);
      setQuery("");
    }
  }

  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const footer = (
    <div className="flex w-full items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col" aria-live="polite">
        {picked.length > 0 ? (
          <>
            <Text size="xs" tone="muted">
              {t("booking.services.selected", { count: picked.length, minutes: itemDuration(picked, catalog) })}
            </Text>
            <Text weight="semibold" tabular>
              {t("booking.services.from", { price: fmt.money(itemPrice({ serviceIds: [...picked], barberId: null }, catalog)) })}
            </Text>
          </>
        ) : (
          <Text role={missingService ? "alert" : undefined} size="sm" tone={missingService ? "negative" : "muted"} weight={missingService ? "medium" : undefined}>
            {t("booking.services.pick")}
          </Text>
        )}
      </div>
      <Button type="button" size="lg" onClick={apply} data-testid="agenda-service-apply">
        {t("booking.agenda.whatApply")}
      </Button>
    </div>
  );

  return (
    <PickerOverlay open={open} onOpenChange={onOpenChange} title={t("booking.agenda.whatTitle")} description={t("booking.agenda.whatLead")} footer={footer} focusRef={listRef}>
      <ServicePickerList ref={listRef} picked={picked} onToggle={toggle} query={query} onQueryChange={setQuery} />
    </PickerOverlay>
  );
}

interface ServicePickerListProps {
  picked: readonly string[];
  onToggle: (serviceId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

/** La lista de la carta: buscador si hay muchos, agrupada por categoría y con casilla por fila (se pueden varios). */
const ServicePickerList = React.forwardRef<HTMLDivElement, ServicePickerListProps>(function ServicePickerList({ picked, onToggle, query, onQueryChange }, ref) {
  const t = useAppT();
  const { state, catalog, fmt } = useBookingFlow();
  // El barbero se elige antes: con uno elegido, solo lo que él hace.
  const barber = catalog?.barbers.find((item) => item.id === state.draft?.barberId);
  const services = (catalog?.services ?? []).filter((service) => !barber || barber.prices[service.id] !== undefined);
  const needle = plain(query.trim());
  const visible = needle === "" ? services : services.filter((service) => plain(`${service.name} ${service.description} ${service.category}`).includes(needle));
  // Por categoría mientras no se busca; buscando, una sola lista con lo que coincide.
  const groups =
    needle === "" ? [...new Set(visible.map((service) => service.category))].map((category) => ({ category, items: visible.filter((service) => service.category === category) })) : [{ category: "", items: visible }];
  const showHeadings = groups.length > 1;

  return (
    <div ref={ref} className="flex flex-col">
      {services.length >= PICKER_SEARCH_FROM && <PickerSearch value={query} onChange={onQueryChange} placeholder={t("booking.services.search")} />}

      {services.length === 0 ? (
        <EmptyState icon="scissors" title={t("booking.services.emptyBranch")} />
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title={t("booking.services.empty")} />
      ) : (
        <div className="flex flex-col gap-4 px-2 pb-3 pt-1">
          {groups.map((group) => (
            <section key={group.category || "all"} aria-label={group.category || undefined} className="flex flex-col gap-0.5">
              {showHeadings && group.category && (
                <Text as="h3" size="xs" weight="medium" tone="muted" className="px-2 pb-1 pt-2 uppercase tracking-wide">
                  {group.category}
                </Text>
              )}
              {group.items.map((service) => {
                const price = t("booking.services.from", { price: fmt.money(fromPrice(service, catalog)) });
                const minutes = t("booking.services.minutes", { count: service.durationMin });
                return (
                  <PickerRow key={service.id} role="checkbox" checked={picked.includes(service.id)} label={`${service.name} · ${minutes} · ${price}`} imageUrl={service.imageUrl} icon="scissors" onClick={() => onToggle(service.id)}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Text as="span" weight="medium" className="truncate">
                        {service.name}
                      </Text>
                      {service.popular && <Badge variant="secondary">{t("booking.services.popular")}</Badge>}
                      {service.isCombo && <Badge variant="outline">{t("booking.services.combo")}</Badge>}
                    </span>
                    <Text as="span" size="xs" tone="muted" tabular>
                      {minutes} · <span className="font-medium text-text-primary">{price}</span>
                    </Text>
                  </PickerRow>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
});
