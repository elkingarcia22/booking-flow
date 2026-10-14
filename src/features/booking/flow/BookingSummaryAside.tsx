import { useAppT } from "@/app/i18n";
import { NumberField } from "@/components/forms";
import { Heading, Text } from "@/components/typography";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { personName } from "../bookingState";
import { parseStart } from "../bookingFormat";
import { draftOrderLines, itemPrice } from "../useBookingTotals";
import { useBookingFlow } from "./BookingContext";
import { CheckoutSummary, OrderEstimate } from "./CheckoutRecap";

/**
 * En monitor, la reserva que se va armando queda a la derecha todo el
 * tiempo: la sede, cada cita y el total. En celular eso vive en el resumen.
 */
export function BookingSummaryAside({
  actionSlotRef,
  draftUntilBooked = false,
  atPayment,
}: {
  /** El hueco al pie para la acción principal del paso (seguir, pagar). */
  actionSlotRef?: (element: HTMLElement | null) => void;
  /** La cita en curso solo hasta apartar la hora (Agenda: hay una sola cita). */
  draftUntilBooked?: boolean;
  /** Si ya se está pagando (muestra cómo se paga). Por defecto, el paso de pago. */
  atPayment?: boolean;
}) {
  const t = useAppT();
  const { state, shop, catalog, fmt } = useBookingFlow();
  const branch = shop.branches.find((item) => item.id === state.branchId);
  const allLines = draftOrderLines(state, catalog, (item) => {
    const barber = catalog?.barbers.find((entry) => entry.id === item.barberId)?.name ?? t("booking.review.noPreference");
    return [personName(item.person, state.customer), barber, item.start ? fmt.when(parseStart(item.start)) : null].filter(Boolean).join(" · ");
  });

  // Los productos se ven y se ajustan aparte, con su cantidad; aquí solo las citas.
  const lines = allLines;
  const appointmentLines = allLines.filter((line) => state.products[line.id] === undefined);
  const canShop = state.step === "review" || (atPayment ?? state.step === "payment");

  const hasLines = lines.length > 0;
  const draftAmount = state.draft && state.draft.serviceIds.length > 0 ? itemPrice(state.draft, catalog) : 0;
  return (
    // Arriba lo elegido (se desplaza si no cabe); abajo, fijo, la cuenta y la acción del paso.
    <aside aria-label={t("booking.step.review")} className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        <Heading level={5}>{t("booking.step.review")}</Heading>
        {branch ? (
          <div className="flex items-center gap-3">
            <IconTile size="lg" src={branch.imageUrl} icon={<ThemaIcon name="building" />} />
            <div className="flex min-w-0 flex-col">
              <Text weight="semibold" truncate>
                {branch.name}
              </Text>
              <Text size="xs" tone="muted" truncate>
                {branch.address}, {branch.city}
              </Text>
            </div>
          </div>
        ) : (
          <Text size="sm" tone="muted">
            {t("booking.branch.lead")}
          </Text>
        )}
        {!(draftUntilBooked && state.items.length > 0) && <DraftPreview />}
        {hasLines ? (
          <>
            <ul className="flex flex-col gap-3">
              {appointmentLines.map((line) => (
                <li key={line.id} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <Text size="sm" weight="medium">
                      {line.label}
                    </Text>
                    {line.detail && (
                      <Text size="xs" tone="muted" className="line-clamp-2">
                        {line.detail}
                      </Text>
                    )}
                  </div>
                  <Text size="sm" tabular>
                    {fmt.money(line.amount)}
                  </Text>
                </li>
              ))}
            </ul>
            {canShop && <AsideProducts />}
          </>
        ) : state.draft ? null : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <ThemaIcon name="calendar" tone="muted" />
            <Text size="sm" tone="muted">
              {t("booking.review.emptyLead")}
            </Text>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-4 border-t border-border px-6 py-4 empty:hidden">
        {/* La cuenta se recoge cuando la ventana es baja. */}
        {hasLines ? <CheckoutSummary showMethod={atPayment ?? state.step === "payment"} /> : draftAmount > 0 && <OrderEstimate amount={draftAmount} />}
        {/* El aviso de llegar antes vive en la confirmación, cuando ya hay hora. */}
        <div ref={actionSlotRef} className="empty:hidden" />
      </div>
    </aside>
  );
}

/** Pasos en los que el barbero ya se decidió: «sin preferencia» solo cuenta desde ahí. */
const AFTER_BARBER = new Set(["time", "review"]);

/**
 * La cita que se está armando, antes de añadirla: cada elección aparece aquí
 * en cuanto se hace —servicios, barbero, hora— y lo que falta se dice en gris.
 */
function DraftPreview() {
  const t = useAppT();
  const { state, catalog, fmt } = useBookingFlow();
  const draft = state.draft;
  if (!draft) return null;
  const services = draft.serviceIds.map((id) => catalog?.services.find((service) => service.id === id)).filter((service) => service !== undefined);
  const barber = catalog?.barbers.find((entry) => entry.id === draft.barberId);
  const barberChosen = draft.barberId !== null || AFTER_BARBER.has(state.step);
  const rows = [
    {
      key: "services",
      icon: "scissors" as const,
      value: services.length > 0 ? services.map((service) => service.name).join(" + ") : null,
      pending: t("booking.summary.pendingServices"),
    },
    {
      key: "barber",
      icon: "users" as const,
      value: barberChosen ? (barber?.name ?? t("booking.review.noPreference")) : null,
      pending: t("booking.summary.pendingBarber"),
    },
    {
      key: "time",
      icon: "clock" as const,
      value: draft.start ? fmt.when(parseStart(draft.start)) : null,
      pending: t("booking.summary.pendingTime"),
    },
  ];
  return (
    <section aria-label={t("booking.summary.inProgress")} className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <Text size="sm" weight="semibold">
          {t("booking.summary.inProgress")}
        </Text>
        {services.length > 0 && (
          <Text size="sm" weight="medium" tabular>
            {fmt.money(itemPrice(draft, catalog))}
          </Text>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start gap-2">
            <ThemaIcon name={row.icon} size="sm" tone={row.value ? "primary" : "muted"} />
            <Text size="sm" tone={row.value ? "default" : "muted"}>
              {row.value ?? row.pending}
            </Text>
          </li>
        ))}
      </ul>
    </section>
  );
}

