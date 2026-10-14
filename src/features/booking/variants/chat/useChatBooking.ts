import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppT, type AppMessageKey } from "@/app/i18n";
import { describeError } from "@/lib/api";
import { splitMultipleAnswer } from "@/lib/chat";
import { bookingApi } from "../../api";
import { bookingReducer, defaultBranchId, personName, type BookingAction, type BookingPerson, type BookingState } from "../../bookingState";
import { dayKeyOf, firstBookableDay, formatPhone, parseStart } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { brandFromName, isCvcComplete } from "../../flow/cardValidation";
import type { PaymentController } from "../../flow/usePaymentController";
import type { Totals } from "../../pricing";
import { bookingKeys } from "../../queries";
import type { Availability, BookedAppointment, BookingBarber, BookingCatalog, Slot, VisitSuggestion } from "../../types";
import type { DayWindow } from "../agenda/agendaModel";
import { EMPTY_CARD, isCardStep, maskCardInput, useChatNewCard, type CardDraft } from "./chatCard";
import { useChatCheckout } from "./chatCheckout";
import { useChatIdentity } from "./chatIdentity";
import { detectAside, useChatIntents } from "./chatIntents";
import { looksLikeDetail, useChatProfiles } from "./chatProfiles";

/** Al no haber hueco a la hora pedida: cuántas horas cercanas y cuántos barberos libres a esa hora se ofrecen. */
const NEAR_TIMES = 2;
const NEAR_OTHERS = 2;
/** «Sí», «dale», «sí, por favor»: aceptar lo que se propone. */
const SAYS_YES = /^(si|dale|claro|de una|listo|va|vale|ok|okay|perfecto|bueno|yes|sure|yeah)\b/;
const plain = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
import { activeQuestionTurn, capitalize, DAYS_OFFERED, firstName, isKnownAnswer, nextId, reducedMotion, RELATIONS, TYPING_MS, type ChatReplyId, type ChatTurn, type Expecting, type Handlers, type MessageInput, type PaymentEvent } from "./chatKit";
import { MAX_REFERENCE_PHOTOS } from "../../flow/referencePhoto";
import { useChatExtras } from "./chatExtras";
import { isReceiptStep, type ReceiptPlan } from "./chatReceipt";
import { makeQuestion, matchOption, matchOptionLoosely, type BookingQuestion, type QuestionEntry } from "./chatQuestions";
import { parseBookingText, type ParsedRequest } from "./parseBookingText";

/**
 * La conversación de la reserva. Habla como un chat: lo que se escribe (el
 * celular, el código, el nombre, el correo, el CVC o una frase como «corte
 * mañana a las 5») va en la caja, y cada elección llega como una pregunta con
 * su lista (`ChatQuestionCard`). No guarda la reserva aparte: despacha las
 * mismas acciones del `bookingReducer` que las otras versiones y cobra con el
 * mismo `usePaymentController`, que le pasa `ChatFlow` por `payment`.
 */
