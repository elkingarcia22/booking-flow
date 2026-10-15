import type { useAppT } from "@/app/i18n";
import { bookingApi } from "../../api";
import { personName, type BookingAction, type BookingState } from "../../bookingState";
import { openStateOf, parseStart, type BookingFormatters } from "../../bookingFormat";
import type { Totals } from "../../pricing";
import type { BookingBarber, BookingCatalog, BookingShop } from "../../types";
import { itemPrice } from "../../useBookingTotals";
import { adjustmentRows } from "./chatCheckout";
import type { MessageInput } from "./chatKit";

/**
 * Lo que se pide «de pasada» en cualquier momento de la conversación, como se
 * le hablaría a una persona: volver atrás, cambiar algo ya elegido (el barbero,
 * los servicios, el día, la sede) o preguntar algo (el perfil del barbero que
 * eligió, la dirección, el horario, cuánto lleva, cuándo es su cita). Se
 * responde y la conversación retoma donde iba.
 */

export type ChatAside =
  | { kind: "back" }
  | { kind: "separate" }
  | { kind: "changeBarber" }
  | { kind: "changeServices" }
  | { kind: "changeTime" }
  | { kind: "changeBranch" }
  | { kind: "myBarber" }
  | { kind: "myBranch" }
  | { kind: "address" }
  | { kind: "hours" }
  | { kind: "phone" }
  | { kind: "summary" }
  | { kind: "price" }
  | { kind: "when" }
  | { kind: "thanks" }
  | { kind: "greeting" }
  | { kind: "who" };

const plain = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CHANGE = "(cambiar|cambia|cambio|cambiemos|otro|otra|diferente|distinto|distinta|mejor con|prefiero|no me sirve|no quiero|elegir otr|escoger otr|modificar|corregir)";

/** Reglas en orden: la primera que coincide gana. Van de lo más concreto a lo más general. */
const RULES: readonly [ChatAside["kind"], RegExp][] = [
  // «Volver», «espera, quiero volver», «me devuelvo», «me equivoqué»; no «volver a reservar» ni «vuelvo el mes que viene».
  ["back", /\b(volver|volvamos|regresar|regresemos|devolverme|devolvernos|me devuelvo|devuelvete|vuelve|atras|deshacer|me equivoque|paso anterior)\b(?! a (agendar|reservar|pedir|venir|empezar))/],
  // «Por separado», «cada uno con un barbero distinto», «la barba con otro barbero»: cada servicio aparte.
  ["separate", /\b(por separado|separar|separado|cada (servicio|uno|cosa) (con|a)|barberos distintos|barberos diferentes|(la barba|el corte|las cejas|el tinte|el afeitado|el tratamiento) (con otr[oa]|a otra hora|aparte))\b/],
  ["changeBarber", new RegExp(`\\b${CHANGE}\\b.*\\b(barbero|barbera|peluquero|estilista)\\b|\\b(barbero|barbera)\\b.*\\b(cambiar|otro|otra|distinto)\\b|\\bcon otr[oa]\\b`)],
  ["changeServices", new RegExp(`\\b${CHANGE}\\b.*\\b(servicio|servicios|corte|barba|lo que me (voy a )?hago)\\b|\\b(agregar|anadir|sumar|quitar)\\b.*\\b(servicio|barba|corte|cejas)\\b`)],
  ["changeTime", new RegExp(`\\b${CHANGE}\\b.*\\b(hora|horario|dia|fecha|turno)\\b|\\b(mas tarde|mas temprano|otro dia|otra hora)\\b`)],
  ["changeBranch", new RegExp(`\\b${CHANGE}\\b.*\\b(sede|sucursal|local|barberia)\\b`)],
  ["myBarber", /\b(perfil|quien es|conocer|info|informacion|fotos|resenas|trabajos|sobre)\b.*\b(barbero|barbera)\b|\b(barbero|barbera) que (elegi|escogi)\b|\bcon quien (voy|quede|me toca)\b/],
  ["myBranch", /\b(perfil|detalle|como es|info|informacion|fotos|conocer)\b.*\b(la sede|la sucursal|el local|la barberia|mi sede)\b/],
  ["address", /\b(direccion|donde (queda|esta|es)|ubicacion|ubicados|como llego|mapa|como llegar)\b/],
  ["hours", /\b(horario|horarios|a que hora (abren|cierran)|abren|cierran|esta abierto|estan abiertos)\b/],
  ["phone", /\b(telefono|numero de (la barberia|ustedes)|llamar|whatsapp de ustedes)\b/],
  ["when", /\b(a que hora es|cuando es|que dia es|a que hora quedo|a que hora quede|mi cita es)\b/],
  ["summary", /\b(resumen|que llevo|que tengo|cuanto (llevo|va|es en total|sale|me sale)|total|mi reserva|mi pedido)\b/],
  ["price", /\b(cuanto (cuesta|vale|cobran|sale)|precio|precios|tarifa)\b/],
  ["thanks", /^(gracias|muchas gracias|mil gracias|genial|super|vale gracias|thanks)\b/],
  ["greeting", /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/],
  ["who", /\b(eres (un )?(bot|robot|humano|persona|ia)|con quien hablo|quien eres)\b/],
];

