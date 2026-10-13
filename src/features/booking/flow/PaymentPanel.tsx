import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Spinner } from "@/components/feedback/Spinner";
import { Heading, Text } from "@/components/typography";
import { ModalShell } from "@/components/overlays";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OptionTile } from "@/components/selection";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { describeError, isApiError } from "@/lib/api";
import { personName } from "../bookingState";
import { parseStart } from "../bookingFormat";
import type { PayMethod } from "../types";
import { draftOrderLines } from "../useBookingTotals";
import { useBookingFlow } from "./BookingContext";
import { BookingSheet } from "./BookingSheet";
import { overlayKind } from "./drawerFit";
import { GiftCardField } from "./GiftCardField";
import { MembershipPerk } from "./MembershipPerk";
import { NewCardSheet } from "./NewCardSheet";
import { OrderSummary } from "./OrderSummary";
import { PackagesToggle } from "./PackagesToggle";
import { PromoField } from "./PromoField";
import { NEW_CARD, SavedCardPicker } from "./SavedCardPicker";
import type { PaymentController } from "./usePaymentController";

const NO_TIP = "none";

/** Los títulos de dentro del cobro; compactos, con menos peso para no sumar escalones bajo «Pago». */
function SubHeading({ compact, children }: { compact: boolean; children: React.ReactNode }) {
  return compact ? (
    <Text size="sm" weight="medium">
      {children}
    </Text>
  ) : (
    <Heading level={6}>{children}</Heading>
  );
}

/** El botón que cobra: dice exactamente lo que va a pasar («Pagar $64»). */
export function PayButton({ payment, className }: { payment: PaymentController; className?: string }) {
  const t = useAppT();
  const { method, deposit, reserve, payLabel, pay } = payment;
  return (
    <Button type="button" size="lg" className={className ?? "w-full"} disabled={!method || reserve.isPending} onClick={() => pay()}>
      {reserve.isPending ? <Spinner size="sm" tone="inverse" /> : <ThemaIcon name={method === "shop" && deposit === 0 ? "calendar" : "lock"} />}
      {reserve.isPending ? t("booking.payment.processing") : method ? payLabel : t("booking.payment.choose")}
    </Button>
  );
}

interface PaymentPanelProps {
  payment: PaymentController;
  /** El resumen del pedido al final; la conversación lo enseña en su propia tarjeta. */
  showOrder?: boolean;
  /**
   * Menos alto, para el cierre de la Agenda con selector: el cupón detrás de un enlace y las formas de pago en filas cortas
   * con el detalle solo de la elegida.
   */
  compact?: boolean;
  /** Volver a elegir la hora cuando la que se iba a pagar ya no está libre. */
  onChangeTime?: () => void;
}

/**
 * Un cupón y cómo se paga (la propina se pregunta en un modal al pulsar «Pagar»). Si la barbería deja pagar en
 * el local, esa opción está; si el cliente es «solo en línea», no.
 */
