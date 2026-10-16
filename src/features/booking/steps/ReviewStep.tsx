import * as React from "react";
import { toast } from "../flow/bookingToast";
import { useAppT } from "@/app/i18n";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Heading, Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { personName, type DraftItem } from "../bookingState";
import { parseStart } from "../bookingFormat";
import { renderPolicy } from "../pricing";
import { AppointmentCard } from "../flow/AppointmentCard";
import { useBookingFlow } from "../flow/BookingContext";
import { BranchChange } from "../flow/BranchChange";
import { ProductCard } from "../flow/ProductCard";
import { PickedProducts } from "../flow/PickedProducts";
import { ProductCatalogDrawer } from "../flow/ProductCatalogDrawer";
import { PersonSheet } from "../flow/PersonPicker";
import { AddCard } from "../flow/AddCard";
import { VisitGroup } from "../flow/VisitGroup";
import { StepLayout } from "../flow/StepLayout";
import { itemDuration, itemPrice } from "../useBookingTotals";
import { cartGroups } from "../visit";

/**
 * El carrito: cada cita en su tarjeta (con cambiar y quitar), sumar otra
 * —para la misma persona otro día o para alguien que viene con ella—, lo que
 * se lleva de la tienda. La nota y la foto para el barbero se piden al confirmar. El total se ve siempre.
 */