export function useChatBooking({
  onFinish,
  payment,
  deferStart = false,
  identityAt = "first",
}: {
  onFinish?: () => void;
  payment: React.RefObject<PaymentController | null>;
  /** Con portada: el saludo espera a que diga (o escriba) qué quiere; ver `begin`. */
  deferStart?: boolean;
  /**
   * Cuándo se pide quién eres. `first` (como en WhatsApp): el celular y el código al empezar. `last`
   * (como en la Agenda): se arma la cita y el celular se pide al pagar.
   */
  identityAt?: "first" | "last";
}) {
  const identityLast = identityAt === "last";
  const t = useAppT();
  const queryClient = useQueryClient();
  const { state, dispatch, shop, catalog, totals, fmt } = useBookingFlow();
  const [turns, setTurns] = React.useState<readonly ChatTurn[]>([]);
  const [typing, setTyping] = React.useState(false);
  const [expectingNow, setExpectingNow] = React.useState<Expecting>(identityLast ? null : "phone");
  const stateRef = React.useRef<BookingState>(state);
  const catalogRef = React.useRef<BookingCatalog | undefined>(catalog);
  const totalsRef = React.useRef<Totals>(totals);
  const turnsRef = React.useRef(turns);
  const handlers = React.useRef<Handlers | null>(null);
  const queue = React.useRef<Promise<void>>(Promise.resolve());
  const expecting = React.useRef<Expecting>(identityLast ? null : "phone");
  /** Con la identidad al final: se pidió pagar sin saber quién es; al identificarse, sigue al pago. */
  const pendingCheckout = React.useRef(false);
  const profile = React.useRef({ firstName: "", lastName: "", email: "" });
  const pendingName = React.useRef("");
  const receiptPlan = React.useRef<ReceiptPlan | null>(null);
  const pendingManage = React.useRef(false);
  /** Se pidió la lista de espera (con esta franja) sin el código: al confirmarlo se apunta. */
  const pendingWaitlist = React.useRef<string | null>(null);
  /** Lo que pidió en la portada («corte mañana en la tarde»): se atiende en cuanto se sabe quién es. */
  const pendingIntent = React.useRef<string | null>(null);
  const timesDay = React.useRef<string | null>(null);
  const rescheduling = React.useRef<BookedAppointment | null>(null);
  const managing = React.useRef<BookedAppointment | null>(null);
  const suggestion = React.useRef<VisitSuggestion | null>(null);
  const lastTeam = React.useRef<readonly BookingBarber[]>([]);
  const started = React.useRef(false);
  const seenCustomer = React.useRef<string | null>(null);
  const seenReservation = React.useRef<string | null>(null);
  /** La tarjeta nueva a medio escribir (un dato por mensaje). */
  const cardDraft = React.useRef<CardDraft>(EMPTY_CARD);

  const apply = React.useCallback(
    (action: BookingAction) => {
      stateRef.current = bookingReducer(stateRef.current, action);
      dispatch(action);
    },
    [dispatch]
  );

  const expect = (next: Expecting) => {
    expecting.current = next;
    setExpectingNow(next);
  };

  /** Cuántas veces habló el cliente: una pregunta que llega tarde (tras una consulta) no pisa lo que ya pidió. */
  const userTurns = React.useRef(0);
  const pushUser = (text: string, photos?: readonly string[]) => {
    userTurns.current += 1;
    setTurns((current) => [...current, { id: nextId(), from: "user", text, ...(photos && photos.length > 0 ? { photos } : {}) }]);
  };

  /** Mensajes del asistente, uno tras otro, con su «escribiendo…» delante. */
  const say = React.useCallback((...messages: MessageInput[]) => {
    const delay = reducedMotion() ? 0 : TYPING_MS;
    queue.current = queue.current.then(async () => {
      for (const input of messages) {
        if (delay > 0) setTyping(true);
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        setTyping(false);
        const message = typeof input === "function" ? input() : input;
        if (message) setTurns((current) => [...current, { id: nextId(), from: "agent", ...message }]);
      }
    });
  }, []);

  const ask = (question: BookingQuestion, text?: string) => say({ text, question });
  const busy = async <T,>(work: () => Promise<T>): Promise<T> => {
    setTyping(true);
    try {
      return await work();
    } finally {
      setTyping(false);
    }
  };

  const serviceNames = (ids: readonly string[]) => ids.map((id) => catalogRef.current?.services.find((service) => service.id === id)?.name ?? id).join(" + ");
  const barberName = (id: string | null) => (id ? (catalogRef.current?.barbers.find((barber) => barber.id === id)?.name ?? "") : "");

  /* ───────────────────────────── quién es ───────────────────────────── */

  const askPhone = (text = t("booking.chat.askPhone")) => {
    expect("phone");
    say({ text });
  };

  const identity = useChatIdentity({
    t,
    shop,
    apply,
    say,
    ask,
    busy,
    expect,
    expecting,
    stateRef,
    profile,
    askPhone,
    // Con la identidad al final, o si ya va a pagar o a «Mis citas», el celular se confirma con código.
    needsCode: () => identityLast || pendingCheckout.current || pendingManage.current || pendingWaitlist.current !== null,
    onPhoneSaved: () => startBooking(),
  });
  const { submitPhone, sendCode, submitCode, submitProfileText, createProfile } = identity;

  /** Ya se puede armar la cita: sabe quién es, o dio su celular (el código va al pagar), o la identidad va al final. */
  const canBook = () => Boolean(stateRef.current.customer || stateRef.current.token || stateRef.current.phone || identityLast);

  /**
   * Confirmar quién es (para pagar, «Mis citas» o la lista de espera): con el celular ya dado —también
   * el del cliente reconocido sin código—, el código va directo a él; si no, se le pide el celular.
   */
  const confirmIdentity = (text?: string) => {
    const phone = stateRef.current.phone;
    if (phone && !stateRef.current.verified) return void sendCode(phone);
    askPhone(text);
  };

  /* ───────────────────────────── la cita ───────────────────────────── */

  /** La sede que se da por hecha (única o la de siempre), sin preguntar. */
  const presetBranch = () => {
    const current = stateRef.current;
    if (current.branchId) return;
    const known = defaultBranchId(current.customer, shop.branches.map((branch) => branch.id));
    if (known) apply({ type: "chooseBranch", branchId: known });
  };

  const loadCatalog = async (): Promise<BookingCatalog | undefined> => {
    const branchId = stateRef.current.branchId;
    if (catalogRef.current || !branchId) return catalogRef.current;
    try {
      const loaded = await queryClient.fetchQuery({ queryKey: bookingKeys.catalog(branchId), queryFn: ({ signal }) => bookingApi.catalog(branchId, signal), staleTime: 10 * 60_000 });
      catalogRef.current = loaded;
      return loaded;
    } catch {
      return undefined;
    }
  };

  const ensureDraft = (person: BookingPerson = { kind: "self" }) => {
    if (!stateRef.current.draft) apply({ type: "openDraft", person, serviceIds: [], barberId: null });
  };

  const setServices = (ids: readonly string[]) => {
    const draft = stateRef.current.draft;
    if (!draft) return;
    const wanted = new Set(ids);
    draft.serviceIds.filter((id) => !wanted.has(id)).forEach((serviceId) => apply({ type: "toggleService", serviceId }));
    ids.filter((id) => !draft.serviceIds.includes(id)).forEach((serviceId) => apply({ type: "toggleService", serviceId }));
  };

  const askPerson = (text?: string) => {
    const current = stateRef.current;
    const entries: QuestionEntry[] = [{ label: t("booking.person.self"), value: "self", emoji: "🙋" }];
    for (const guest of current.customer?.guests ?? []) entries.push({ label: guest.name, value: `guest:${guest.id}`, description: guest.relation, image: null });
    for (const item of current.items) {
      const person = item.person;
      if (person.kind === "new" && !entries.some((entry) => entry.label === person.name)) entries.push({ label: person.name, value: `new:${person.name}|${person.relation}`, description: person.relation, image: null });
    }
    ask(makeQuestion("person", t("booking.chat.personTitle"), entries, { otherLabel: t("booking.person.add"), otherPlaceholder: t("booking.chat.personPlaceholder") }), text);
  };

  const askServices = async (text?: string) => {
    if (!stateRef.current.branchId) {
      presetBranch();
      if (!stateRef.current.branchId) return askBranch();
    }
    ensureDraft();
    const loaded = await loadCatalog();
    const prices = (loaded?.barbers ?? []).map((barber) => barber.prices);
    const entries = (loaded?.services ?? []).map((service) => {
      const values = prices.map((entry) => entry[service.id]).filter((value): value is number => value !== undefined);
      const from = values.length > 0 ? Math.min(...values) : service.price;
      return { label: service.name, value: service.id, description: t("booking.agenda.whatSummary", { minutes: service.durationMin, price: fmt.money(from) }), ...(service.imageUrl ? { image: service.imageUrl } : {}) };
    });
    ask(makeQuestion("services", t("booking.chat.servicesTitle"), entries, { hint: t("booking.chat.servicesHint"), searchPlaceholder: t("booking.services.search"), multiple: { confirmLabel: t("booking.services.next") } }), text);
  };

  /** Lo que se está buscando: la cita en borrador o la que se está moviendo. */
  const target = () => {
    const moving = rescheduling.current;
    if (moving) return { serviceIds: moving.serviceIds, barberId: moving.noPreference ? null : moving.barberId, exclude: moving.id, branchId: moving.branchId };
    const draft = stateRef.current.draft;
    return draft && stateRef.current.branchId ? { serviceIds: draft.serviceIds, barberId: draft.barberId, exclude: undefined, branchId: stateRef.current.branchId } : null;
  };

  const askDay = async (text?: string) => {
    const goal = target();
    if (!goal) return void askServices();
    const branch = shop.branches.find((item) => item.id === goal.branchId);
    const first = branch ? firstBookableDay(branch.closesAt, shop.minNoticeMinutes) : new Date();
    const earliest = await busy(() => bookingApi.earliest({ branchId: goal.branchId, serviceIds: goal.serviceIds, barberId: goal.barberId }).catch(() => null));
    const now = new Date();
    const today = dayKeyOf(now);
    const tomorrow = dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const entries: QuestionEntry[] = [];
    if (earliest?.slot && !rescheduling.current) {
      entries.push({
        label: t("booking.chat.soonest", { when: fmt.when(parseStart(`${earliest.slot.date}T${earliest.slot.time}`)) }),
        value: `slot:${earliest.slot.date}T${earliest.slot.time}`,
        emoji: "⚡",
        description: goal.barberId ? undefined : t("booking.earliest.with", { name: firstName(barberName(earliest.slot.barberId)) }),
      });
    }
    for (let index = 0; index < DAYS_OFFERED; index += 1) {
      const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index);
      const key = dayKeyOf(day);
      entries.push({ label: capitalize(fmt.dayLong(day)), value: `day:${key}`, description: key === today ? t("booking.earliest.today") : key === tomorrow ? t("booking.chat.tomorrow") : undefined });
    }
    const who = goal.barberId ? firstName(barberName(goal.barberId)) : "";
    ask(makeQuestion("day", t("booking.chat.dayTitle"), entries, { hint: who ? t("booking.chat.dayHintWith", { name: who }) : undefined, otherLabel: t("booking.chat.otherDate"), otherPlaceholder: t("booking.chat.otherDatePlaceholder") }), text);
  };

  const askTimes = async (date: string, window?: DayWindow, text?: string) => {
    const goal = target();
    if (!goal) return void askServices();
    timesDay.current = date;
    const params = { branchId: goal.branchId, date, serviceIds: goal.serviceIds, barberId: goal.barberId, exclude: goal.exclude };
    const availability = await busy(() =>
      queryClient
        .fetchQuery({ queryKey: bookingKeys.availability(params.branchId, date, params.serviceIds, params.barberId, params.exclude), queryFn: ({ signal }) => bookingApi.availability(params, signal), staleTime: 30_000 })
        .catch(() => ({ date, slots: [] }))
    );
    const day = fmt.dayLong(parseStart(`${date}T00:00`));
    const slots = availability.slots;
    if (slots.length === 0) {
      // Sin horas con su barbero: primero otros que hacen lo mismo y sí tienen; después, el resto de opciones.
      const name = goal.barberId ? firstName(barberName(goal.barberId)) : "";
      const others = goal.barberId && !rescheduling.current ? await profiles.alternativeEntries({ branchId: goal.branchId, serviceIds: goal.serviceIds, barberId: goal.barberId }, date) : [];
      const entries: QuestionEntry[] = [
        ...others,
        ...(goal.barberId && !rescheduling.current ? [{ label: t("booking.chat.reply.anyBarber"), value: "any", description: t("booking.chat.anyThatDay"), emoji: "✂️" }] : []),
        { label: name ? t("booking.chat.otherDayWith", { name }) : t("booking.chat.otherDay"), value: "otherDay", emoji: "📅" },
        ...(goal.barberId && !rescheduling.current ? [{ label: t("booking.chat.otherBarber"), value: "otherBarber", emoji: "💈" }] : []),
        ...(!rescheduling.current ? [{ label: t("booking.chat.waitlistJoin"), value: "waitlist", description: t("booking.chat.waitlistHint"), emoji: "🔔" }] : []),
      ];
      const lead = name ? (others.length > 0 ? t("booking.chat.noTimesWithAlts", { name, day }) : t("booking.chat.noTimesWith", { name, day })) : t("booking.chat.noTimes", { day });
      return ask(makeQuestion("noTimes", t("booking.chat.noTimesTitle"), entries), [text, lead].filter(Boolean).join(" "));
    }
    const hourOf = (time: string) => Number(time.slice(0, 2));
    const inWindow = window ? slots.filter((slot) => (window === "morning" ? hourOf(slot.time) < 12 : window === "afternoon" ? hourOf(slot.time) >= 12 && hourOf(slot.time) < 18 : hourOf(slot.time) >= 18)) : slots;
    const shown = inWindow.length > 0 ? inWindow : slots;
    const entries: QuestionEntry[] = [
      ...shown.map((slot) => ({ label: fmt.clock(slot.time), value: `time:${slot.time}`, description: goal.barberId ? undefined : t("booking.chat.freeBarbers", { count: slot.barberIds.length }) })),
      { label: t("booking.chat.otherDay"), value: "otherDay" },
    ];
    ask(makeQuestion("time", t("booking.chat.timeTitle", { day }), entries, shown.length > 8 ? { searchPlaceholder: t("booking.chat.timeSearch") } : {}), text);
  };

  const heldText = () => {
    const current = stateRef.current;
    const item = current.items.at(-1);
    if (!item?.start) return t("booking.chat.cartLead");
    return t("booking.chat.held", {
      services: serviceNames(item.serviceIds),
      barber: item.barberId ? t("booking.chat.withName", { name: barberName(item.barberId) }) : t("booking.chat.withAny"),
      when: fmt.when(parseStart(item.start)),
      who: item.person.kind === "self" ? "" : ` ${t("booking.chat.forWhom", { name: personName(item.person, current.customer) })}`,
    });
  };

  const askMore = (text?: string) => {
    const entries: QuestionEntry[] = [
      { label: t("booking.chat.reply.pay"), value: "pay", emoji: "💳" },
      { label: t("booking.chat.moreAnother"), value: "another", description: t("booking.chat.moreAnotherHint"), emoji: "➕" },
      ...((catalogRef.current?.products.length ?? 0) > 0 ? [{ label: t("booking.chat.moreProducts"), value: "products", emoji: "🧴" }] : []),
      { label: t("booking.chat.moreNote"), value: "note", emoji: "📝" },
      ...(stateRef.current.items.length > 0 ? [{ label: t("booking.chat.moreEdit"), value: "edit", emoji: "✏️" }] : []),
    ];
    ask(makeQuestion("more", t("booking.chat.moreTitle"), entries), text);
  };

  /** Para seguir cuando algo terminó (moviste o cancelaste una cita, no hay citas): reservar o ver tus citas. */
  const askNext = (text?: string, withManage = true) =>
    ask(
      makeQuestion("next", t("booking.chat.nextTitle"), [
        { label: t("booking.chat.nextBook"), value: "book", emoji: "✂️" },
        ...(withManage ? [{ label: t("booking.chat.reply.manage"), value: "manage", emoji: "📅" }] : []),
      ]),
      text
    );

  const askEditWhat = (index: number) => {
    const question = makeQuestion("editWhat", t("booking.chat.editWhatTitle"), [
      { label: t("booking.chat.editTime"), value: "time", emoji: "🕒" },
      { label: t("booking.chat.editBarber"), value: "barber", emoji: "💈" },
      { label: t("booking.chat.editServices"), value: "services", emoji: "✂️" },
      { label: t("booking.chat.editRemove"), value: "remove", emoji: "🗑️" },
    ]);
    ask({ ...question, values: { ...question.values, __index: String(index) } });
  };

  const commitTime = async (start: string, lead?: string) => {
    const moving = rescheduling.current;
    if (!moving) {
      // Sin preferencia, el precio es el de quien la agenda asigna a esa hora: el primero libre.
      const current = stateRef.current;
      const cached = current.branchId && current.draft ? queryClient.getQueryData<Availability>(bookingKeys.availability(current.branchId, start.slice(0, 10), current.draft.serviceIds, null)) : undefined;
      apply({ type: "chooseTime", start, assignedBarberId: cached?.slots.find((slot) => slot.time === start.slice(11, 16))?.barberIds[0] ?? null });
      return askMore([lead, heldText()].filter(Boolean).join(" "));
    }
    const token = stateRef.current.token;
    if (!token) return;
    try {
      await busy(() => bookingApi.reschedule(token, moving.id, { start, barberId: moving.noPreference ? null : moving.barberId }));
      rescheduling.current = null;
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      askNext(t("booking.chat.moved", { when: fmt.when(parseStart(start)) }));
    } catch (error) {
      say({ text: describeError(error).description });
      void askDay();
    }
  };

  /** Lo de una frase aplicado de una vez: servicios, barbero, día y hora; pregunta lo que falte. */
  const fulfil = async (parsed: ParsedRequest) => {
    if (!stateRef.current.branchId) {
      presetBranch();
      if (!stateRef.current.branchId) return askBranch();
    }
    ensureDraft();
    if (parsed.serviceIds.length > 0) setServices(parsed.serviceIds);
    if (parsed.barberId !== undefined) apply({ type: "chooseBarber", barberId: parsed.barberId });
    const ready = stateRef.current.draft;
    if (!ready || ready.serviceIds.length === 0) return askServices(t("booking.chat.whichService"));
    if (parsed.time) {
      const branch = shop.branches.find((item) => item.id === stateRef.current.branchId);
      const date = parsed.date ?? timesDay.current ?? (branch ? dayKeyOf(firstBookableDay(branch.closesAt, shop.minNoticeMinutes)) : dayKeyOf(new Date()));
      const params = { branchId: stateRef.current.branchId as string, date, serviceIds: ready.serviceIds, barberId: ready.barberId };
      const availability = await busy(() =>
        queryClient.fetchQuery({ queryKey: bookingKeys.availability(params.branchId, date, params.serviceIds, params.barberId), queryFn: ({ signal }) => bookingApi.availability(params, signal), staleTime: 30_000 }).catch(() => ({ date, slots: [] }))
      );
      const when = fmt.when(parseStart(`${date}T${parsed.time}`));
      // Libre: se confirma con quién y cuándo, y se aparta.
      if (availability.slots.some((slot) => slot.time === parsed.time)) return commitTime(`${date}T${parsed.time}`, t("booking.chat.isFree"));
      return offerNear(date, parsed.time, availability.slots, when);
    }
    if (parsed.date) return askTimes(parsed.date, parsed.window);
    if (parsed.barberId !== undefined) return askDay();
    return askBarber();
  };

  /**
   * La hora pedida no está libre: como lo diría alguien en la barbería, lo más cercano con el mismo
   * barbero y quién más está libre a esa misma hora; o todas las horas del día.
   */
  const offerNear = async (date: string, time: string, slots: readonly Slot[], when: string) => {
    const draft = stateRef.current.draft;
    const branchId = stateRef.current.branchId;
    if (!draft || !branchId) return;
    timesDay.current = date;
    const minutesOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const nearest = [...slots].sort((a, b) => Math.abs(minutesOf(a.time) - minutesOf(time)) - Math.abs(minutesOf(b.time) - minutesOf(time))).slice(0, NEAR_TIMES);
    const others: QuestionEntry[] = [];
    if (draft.barberId) {
      const params = { branchId, date, serviceIds: draft.serviceIds, barberId: null };
      const anyone = await queryClient
        .fetchQuery({ queryKey: bookingKeys.availability(branchId, date, draft.serviceIds, null), queryFn: ({ signal }) => bookingApi.availability(params, signal), staleTime: 30_000 })
        .catch(() => ({ date, slots: [] as Slot[] }));
      const free = anyone.slots.find((slot) => slot.time === time)?.barberIds.filter((id) => id !== draft.barberId) ?? [];
      free.slice(0, NEAR_OTHERS).forEach((id) => others.push({ label: t("booking.chat.withAt", { name: firstName(barberName(id)), time: fmt.clock(time) }), value: `with:${id}|${time}`, image: catalogRef.current?.barbers.find((barber) => barber.id === id)?.avatarUrl ?? null }));
    }
    const name = draft.barberId ? firstName(barberName(draft.barberId)) : "";
    const entries: QuestionEntry[] = [
      ...nearest.map((slot) => ({ label: fmt.clock(slot.time), value: `time:${slot.time}`, description: name ? t("booking.chat.withName", { name }) : undefined })),
      ...others,
      { label: t("booking.chat.allTimes"), value: "allTimes" },
    ];
    const lead = name ? t("booking.chat.notFreeWith", { name, when }) : t("booking.chat.notFree", { when });
    const hint = nearest.length > 0 ? t(others.length > 0 ? "booking.chat.nearAndOthers" : "booking.chat.nearOnly") : others.length > 0 ? t("booking.chat.othersOnly") : "";
    ask(makeQuestion("time", t("booking.chat.nearTitle"), entries), [lead, hint].filter(Boolean).join(" "));
  };

  const startBooking = (text?: string) => {
    presetBranch();
    if (!stateRef.current.branchId) return askBranch();
    // Lo pedido antes de tener sede (en la portada o en una frase) se atiende ahora.
    if (handlers.current?.takeIntent()) return;
    ensureDraft();
    if ((stateRef.current.customer?.guests.length ?? 0) > 0 && stateRef.current.items.length === 0) return askPerson(text);
    void askServices(text);
  };

  /** Tras un desvío (ver una sede o un perfil), la pregunta que quedó sin responder, otra vez. */
  /** Vuelve a mostrar la pregunta que quedó sin responder; `false` si no hay ninguna. */
  const resume = (lead: string = t("booking.chat.resume")): boolean => {
    const pending = [...turnsRef.current].reverse().find((turn) => turn.question && turn.question.answer === undefined && !["branchInfo", "branchConfirm"].includes(turn.question.kind));
    if (!pending?.question || !canBook()) return false;
    ask({ ...pending.question }, lead);
    return true;
  };
  const profiles = useChatProfiles({ t, fmt, shop, apply, say, ask, busy, stateRef, catalogRef, loadCatalog, serviceNames, startBooking, askDay, askServices, resume, lastTeam });
  const { askBranch, askBarber, info } = profiles;
  const extras = useChatExtras({ t, fmt, apply, say, ask, expect, stateRef, catalogRef, pushUser, askMore });
  const pay = useChatCheckout({ t, fmt, shop, queryClient, apply, say, ask, busy, expect, settle: (turnId: string, label: string) => settle(turnId, label), receiptPlan, stateRef, catalogRef, totalsRef, payment, suggestion, managing, rescheduling, pendingManage, serviceNames, barberName, onFinish, askMore, startBooking, askDay, askPhone: confirmIdentity, askServices, askNext, startNewCard: (lead?: string) => newCard.start(lead) });
  const newCard = useChatNewCard({ t, say, ask, expect, stateRef, payment, cardDraft, askMethod: pay.askMethod });
  const { checkout, manage, askMethod, askConfirm } = pay;

  /** Pagar: si aún no se sabe quién es, primero el código (o el celular, si no lo dio) y luego al pago. */
  const payOrIdentify = () => {
    if (!stateRef.current.verified || !stateRef.current.customer) {
      pendingCheckout.current = true;
      return confirmIdentity(t("booking.chat.phoneToFinish"));
    }
    return checkout();
  };

  /**
   * «Volver»: un paso atrás en el orden de la reserva (barbero → servicios, día → barbero, hora → día; tras
   * apartar, se abre la cita para cambiarla). En el pago, la pregunta anterior del hilo otra vez.
   */
  const back = (): boolean => {
    const turns = turnsRef.current;
    const open = activeQuestionTurn(turns);
    const lead = t("booking.chat.asideBack");
    const reopen = () => stateRef.current.items.length > 0 && !stateRef.current.draft && apply({ type: "editItem", index: stateRef.current.items.length - 1 });
    const steps: Partial<Record<string, () => void>> = {
      barber: () => void askServices(lead),
      day: () => askBarber(lead),
      time: () => void askDay(lead),
      noTimes: () => void askDay(lead),
      tip: () => askMore(lead),
      more: () => {
        reopen();
        void askDay(lead);
      },
    };
    const step = open?.question ? steps[open.question.kind] : undefined;
    if (step) {
      step();
      return true;
    }
    const PAYMENT = ["tip", "discount", "method", "card"];
    const before = turns.slice(0, open ? turns.indexOf(open) : turns.length).filter((turn) => turn.question && PAYMENT.includes(turn.question.kind) && turn.question.kind !== open?.question?.kind);
    const previous = before.at(-1)?.question;
    if (!previous) return false;
    // Se vuelve a preguntar sin la respuesta que se le dio.
    ask({ ...previous, answer: undefined }, lead);
    return true;
  };
  const intents = useChatIntents({ t, fmt, shop, apply, say, stateRef, catalogRef, totalsRef, serviceNames, barberName, askServices, askBarber, askDay, askBranch, showBarber: profiles.showBarber, showBranch: profiles.showBranch, call: () => call(), info, manage, resume, back, canBook });

  /* ───────────────────────────── al saludar ───────────────────────────── */

  /** Lo pedido en la portada, ya con quien reserva: se entiende como cualquier frase. */
  const takeIntent = (): boolean => {
    const text = pendingIntent.current;
    if (!text) return false;
    pendingIntent.current = null;
    void interpret(text);
    return true;
  };

  const greet = async (again = false) => {
    const current = stateRef.current;
    const customer = current.customer;
    if (!customer) return;
    presetBranch();
    // Ya se le saludó al reconocerlo por su celular: ahora solo se confirma el código y se sigue.
    if (again) say({ text: t("booking.chat.codeOk") });
    // Confirmó el código para la lista de espera: se apunta con la franja que había elegido.
    if (pendingWaitlist.current) {
      const window = pendingWaitlist.current;
      pendingWaitlist.current = null;
      return void joinWaitlist(window);
    }
    // Se identificó para pagar lo que ya armó: un saludo corto y al pago, sin volver a empezar.
    if (pendingCheckout.current) {
      pendingCheckout.current = false;
      if (!again) say({ text: customer.isNew ? t("booking.chat.niceToMeet", { name: customer.firstName }) : t("booking.chat.knownHello", { name: customer.firstName }) });
      return void checkout();
    }
    if (again) {
      if (pendingManage.current) return manage();
      return;
    }
    if (customer.isNew) {
      // El descuento de primera visita no se anuncia aquí: se ve y se aplica solo en el pago.
      say({ text: t("booking.chat.niceToMeet", { name: customer.firstName }) });
      if (pendingManage.current) return manage();
      if (takeIntent()) return;
      return startBooking();
    }
    // Un saludo corto: la membresía se cuenta en el pago y las citas próximas están en «Mis citas».
    const extra = [customer.credit > 0 ? t("booking.welcome.credit", { amount: fmt.money(customer.credit) }) : ""].filter(Boolean);
    say({ text: [t("booking.chat.knownHello", { name: customer.firstName }), ...extra].join("\n\n") });
    if (pendingManage.current) return manage();
    if (takeIntent()) return;
    const spoken = userTurns.current;
    await loadCatalog();
    const next = current.token ? await bookingApi.suggestion(current.token).then((result) => result.suggestion, () => null) : null;
    suggestion.current = next;
    if (userTurns.current !== spoken) return;
    const entries: QuestionEntry[] = [];
    next?.options.forEach((option, index) => {
      entries.push({
        label: capitalize(fmt.when(parseStart(option.start))),
        value: `slot:${index}`,
        image: catalogRef.current?.barbers.find((barber) => barber.id === option.barberId)?.avatarUrl ?? null,
        description: t("booking.chat.withName", { name: barberName(option.barberId) }),
      });
    });
    if (customer.lastVisit) entries.push({ label: t("booking.chat.sameOtherDay"), value: "repeat", description: serviceNames(customer.lastVisit.serviceIds), emoji: "🔁" });
    entries.push({ label: t("booking.chat.reply.different"), value: "different", emoji: "✂️" });
    if (customer.upcoming > 0) entries.push({ label: t("booking.chat.reply.manage"), value: "manage", emoji: "📅" });
    if (shop.packages.length > 0) entries.push({ label: t("booking.packages.cta"), value: "packages", emoji: "🎟️" });
    if (shop.payment.card) entries.push({ label: t("booking.gift.cta"), value: "gift", emoji: "🎁" });
    // Invita a decir de una vez cuándo; «sí» o «el viernes a las 5» agendan lo de siempre (`interpret`).
    const lead = next ? t("booking.chat.dueAsk", { service: serviceNames(next.serviceIds) }) : undefined;
    ask(makeQuestion("home", next ? t("booking.chat.homeTitleDue") : t("booking.chat.homeTitle"), entries), lead);
  };

  /* ───────────────────────────── respuestas ───────────────────────────── */

  const onHome = (value: string | null) => {
    const current = stateRef.current;
    if (value?.startsWith("slot:")) {
      const option = suggestion.current?.options[Number(value.slice(5))];
      if (!option || !suggestion.current) return;
      apply({ type: "acceptSuggestion", branchId: suggestion.current.branchId, serviceIds: suggestion.current.serviceIds, barberId: option.barberId, start: option.start });
      return askMore(heldText());
    }
    if (value === "repeat" && current.customer?.lastVisit) {
      apply({ type: "repeatLastVisit", lastVisit: current.customer.lastVisit });
      return void askDay();
    }
    if (value === "manage") return void manage();
    if (value === "gift" || value === "packages") return apply({ type: "goTo", step: value });
    startBooking();
  };

  const onPerson = (value: string | null, label: string, isOther: boolean) => {
    if (isOther) {
      pendingName.current = capitalize(label.trim());
      return ask(makeQuestion("relation", t("booking.chat.relationTitle", { name: pendingName.current }), RELATIONS.map((key) => ({ label: t(key), value: t(key) }))));
    }
    const guest = value?.startsWith("guest:") ? stateRef.current.customer?.guests.find((item) => item.id === value.slice(6)) : undefined;
    const [newName = "", newRelation = ""] = value?.startsWith("new:") ? value.slice(4).split("|") : [];
    const person: BookingPerson = guest ? { kind: "guest", guestId: guest.id, name: guest.name, relation: guest.relation } : newName ? { kind: "new", name: newName, relation: newRelation } : { kind: "self" };
    ensureDraft(person);
    apply({ type: "setPerson", person });
    void askServices();
  };

  const onMore = (value: string | null) => {
    const current = stateRef.current;
    if (value === "pay") return payOrIdentify();
    if (value === "another") {
      apply({ type: "openDraft", person: { kind: "self" }, serviceIds: [], barberId: null });
      return askPerson(t("booking.chat.anotherAsk"));
    }
    if (value === "products") return extras.askProducts();
    if (value === "note") return extras.askNote();
    if (current.items.length === 1) return askEditWhat(0);
    ask(
      makeQuestion(
        "editPick",
        t("booking.chat.editPickTitle"),
        current.items.map((item, index) => ({ label: `${serviceNames(item.serviceIds)} — ${item.start ? fmt.when(parseStart(item.start)) : ""}`, value: String(index), description: personName(item.person, current.customer) }))
      )
    );
  };

  /** Se apunta a la lista de espera del día que miraba, con la franja elegida. */
  const joinWaitlist = async (window: string) => {
    const current = stateRef.current;
    const draft = current.draft;
    const day = timesDay.current;
    if (!current.token || !current.branchId || !draft || !day) return;
    try {
      await busy(() => bookingApi.joinWaitlist(current.token as string, { branchId: current.branchId as string, date: day, serviceIds: draft.serviceIds, barberId: draft.barberId, window: window as DayWindow | "any" }));
      say({ text: t("booking.chat.waitlistDone", { day: fmt.dayLong(parseStart(`${day}T00:00`)) }) });
    } catch (error) {
      say({ text: describeError(error).description });
    }
    return askDay(t("booking.chat.meanwhile"));
  };

  const handle = async (question: BookingQuestion, label: string, isOther: boolean) => {
    const value = isOther ? null : (question.values[label] ?? null);
    if (await pay.answerCheckout(question, value, label, isOther)) return;
    if (await profiles.answerProfile(question, value, label, isOther)) return;
    if (newCard.answerCard(question, value)) return;
    const current = stateRef.current;
    switch (question.kind) {
      case "next":
        if (value === "manage") return manage();
        return canBook() ? startBooking() : askPhone();
      case "blocked":
        if (value === "call") window.location.href = `tel:${shop.phone}`;
        apply({ type: "signOut" });
        return askPhone();
      case "consent":
        return createProfile(value === "yes");
      case "home":
        return onHome(value);
      case "person":
        return onPerson(value, label, isOther);
      case "relation":
        ensureDraft();
        apply({ type: "setPerson", person: { kind: "new", name: pendingName.current, relation: label } });
        return askServices();
      case "services":
        ensureDraft();
        setServices(splitMultipleAnswer(label).map((part) => question.values[part]).filter((id): id is string => Boolean(id)));
        return askBarber();
      case "day": {
        if (value?.startsWith("slot:")) return commitTime(value.slice(5));
        if (value?.startsWith("day:")) return askTimes(value.slice(4));
        const parsed = parseBookingText(label, { services: [], barbers: [], now: new Date() });
        if (parsed.date) return askTimes(parsed.date, parsed.window);
        say({ text: t("booking.chat.badDate") });
        return askDay();
      }
      case "time":
        if (value?.startsWith("time:") && timesDay.current) return commitTime(`${timesDay.current}T${value.slice(5)}`);
        // A esa misma hora, con otro barbero que sí está libre.
        if (value?.startsWith("with:") && timesDay.current) {
          const [barberId = "", time = ""] = value.slice(5).split("|");
          apply({ type: "chooseBarber", barberId });
          return commitTime(`${timesDay.current}T${time}`, t("booking.chat.isFree"));
        }
        if (value === "allTimes" && timesDay.current) return askTimes(timesDay.current);
        return askDay();
      case "noTimes":
        if (value?.startsWith("alt:")) {
          const [barberId = "", date = ""] = value.slice(4).split("|");
          apply({ type: "chooseBarber", barberId });
          return askTimes(date);
        }
        if (value === "any") {
          apply({ type: "chooseBarber", barberId: null });
          return askTimes(timesDay.current ?? dayKeyOf(new Date()));
        }
        if (value === "otherBarber") return askBarber();
        if (value === "waitlist") return ask(makeQuestion("waitlist", t("booking.chat.waitlistTitle"), (["morning", "afternoon", "evening", "any"] as const).map((window) => ({ label: t(`booking.waitlist.${window}`), value: window }))));
        return askDay();
      case "waitlist":
        if (!value) return;
        // Apuntarse pide el código: al confirmarlo se apunta solo (`greet`).
        if (!current.verified) {
          pendingWaitlist.current = value;
          return confirmIdentity(t("booking.chat.waitlistNeedsPhone"));
        }
        return joinWaitlist(value);
      case "more":
        return onMore(value);
      case "editPick":
        return askEditWhat(Number(value));
      case "editWhat": {
        const index = Number(question.values.__index ?? "0");
        if (value === "remove") {
          apply({ type: "removeItem", index });
          return stateRef.current.items.length === 0 ? startBooking(t("booking.chat.removedAll")) : askMore(t("booking.chat.removed"));
        }
        apply({ type: "editItem", index });
        if (value === "services") return askServices(t("booking.chat.editing"));
        if (value === "barber") return askBarber();
        return askDay();
      }
      case "products":
        return extras.answerProducts(question, label);
    }
  };

  /** Deja la pregunta como respondida con `label`, sin atenderla (quien llama ya lo hizo). */
  const settle = (turnId: string, label: string) =>
    setTurns((current) => current.map((item) => (item.id === turnId && item.question ? { ...item, question: { ...item.question, answer: label } } : item)));

  /** Se respondió la pregunta abierta: tocando una opción (`echo`: su texto como mensaje) o escribiéndola. */
  const answer = (turnId: string, label: string, { echo = true, isOther }: { echo?: boolean; isOther?: boolean } = {}) => {
    const turn = turnsRef.current.find((item) => item.id === turnId);
    const question = turn?.question;
    if (!question || question.answer !== undefined) return;
    settle(turnId, label);
    if (echo) pushUser(label);
    void handle(question, label, isOther ?? !isKnownAnswer(question, label));
  };

  const call = () => say({ text: t("booking.chat.callText", { phone: formatPhone(shop.phone), href: `tel:${shop.phone}` }) });

  const greetAtStart = React.useCallback(
    () =>
      say(
        { text: t("booking.chat.hello", { shop: shop.name }) },
        { text: t("booking.chat.askPhone") }
      ),
    [say, shop.name, t]
  );

  const restart = () => {
    apply({ type: "restart" });
    expect(identityLast ? null : "phone");
    pendingManage.current = false;
    pendingCheckout.current = false;
    pendingWaitlist.current = null;
    seenCustomer.current = null;
    rescheduling.current = null;
    setTurns([]);
    if (!identityLast) return greetAtStart();
    say({ text: t("booking.chat.helloLast", { shop: shop.name }) });
    startBooking();
  };

  /** Los botones de la cabecera: «Mis citas» y empezar de nuevo. */
  const reply = (id: ChatReplyId, label: string) => {
    pushUser(label);
    if (id === "restart") return restart();
    void manage();
  };

  const interpret = async (text: string) => {
    // La sede de siempre (o la única) antes de leer el catálogo, que depende de ella.
    if (!stateRef.current.branchId) presetBranch();
    const loaded = await loadCatalog();
    const parsed = parseBookingText(text, { services: loaded?.services ?? [], barbers: loaded?.barbers ?? [], now: new Date() });
    if (parsed.intent === "manage") return manage();
    if (parsed.intent === "pay") return payOrIdentify();
    if (parsed.intent === "help") return say({ text: t("booking.chat.help") });
    // A la propuesta del saludo («¿Te agendamos tu Ritual premium de siempre?»): un día, una hora o un «sí» es lo de siempre.
    const lastVisit = stateRef.current.customer?.lastVisit;
    if (lastVisit && parsed.serviceIds.length === 0 && activeQuestionTurn(turnsRef.current)?.question?.kind === "home") {
      if (parsed.date || parsed.time || parsed.window) {
        apply({ type: "repeatLastVisit", lastVisit });
        return fulfil(parsed);
      }
      if (SAYS_YES.test(plain(text).trim())) return onHome("repeat");
    }
    // Sin sede aún no hay servicios ni barberos que reconocer: se guarda lo pedido, se pregunta la
    // sede y, al elegirla, se vuelve a entender (`startBooking`). Así «corte con Andrés» no se pierde.
    if (!stateRef.current.branchId && parsed.intent !== "another") {
      pendingIntent.current = text;
      return askBranch();
    }
    if (parsed.serviceIds.length > 0 || parsed.barberId !== undefined || parsed.date || parsed.time || parsed.window) return fulfil(parsed);
    if (parsed.intent === "another") {
      apply({ type: "openDraft", person: { kind: "self" }, serviceIds: [], barberId: null });
      return askPerson(t("booking.chat.anotherAsk"));
    }
    // Sin entender la frase, la pregunta que estaba abierta vuelve a quedar a la vista.
    if (!resume(t("booking.chat.fallback"))) say({ text: t("booking.chat.fallback") });
  };

  /** Lo que se escribe en la caja: según lo que se esté esperando, la pregunta abierta o una frase para entender. */
  const send = (text: string, files: readonly File[] = []) => {
    const waiting = expecting.current;
    // La nota para el barbero con sus fotos (el clip solo aparece mientras se escribe la nota).
    if (waiting === "note") return void extras.submitNote(text, files);
    const secret = waiting === "code" || waiting === "cvc" || isCardStep(waiting);
    // «Perfil de Andrés», «cómo es la sede Centro»: el detalle antes de elegir.
    if (!waiting && looksLikeDetail(text)) {
      pushUser(text);
      // Sin un nombre que reconocer («el perfil del barbero que elegí»), se entiende como pregunta de pasada.
      const fallback = detectAside(text);
      void profiles.detailRequest(text).then(async (found) => {
        if (found) return;
        if (fallback) await intents.handleAside(fallback);
        else await interpret(text);
      });
      return;
    }
    // Un número o un trozo de una opción de la pregunta abierta: el mensaje queda con el texto de la opción.
    const open = waiting ? undefined : activeQuestionTurn(turnsRef.current);
    // Con la sesión del código ya se puede responder (el cliente nuevo aún no tiene ficha al dar el permiso).
    const option = open?.question && !open.question.multiple && canBook() ? matchOption(open.question, text) : null;
    if (open && option) return answer(open.id, option, { echo: true, isOther: false });
    // De pasada: volver, cambiar algo ya elegido o preguntar (la dirección, el perfil de su barbero, cuánto lleva…).
    const aside = waiting ? null : detectAside(text);
    if (aside) {
      pushUser(text);
      void intents.handleAside(aside).then((done) => (done ? undefined : canBook() ? interpret(text) : askPhone(t("booking.chat.needPhone"))));
      return;
    }
    const loose = open?.question && !open.question.multiple && canBook() ? matchOptionLoosely(open.question, text) : null;
    if (open && loose) {
      pushUser(text);
      return answer(open.id, loose, { echo: false, isOther: false });
    }
    pushUser(isCardStep(waiting) ? maskCardInput(waiting, text) : secret ? "•".repeat(Math.min(6, text.replace(/\s/g, "").length)) : text);
    const quick = parseBookingText(text, { services: [], barbers: [], now: new Date() }).intent;
    if (!secret && quick === "restart") return restart();
    if (!secret && quick === "info") return info();
    if (!secret && quick === "call") return call();
    if (waiting === "phone" && quick === "manage") {
      pendingManage.current = true;
      return say({ text: t("booking.chat.manageNeedsPhone") });
    }
    if (waiting === "phone") return void submitPhone(text);
    if (waiting === "code" && /reenvi|resend|otro codigo|no (me )?(ha )?llega/.test(plain(text))) return void submitPhone(stateRef.current.phone.replace(/^\+(57)?/, ""));
    if (waiting === "code" && /cambiar (el |mi )?numero|change number|otro numero|numero (esta )?mal|me equivoque/.test(plain(text))) {
      apply({ type: "signOut" });
      return askPhone();
    }
    if (waiting === "code") return void submitCode(text);
    if (isCardStep(waiting)) return newCard.submit(waiting, text);
    if (isReceiptStep(waiting)) return pay.submitReceiptTarget(waiting, text);
    if (waiting === "firstName" || waiting === "lastName" || waiting === "email") return submitProfileText(text);
    if (waiting === "cvc") {
      const card = stateRef.current.customer?.cards.find((item) => item.id === payment.current?.cardChoice);
      const cvc = text.replace(/\D/g, "");
      if (!card || !isCvcComplete(cvc, brandFromName(card.brand))) return say({ text: t("booking.chat.badCvc") });
      expect(null);
      payment.current?.setSavedCvc(cvc);
      return askConfirm();
    }
    if (!canBook()) return askPhone(t("booking.chat.needPhone"));
    // «A los dos», «por SMS», un correo o un celular, con la lista del recibo abierta.
    if (open && pay.answerTypedReceipt(open, text)) return;
    if (open?.question && !open.question.multiple && open.question.otherPlaceholder) return answer(open.id, text.trim(), { echo: false, isOther: true });
    void interpret(text);
  };

  /** La pasarela respondió con un error o se agregó una tarjeta nueva en su hoja. */
  const onPaymentEvent = (event: PaymentEvent) => {
    if (event.kind === "failed") return askMethod(event.message);
    say({ text: t("booking.chat.cardAdded", { last4: event.last4 }) });
    askConfirm();
  };

  /* ───────────────────────────── lo que reacciona ───────────────────────────── */

  React.useLayoutEffect(() => {
    stateRef.current = state;
    catalogRef.current = catalog;
    totalsRef.current = totals;
    turnsRef.current = turns;
    handlers.current = { greet: (again?: boolean) => void greet(again), reserved: pay.reserved, takeIntent };
  });

  // Al abrir: el saludo y quién eres (como en WhatsApp, primero se sabe quién escribe).
  React.useEffect(() => {
    if (started.current || deferStart) return;
    started.current = true;
    greetAtStart();
  }, [greetAtStart, deferStart]);

  /**
   * Desde la portada: con lo que pidió, queda su mensaje y se le pide el celular para apartarlo;
   * sin nada (fue directo al chat), el saludo de siempre.
   */
  const begin = (text?: string) => {
    if (started.current) return;
    started.current = true;
    const wanted = text?.trim();
    // Identidad al final: se saluda y se arma la cita de una vez; el celular, al pagar.
    if (identityLast) {
      if (wanted) pushUser(wanted);
      say({ text: t("booking.chat.helloLast", { shop: shop.name }) });
      return wanted ? void interpret(wanted) : startBooking();
    }
    if (!wanted) return greetAtStart();
    pendingIntent.current = wanted;
    pushUser(wanted);
    say({ text: t("booking.chat.helloWithIntent", { shop: shop.name }) }, { text: t("booking.chat.askPhone") });
  };

  // Cuando ya se sabe quién es (reconocido por su celular, por el código o al crear su perfil), se le
  // saluda por su nombre. Si ya se le había reconocido y ahora confirmó el código, se sigue sin saludar otra vez.
  const customerId = state.customer?.id ?? null;
  const verified = state.verified;
  React.useEffect(() => {
    if (!customerId) return;
    const key = `${customerId}:${verified}`;
    if (seenCustomer.current === key) return;
    const again = seenCustomer.current?.startsWith(`${customerId}:`) ?? false;
    seenCustomer.current = key;
    handlers.current?.greet(again);
  }, [customerId, verified]);

  // La reserva hecha: el recibo en la conversación.
  const reservationId = state.reservation?.id ?? null;
  React.useEffect(() => {
    if (!reservationId || seenReservation.current === reservationId) return;
    seenReservation.current = reservationId;
    handlers.current?.reserved();
  }, [reservationId]);

  const placeholderKey: Record<NonNullable<Expecting>, AppMessageKey> = {
    phone: "booking.chat.placeholderPhone",
    code: "booking.chat.placeholderCode",
    cvc: "booking.chat.placeholderCvc",
    email: "booking.chat.placeholderEmail",
    firstName: "booking.chat.placeholderName",
    lastName: "booking.chat.placeholderName",
    note: "booking.chat.placeholderNote",
    cardNumber: "booking.chat.placeholderCardNumber",
    cardName: "booking.chat.placeholderCardName",
    cardExpiry: "booking.chat.placeholderCardExpiry",
    cardCvc: "booking.chat.placeholderCvc",
    receiptEmail: "booking.chat.placeholderEmail",
    receiptPhone: "booking.chat.placeholderPhone",
  };
  const open = activeQuestionTurn(turns);
  return {
    turns,
    typing,
    begin,
    send,
    answer,
    reply,
    onPaymentEvent,
    activeTurnId: open?.id ?? null,
    /** Mientras escribe la nota para el barbero, la caja deja adjuntar fotos (las que aún caben). */
    photoRoom: expectingNow === "note" ? Math.max(0, MAX_REFERENCE_PHOTOS - state.referencePhotos.length) : 0,
    placeholder: t(expectingNow ? placeholderKey[expectingNow] : "booking.chat.placeholder"),
    /** Lo que se espera no debe quedar a la vista (el código, la tarjeta): el modo voz lo muestra con puntos. */
    secret: expectingNow === "code" || expectingNow === "cvc" || isCardStep(expectingNow),
  };
}

export type ChatEngine = ReturnType<typeof useChatBooking>;