export function PaymentPanel({ payment, showOrder = true, compact = false, onChangeTime }: PaymentPanelProps) {
  const t = useAppT();
  const { state, dispatch, shop, catalog, totals, fmt, isPhone } = useBookingFlow();
  const { methods, method, deposit, depositPercent, usesCard, coveredByGift, reserve, serverCardError } = payment;
  const hasSeveralAppointments = state.items.length > 1;
  const customer = state.customer;
  const [isPromoOpen, setIsPromoOpen] = React.useState(false);
  const chosenMethod = methods.find((option) => option.value === method);
  const methodCards = compact && !isPhone;

  const lines = draftOrderLines(state, catalog, (item) => {
    const barber = catalog?.barbers.find((entry) => entry.id === item.barberId)?.name ?? t("booking.review.noPreference");
    return `${personName(item.person, customer)} · ${barber}${item.start ? ` · ${fmt.when(parseStart(item.start))}` : ""}`;
  });

  return (
    <>
      <div className="flex flex-col gap-4">
        <PackagesToggle />
        <MembershipPerk />
        {/* Cupón y tarjeta de regalo empiezan como dos enlaces en una línea; el que se abre toma el ancho entero. */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-4 [&>*:not(button)]:basis-full">
          {!state.promo && !isPromoOpen ? (
            <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setIsPromoOpen(true)}>
              {t("booking.payment.promoAsk")}
            </Button>
          ) : (
            <PromoField />
          )}
          <GiftCardField />
        </div>
      </div>

      {coveredByGift && (
        <Alert variant="success">
          <ThemaIcon name="ticket" />
          <AlertTitle>{t("booking.gift.coveredTitle")}</AlertTitle>
          <AlertDescription>{t("booking.gift.coveredBody")}</AlertDescription>
        </Alert>
      )}
      <section className={coveredByGift ? "hidden" : "flex flex-col gap-3"}>
        <SubHeading compact={compact}>{t("booking.payment.method")}</SubHeading>
        {/* Compacto (Agenda con selector): las formas de pago como tarjetas lado a lado; en el celular, en filas. */}
        <div role="radiogroup" aria-label={t("booking.payment.method")} className={methodCards ? cn("grid gap-2", methods.length === 3 ? "grid-cols-3" : "grid-cols-2") : "flex flex-col gap-2"}>
          {methods.map((option) => (
            <OptionTile
              key={option.value}
              option={option}
              compact={compact}
              layout={methodCards ? "stacked" : "row"}
              selected={method === option.value}
              onSelect={(value) => {
                dispatch({ type: "setMethod", method: value as PayMethod });
                if (value === "shop" && hasSeveralAppointments && method !== "shop") payment.setShopNoticeOpen(true);
              }}
            />
          ))}
        </div>
        {compact && chosenMethod?.description && (
          <Text size="xs" tone="muted">
            {chosenMethod.description}
          </Text>
        )}
        {deposit > 0 && (
          <Alert variant="info">
            <ThemaIcon name="securityLock" />
            <AlertTitle>{t("booking.payment.deposit.title", { amount: fmt.money(deposit) })}</AlertTitle>
            <AlertDescription>{t("booking.payment.deposit.body", { percent: depositPercent ?? 0, rest: fmt.money(Math.max(0, totals.total - deposit)), hours: shop.cancelHours })}</AlertDescription>
          </Alert>
        )}
        {usesCard && (
          <SavedCardPicker
            cards={payment.savedCards}
            value={payment.cardChoice}
            onChange={payment.chooseCard}
            pending={payment.card}
            onAddNew={() => payment.setSheet({ open: true, prefill: false })}
            onEditPending={() => payment.setSheet({ open: true, prefill: true })}
            onRemovePending={payment.cardManager.onRemovePending}
            onEditCard={payment.cardManager.onEditCard}
            onRemoveCard={payment.cardManager.onRemoveCard}
            cvc={payment.savedCvc}
            onCvcChange={payment.setSavedCvc}
            showErrors={payment.showCardErrors}
          />
        )}
        {usesCard && serverCardError && (
          <Text size="sm" tone="negative">
            {serverCardError}
          </Text>
        )}
        {method === "shop" && hasSeveralAppointments && (
          <Alert variant="info">
            <ThemaIcon name="info" />
            <AlertTitle>{t("booking.payment.shopMulti.title", { count: state.items.length })}</AlertTitle>
            <AlertDescription>
              {t("booking.payment.shopMulti.short")}{" "}
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => payment.setShopNoticeOpen(true)}>
                {t("booking.payment.shopMulti.more")}
              </button>
            </AlertDescription>
          </Alert>
        )}
        {(method !== "shop" || deposit > 0) && (
          <Text size="xs" tone="muted" className="flex items-center gap-1.5">
            <ThemaIcon name="securityLock" size="xs" />
            {t("booking.payment.secure")}
          </Text>
        )}
      </section>

      {reserve.isError && !serverCardError && (
        <Alert variant="destructive">
          <ThemaIcon name="error" />
          <AlertDescription className="flex flex-col items-start gap-2">
            {describeError(reserve.error).description}
            {/* La hora ya no está (se ocupó o ya pasó): ir directo a cambiarla. */}
            {onChangeTime && isApiError(reserve.error) && reserve.error.code === "conflict" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  reserve.reset();
                  onChangeTime();
                }}
              >
                <ThemaIcon name="calendar" />
                {t("booking.payment.changeTime")}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {showOrder && (
        <section className={cn("flex flex-col rounded-2xl border border-border bg-surface-subtle", compact ? "gap-2 p-3" : "gap-3 p-4")}>
          <Heading level={6}>{t("booking.payment.order")}</Heading>
          {/* Compacto, la cita ya está arriba con su precio: aquí solo las cuentas. */}
          <OrderSummary totals={totals} money={fmt.money} lines={compact ? undefined : lines} promoCode={state.promo?.code} />
          {deposit > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              <div className="flex items-center justify-between gap-3">
                <Text size="sm" weight="medium">
                  {t("booking.payment.deposit.today")}
                </Text>
                <Text size="sm" weight="semibold" tabular>
                  {fmt.money(deposit)}
                </Text>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Text size="sm" tone="secondary">
                  {t("booking.payment.deposit.atShop")}
                </Text>
                <Text size="sm" tone="secondary" tabular>
                  {fmt.money(Math.max(0, totals.total - deposit))}
                </Text>
              </div>
            </div>
          )}
        </section>
      )}
      <PaymentSheets payment={payment} />
    </>
  );
}

