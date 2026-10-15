import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Chip } from "@/components/ai-interaction";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MagicCard } from "@/components/ui/magic-card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile } from "@/components/utility/IconTile";
import { useDragScroll } from "@/hooks/useDragScroll";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../flow/BookingContext";
import { toastMissing } from "../flow/missingData";
import { PersonPicker } from "../flow/PersonPicker";
import { SelectMark } from "@/components/selection";
import { SeparateServicesSwitch } from "../flow/SeparateServicesSwitch";
import { StepLayout } from "../flow/StepLayout";
import { fromPrice, itemDuration, itemPrice } from "../useBookingTotals";

const ALL = "__all__";
const SKELETON_ROWS = 5;
const plain = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Los servicios: varios en la misma cita (corte + barba), con foto, cuánto
 * duran y desde cuánto. Las categorías filtran sin esconder lo elegido.
 */
export function ServicesStep() {
  const t = useAppT();
  const { state, dispatch, catalog, catalogLoading, fmt, layout } = useBookingFlow();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  // Con ratón no hay barra que agarrar: la tira se arrastra y trae a la vista lo elegido.
  const categoryRow = useDragScroll<HTMLDivElement>({ follow: category });
  const selected = state.draft?.serviceIds ?? [];
  const services = catalog?.services ?? [];
  const categories = [...new Set(services.map((service) => service.category).filter(Boolean))];
  const visible = services.filter((service) => (category === ALL || service.category === category) && (query.trim() === "" || plain(`${service.name} ${service.description}`).includes(plain(query.trim()))));
  const minutes = itemDuration(selected, catalog);
  // Tocó «Siguiente» sin elegir nada: la lista y el pie se marcan hasta que elija uno.
  const [triedNext, setTriedNext] = React.useState(false);
  const missingService = triedNext && selected.length === 0;
  // Poco frecuente pero posible: cada servicio con su barbero u hora. Solo con dos o más, y no dentro de una parte.
  const [isSeparate, setIsSeparate] = React.useState(false);
  const canSeparate = selected.length > 1 && !state.draft?.visitId;
  const next = () => {
    setTriedNext(true);
    if (toastMissing(t, [selected.length === 0 && t("booking.services.pick")])) return;
    dispatch(canSeparate && isSeparate ? { type: "bookSeparately" } : { type: "goTo", step: "barber" });
  };

  return (
    <StepLayout
      cover
      title={t("booking.services.title")}
      lead={canSeparate && isSeparate ? t("booking.visit.servicesLead") : t("booking.services.lead")}
      footer={
        <div className="flex flex-col gap-3">
          {canSeparate && (
            <SeparateServicesSwitch checked={isSeparate} onCheckedChange={setIsSeparate} count={selected.length} />
          )}
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              {selected.length > 0 ? (
                <>
                  <Text size="xs" tone="muted">
                    {t("booking.services.selected", { count: selected.length, minutes })}
                  </Text>
                  <Text size="lg" weight="semibold" tabular>
                    {fmt.money(itemPrice({ serviceIds: selected, barberId: state.draft?.barberId ?? null }, catalog))}
                  </Text>
                </>
              ) : (
                <Text size="sm" tone={missingService ? "negative" : "muted"} weight={missingService ? "medium" : undefined}>
                  {t("booking.services.pick")}
                </Text>
              )}
            </div>
            <Button type="button" size="lg" onClick={next}>
              {t("booking.services.next")}
              <ThemaIcon name="arrowRight" />
            </Button>
          </div>
        </div>
      }
    >
      {/* Por separado, para quién se elige en cada parte (puede ser otra persona en cada una). */}
      {!(canSeparate && isSeparate) && <PersonPicker />}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <ThemaIcon name="search" size="sm" tone="muted" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("booking.services.search")} aria-label={t("booking.services.search")} className="pl-9" />
        </div>
        {categories.length > 1 && (
          <div ref={categoryRow} className="-mx-5 -my-1.5 flex gap-2 overflow-x-auto px-5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip label={t("booking.services.all")} selected={category === ALL} onClick={() => setCategory(ALL)} className="shrink-0" />
            {categories.map((item) => (
              <Chip key={item} label={item} selected={category === item} onClick={() => setCategory(item)} className="shrink-0" />
            ))}
          </div>
        )}
      </div>

      {catalogLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState icon="scissors" title={t("booking.services.emptyBranch")} />
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title={t("booking.services.empty")} />
      ) : (
        <div className="flex flex-col gap-3">
        {missingService && (
          <Text role="alert" size="sm" tone="negative" weight="medium" className="flex items-center gap-1.5">
            <ThemaIcon name="error" size="sm" tone="negative" />
            {t("booking.services.pick")}
          </Text>
        )}
        <div className={cn("grid grid-cols-1 gap-3 rounded-2xl", layout === "wide" && "lg:grid-cols-2", missingService && "outline outline-1 outline-offset-4 outline-destructive")}>
          {visible.map((service) => {
            const isSelected = selected.includes(service.id);
            return (
              <MagicCard
                key={service.id}
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`${service.name} · ${t("booking.services.minutes", { count: service.durationMin })}`}
                isSelected={isSelected}
                onClick={() => dispatch({ type: "toggleService", serviceId: service.id })}
                contentClassName="items-start gap-3 text-left"
              >
                <IconTile size="xl" src={service.imageUrl} icon={<ThemaIcon name="scissors" />} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Text weight="semibold" as="span">
                      {service.name}
                    </Text>
                    {service.popular && <Badge variant="secondary">{t("booking.services.popular")}</Badge>}
                    {service.isCombo && <Badge variant="outline">{t("booking.services.combo")}</Badge>}
                  </span>
                  {service.description && (
                    <Text size="xs" tone="secondary" className="line-clamp-2">
                      {service.description}
                    </Text>
                  )}
                  <Text size="sm" tone="muted" tabular as="span" className="mt-0.5">
                    {t("booking.services.minutes", { count: service.durationMin })} · <span className="font-medium text-text-primary">{t("booking.services.from", { price: fmt.money(fromPrice(service, catalog)) })}</span>
                  </Text>
                </span>
                <SelectMark kind="checkbox" checked={isSelected} />
              </MagicCard>
            );
          })}
        </div>
        </div>
      )}
    </StepLayout>
  );
}
