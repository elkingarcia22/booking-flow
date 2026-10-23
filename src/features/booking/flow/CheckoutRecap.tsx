import * as React from "react";
import { useAppT, type AppMessageKey } from "@/app/i18n";
import { Text } from "@/components/typography";
import { ThemaIcon, type IconName } from "@/icons";
import { draftOrderLines } from "../useBookingTotals";
import type { PayMethod } from "../types";
import { useBookingFlow } from "./BookingContext";
import { OrderSummary } from "./OrderSummary";

const METHOD_LABEL: Record<PayMethod, { label: AppMessageKey; icon: IconName }> = {
  card: { label: "booking.payment.card", icon: "lock" },
  wallet: { label: "booking.payment.wallet", icon: "phone" },
  shop: { label: "booking.payment.shop", icon: "building" },
  credit: { label: "booking.payment.credit", icon: "ticket" },
  gift: { label: "booking.gift.line", icon: "ticket" },
  pse: { label: "booking.payment.pse", icon: "building" },
  nequi: { label: "booking.payment.nequi", icon: "phone" },
};

/** En el cierre, los productos que se lleva: junto a la cita, en la parte de arriba del panel. */
export function CheckoutProducts() {
  const t = useAppT();
  const { state, catalog, fmt } = useBookingFlow();
  const products = draftOrderLines(state, catalog, () => "").filter((line) => state.products[line.id] !== undefined);
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="cart-products" className="flex flex-col gap-2 border-t border-border pt-3">
      <Text id="cart-products" size="xs" weight="semibold" tone="muted" className="uppercase tracking-wide">
        {t("booking.agenda.checkout.products")}
      </Text>
      <ul className="flex flex-col gap-1.5">
        {products.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3">
            <Text size="sm" truncate>
              {line.label}
            </Text>
            <Text size="sm" tabular>
              {fmt.money(line.amount)}
            </Text>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * En el cierre, junto al botón: la cuenta (que se recoge y se despliega) y cómo se paga, para
 * revisarlo todo sin volver a bajar.
 */
export function CheckoutSummary({ showMethod = true }: { /** La forma de pago solo se muestra al pagar. */ showMethod?: boolean }) {
  const t = useAppT();
  const { state, totals, fmt } = useBookingFlow();
  const [isOpen, setIsOpen] = React.useState<boolean | null>(null);
  // Empieza recogida (solo el total); se despliega con un toque.
  const isExpanded = isOpen ?? false;
  const coveredByGift = totals.total === 0 && totals.gift > 0;
  const method = coveredByGift ? METHOD_LABEL.gift : state.method ? METHOD_LABEL[state.method] : null;
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls="cart-order-detail"
          onClick={() => setIsOpen(!isExpanded)}
          className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-0.5 text-left outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Text as="span" size="sm" weight="semibold" className="flex-1">
            {t("booking.payment.order")}
          </Text>
          {!isExpanded && (
            <Text as="span" size="sm" weight="semibold" tabular>
              {fmt.money(totals.total)}
            </Text>
          )}
          <ThemaIcon name={isExpanded ? "chevronUp" : "chevronDown"} size="sm" tone="muted" />
        </button>
        {isExpanded && (
          <div id="cart-order-detail">
            <OrderSummary totals={totals} money={fmt.money} promoCode={state.promo?.code} />
          </div>
        )}
      </section>
      {showMethod && (
      <section aria-labelledby="cart-method" className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
        <ThemaIcon name={method?.icon ?? "lock"} size="sm" tone={method ? "primary" : "muted"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Text id="cart-method" size="xs" tone="muted">
            {t("booking.payment.method")}
          </Text>
          <Text size="sm" weight={method ? "medium" : undefined} tone={method ? "default" : "muted"} truncate>
            {method ? t(method.label) : t("booking.agenda.cart.methodPending")}
          </Text>
        </div>
        {/* La tarjeta va al lado, alineada a la derecha: hay ancho de sobra. */}
        {state.method === "card" && !coveredByGift && (
          <Text size="sm" tone={state.payCard ? "secondary" : "muted"} tabular className="shrink-0 text-right">
            {state.payCard ?? t("booking.agenda.cart.cardPending")}
          </Text>
        )}
      </section>
      )}
    </div>
  );
}


/**
 * Mientras se arma la primera cita (aún sin hora) no hay cuenta que desplegar: «Tu orden» muestra
 * lo que va costando, para que el total no desaparezca entre pasos.
 */
export function OrderEstimate({ amount }: { amount: number }) {
  const t = useAppT();
  const { fmt } = useBookingFlow();
  return (
    <div className="flex items-center gap-2">
      <Text as="span" size="sm" weight="semibold" className="flex-1">
        {t("booking.payment.order")}
      </Text>
      <Text as="span" size="sm" weight="semibold" tabular>
        {fmt.money(amount)}
      </Text>
    </div>
  );
}
