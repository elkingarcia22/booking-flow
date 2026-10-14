import type { QueryClient } from "@tanstack/react-query";
import type { useAppT } from "@/app/i18n";
import { describeError } from "@/lib/api";
import { bookingApi } from "../../api";
import { personName, type BookingAction, type BookingState } from "../../bookingState";
import { buildIcs, parseStart, type BookingFormatters } from "../../bookingFormat";
import { savedCardExpiry } from "../../flow/cardValidation";
import type { PaymentController } from "../../flow/usePaymentController";
import { cancellationTerms, depositOf, FIRST_VISIT_PROMO, tipAmount, type Totals } from "../../pricing";
import { bookingKeys } from "../../queries";
import type { BookedAppointment, BookingCatalog, BookingShop, VisitSuggestion } from "../../types";
import { itemPrice } from "../../useBookingTotals";
import { makeQuestion, orderLine, type BookingQuestion, type QuestionEntry, type QuestionKind } from "./chatQuestions";
import type { Expecting, MessageInput } from "./chatKit";
import { createChatReceipt, type ReceiptPlan } from "./chatReceipt";

const REPEAT_COUNT = 3;
const CHECKOUT_KINDS: ReadonlySet<QuestionKind> = new Set(["receiptTo", "tip", "discount", "method", "card", "confirm", "after", "repeat", "manage", "manageWhat", "cancelConfirm", "refund"]);
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Lo que la conversación le presta al cobro: cómo hablar, el estado al día y a dónde volver. */
export interface CheckoutKit {
  t: ReturnType<typeof useAppT>;
  fmt: BookingFormatters;
  shop: BookingShop;
  queryClient: QueryClient;
  apply: (action: BookingAction) => void;
  say: (...messages: MessageInput[]) => void;
  ask: (question: BookingQuestion, text?: string) => void;
  busy: <T>(work: () => Promise<T>) => Promise<T>;
  expect: (next: Expecting) => void;
  /** Deja una pregunta respondida con lo que se escribió (para el recibo escrito en vez de tocado). */
  settle: (turnId: string, label: string) => void;
  receiptPlan: { current: ReceiptPlan | null };
  stateRef: { readonly current: BookingState };
  catalogRef: { readonly current: BookingCatalog | undefined };
  totalsRef: { readonly current: Totals };
  payment: { readonly current: PaymentController | null };
  suggestion: { readonly current: VisitSuggestion | null };
  managing: { current: BookedAppointment | null };
  rescheduling: { current: BookedAppointment | null };
  pendingManage: { current: boolean };
  serviceNames: (ids: readonly string[]) => string;
  barberName: (id: string | null) => string;
  onFinish?: () => void;
  /** Volver a la reserva: lo que sigue, otra vez desde el principio, elegir día o pedir el celular. */
  askMore: (text?: string) => void;
  startBooking: (text?: string) => void;
  askDay: (text?: string) => Promise<void>;
  askPhone: (text?: string) => void;
  askServices: (text?: string) => Promise<void>;
  askNext: (text?: string, withManage?: boolean) => void;
  /** Pedir la tarjeta nueva dato por dato en la caja. */
  startNewCard: (lead?: string) => void;
}

/** Lo que cambia el total bajo las citas: paquete, membresía, descuento, impuestos, propina, recargo y regalo. */
export function adjustmentRows(t: ReturnType<typeof useAppT>, fmt: { money: (value: number) => string }, sums: Totals): string[] {
  return [
    sums.prepaid > 0 ? `${t("booking.packages.line")}: −${fmt.money(sums.prepaid)}` : "",
    sums.reward > 0 ? `${t("booking.loyalty.line")}: −${fmt.money(sums.reward)}` : "",
    sums.discount > 0 ? `${t("booking.payment.discount")}: −${fmt.money(sums.discount)}` : "",
    `${t("booking.payment.tax")}: ${fmt.money(sums.tax)}`,
    sums.tip > 0 ? `${t("booking.payment.tipLine")}: ${fmt.money(sums.tip)}` : "",
    sums.fee > 0 ? `${sums.feeName ?? t("booking.payment.fee")}: ${fmt.money(sums.fee)}` : "",
    sums.gift > 0 ? `${t("booking.gift.line")}: −${fmt.money(sums.gift)}` : "",
  ].filter(Boolean);
}

/**
 * El cobro, el después de reservar y «Mis citas» en la conversación: la propina,
 * el cupón, cómo paga (con el mismo `usePaymentController` de las otras
 * versiones), el resumen para confirmar, el recibo y mover o cancelar una cita.
 */
