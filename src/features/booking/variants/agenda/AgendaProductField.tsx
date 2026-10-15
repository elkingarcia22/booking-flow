import * as React from "react";
import { useAppT } from "@/app/i18n";
import { NumberField } from "@/components/forms";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ActionTile, IconTile } from "@/components/utility";
import { ThemaIcon } from "@/icons";
import { useBookingFlow } from "../../flow/BookingContext";
import type { BookingProduct } from "../../types";
import { PickerOverlay, PickerRow } from "./AgendaPicker";

const MAX_QTY = 9;
/** Cuántos nombres caben en el campo antes de resumir con «y N más». */
const NAMES_SHOWN = 2;

type Picks = Readonly<Record<string, number>>;

/**
 * Lo que se lleva de la tienda en la Agenda: el mismo campo y la
 * misma ventana que los servicios. Se marca lo que quiere, con su cantidad en la
 * misma fila, y se aplica con «Agregar»; cerrar sin aplicar no cambia nada.
 */
export function AgendaProductField({ labelledBy }: { labelledBy: string }) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt } = useBookingFlow();
  const [open, setOpen] = React.useState(false);
  const [picks, setPicks] = React.useState<Picks>(state.products);
  const listRef = React.useRef<HTMLDivElement>(null);
  const hintId = React.useId();
  const products = catalog?.products ?? [];
  if (products.length === 0) return null;

  const categoryOf = (product: BookingProduct) => product.category || t("booking.products.other");
  const groups = [...new Set(products.map(categoryOf))].map((category) => ({ category, items: products.filter((product) => categoryOf(product) === category) }));
  const chosen = products.filter((product) => (state.products[product.id] ?? 0) > 0);
  const amountOf = (source: Picks) => products.reduce((sum, product) => sum + product.price * (source[product.id] ?? 0), 0);
  const countOf = (source: Picks) => Object.values(source).reduce((sum, qty) => sum + qty, 0);
  const label = (product: BookingProduct) => {
    const qty = state.products[product.id] ?? 0;
    return qty > 1 ? `${product.name} ×${qty}` : product.name;
  };
  const names = chosen.length > NAMES_SHOWN ? t("booking.agenda.whatMore", { names: chosen.slice(0, NAMES_SHOWN - 1).map(label).join(" + "), count: chosen.length - (NAMES_SHOWN - 1) }) : chosen.map(label).join(" + ");

  const openPicker = () => {
    setPicks(state.products);
    setOpen(true);
  };
  const setQty = (productId: string, qty: number) =>
    setPicks((current) => {
      const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== productId));
      return qty > 0 ? { ...rest, [productId]: Math.min(MAX_QTY, qty) } : rest;
    });
  const apply = () => {
    const ids = new Set([...Object.keys(state.products), ...Object.keys(picks)]);
    ids.forEach((productId) => {
      const qty = picks[productId] ?? 0;
      if (qty !== (state.products[productId] ?? 0)) dispatch({ type: "setProduct", productId, qty });
    });
    setOpen(false);
  };

  const count = countOf(picks);
  const footer = (
    <div className="flex w-full items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col" aria-live="polite">
        {count > 0 ? (
          <>
            <Text size="xs" tone="muted">
              {t("booking.agenda.productsCount", { count })}
            </Text>
            <Text weight="semibold" tabular>
              {fmt.money(amountOf(picks))}
            </Text>
          </>
        ) : (
          <Text size="sm" tone="muted">
            {t("booking.agenda.productsNone")}
          </Text>
        )}
      </div>
      <Button type="button" size="lg" onClick={apply} data-testid="agenda-products-apply">
        {count > 0 || chosen.length > 0 ? t("booking.agenda.productsApply") : t("common.close")}
      </Button>
    </div>
  );

  return (
    <>
      {/* Igual que «Agregar otra cita»: algo que se suma, no un dato que falte. */}
      <ActionTile
        tone="accent"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        aria-describedby={hintId}
        onClick={openPicker}
        data-testid="agenda-products-field"
        leading={<IconTile size="md" src={chosen[0]?.imageUrl} icon={<ThemaIcon name={chosen.length > 0 ? "layers" : "plus"} />} />}
        title={<span className="block truncate">{chosen.length > 0 ? names : t("booking.agenda.productsAdd")}</span>}
        description={
          <span id={hintId} className="block truncate tabular-nums">
            {chosen.length > 0 ? fmt.money(amountOf(state.products)) : t("booking.agenda.productsHint", { count: products.length })}
          </span>
        }
      />
      <PickerOverlay open={open} onOpenChange={setOpen} title={t("booking.agenda.productsTitle")} description={t("booking.agenda.productsLead")} footer={footer} focusRef={listRef}>
        {/* Por categoría, como la carta de servicios: el título de cada grupo y sus productos debajo. */}
        <div ref={listRef} className="flex flex-col gap-4 px-2 pb-3 pt-1">
          {groups.map((group) => (
            <section key={group.category} aria-label={group.category} className="flex flex-col gap-0.5">
              {groups.length > 1 && (
                <Text as="h3" size="xs" weight="medium" tone="muted" className="px-2 pb-1 pt-2 uppercase tracking-wide">
                  {group.category}
                </Text>
              )}
              {group.items.map((product) => {
                const qty = picks[product.id] ?? 0;
                return (
                  <PickerRow
                    key={product.id}
                    role="checkbox"
                    checked={qty > 0}
                    label={`${product.name} · ${fmt.money(product.price)}`}
                    imageUrl={product.imageUrl}
                    icon="layers"
                    onClick={() => setQty(product.id, qty > 0 ? 0 : 1)}
                    below={
                      qty > 0 ? (
                        <NumberField size="sm" stepper="sides" min={0} max={MAX_QTY} value={qty} onValueChange={(value) => setQty(product.id, value ?? 0)} aria-label={t("booking.agenda.productsQty", { name: product.name })} className="w-28" />
                      ) : undefined
                    }
                  >
                    <Text as="span" weight="medium" className="truncate">
                      {product.name}
                    </Text>
                    {product.description && (
                      <Text as="span" size="xs" tone="muted" className="line-clamp-1">
                        {product.description}
                      </Text>
                    )}
                    <Text as="span" size="xs" weight="medium" tabular>
                      {fmt.money(product.price)}
                    </Text>
                  </PickerRow>
                );
              })}
            </section>
          ))}
        </div>
      </PickerOverlay>
    </>
  );
}