export function ReviewStep() {
  const t = useAppT();
  const { state, dispatch, catalog, shop, fmt, totals, layout } = useBookingFlow();
  const [isCatalogOpen, setIsCatalogOpen] = React.useState(false);
  // Para quién es cada cita: se cambia aquí, con la misma hoja de «¿Para quién más?».
  const [personFor, setPersonFor] = React.useState<number | null>(null);
  const personItem = personFor === null ? null : (state.items[personFor] ?? null);
  const products = catalog?.products ?? [];
  // Lo que ya va en el pedido sale del carrusel: se ve y se ajusta en «En tu pedido», no dos veces.
  const remaining = products.filter((product) => (state.products[product.id] ?? 0) === 0);
  const pickedCount = Object.values(state.products).reduce((sum, qty) => sum + qty, 0);

  const remove = (index: number) => {
    const item = state.items[index];
    if (!item) return;
    dispatch({ type: "removeItem", index });
    toast(t("booking.review.removed"), { action: { label: t("booking.review.undo"), onClick: () => dispatch({ type: "restoreItem", index, item }) } });
  };

  const cardFor = (item: DraftItem, index: number) => {
    const barber = catalog?.barbers.find((entry) => entry.id === item.barberId);
    const relation = item.person.kind === "self" ? null : item.person.relation;
    return (
      <AppointmentCard
        key={item.key}
        data={{
          personName: personName(item.person, state.customer),
          relation,
          services: item.serviceIds.map((id) => catalog?.services.find((service) => service.id === id)?.name ?? id),
          barberName: barber?.name ?? t("booking.review.noPreference"),
          barberAvatarUrl: barber?.avatarUrl,
          day: item.start ? fmt.day(parseStart(item.start)) : "",
          time: item.start ? fmt.time(parseStart(item.start)) : "",
          duration: t("booking.review.minutes", { count: itemDuration(item.serviceIds, catalog) }),
          price: fmt.money(itemPrice(item, catalog)),
        }}
        // Un servicio de la cita puede ir aparte: con otro barbero u otra hora, como otra parte de la visita.
        onSplitService={(position) => dispatch({ type: "splitService", index, serviceId: item.serviceIds[position] })}
        personAction={
          // En celular solo el icono: con «Otra persona» al lado el nombre no cabía.
          <Button
            type="button"
            variant="ghost"
            size={layout === "wide" ? "sm" : "icon-sm"}
            className={layout === "wide" ? "h-7 px-2 text-primary" : "text-primary"}
            onClick={() => setPersonFor(index)}
            aria-label={t("booking.person.change")}
          >
            <ThemaIcon name={item.person.kind === "self" ? "userAdd" : "edit"} />
            {layout === "wide" && t("booking.person.change")}
          </Button>
        }
        actions={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "editItem", index })}>
              <ThemaIcon name="edit" />
              {t("booking.review.edit")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={t("booking.review.remove")}>
              <ThemaIcon name="close" />
              {layout === "wide" && t("booking.review.remove")}
            </Button>
          </>
        }
      />
    );
  };

  if (state.items.length === 0) {
    return (
      <StepLayout title={t("booking.review.title")}>
        <EmptyState
          icon="calendar"
          title={t("booking.review.emptyTitle")}
          description={t("booking.review.emptyLead")}
          action={
            <Button type="button" onClick={() => dispatch({ type: "addAnother", person: { kind: "self" } })}>
              {t("booking.review.start")}
            </Button>
          }
        />
      </StepLayout>
    );
  }

  return (
    <StepLayout
      title={t("booking.review.title")}
      lead={t("booking.review.lead")}
      footer={
        <div className="flex items-center gap-3">
          {/* En monitor el total ya está en el resumen de la derecha, junto a este botón. */}
          {layout !== "wide" && (
            <div className="flex min-w-0 flex-1 flex-col">
              <Text size="xs" tone="muted">
                {t("booking.payment.total")}
              </Text>
              <Text size="lg" weight="semibold" tabular>
                {fmt.money(totals.total)}
              </Text>
            </div>
          )}
          <Button type="button" size="lg" className={layout === "wide" ? "w-full" : undefined} onClick={() => dispatch({ type: "goTo", step: "payment" })}>
            {t("booking.review.continue")}
            <ThemaIcon name="arrowRight" />
          </Button>
        </div>
      }
    >
      <BranchChange />

      <div className="flex flex-col gap-3">
        {cartGroups(state.items).map((group) =>
          group.kind === "single" ? (
            cardFor(group.item, group.index)
          ) : (
            <VisitGroup key={group.visitId} parts={group.parts.length} onJoin={() => dispatch({ type: "joinVisit", visitId: group.visitId })}>
              {group.parts.map((part) => cardFor(part.item, part.index))}
            </VisitGroup>
          )
        )}
        {/* La misma tarjeta que en la Agenda. */}
        <AddCard title={t("booking.review.addAnother")} hint={t("booking.review.addAnotherHint")} onClick={() => dispatch({ type: "addAnother", person: { kind: "self" } })} />
      </div>

      {products.length > 0 && (
        <section aria-labelledby="products-title" className="flex flex-col gap-3">
          {/* Todo va dentro del carrusel para que las flechas, arriba junto al título, lo muevan. */}
          <Carousel opts={{ align: "start", dragFree: true }}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Heading level={5} id="products-title">
                  {t("booking.review.productsTitle")}
                </Heading>
                <Text size="sm" tone="secondary">
                  {t("booking.review.productsLead")}
                </Text>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {remaining.length > 0 && (
                  <>
                    <CarouselPrevious className="static translate-y-0" aria-label={t("booking.review.carouselPrev")} />
                    <CarouselNext className="static translate-y-0" aria-label={t("booking.review.carouselNext")} />
                  </>
                )}
              </div>
            </div>
            {/* En monitor lo elegido se ve y se ajusta en el resumen de la derecha. */}
            {layout !== "wide" && <PickedProducts products={products} />}
            <CarouselContent className={cn("-ml-3", layout !== "wide" && pickedCount > 0 && remaining.length > 0 && "mt-3")}>
              {remaining.map((product) => (
                <CarouselItem key={product.id} className={cn("basis-[45%] pl-3", layout === "wide" && "basis-1/3")}>
                  <ProductCard product={product} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <Button type="button" variant="outline" className="w-full" onClick={() => setIsCatalogOpen(true)}>
            <ThemaIcon name="layers" />
            {t("booking.review.seeAll", { count: products.length })}
          </Button>
          <ProductCatalogDrawer open={isCatalogOpen} onOpenChange={setIsCatalogOpen} />
        </section>
      )}

      <Collapsible className="rounded-2xl border border-border bg-surface-subtle">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <ThemaIcon name="info" size="sm" />
              {t("booking.review.policy")}
            </span>
            <ThemaIcon name="chevronDown" size="sm" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <Text size="sm" tone="secondary" className="whitespace-pre-line">
            {renderPolicy(shop.policy, shop)}
          </Text>
        </CollapsibleContent>
      </Collapsible>
      {personItem && (
        <PersonSheet open onOpenChange={(open) => !open && setPersonFor(null)} person={personItem.person} onChoose={(person) => dispatch({ type: "setItemPerson", key: personItem.key, person })} />
      )}
    </StepLayout>
  );
}
