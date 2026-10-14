import type { useAppT } from "@/app/i18n";
import { describeError } from "@/lib/api";
import { bookingApi } from "../../api";
import type { BookingAction, BookingState } from "../../bookingState";
import { WEEK_ORDER, formatPhone, openStateOf, parseStart, type BookingFormatters } from "../../bookingFormat";
import type { BookingBarber, BookingCatalog, BookingShop, BranchDetail } from "../../types";
import { itemPrice } from "../../useBookingTotals";
import { ableBarbers } from "../agenda/agendaModel";
import { makeQuestion, type BookingQuestion, type QuestionEntry } from "./chatQuestions";
import type { MessageInput } from "./chatKit";

const PRICES_SHOWN = 4;
/** Palabras que piden conocer a alguien o algo antes de elegir. */
const ASKS_DETAIL = /\b(perfil|conocer|conoce|quien es|detalle|detalles|como es|fotos|resenas|trabajos|informacion|info de|ver la sede|ver sede|sobre)\b/;

const plain = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const firstName = (name: string) => name.split(" ")[0] ?? name;
/** Si lo escrito pide conocer a un barbero o una sede antes de elegir. */
export const looksLikeDetail = (text: string): boolean => ASKS_DETAIL.test(plain(text));
const instagramUrl = (value: string) => (value.startsWith("http") ? value : `https://instagram.com/${value.replace(/^@/, "")}`);

/** Lo que la conversación le presta a los perfiles: cómo hablar, el estado y a dónde volver. */
export interface ProfilesKit {
  t: ReturnType<typeof useAppT>;
  fmt: BookingFormatters;
  shop: BookingShop;
  apply: (action: BookingAction) => void;
  say: (...messages: MessageInput[]) => void;
  ask: (question: BookingQuestion, text?: string) => void;
  busy: <T>(work: () => Promise<T>) => Promise<T>;
  stateRef: { readonly current: BookingState };
  catalogRef: { readonly current: BookingCatalog | undefined };
  loadCatalog: () => Promise<BookingCatalog | undefined>;
  serviceNames: (ids: readonly string[]) => string;
  startBooking: (text?: string) => void;
  askDay: (text?: string) => Promise<void>;
  askServices: (text?: string) => Promise<void>;
  /** Vuelve a hacer la pregunta que quedó pendiente antes de pedir el detalle. */
  resume: () => void;
  /** Los barberos de la última sede que se mostró: su perfil se puede pedir aunque no sea la sede de la reserva. */
  lastTeam: { current: readonly BookingBarber[] };
}

/**
 * Las sedes y los barberos en la conversación: la lista para elegir (con una
 * opción al final para conocer uno antes) y su detalle contado como mensaje,
 * con sus fotos. Después del detalle pregunta si se elige.
 */
