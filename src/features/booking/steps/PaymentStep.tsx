import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { PaymentPanel, PayButton } from "../flow/PaymentPanel";
import { PayIdentity } from "../flow/PayIdentity";
import { usePaymentController } from "../flow/usePaymentController";
import { useBookingFlow } from "../flow/BookingContext";
import { StepLayout } from "../flow/StepLayout";

/**
 * Pagar: la propina para el barbero, un cupón y cómo se paga. Si la barbería
 * deja pagar en el local, esa opción está; si el cliente es «solo en línea»,
 * no. El botón dice exactamente lo que va a pasar («Pagar $64»).
 *
 * La portada solo pide el celular (al cliente de siempre lo reconoce sin código):
 * aquí, antes de cobrar, va el código que confirma que es suyo (y la ficha si es
 * la primera vez). Al verificarlo se monta el pago con sus tarjetas y su membresía.
 */
export function PaymentStep() {
  const t = useAppT();
  const { state } = useBookingFlow();
  // Se paga a su nombre solo con el código confirmado y su ficha.
  if (!state.verified || !state.customer) {
    return (
      <StepLayout title={t(state.verified ? "booking.payIdentity.newTitle" : "booking.payIdentity.title")} lead={t(state.verified ? "booking.payIdentity.newLead" : "booking.payIdentity.lead")}>
        <PayIdentity />
      </StepLayout>
    );
  }
  return <IdentifiedPayment key={state.customer.id} />;
}

function IdentifiedPayment() {
  const t = useAppT();
  const payment = usePaymentController();
  const { layout, state, dispatch } = useBookingFlow();

  return (
    <StepLayout
      title={t("booking.payment.title")}
      lead={t("booking.payment.lead")}
      footer={
        <div className="flex flex-col gap-2">
          <PayButton payment={payment} />
          <Text size="xs" tone="muted" className="text-center">
            {t("booking.payment.policyAccept")}
          </Text>
        </div>
      }
    >
      {/* En monitor la cuenta se ve en el resumen de la derecha. */}
      <PaymentPanel
        payment={payment}
        showOrder={layout !== "wide"}
        // Con una cita se vuelve a su hora; con varias, al resumen para elegir cuál.
        onChangeTime={() => dispatch(state.items.length > 1 ? { type: "goTo", step: "review" } : { type: "reopenLast" })}
      />
    </StepLayout>
  );
}