/** Las hojas del cobro: cómo se paga en el local con varias citas y la tarjeta nueva. */
export function PaymentSheets({ payment }: { payment: PaymentController }) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const { reserve, sheet, setSheet, card, saveCard } = payment;
  return (
    <>
      <BookingSheet
        open={payment.shopNoticeOpen}
        onOpenChange={payment.setShopNoticeOpen}
        title={t("booking.payment.shopMulti.modalTitle")}
        actions={
          <Button type="button" size="lg" className="w-full" onClick={() => payment.setShopNoticeOpen(false)}>
            {t("booking.payment.shopMulti.ok")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Text tone="secondary">{t("booking.payment.shopMulti.intro", { count: state.items.length })}</Text>
          <ol className="flex list-decimal flex-col gap-2 pl-5 marker:text-text-muted">
            <li>
              <Text as="span" tone="secondary">
                {t("booking.payment.shopMulti.one")}
              </Text>
            </li>
            <li>
              <Text as="span" tone="secondary">
                {t("booking.payment.shopMulti.two")}
              </Text>
            </li>
            <li>
              <Text as="span" tone="secondary">
                {t("booking.payment.shopMulti.three")}
              </Text>
            </li>
          </ol>
          <Text tone="secondary">{t("booking.payment.shopMulti.bye")}</Text>
        </div>
      </BookingSheet>
      <TipSheet payment={payment} />
      {payment.cardManager.sheets}
      <NewCardSheet
        key={`${sheet.open}-${sheet.prefill}`}
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        initial={sheet.prefill ? card : null}
        initialSave={saveCard}
        canSave={Boolean(state.customer)}
        onConfirm={(values, save) => {
          payment.setCard(values);
          payment.setSaveCard(save);
          payment.setCardChoice(NEW_CARD);
          payment.setShowCardErrors(false);
          // Lo que dijo la pasarela ya no vale para la tarjeta corregida.
          if (reserve.isError) reserve.reset();
        }}
      />
    </>
  );
}

/**
 * La propina para el barbero: se elige después de pulsar «Pagar» y al elegir se cobra.
 * En celular y tablet sube como hoja desde abajo; en monitor es un modal centrado.
 */
function TipSheet({ payment }: { payment: PaymentController }) {
  const t = useAppT();
  const { state, shop, fmt, layout, touch } = useBookingFlow();
  const [tipId, setTipId] = React.useState<string>(state.tipId ?? NO_TIP);
  React.useEffect(() => {
    if (payment.tipOpen) setTipId(state.tipId ?? NO_TIP);
  }, [payment.tipOpen, state.tipId]);
  const options = [{ value: NO_TIP, label: t("booking.payment.tipNone") }, ...shop.tipOptions.map((option) => ({ value: option.id, label: option.type === "percent" ? `${option.value} %` : fmt.money(option.value) }))];
  const title = t("booking.payment.tip");
  const description = t("booking.payment.tipHint");
  const actions = (
    <Button type="button" size="lg" className="w-full" disabled={payment.reserve.isPending} onClick={() => payment.confirmTip(tipId === NO_TIP ? null : tipId)}>
      {payment.reserve.isPending ? <Spinner size="sm" tone="inverse" /> : <ThemaIcon name="lock" />}
      {tipId === NO_TIP ? t("booking.payment.tipSkipPay") : t("booking.payment.tipAndPay")}
    </Button>
  );
  const choices = (
    <div role="radiogroup" aria-label={title} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = tipId === option.value;
        return (
          <Button key={option.value} type="button" role="radio" aria-checked={selected} variant={selected ? "default" : "outline"} className="min-w-[5rem] rounded-full tabular-nums" onClick={() => setTipId(option.value)}>
            {option.label}
          </Button>
        );
      })}
    </div>
  );
  if (overlayKind({ layout, touch }) === "sheet") {
    return (
      <BookingSheet open={payment.tipOpen} onOpenChange={payment.setTipOpen} title={title} description={description} actions={actions}>
        {choices}
      </BookingSheet>
    );
  }
  return (
    <ModalShell open={payment.tipOpen} onOpenChange={payment.setTipOpen} title={title} description={description} actions={actions} size="md">
      {choices}
    </ModalShell>
  );
}