export function useChatCheckout(kit: CheckoutKit) {
  const { settle, receiptPlan, t, fmt, shop, queryClient, apply, say, ask, busy, expect, stateRef, catalogRef, totalsRef, payment, suggestion, managing, rescheduling, pendingManage, serviceNames, barberName, onFinish, askMore, startBooking, askDay, askPhone, askServices, askNext, startNewCard } = kit;

  /* ── pagar ── */

  const orderText = (): string => {
    const current = stateRef.current;
    const sums = totalsRef.current;
    const lines = current.items.map((item) =>
      orderLine(
        serviceNames(item.serviceIds),
        fmt.money(itemPrice(item, catalogRef.current)),
        [personName(item.person, current.customer), barberName(item.barberId) || t("booking.review.noPreference"), item.start ? fmt.when(parseStart(item.start)) : ""].filter(Boolean).join(" · ")
      )
    );
    for (const [id, qty] of Object.entries(current.products)) {
      const product = catalogRef.current?.products.find((entry) => entry.id === id);
      if (product) lines.push(orderLine(qty > 1 ? `${product.name} × ${qty}` : product.name, fmt.money(product.price * qty)));
    }
    const rows = adjustmentRows(t, fmt, sums);
    return [lines.join("\n"), rows.join(" · "), `**${t("booking.payment.total")}: ${fmt.money(sums.total)}**`].join("\n\n");
  };

  /**
   * Al empezar a pagar, dicho como una persona: el servicio, con quién y cuándo, cuánto es y sus
   * impuestos. La propina se pregunta justo después y el recargo se dice al elegir tarjeta.
   */
  const checkoutIntro = (): string => {
    const current = stateRef.current;
    const sums = totalsRef.current;
    const subtotal = fmt.money(sums.subtotal);
    const tax = fmt.money(sums.tax);
    const productCount = Object.values(current.products).reduce((sum, qty) => sum + qty, 0);
    const item = current.items[0];
    if (current.items.length === 1 && productCount === 0 && item) {
      return t("booking.chat.checkoutOne", {
        services: serviceNames(item.serviceIds),
        barber: item.barberId ? t("booking.chat.withName", { name: barberName(item.barberId) }) : t("booking.chat.withAny"),
        when: item.start ? fmt.when(parseStart(item.start)) : "",
        subtotal,
        tax,
      });
    }
    const products = productCount > 0 ? t("booking.chat.checkoutProducts", { count: productCount }) : "";
    return t("booking.chat.checkoutMany", { count: current.items.length, products, subtotal, tax });
  };

  const checkout = async () => {
    const current = stateRef.current;
    if (current.items.length === 0) return void askServices(t("booking.chat.nothingYet"));
    apply({ type: "goTo", step: "payment" });
    // La propina se pregunta enseguida: hasta que la diga, no se suma ninguna (ni la de por defecto).
    apply({ type: "setTip", tipId: null });
    // Primera visita: el descuento prometido se aplica solo, como en las otras versiones (PromoField).
    if (current.customer?.isNew && !current.promo && FIRST_VISIT_PROMO) {
      const promo = await bookingApi.checkPromo(current.token, { code: FIRST_VISIT_PROMO.code, appointments: current.items.length }).catch(() => null);
      if (promo) apply({ type: "setPromo", promo });
    }
    // El resumen y la propina se arman al decirlos, ya con el descuento en las cuentas.
    say(
      () => ({ text: checkoutIntro() }),
      () => {
        const services = totalsRef.current.services;
        const entries: QuestionEntry[] = [
          { label: t("booking.payment.tipNone"), value: "none" },
          ...shop.tipOptions.map((option) => ({ label: option.type === "percent" ? `${option.value} %` : fmt.money(option.value), value: option.id, description: option.type === "percent" ? fmt.money(tipAmount(option, services)) : undefined })),
        ];
        return { question: makeQuestion("tip", t("booking.chat.tipTitle"), entries, { hint: t("booking.payment.tipHint") }) };
      }
    );
  };

  const askDiscount = () =>
    say(() => {
      const sums = totalsRef.current;
      // Solo lo que ahorra (paquete o cortesía); el avance de la membresía no se dice aquí, alargaba la pregunta.
      const perks = [sums.prepaid > 0 ? t("booking.chat.perkPackage", { amount: fmt.money(sums.prepaid) }) : "", sums.reward > 0 ? t("booking.chat.perkReward", { amount: fmt.money(sums.reward) }) : ""].filter(Boolean).join(" ");
      return { text: perks || undefined, question: makeQuestion("discount", t("booking.chat.discountTitle"), [{ label: t("booking.chat.discountNo"), value: "none" }], { otherLabel: t("booking.chat.discountYes"), otherPlaceholder: t("booking.chat.discountPlaceholder") }) };
    });

  const confirmQuestion = (controller: PaymentController) => makeQuestion("confirm", t("booking.chat.confirmTitle"), [{ label: controller.payLabel, value: "pay", emoji: "✅" }, { label: t("booking.chat.changeSomething"), value: "change" }]);

  const askMethod = (lead?: string) =>
    say(() => {
      const controller = payment.current;
      if (!controller) return { text: t("booking.chat.payUnavailable") };
      if (controller.coveredByGift) return { text: t("booking.gift.coveredBody"), question: confirmQuestion(controller) };
      const options = controller.methods.filter((option) => !option.disabled);
      const blocked = controller.methods.find((option) => option.disabled);
      const text = [lead, blocked ? `${blocked.label}: ${blocked.description}` : ""].filter(Boolean).join("\n\n") || undefined;
      return { text, question: makeQuestion("method", t("booking.chat.methodTitle"), options.map((option) => ({ label: option.label, value: option.value, description: option.description }))) };
    });

  const askConfirm = () =>
    say(() => {
      const controller = payment.current;
      if (!controller) return { text: t("booking.chat.payUnavailable") };
      const sums = totalsRef.current;
      const deposit = controller.depositPercent !== null && stateRef.current.method === "shop" ? depositOf(sums, controller.depositPercent) : 0;
      const depositLine = deposit > 0 ? `\n\n${t("booking.payment.deposit.title", { amount: fmt.money(deposit) })} ${t("booking.payment.deposit.body", { percent: controller.depositPercent ?? 0, rest: fmt.money(Math.max(0, sums.total - deposit)), hours: shop.cancelHours })}` : "";
      return { text: `${orderText()}${depositLine}\n\n${t("booking.payment.policyAccept")}`, question: confirmQuestion(controller) };
    });

  const askCard = () =>
    say(() => {
      const cards = stateRef.current.customer?.cards ?? [];
      if (cards.length === 0) {
        startNewCard();
        return null;
      }
      return {
        question: makeQuestion("card", t("booking.chat.cardTitle"), [
          ...cards.map((card) => ({ label: `${card.brand} •••• ${card.last4}`, value: card.id, description: t("booking.chat.cardExpires", { date: savedCardExpiry(card) }) })),
          { label: t("booking.chat.newCard"), value: "new", emoji: "➕" },
        ]),
      };
    });

  const applyCode = async (code: string) => {
    const current = stateRef.current;
    try {
      const promo = await busy(() => bookingApi.checkPromo(current.token, { code, appointments: current.items.length }));
      apply({ type: "setPromo", promo });
      say({ text: t("booking.chat.promoApplied", { code: promo.code }) });
      return askMethod();
    } catch (promoError) {
      try {
        const gift = await bookingApi.checkGift(code);
        apply({ type: "setGift", gift });
        say({ text: t("booking.chat.giftApplied", { amount: fmt.money(gift.balance) }) });
        return askMethod();
      } catch {
        say({ text: describeError(promoError).description });
        return askDiscount();
      }
    }
  };

  /* ───────────────────────────── después de reservar ───────────────────────────── */

  const askAfter = (text?: string) =>
    ask(
      makeQuestion("after", t("booking.chat.afterTitle"), [
        { label: t("booking.confirmed.calendar"), value: "ics", emoji: "📅" },
        { label: t("booking.chat.sendReceipt"), value: "receipt", description: t("booking.chat.sendReceiptHint"), emoji: "✉️" },
        { label: t("booking.chat.makeRecurring"), value: "repeat", description: t("booking.chat.makeRecurringHint"), emoji: "🔁" },
        { label: t("booking.chat.reply.again"), value: "again", emoji: "➕" },
        { label: t("booking.chat.reply.manage"), value: "manage", emoji: "🗓️" },
        { label: t("booking.chat.allDone"), value: "done", emoji: "👋" },
      ]),
      text
    );

  const receipt = createChatReceipt({ t, say, ask, busy, expect, stateRef, settle, askAfter, receiptPlan });

  const reserved = () => {
    const current = stateRef.current;
    const reservation = current.reservation;
    if (!reservation) return;
    const lines = reservation.appointments.map((item) => orderLine(item.serviceNames.join(" + "), fmt.money(item.price), [item.personName, item.barberName, fmt.when(parseStart(item.start))].join(" · ")));
    const owed = Math.max(0, reservation.totals.total - reservation.payment.paid);
    const tail = reservation.payment.status === "paid" ? "" : `\n\n${t("booking.confirmed.payAtShop", { amount: fmt.money(owed) })}`;
    askAfter(`${t("booking.chat.done", { name: current.customer?.firstName ?? "", number: reservation.number })}\n\n${lines.join("\n")}${tail}`);
  };

  /* ───────────────────────────── mis citas ───────────────────────────── */

  const manage = async () => {
    const token = stateRef.current.token;
    // «Mis citas» pide el código: el cliente reconocido solo por su celular aún no lo confirmó.
    if (!token || !stateRef.current.customer || !stateRef.current.verified) {
      pendingManage.current = true;
      return askPhone(t("booking.chat.manageNeedsPhone"));
    }
    pendingManage.current = false;
    const mine = await busy(() => bookingApi.myAppointments(token).catch(() => null));
    const upcoming = mine?.upcoming ?? [];
    if (!mine || upcoming.length === 0) return askNext(t("booking.chat.noUpcoming"), false);
    // Las citas quedan a mano para la siguiente respuesta.
    queryClient.setQueryData(bookingKeys.mine(token), mine);
    const entries: QuestionEntry[] = upcoming.map((item) => ({
      label: capitalize(fmt.when(parseStart(item.start))),
      value: item.id,
      image: item.barberAvatarUrl,
      description: [item.serviceNames.join(" + "), item.barberName, item.guestRelation ? item.personName : ""].filter(Boolean).join(" · "),
    }));
    entries.push({ label: t("booking.chat.nothing"), value: "none" });
    managing.current = null;
    ask(makeQuestion("manage", t("booking.chat.manageTitle"), entries), t("booking.chat.manageIntro"));
  };

  const termsOf = (item: BookedAppointment) => cancellationTerms({ start: parseStart(item.start), now: new Date(), cancelHours: shop.cancelHours, lateFeePercent: shop.lateFeePercent, price: item.price, paid: item.paid });

  const cancelAppointment = async (refundTo: "card" | "credit") => {
    const item = managing.current;
    const token = stateRef.current.token;
    if (!item || !token) return;
    try {
      const result = await busy(() => bookingApi.cancel(token, item.id, refundTo));
      managing.current = null;
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      const refund = result.refund > 0 ? ` ${t(result.refundTo === "card" ? "booking.chat.refundedCard" : "booking.chat.refundedCredit", { amount: fmt.money(result.refund) })}` : "";
      askNext(`${t("booking.chat.cancelled")}${refund}`);
    } catch (error) {
      say({ text: describeError(error).description });
    }
  };

  const onAfter = async (value: string | null) => {
    const current = stateRef.current;
    const reservation = current.reservation;
    if (!reservation) return;
    if (value === "ics") {
      // El archivo va dentro de la conversación, para descargarlo cuando quiera (en el celular lo abre su calendario).
      const url = URL.createObjectURL(new Blob([buildIcs(reservation.appointments, shop.name)], { type: "text/calendar;charset=utf-8" }));
      say({ text: t("booking.chat.icsReady"), attachment: { name: `${reservation.number}.ics`, url, description: t("booking.chat.icsDescription", { count: reservation.appointments.length }) } });
      return askAfter();
    }
    if (value === "receipt") return receipt.askReceipt();
    if (value === "repeat") {
      const usual = suggestion.current ? Math.min(4, Math.max(1, Math.round(suggestion.current.everyDays / 7))) : 3;
      const every: QuestionEntry[] = [1, 2, 3, 4].map((weeks) => ({ label: t("booking.chat.everyWeeks", { count: weeks }), value: String(weeks), description: weeks === usual ? t("booking.chat.yourRhythm") : undefined }));
      return ask(makeQuestion("repeat", t("booking.chat.repeatTitle"), [...every, { label: t("booking.chat.repeatNo"), value: "no", emoji: "✋" }]), t("booking.chat.repeatLead", { count: REPEAT_COUNT }));
    }
    if (value === "again") {
      apply({ type: "bookAgain" });
      return startBooking();
    }
    if (value === "manage") return manage();
    say({ text: t("booking.chat.bye", { name: current.customer?.firstName ?? "" }) });
    onFinish?.();
  };

  const onRepeat = async (value: string | null) => {
    const current = stateRef.current;
    const reservation = current.reservation;
    const token = current.token;
    if (!reservation || !token) return;
    if (value === "no" || !value) return askAfter(t("booking.chat.repeatSkippedAll"));
    try {
      const results = await busy(() => Promise.all(reservation.appointments.map((item) => bookingApi.repeat(token, item.id, { everyWeeks: Number(value), count: REPEAT_COUNT }))));
      const created = results.reduce((sum, result) => sum + result.created.length, 0);
      const skipped = [...new Set(results.flatMap((result) => result.skipped))];
      void queryClient.invalidateQueries({ queryKey: bookingKeys.availabilities() });
      askAfter([t("booking.repeat.done", { count: created }), skipped.length > 0 ? t("booking.chat.repeatSkipped", { days: skipped.map((day) => fmt.dayShort(parseStart(`${day}T00:00`))).join(", ") }) : ""].filter(Boolean).join(" "));
    } catch (error) {
      askAfter(describeError(error).description);
    }
  };

  const onManage = (value: string | null) => {
    const token = stateRef.current.token;
    if (value === "none" || !value || !token) return askNext(t("booking.chat.okay"));
    const item = queryClient.getQueryData<{ upcoming: BookedAppointment[] }>(bookingKeys.mine(token))?.upcoming.find((entry) => entry.id === value);
    if (!item) return void manage();
    managing.current = item;
    const terms = termsOf(item);
    const entries: QuestionEntry[] = [
      ...(terms.isFree ? [{ label: t("booking.manage.reschedule"), value: "move", emoji: "🕒" }] : []),
      { label: t("booking.chat.cancelIt"), value: "cancel", emoji: "✖️" },
      { label: t("booking.chat.nothing"), value: "none" },
    ];
    ask(makeQuestion("manageWhat", t("booking.chat.manageWhatTitle"), entries), terms.isFree ? undefined : t("booking.manage.locked", { hours: shop.cancelHours }));
  };

  const onManageWhat = (value: string | null) => {
    const item = managing.current;
    if (!item || value === "none") return say({ text: t("booking.chat.okay") });
    if (value === "move") {
      rescheduling.current = item;
      return void askDay(t("booking.chat.moveLead"));
    }
    const terms = termsOf(item);
    ask(makeQuestion("cancelConfirm", t("booking.chat.cancelTitle"), [{ label: t("booking.chat.cancelYes"), value: "yes" }, { label: t("booking.chat.cancelNo"), value: "no" }]), terms.isFree ? t("booking.chat.cancelFree") : t("booking.chat.cancelLate", { fee: fmt.money(terms.fee) }));
  };


  const runCheckout = async (question: BookingQuestion, value: string | null, label: string, isOther: boolean) => {
    const current = stateRef.current;
    switch (question.kind) {
      case "tip":
        apply({ type: "setTip", tipId: value === "none" ? null : value });
        return askDiscount();
      case "discount":
        return isOther ? applyCode(label.trim()) : askMethod();
      case "method": {
        if (!value) return askMethod();
        apply({ type: "setMethod", method: value as NonNullable<BookingState["method"]> });
        const deposit = payment.current?.depositPercent ?? null;
        return value === "card" || (value === "shop" && deposit !== null) ? askCard() : askConfirm();
      }
      case "card": {
        if (value === "new" || !value) return startNewCard();
        payment.current?.chooseCard(value);
        const card = current.customer?.cards.find((item) => item.id === value);
        expect("cvc");
        return say({ text: t("booking.chat.askCvc", { card: card ? `${card.brand} •••• ${card.last4}` : "" }) });
      }
      case "confirm":
        return value === "pay" ? payment.current?.pay({ askTip: false }) : askMore();
      case "after":
        return onAfter(value);
      case "receiptTo":
        return receipt.answerReceipt(question, label);
      case "repeat":
        return onRepeat(value);
      case "manage":
        return onManage(value);
      case "manageWhat":
        return onManageWhat(value);
      case "cancelConfirm": {
        const item = managing.current;
        if (!item || value !== "yes") return say({ text: t("booking.chat.keptIt") });
        if (item.paid > 0) return ask(makeQuestion("refund", t("booking.chat.refundTitle"), [{ label: t("booking.chat.refundCard"), value: "card" }, { label: t("booking.chat.refundCredit"), value: "credit", description: t("booking.chat.refundCreditHint") }]));
        return cancelAppointment("credit");
      }
      case "refund":
        return cancelAppointment(value === "card" ? "card" : "credit");
    }
  };

  /** Las respuestas de las preguntas del cobro, de «Mis citas» y del después; `false` si la pregunta no es de aquí. */
  const answerCheckout = async (question: BookingQuestion, value: string | null, label: string, isOther: boolean): Promise<boolean> => {
    if (!CHECKOUT_KINDS.has(question.kind)) return false;
    await runCheckout(question, value, label, isOther);
    return true;
  };

  return { checkout, askMethod, askConfirm, reserved, manage, answerCheckout, submitReceiptTarget: receipt.submitTarget, answerTypedReceipt: receipt.answerTyped };
}