export function useChatProfiles(kit: ProfilesKit) {
  const { t, fmt, shop, apply, say, ask, busy, stateRef, catalogRef, loadCatalog, serviceNames, startBooking, askDay, askServices, resume, lastTeam } = kit;

  const branchByText = (text: string) => {
    const typed = plain(text);
    return shop.branches.find((branch) => typed.includes(plain(branch.name)) || plain(branch.name).split(" ").some((word) => word.length > 3 && typed.includes(word)));
  };

  const barberByText = (text: string, barbers: readonly BookingBarber[]) => {
    const typed = plain(text);
    const words = new Set(typed.split(/\s+/));
    return barbers.find((barber) => typed.includes(plain(barber.name)) || words.has(plain(firstName(barber.name))));
  };

  const askBranch = (text?: string) =>
    ask(
      makeQuestion(
        "branch",
        t("booking.chat.branchTitle"),
        shop.branches.map((branch) => ({ label: branch.name, value: branch.id, description: `${branch.address} · ${t("booking.chat.todayHours", { from: fmt.clock(branch.opensAt), to: fmt.clock(branch.closesAt) })}` })),
        { hint: t("booking.chat.branchHint"), otherLabel: t("booking.chat.branchKnow"), otherPlaceholder: t("booking.chat.branchKnowPlaceholder") }
      ),
      text ?? t("booking.chat.branchLead", { count: shop.branches.length })
    );

  const askBarber = (text?: string) => {
    const draft = stateRef.current.draft;
    if (!draft) return void askServices();
    const usualId = stateRef.current.customer?.lastVisit?.barberId ?? null;
    const able = ableBarbers(catalogRef.current?.barbers ?? [], draft.serviceIds, usualId);
    const entries: QuestionEntry[] = [
      { label: t("booking.chat.reply.anyBarber"), value: "any", description: t("booking.chat.anyBarberHint"), emoji: "✂️" },
      ...able.map((barber) => ({
        label: barber.name,
        value: barber.id,
        image: barber.avatarUrl,
        description: [`★ ${barber.rating.toFixed(1)}`, fmt.money(itemPrice({ serviceIds: draft.serviceIds, barberId: barber.id }, catalogRef.current)), barber.id === usualId ? t("booking.agenda.yourBarber") : barber.level].filter(Boolean).join(" · "),
      })),
    ];
    ask(
      makeQuestion("barber", t("booking.chat.barberTitle"), entries, {
        hint: t("booking.chat.barberHint"),
        otherLabel: t("booking.chat.barberKnow"),
        otherPlaceholder: t("booking.chat.barberKnowPlaceholder"),
        ...(able.length > 6 ? { searchPlaceholder: t("booking.chat.barberSearch") } : {}),
      }),
      text ?? t("booking.chat.barberLead", { services: serviceNames(draft.serviceIds) })
    );
  };

  const branchText = (detail: BranchDetail, barbers: readonly BookingBarber[]): string => {
    const now = new Date();
    const open = openStateOf(detail.hours, now);
    const state = open.kind === "open" ? `${t("booking.branchProfile.open")} · ${t("booking.branchProfile.closesAt", { time: fmt.clock(open.closesAt) })}` : open.kind === "opensLater" ? t("booking.branchProfile.opensAt", { time: fmt.clock(open.opensAt) }) : t("booking.branchProfile.closedToday");
    const hours = WEEK_ORDER.map((day) => {
      const entry = detail.hours.find((item) => item.day === day);
      const range = entry?.opensAt && entry.closesAt ? `${fmt.clock(entry.opensAt)} – ${fmt.clock(entry.closesAt)}` : t("booking.branchProfile.closed");
      const name = `${fmt.weekday(day).charAt(0).toUpperCase()}${fmt.weekday(day).slice(1)}`;
      return day === now.getDay() ? `- **${name} (${t("booking.branchProfile.today")}): ${range}**` : `- ${name}: ${range}`;
    });
    const links = [
      detail.links.website ? `[${t("booking.branchProfile.website")}](${detail.links.website})` : "",
      detail.links.instagram ? `[${t("booking.branchProfile.instagram")}](${instagramUrl(detail.links.instagram)})` : "",
      detail.links.facebook ? `[${t("booking.branchProfile.facebook")}](${detail.links.facebook})` : "",
    ].filter(Boolean);
    const closures = detail.closures.map((closure) =>
      closure.startDate === closure.endDate
        ? t("booking.branchProfile.closureOne", { name: closure.description, date: fmt.day(parseStart(`${closure.startDate}T00:00`)) })
        : t("booking.branchProfile.closureRange", { name: closure.description, from: fmt.day(parseStart(`${closure.startDate}T00:00`)), to: fmt.day(parseStart(`${closure.endDate}T00:00`)) })
    );
    return [
      `**${detail.name}** · ${state}`,
      detail.description,
      // Dos espacios antes del salto: en Markdown, una línea nueva sin cerrar el párrafo.
      [`📍 ${detail.address}, ${detail.city} · [${t("booking.branchProfile.directions")}](${detail.mapsUrl})`, `📞 [${formatPhone(detail.phone)}](tel:${detail.phone})`, links.length > 0 ? `🔗 ${links.join(" · ")}` : ""].filter(Boolean).join("  \n"),
      `**${t("booking.branchProfile.hours")}**\n${hours.join("\n")}`,
      // Quién atiende en esa sede: nombre, nivel y nota; el perfil se pide escribiendo su nombre.
      barbers.length > 0
        ? `**${t("booking.chat.branchTeam", { count: barbers.length })}**\n${barbers.map((barber) => `- ${barber.name}${barber.level ? ` · ${barber.level}` : ""} · ★ ${barber.rating.toFixed(1)}`).join("\n")}\n\n${t("booking.chat.branchTeamHint")}`
        : t("booking.chat.branchBarbers", { count: detail.barbers }),
      closures.join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const barberText = (barber: BookingBarber): string => {
    const draft = stateRef.current.draft;
    const services = catalogRef.current?.services ?? [];
    const priced = draft && draft.serviceIds.length > 0 && draft.serviceIds.every((id) => barber.prices[id] !== undefined)
      ? [`${serviceNames(draft.serviceIds)}: ${fmt.money(itemPrice({ serviceIds: draft.serviceIds, barberId: barber.id }, catalogRef.current))}`]
      : services.filter((service) => barber.prices[service.id] !== undefined).slice(0, PRICES_SHOWN).map((service) => `${service.name}: ${fmt.money(barber.prices[service.id] ?? service.price)}`);
    return [
      `**${barber.name}**${barber.level ? ` · ${barber.level}` : ""} · ★ ${barber.rating.toFixed(1)}`,
      barber.description,
      barber.skills.length > 0 ? `**${t("booking.barber.skills")}:** ${barber.skills.join(", ")}` : "",
      priced.length > 0 ? `**${t("booking.barber.prices")}:** ${priced.join(" · ")}` : "",
      barber.instagram ? `[Instagram](${instagramUrl(barber.instagram)})` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  /** Se ofrece reservar en una sede si ya se sabe quién es y no es la sede de su reserva. */
  const offersBranch = (branchId: string) => Boolean(stateRef.current.customer) && stateRef.current.branchId !== branchId;

  /** El detalle de una sede; `offer` pregunta después si va a esa (mientras arma la reserva). */
  const showBranch = async (branchId: string, offer: boolean) => {
    try {
      const [detail, team] = await busy(() => Promise.all([bookingApi.branch(branchId), bookingApi.catalog(branchId).then((catalog) => catalog.barbers, () => [])]));
      const ranked = [...team].sort((a, b) => b.rating - a.rating);
      lastTeam.current = ranked;
      say({ text: branchText(detail, ranked), photos: detail.gallery, photosTitle: detail.name });
      if (!offer) return resume();
      ask(
        makeQuestion("branchConfirm", stateRef.current.branchId ? t("booking.chat.branchSwitchTitle") : t("booking.chat.branchConfirmTitle"), [
          { label: t("booking.chat.branchConfirmYes", { name: detail.name }), value: branchId, emoji: "✅" },
          { label: stateRef.current.branchId ? t("booking.chat.branchStay") : t("booking.chat.branchOthers"), value: stateRef.current.branchId ? "stay" : "others" },
        ]),
        stateRef.current.branchId && stateRef.current.items.length > 0 ? t("booking.chat.branchSwitchWarn") : undefined
      );
    } catch (error) {
      say({ text: describeError(error).description });
    }
  };

  /** El perfil de un barbero (con su calificación, sin reseñas); después, si lo elige para la cita que se arma. */
  const showBarber = async (barber: BookingBarber) => {
    say({ text: barberText(barber), photos: barber.gallery, photosTitle: barber.name });
    const draft = stateRef.current.draft;
    if (!draft || draft.serviceIds.length === 0) return resume();
    const doesAll = draft.serviceIds.every((id) => barber.prices[id] !== undefined);
    ask(
      makeQuestion("barberConfirm", doesAll ? t("booking.chat.barberConfirmTitle", { name: firstName(barber.name) }) : t("booking.chat.barberCannot", { name: firstName(barber.name) }), [
        ...(doesAll ? [{ label: t("booking.chat.barberConfirmYes", { name: firstName(barber.name) }), value: barber.id, image: barber.avatarUrl }] : []),
        { label: t("booking.chat.barberOthers"), value: "others" },
      ])
    );
  };

  /** «Conocer una sede» o «Ver el perfil de un barbero» con lo escrito. Devuelve si encontró a quién. */
  const showByText = async (text: string, kind: "branch" | "barber"): Promise<boolean> => {
    if (kind === "branch") {
      const branch = branchByText(text);
      if (!branch) return false;
      await showBranch(branch.id, true);
      return true;
    }
    const loaded = await loadCatalog();
    const barber = barberByText(text, loaded?.barbers ?? []) ?? barberByText(text, lastTeam.current);
    if (!barber) return false;
    await showBarber(barber);
    return true;
  };

  /** Una frase que pide conocer a un barbero o una sede («perfil de Andrés», «cómo es la sede Centro»). */
  const detailRequest = async (text: string): Promise<boolean> => {
    if (!looksLikeDetail(text)) return false;
    const loaded = stateRef.current.branchId ? await loadCatalog() : undefined;
    const barber = barberByText(text, loaded?.barbers ?? []) ?? barberByText(text, lastTeam.current);
    if (barber) {
      await showBarber(barber);
      return true;
    }
    const branch = branchByText(text);
    if (branch) {
      await showBranch(branch.id, offersBranch(branch.id));
      return true;
    }
    return false;
  };

  /**
   * El barbero elegido no tiene horas ese día: otros que hacen lo mismo (por habilidades y nivel
   * parecidos), con su primer día libre y sus primeras horas, para elegir con quién seguir.
   */
  const alternativeEntries = async (goal: { branchId: string; serviceIds: readonly string[]; barberId: string }, date: string): Promise<QuestionEntry[]> => {
    const found = await busy(() => bookingApi.alternatives({ branchId: goal.branchId, date, serviceIds: goal.serviceIds, barberId: goal.barberId }).catch(() => null));
    const barbers = catalogRef.current?.barbers ?? [];
    return (found?.items ?? []).flatMap((item) => {
      const barber = barbers.find((entry) => entry.id === item.barberId);
      if (!barber || item.times.length === 0) return [];
      const day = item.date === date ? t("booking.chat.altSameDay") : fmt.dayShort(parseStart(`${item.date}T00:00`));
      const times = item.times.slice(0, 3).map((time) => fmt.clock(time)).join(", ");
      const skills = item.skills.length > 0 ? ` · ${t("booking.chat.altSkills", { skills: item.skills.slice(0, 2).join(", ") })}` : "";
      return [{ label: barber.name, value: `alt:${barber.id}|${item.date}`, image: barber.avatarUrl, description: `★ ${barber.rating.toFixed(1)} · ${day}: ${times}${skills}` }];
    });
  };

  /** ¿Dónde quedan? Con varias sedes, cuál conocer; con una, su detalle de una vez. */
  const info = () => {
    if (shop.branches.length === 1 && shop.branches[0]) return void showBranch(shop.branches[0].id, false);
    ask(makeQuestion("branchInfo", t("booking.chat.branchInfoTitle"), shop.branches.map((branch) => ({ label: branch.name, value: branch.id, description: `${branch.address}, ${branch.city}` }))), t("booking.chat.infoLead"));
  };

  /** Las respuestas de las preguntas de sedes y barberos; `false` si la pregunta no es de aquí. */
  const answerProfile = async (question: BookingQuestion, value: string | null, label: string, isOther: boolean): Promise<boolean> => {
    switch (question.kind) {
      case "branch":
        if (isOther) {
          if (!(await showByText(label, "branch"))) askBranch(t("booking.chat.branchNotFound"));
          return true;
        }
        if (value) apply({ type: "chooseBranch", branchId: value });
        startBooking();
        return true;
      case "branchConfirm":
        if (value === "stay") {
          resume();
          return true;
        }
        if (value && value !== "others") {
          apply({ type: "chooseBranch", branchId: value });
          startBooking();
        } else askBranch(t("booking.chat.branchPickAgain"));
        return true;
      case "branchInfo":
        if (value) await showBranch(value, offersBranch(value));
        return true;
      case "barber":
        if (isOther) {
          if (!(await showByText(label, "barber"))) askBarber(t("booking.chat.barberNotFound"));
          return true;
        }
        apply({ type: "chooseBarber", barberId: value === "any" ? null : value });
        void askDay();
        return true;
      case "barberConfirm":
        if (value && value !== "others") {
          apply({ type: "chooseBarber", barberId: value });
          void askDay();
        } else askBarber(t("booking.chat.barberPickAgain"));
        return true;
      default:
        return false;
    }
  };

  return { askBranch, askBarber, showBranch, showBarber, detailRequest, info, answerProfile, alternativeEntries };
}
