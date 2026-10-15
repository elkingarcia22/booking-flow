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
import { PersonSheet } from "../../flow/PersonPicker";
import { PaymentPanel } from "../../flow/PaymentPanel";
import { PayIdentity } from "../../flow/PayIdentity";
import { StepLayout } from "../../flow/StepLayout";
import { useAsideFooter } from "../../flow/asideSlot";
import { usePaymentController, type PaymentController } from "../../flow/usePaymentController";
import { itemPrice } from "../../useBookingTotals";
import { CheckoutFooter, CheckoutSection } from "./AgendaCheckout";
import { AgendaProductField } from "./AgendaProductField";
import { AddCard } from "../../flow/AddCard";
import { VisitGroup } from "../../flow/VisitGroup";
import { cartGroups } from "../../visit";

/** La cita en una tarjeta: qué, cuándo, con quién y dónde, con su precio; y a nombre de quién va. */
function AppointmentCard({ item, onSplit }: { item: DraftItem; /** Saca ese servicio a su propia parte de la visita. */ onSplit: (serviceId: string) => void }) {
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
      {/* Cuándo, con quién y cuánto arriba; con varios servicios, la lista debajo (cada uno con su «Separar»),
          así el precio no compite con los enlaces. */}
      <div className="flex items-start gap-3 p-3">
        <IconTile size="lg" src={services[0]?.imageUrl} icon={<ThemaIcon name="scissors" />} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text weight="semibold" className="truncate">
            {services.length > 1 ? t("booking.agenda.checkout.servicesCount", { count: services.length }) : services[0]?.name}
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
        <Text weight="semibold" tabular className="shrink-0">
          {fmt.money(itemPrice(item, catalog))}
        </Text>
      </div>
      {services.length > 1 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border px-3">
          {services.map((service) => (
            <li key={service.id} className="flex items-center gap-3 py-2">
              <Text size="sm" className="min-w-0 flex-1 truncate">
                {service.name}
              </Text>
              <Text size="xs" tone="muted" tabular className="shrink-0">
                {t("booking.review.minutes", { count: service.durationMin })}
              </Text>
              <Button type="button" variant="link" size="sm" className="h-auto shrink-0 px-0" onClick={() => onSplit(service.id)} aria-label={t("booking.visit.splitAria", { service: service.name })}>
                {t("booking.visit.split")}
              </Button>
            </li>
          ))}
        </ul>
      )}
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

/** «Agregar otra cita»: la misma tarjeta que en Paso a paso y que «Agregar productos». */
function AddAnotherCard({ onClick }: { onClick: () => void }) {
  const t = useAppT();
  return <AddCard title={t("booking.review.addAnother")} hint={t("booking.review.addAnotherHint")} onClick={onClick} />;
}

/** El pie de «Confirma tu cita»: seguir al pago (allí se pide el código). */
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
  /** Separar un servicio de su cita. Sin esto, abre su parte desde el barbero (Según el cliente). */
  onSplit?: (index: number, serviceId: string) => void;
  /** Juntar las partes de una visita. Sin esto, pide la hora en su paso (Según el cliente). */
  onJoin?: (visitId: string) => void;
}

/**
 * «Confirma tu cita» en la Agenda: solo lo de la cita. Las citas en sus tarjetas
 * (con a nombre de quién), sumar otra y los productos. Quién es no se pregunta
 * aquí: el celular ya viene de la portada y el código se pide al pagar
 * (`AgendaSelectPay`), como en Paso a paso.
 */
export function AgendaSelectCheckout({ onContinue, onAddAnother, onSplit, onJoin }: ReviewProps) {
  const t = useAppT();
  const { state, dispatch } = useBookingFlow();
  const split = onSplit ?? ((index: number, serviceId: string) => dispatch({ type: "splitService", index, serviceId }));
  const join = onJoin ?? ((visitId: string) => dispatch({ type: "joinVisit", visitId }));
  const cardFor = (item: DraftItem, index: number) => <AppointmentCard key={item.key} item={item} onSplit={(serviceId) => split(index, serviceId)} />;
  const { footer, portal } = useAsideFooter(<ContinueFooter onContinue={onContinue} />);
  let index = 0;
  const next = () => ++index;
  return (
    <StepLayout title={t("booking.agenda.checkout.title")} lead={t("booking.agenda.checkout.selectLead")} footer={footer}>
      <CheckoutSection index={next()} title={t(state.items.length > 1 ? "booking.agenda.checkout.appointments" : "booking.agenda.checkout.yourAppointment")}>
        {cartGroups(state.items).map((group) =>
          group.kind === "single" ? (
            cardFor(group.item, group.index)
          ) : (
            <VisitGroup key={group.visitId} parts={group.parts.length} onJoin={() => join(group.visitId)}>
              {group.parts.map((part) => cardFor(part.item, part.index))}
            </VisitGroup>
          )
        )}
        <AddAnotherCard onClick={onAddAnother} />
      </CheckoutSection>
      <CheckoutSection index={next()} title={t("booking.agenda.checkout.products")}>
        <Extras />
      </CheckoutSection>
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
 * «Pago» en la Agenda: antes de cobrar, el código que confirma que el celular de
 * la portada es suyo (y la ficha si es la primera vez), igual que en Paso a paso.
 * Verificado, cómo se paga (propina, descuentos, método y tarjeta) y el botón que cobra.
 */
export function AgendaSelectPay({ onChangeTime }: { onChangeTime?: () => void }) {
  const t = useAppT();
  const { state } = useBookingFlow();
  if (!state.verified || !state.customer) {
    return (
      <StepLayout title={t(state.verified ? "booking.payIdentity.newTitle" : "booking.payIdentity.title")} lead={t(state.verified ? "booking.payIdentity.newLead" : "booking.payIdentity.lead")}>
        <PayIdentity />
      </StepLayout>
    );
  }
  return <IdentifiedPay key={state.customer.id} onChangeTime={onChangeTime} />;
}

function IdentifiedPay({ onChangeTime }: { onChangeTime?: () => void }) {
  const payment = usePaymentController();
  return <PayBody payment={payment} onChangeTime={onChangeTime} />;
}
