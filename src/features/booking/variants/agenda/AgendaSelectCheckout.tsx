import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { toast } from "../../flow/bookingToast";
import { type DraftItem } from "../../bookingState";
import { formatPhone, parseStart } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { BookingSheet } from "../../flow/BookingSheet";
import { PersonSheet } from "../../flow/PersonPicker";
import { PaymentPanel } from "../../flow/PaymentPanel";
import { StepLayout } from "../../flow/StepLayout";
import { useAsideFooter } from "../../flow/asideSlot";
import { usePaymentController, type PaymentController } from "../../flow/usePaymentController";
import { itemPrice } from "../../useBookingTotals";
import { CheckoutFooter, CheckoutSection } from "./AgendaCheckout";
import { AgendaIdentity, ProfileForm } from "./AgendaIdentity";
import { AgendaProductField } from "./AgendaProductField";
import { AddCard } from "../../flow/AddCard";

/** La cita en una tarjeta: qué, cuándo, con quién y dónde, con su precio; y a nombre de quién va. */
function AppointmentCard({ item }: { item: DraftItem }) {
  const t = useAppT();
  const { state, dispatch, shop, catalog, fmt } = useBookingFlow();
  const services = item.serviceIds.map((id) => catalog?.services.find((service) => service.id === id)).filter((service) => service !== undefined);
  const barber = catalog?.barbers.find((entry) => entry.id === item.barberId);
  const branch = shop.branches.find((entry) => entry.id === state.branchId);
  const forOther = item.person.kind !== "self";
  const [isPersonOpen, setIsPersonOpen] = React.useState(false);
  const remove = () => {
    const index = state.items.findIndex((entry) => entry.key === item.key);
    if (index < 0) return;
    dispatch({ type: "removeItem", index });
    toast(t("booking.review.removed"), { action: { label: t("booking.review.undo"), onClick: () => dispatch({ type: "restoreItem", index, item }) } });
  };
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface">
      <div className="flex items-start gap-3 p-3">
        <IconTile size="lg" src={services[0]?.imageUrl} icon={<ThemaIcon name="scissors" />} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text weight="semibold" className="truncate">
            {services.map((service) => service.name).join(" + ")}
          </Text>
          {item.start && (
            <Text size="sm" tabular className="first-letter:uppercase">
              {fmt.when(parseStart(item.start))}
            </Text>
          )}
          <Text size="xs" tone="muted" className="truncate">
            {[barber?.name ?? t("booking.review.noPreference"), branch?.name].filter(Boolean).join(" · ")}
          </Text>
        </div>
        <Text weight="semibold" tabular>
          {fmt.money(itemPrice(item, catalog))}
        </Text>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <ThemaIcon name="users" size="sm" tone="muted" />
        <Text size="sm" className="min-w-0 flex-1 truncate">
          {forOther ? t("booking.agenda.checkout.forPerson", { name: item.person.kind === "self" ? "" : item.person.name }) : t("booking.person.self")}
          {forOther && item.person.kind !== "self" && item.person.relation && (
            <Text as="span" size="sm" tone="muted">
              {` · ${item.person.relation}`}
            </Text>
          )}
        </Text>
        <Button type="button" variant="ghost" size="sm" className="-mr-1.5" onClick={() => setIsPersonOpen(true)}>
          {t(forOther ? "booking.person.change" : "booking.person.add")}
        </Button>
        {state.items.length > 1 && (
          <Button type="button" variant="ghost" size="sm" className="-mr-1.5" onClick={remove} aria-label={t("booking.review.remove")}>
            <ThemaIcon name="close" />
          </Button>
        )}
      </div>
      <PersonSheet open={isPersonOpen} onOpenChange={setIsPersonOpen} person={item.person} onChoose={(person) => dispatch({ type: "setItemPerson", key: item.key, person })} />
      {state.customer && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <ThemaIcon name="check" size="sm" tone="positive" />
          <Text size="sm" className="min-w-0 flex-1 truncate">
            {state.customer.name}
            <Text as="span" size="sm" tone="muted" tabular>
              {` · ${formatPhone(state.customer.phone)}`}
            </Text>
          </Text>
          <Button type="button" variant="ghost" size="sm" className="-mr-1.5" onClick={() => dispatch({ type: "signOut" })}>
            {t("booking.agenda.checkout.notYou")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Los productos; la nota y la foto para el barbero se piden ya confirmada la cita. */
function Extras() {
  const t = useAppT();
  return (
    <>
      <span id="checkout-products" className="sr-only">
        {t("booking.agenda.checkout.products")}
      </span>
      <AgendaProductField labelledBy="checkout-products" />
    </>
  );
}

/**
 * Cliente nuevo (ya verificó su celular): sus datos se piden en una hoja que
 * se abre sola. Si la cierra, el botón la vuelve a abrir.
 */
function NewCustomerDetails() {
  const t = useAppT();
  const [isOpen, setIsOpen] = React.useState(true);
  return (
    <>
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-3">
        <Text size="sm" tone="secondary">
          {t("booking.agenda.id.newLead")}
        </Text>
        <Button type="button" onClick={() => setIsOpen(true)}>
          <ThemaIcon name="edit" />
          {t("booking.agenda.id.completeCta")}
        </Button>
      </div>
      <BookingSheet open={isOpen} onOpenChange={setIsOpen} title={t("booking.profile.title")} description={t("booking.profile.lead")}>
        <ProfileForm />
      </BookingSheet>
    </>
  );
}

/** «Agregar otra cita»: la misma tarjeta que en Paso a paso y que «Agregar productos». */
function AddAnotherCard({ onClick }: { onClick: () => void }) {
  const t = useAppT();
  return <AddCard title={t("booking.review.addAnother")} hint={t("booking.review.addAnotherHint")} onClick={onClick} />;
}

/** El pie de «Confirma tu cita» ya identificado: seguir al pago. */
function ContinueFooter({ onContinue }: { onContinue: () => void }) {
  const t = useAppT();
  return (
    <Button type="button" size="lg" className="w-full" onClick={onContinue}>
      {t("booking.agenda.checkout.continue")}
      <ThemaIcon name="arrowRight" />
    </Button>
  );
}

interface ReviewProps {
  /** Seguir a la pantalla de pago. */
  onContinue: () => void;
  /** Volver a la agenda a elegir otra hora, sin soltar las de ahora. */
  onAddAnother: () => void;
}

/**
 * «Confirma tu cita» en la Agenda con selector: solo lo de la cita. Las citas
 * en sus tarjetas (con a nombre de quién), sumar otra, los productos y, si aún no
 * ingresó, quién es: al identificarse pasa solo al pago (`AgendaSelectPay`).
 */
export function AgendaSelectCheckout({ onContinue, onAddAnother }: ReviewProps) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const isSignedIn = Boolean(state.customer);
  // Sin identificarse, el único botón principal es el de «Tus datos» (enviar el código): el de seguir no se
  // muestra bloqueado al lado. Al identificarse pasa solo al pago; el botón queda para volver a él.
  const { footer, portal } = useAsideFooter(isSignedIn ? <ContinueFooter onContinue={onContinue} /> : null);
  // Se identificó aquí (cliente de siempre, o nuevo al crear su ficha): sigue solo al pago.
  const wasSignedIn = React.useRef(isSignedIn);
  React.useEffect(() => {
    if (isSignedIn && !wasSignedIn.current) onContinue();
    wasSignedIn.current = isSignedIn;
  }, [isSignedIn, onContinue]);
  let index = 0;
  const next = () => ++index;
  return (
    <StepLayout title={t("booking.agenda.checkout.title")} lead={t("booking.agenda.checkout.selectLead")} footer={footer}>
      <CheckoutSection index={next()} title={t(state.items.length > 1 ? "booking.agenda.checkout.appointments" : "booking.agenda.checkout.yourAppointment")}>
        {state.items.map((item) => (
          <AppointmentCard key={item.key} item={item} />
        ))}
        <AddAnotherCard onClick={onAddAnother} />
      </CheckoutSection>
      {/* Los productos antes de quién eres: al identificarse ya pasa directo al pago. */}
      <CheckoutSection index={next()} title={t("booking.agenda.checkout.products")}>
        <Extras />
      </CheckoutSection>
      {!isSignedIn && (
        <CheckoutSection index={next()} title={t("booking.agenda.checkout.yourDetails")}>
          {state.token ? <NewCustomerDetails /> : <AgendaIdentity />}
        </CheckoutSection>
      )}
      {portal}
    </StepLayout>
  );
}

function PayBody({ payment, onChangeTime }: { payment: PaymentController; onChangeTime?: () => void }) {
  const { layout } = useBookingFlow();
  const { footer, portal } = useAsideFooter(<CheckoutFooter payment={payment} />);
  const t = useAppT();
  return (
    <StepLayout title={t("booking.agenda.pay.title")} lead={t("booking.agenda.pay.lead")} footer={footer}>
      <PaymentPanel payment={payment} compact showOrder={layout !== "wide"} onChangeTime={onChangeTime} />
      {portal}
    </StepLayout>
  );
}

/**
 * «Pago» en la Agenda con selector: solo cómo se paga (propina, descuentos,
 * método y tarjeta) y el botón que cobra. Aquí ya se sabe quién es: sin cuenta
 * se vuelve a «Confirma tu cita».
 */
export function AgendaSelectPay({ onChangeTime }: { onChangeTime?: () => void }) {
  const { state } = useBookingFlow();
  if (!state.customer) return null;
  return <IdentifiedPay key={state.customer.id} onChangeTime={onChangeTime} />;
}

function IdentifiedPay({ onChangeTime }: { onChangeTime?: () => void }) {
  const payment = usePaymentController();
  return <PayBody payment={payment} onChangeTime={onChangeTime} />;
}