const MAX_QTY = 9;

/**
 * Los productos de la reserva, en el panel: cada uno con su cantidad (a cero se quita). Se agregan
 * desde el paso de resumen, a la izquierda; aquí solo se ven y se ajustan.
 */
function AsideProducts() {
  const t = useAppT();
  const { state, dispatch, catalog, fmt } = useBookingFlow();
  const products = catalog?.products ?? [];
  const picked = products.filter((product) => (state.products[product.id] ?? 0) > 0);
  if (picked.length === 0) return null;
  return (
    <section aria-labelledby="aside-products" className="flex flex-col gap-2 border-t border-border pt-3">
      <Text id="aside-products" size="xs" weight="semibold" tone="muted" className="uppercase tracking-wide">
        {t("booking.agenda.checkout.products")}
      </Text>
      <ul className="flex flex-col gap-2">
        {picked.map((product) => {
          const qty = state.products[product.id] ?? 0;
          return (
            <li key={product.id} className="flex items-center gap-2.5">
              <IconTile size="sm" src={product.imageUrl} icon={<ThemaIcon name="layers" />} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Text size="sm" weight="medium" truncate>
                  {product.name}
                </Text>
                <Text size="xs" tone="secondary" tabular>
                  {fmt.money(product.price * qty)}
                </Text>
              </div>
              <NumberField
                size="sm"
                stepper="sides"
                min={0}
                max={MAX_QTY}
                value={qty}
                onValueChange={(value) => dispatch({ type: "setProduct", productId: product.id, qty: value ?? 0 })}
                aria-label={product.name}
                className="w-28 shrink-0"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