/** La intención «de pasada» de una frase, o nada si es otra cosa (una respuesta, una reserva). */
export function detectAside(text: string): ChatAside | null {
  const typed = plain(text);
  const rule = RULES.find(([, pattern]) => pattern.test(typed));
  return rule ? ({ kind: rule[0] } as ChatAside) : null;
}

export interface IntentsKit {
  t: ReturnType<typeof useAppT>;
  fmt: BookingFormatters;
  shop: BookingShop;
  apply: (action: BookingAction) => void;
  say: (...messages: MessageInput[]) => void;
  stateRef: { readonly current: BookingState };
  catalogRef: { readonly current: BookingCatalog | undefined };
  totalsRef: { readonly current: Totals };
  serviceNames: (ids: readonly string[]) => string;
  barberName: (id: string | null) => string;
  askServices: (text?: string) => Promise<void>;
  askBarber: (text?: string) => void;
  askDay: (text?: string) => Promise<void>;
  askBranch: (text?: string) => void;
  showBarber: (barber: BookingBarber) => Promise<void>;
  showBranch: (branchId: string, offer: boolean) => Promise<void>;
  call: () => void;
  /** ¿Dónde quedan? sin sede elegida: la lista de sedes para conocer. */
  info: () => void;
  manage: () => Promise<void> | void;
  resume: () => void;
  /** Vuelve a la pregunta anterior de la reserva; `false` si no hay a dónde volver. */
  back: () => boolean;
  /** Ya se está armando una cita (sabe quién es, o dio su celular): se puede cambiar lo elegido. */
  canBook: () => boolean;
  /** Cada servicio aparte: con la cita en curso, o cuál de una ya apartada. `false` si no hay qué separar. */
  separate: () => boolean;
}

