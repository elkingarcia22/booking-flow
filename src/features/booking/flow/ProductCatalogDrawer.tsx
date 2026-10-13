import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Chip } from "@/components/ai-interaction";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Heading, Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemaIcon } from "@/icons";
import { useBookingFlow } from "./BookingContext";
import { BookingOverlay } from "./BookingOverlay";
import { ProductCard } from "./ProductCard";

const ALL = "__all__";
const plain = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface ProductCatalogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Toda la tienda de la sede, ordenada como en el módulo de Productos: por
 * categoría (Styling, Barba, Cuidado…), con buscador y filtro. Lo que se
 * suma aquí queda en la misma reserva que el carrusel del resumen.
 */
export function ProductCatalogDrawer({ open, onOpenChange }: ProductCatalogDrawerProps) {
  const t = useAppT();
  const { catalog, state, fmt, layout } = useBookingFlow();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  const products = catalog?.products ?? [];
  const categories = [...new Set(products.map((product) => product.category || t("booking.products.other")))];
  const visible = products.filter(
    (product) =>
      (category === ALL || (product.category || t("booking.products.other")) === category) &&
      (query.trim() === "" || plain(`${product.name} ${product.description} ${product.category}`).includes(plain(query.trim())))
  );
  const groups = categories
    .map((name) => ({ name, items: visible.filter((product) => (product.category || t("booking.products.other")) === name) }))
    .filter((group) => group.items.length > 0);
  const picked = Object.entries(state.products);
  const count = picked.reduce((sum, [, qty]) => sum + qty, 0);
  const amount = picked.reduce((sum, [id, qty]) => sum + (products.find((product) => product.id === id)?.price ?? 0) * qty, 0);

  return (
    <BookingOverlay
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t("booking.products.title")}
      description={t("booking.products.lead", { count: products.length })}
      footer={
        <div className="flex w-full items-center gap-3 border-t border-border px-5 py-4">
          <Text size="sm" tone="secondary" className="flex-1" tabular>
            {count > 0 ? t("booking.products.selected", { count, amount: fmt.money(amount) }) : t("booking.products.none")}
          </Text>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("booking.products.done")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <ThemaIcon name="search" size="sm" tone="muted" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("booking.products.search")} aria-label={t("booking.products.search")} className="pl-9" />
          </div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Chip label={t("booking.services.all")} count={products.length} selected={category === ALL} onClick={() => setCategory(ALL)} />
              {categories.map((name) => (
                <Chip key={name} label={name} count={products.filter((product) => (product.category || t("booking.products.other")) === name).length} selected={category === name} onClick={() => setCategory(name)} />
              ))}
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <EmptyState icon="search" title={t("booking.products.empty")} />
        ) : (
          groups.map((group) => (
            <section key={group.name} aria-label={group.name} className="flex flex-col gap-3">
              <Heading level={6}>
                {group.name}
                <Text as="span" size="sm" tone="muted" weight="normal">
                  {" · "}
                  {group.items.length}
                </Text>
              </Heading>
              <div className={layout === "wide" ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
                {group.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </BookingOverlay>
  );
}
