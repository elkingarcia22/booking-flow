import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { formatPhone } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { InPlaceIdentity } from "../../flow/InPlaceIdentity";
import { PaymentPanel, PayButton } from "../../flow/PaymentPanel";
import { usePaymentController, type PaymentController } from "../../flow/usePaymentController";
import { PickedProducts } from "../../flow/PickedProducts";
import { ProductCatalogDrawer } from "../../flow/ProductCatalogDrawer";
import { StepLayout } from "../../flow/StepLayout";
import { useAsideFooter } from "../../flow/asideSlot";

/** Una parte del cierre: número, título y lo que va dentro. */
export function CheckoutSection({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Text as="span" size="xs" weight="semibold" tone="primary" tabular>
            {index}
          </Text>
        </span>
        <Heading level={6}>{title}</Heading>
      </div>
      {children}
    </section>
  );
}

/** Quién reserva, ya verificado: su nombre y su celular, con «No soy yo» que no toca las citas. */
function WhoBooks() {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  // El código se resuelve aquí mismo: la reserva no pasa a la pantalla «Escribe el código».
  if (!state.customer || !state.verified) return <InPlaceIdentity />;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <IconTile size="md" shape="circle" tone="positive" icon={<ThemaIcon name="check" />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="sm" weight="semibold" truncate>
          {state.customer.name}
        </Text>
        <Text size="xs" tone="muted" tabular>
          {formatPhone(state.customer.phone)}
        </Text>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "signOut" })}>
        {t("booking.agenda.checkout.notYou")}
      </Button>
    </div>
  );
}

/** Lo que se lleva de la tienda; la nota y la foto para el barbero se piden al confirmar. */
function Extras() {
  const t = useAppT();
  const { catalog } = useBookingFlow();
  const [isCatalogOpen, setIsCatalogOpen] = React.useState(false);
  const products = catalog?.products ?? [];
  return (
    <div className="flex flex-col gap-4">
      {products.length > 0 && (
        <div className="flex flex-col gap-3">
          <PickedProducts products={products} />
          <Button type="button" variant="outline" onClick={() => setIsCatalogOpen(true)}>
            <ThemaIcon name="plus" />
            {t("booking.agenda.checkout.addProducts", { count: products.length })}
          </Button>
          <ProductCatalogDrawer open={isCatalogOpen} onOpenChange={setIsCatalogOpen} />
        </div>
      )}
    </div>
  );
}

interface CheckoutProps {
  onBack: () => void;
  /** En celular la lista de citas va aquí; en monitor ya está en la columna. */
  showAppointments: React.ReactNode;
}

function CheckoutBody({ payment, showAppointments }: { payment: PaymentController | null; showAppointments: React.ReactNode }) {
  const t = useAppT();
  const { layout } = useBookingFlow();
  let index = 0;
  const next = () => ++index;
  return (
    <>
      <CheckoutSection index={next()} title={t("booking.agenda.checkout.who")}>
        <WhoBooks />
      </CheckoutSection>
      {showAppointments && (
        <CheckoutSection index={next()} title={t("booking.agenda.checkout.appointments")}>
          {showAppointments}
        </CheckoutSection>
      )}
      <CheckoutSection index={next()} title={t("booking.agenda.checkout.extras")}>
        <Extras />
      </CheckoutSection>
      <CheckoutSection index={next()} title={t("booking.agenda.checkout.pay")}>
        {payment ? (
          <div className="flex flex-col gap-6">
            <PaymentPanel payment={payment} showOrder={layout !== "wide"} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
            <IconTile size="md" shape="circle" tone="neutral" icon={<ThemaIcon name="lock" />} />
            <Text size="sm" tone="muted">
              {t("booking.agenda.checkout.signInFirst")}
            </Text>
          </div>
        )}
      </CheckoutSection>
    </>
  );
}

export function CheckoutFooter({ payment }: { payment: PaymentController | null }) {
  const t = useAppT();
  return (
    <div className="flex flex-col gap-2">
      {payment ? (
        <PayButton payment={payment} />
      ) : (
        <Button type="button" size="lg" className="w-full" disabled>
          <ThemaIcon name="lock" />
          {t("booking.agenda.checkout.payLocked")}
        </Button>
      )}
      <Text size="xs" tone="muted" className="text-center">
        {t("booking.payment.policyAccept")}
      </Text>
    </div>
  );
}

/** El cierre con cliente ya verificado: aquí se monta el cobro (sus tarjetas guardadas, su saldo). */
function IdentifiedCheckout({ onBack, showAppointments }: CheckoutProps) {
  const t = useAppT();
  const payment = usePaymentController();
  const { footer, portal } = useAsideFooter(<CheckoutFooter payment={payment} />);
  return (
    <StepLayout title={t("booking.agenda.checkout.title")} lead={t("booking.agenda.checkout.lead")} aside={<BackButton onBack={onBack} />} footer={footer}>
      <CheckoutBody payment={payment} showAppointments={showAppointments} />
      {portal}
    </StepLayout>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  const t = useAppT();
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onBack}>
      <ThemaIcon name="arrowLeft" />
      {t("booking.agenda.checkout.back")}
    </Button>
  );
}

/**
 * Confirmar y pagar, todo en una página: quién reserva (el celular se pide solo
 * ahora, cuando ya tiene su hora), lo que va para el barbero y la tienda, y el
 * cobro. El cobro aparece en cuanto se sabe quién es, con sus beneficios.
 */
export function AgendaCheckout({ onBack, showAppointments }: CheckoutProps) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const { footer, portal } = useAsideFooter(<CheckoutFooter payment={null} />, { asideOnly: true });
  if (state.customer) return <IdentifiedCheckout key={state.customer.id} onBack={onBack} showAppointments={showAppointments} />;
  return (
    <StepLayout title={t("booking.agenda.checkout.title")} lead={t("booking.agenda.checkout.lead")} aside={<BackButton onBack={onBack} />} footer={footer}>
      <CheckoutBody payment={null} showAppointments={showAppointments} />
      {portal}
    </StepLayout>
  );
}