/** Las respuestas «de pasada»: cambian lo pedido o responden y retoman. */
export function useChatIntents(kit: IntentsKit) {
  const { t, fmt, shop, apply, say, stateRef, catalogRef, totalsRef, serviceNames, barberName, askServices, askBarber, askDay, askBranch, showBarber, showBranch, call, info, manage, resume, back, canBook, separate } = kit;

  /** Para cambiar algo de una cita ya apartada sin borrador abierto: se abre la última para cambiarla. */
  const reopenLast = (): boolean => {
    const current = stateRef.current;
    if (current.draft) return true;
    if (current.items.length === 0) return false;
    apply({ type: "editItem", index: current.items.length - 1 });
    return true;
  };

  /**
   * El barbero del que se habla: el de la cita en curso; ya reservada, el que le asignaron;
   * si no, el de la última apartada («con quien esté libre» es ninguno todavía); sin citas,
   * el de su última visita.
   */
  const currentBarberId = (): string | null => {
    const current = stateRef.current;
    if (current.draft) return current.draft.barberId ?? null;
    if (current.reservation) return current.reservation.appointments.at(-1)?.barberId ?? null;
    if (current.items.length > 0) return current.items.at(-1)?.barberId ?? null;
    return current.customer?.lastVisit?.barberId ?? null;
  };

  const branchOfNow = () => shop.branches.find((branch) => branch.id === stateRef.current.branchId) ?? (shop.branches.length === 1 ? shop.branches[0] : undefined);

  const summary = (): string => {
    const current = stateRef.current;
    if (current.items.length === 0 && !current.draft?.serviceIds.length) return t("booking.chat.asideNothing");
    const lines = current.items.map(
      (item) => `- **${serviceNames(item.serviceIds)}** · ${personName(item.person, current.customer) || t("booking.person.self")} · ${barberName(item.barberId) || t("booking.chat.withAny")} · ${item.start ? fmt.when(parseStart(item.start)) : ""} — ${fmt.money(itemPrice(item, catalogRef.current))}`
    );
    const draft = current.draft && current.draft.serviceIds.length > 0 ? [t("booking.chat.asideDraft", { services: serviceNames(current.draft.serviceIds) })] : [];
    return [t("booking.chat.asideSummary"), ...lines, ...draft, ...(current.items.length > 0 ? [...adjustmentRows(t, fmt, totalsRef.current), `**${t("booking.payment.total")}: ${fmt.money(totalsRef.current.total)}**`] : [])].filter(Boolean).join("\n");
  };

  const prices = (): string => {
    const services = catalogRef.current?.services ?? [];
    if (services.length === 0) return t("booking.chat.asideNoCatalog");
    const barbers = catalogRef.current?.barbers ?? [];
    const lines = services.map((service) => {
      const values = barbers.map((barber) => barber.prices[service.id]).filter((value): value is number => value !== undefined);
      return `- ${service.name}: ${t("booking.services.from", { price: fmt.money(values.length > 0 ? Math.min(...values) : service.price) })} · ${t("booking.services.minutes", { count: service.durationMin })}`;
    });
    return [t("booking.chat.asidePrices"), ...lines].join("\n");
  };

  const when = (): string | null => {
    const current = stateRef.current;
    const held = current.reservation?.appointments.map((item) => `- **${fmt.when(parseStart(item.start))}** · ${item.serviceNames.join(" + ")} · ${item.barberName}`) ?? current.items.filter((item) => item.start).map((item) => `- **${fmt.when(parseStart(item.start as string))}** · ${serviceNames(item.serviceIds)} · ${barberName(item.barberId) || t("booking.chat.withAny")}`);
    return held.length > 0 ? [t("booking.chat.asideWhen"), ...held].join("\n") : null;
  };

  /** Responde una intención «de pasada». Devuelve si la atendió. */
  const handleAside = async (aside: ChatAside): Promise<boolean> => {
    const current = stateRef.current;
    const signedIn = Boolean(current.customer);
    const booking = canBook();
    switch (aside.kind) {
      case "back":
        if (back()) return true;
        say({ text: t("booking.chat.asideNoBack") });
        resume();
        return true;
      case "separate":
        if (!booking) return false;
        if (separate()) return true;
        say({ text: t("booking.chat.separateNone") });
        resume();
        return true;
      case "changeBarber":
        if (!booking) return false;
        if (!reopenLast() || !stateRef.current.draft?.serviceIds.length) {
          await askServices(t("booking.chat.asideServicesFirst"));
          return true;
        }
        askBarber(t("booking.chat.asideChangeBarber"));
        return true;
      case "changeServices":
        if (!booking) return false;
        reopenLast();
        await askServices(t("booking.chat.asideChangeServices"));
        return true;
      case "changeTime":
        if (!booking) return false;
        if (!reopenLast() || !stateRef.current.draft?.serviceIds.length) {
          await askServices(t("booking.chat.asideServicesFirst"));
          return true;
        }
        await askDay(t("booking.chat.asideChangeTime"));
        return true;
      case "changeBranch":
        if (shop.branches.length < 2) {
          say({ text: t("booking.chat.asideOneBranch", { name: shop.branches[0]?.name ?? "" }) });
          resume();
          return true;
        }
        askBranch(current.items.length > 0 ? t("booking.chat.branchSwitchWarn") : t("booking.chat.asideChangeBranch"));
        return true;
      case "myBarber": {
        const barberId = currentBarberId();
        const barber = barberId ? catalogRef.current?.barbers.find((item) => item.id === barberId) : undefined;
        if (barber) {
          await showBarber(barber);
          return true;
        }
        say({ text: t("booking.chat.asideNoBarber") });
        if (current.draft?.serviceIds.length) askBarber();
        else resume();
        return true;
      }
      case "myBranch": {
        const branch = branchOfNow();
        if (!branch) return false;
        await showBranch(branch.id, false);
        return true;
      }
      case "address": {
        const branch = branchOfNow();
        if (!branch) {
          info();
          return true;
        }
        const detail = await bookingApi.branch(branch.id).catch(() => null);
        say({ text: t("booking.chat.asideAddress", { name: branch.name, address: `${branch.address}, ${branch.city}`, href: detail?.mapsUrl ?? "#" }) });
        resume();
        return true;
      }
      case "hours": {
        const branch = branchOfNow();
        if (!branch) {
          info();
          return true;
        }
        const detail = await bookingApi.branch(branch.id).catch(() => null);
        const open = detail ? openStateOf(detail.hours) : null;
        const state = !open ? "" : open.kind === "open" ? t("booking.chat.asideOpenNow", { time: fmt.clock(open.closesAt) }) : open.kind === "opensLater" ? t("booking.chat.asideOpensLater", { time: fmt.clock(open.opensAt) }) : t("booking.chat.asideClosedToday");
        say({ text: `${t("booking.chat.asideHours", { name: branch.name, from: fmt.clock(branch.opensAt), to: fmt.clock(branch.closesAt) })} ${state}`.trim() });
        resume();
        return true;
      }
      case "phone":
        call();
        resume();
        return true;
      case "summary":
        say({ text: summary() });
        resume();
        return true;
      case "price":
        say({ text: prices() });
        resume();
        return true;
      case "when": {
        const text = when();
        if (!text && !signedIn) return false;
        if (!text) {
          await manage();
          return true;
        }
        say({ text });
        resume();
        return true;
      }
      case "thanks":
        say({ text: t("booking.chat.asideThanks") });
        resume();
        return true;
      case "greeting":
        say({ text: t("booking.chat.asideGreeting", { name: current.customer ? `, ${current.customer.firstName}` : "" }) });
        resume();
        return true;
      case "who":
        say({ text: t("booking.chat.asideWho", { shop: shop.name }) });
        resume();
        return true;
    }
  };

  return { handleAside };
}
