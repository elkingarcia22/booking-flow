import { db } from "../db";
import { memberName } from "../team/seed";
import { WALK_IN_CLIENT, clockOf, dateKey, parseClock, type MockAppointment, type MockClient } from "../calendar/seed";
import { appointmentsOn, barbersIn, clashMessage, hoursOn } from "../calendar/handlers";
import { profileOf } from "../customers/handlers";
import { depositOf } from "@/features/booking/pricing";
import { productPriceIn, servicePriceIn } from "../catalogPrices";
import { accountTaxPercent, branchCountry, branchHours, branchCurrency, branchNow, branchOnlineMethods, branchTaxPercent, branchTimeZone, itemTaxPercent, startInstant, taxInclusive } from "../settings/branchRules";
import { ratingOf, reviewOfAppointment } from "./reviews";
import { activePackages, packageOffers } from "./packages";
import { hashOf } from "../customers/seed";
import { stockLevel } from "../inventory/stock";
import { BLOCKED_PHONE, DEMO_CARDS, DEMO_GUESTS_CLIENT, DEMO_PHONES, type MockReservation, type MockSavedCard } from "./state";
import { consentCountryOf } from "@/features/legal/consent";
import { closedForHoliday } from "@/features/settings/countryPack";
import { welcomeCoupon } from "../marketing/coupons";
import { fitsInHours, hoursOnDate } from "@/features/branches/branchHours";
import type { BookingAppearance } from "@/lib/booking/appearance";

/**
 * Las derivaciones de la reserva en línea: lo que ve el cliente sale de lo
 * mismo que usa la app —sucursales y política de Configuración, el catálogo
 * de Servicios y Productos, el equipo con sus horarios y la agenda—, así una
 * reserva hecha aquí aparece en el Calendario y una cita de la agenda
 * ocupa la hora aquí.
 */

const COVER = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1600&h=900&fit=crop&auto=format&q=70";
const BRANCH_PHOTOS: Readonly<Record<string, string>> = {
  ma: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=640&h=400&fit=crop&auto=format&q=70",
  nc: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=640&h=400&fit=crop&auto=format&q=70",
  ri: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=640&h=400&fit=crop&auto=format&q=70",
  ut: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=640&h=400&fit=crop&auto=format&q=70",
};

const booking = () => db.settings.sections.booking as {
  minNotice: number;
  minNoticeUnit: string;
  slotInterval: number;
  paymentMethods: { card: boolean; payAtShop: boolean };
  /** Anticipo para pagar en la barbería: a clientes nuevos y/o tras N inasistencias (0 = nunca). */
  deposit: { enabled: boolean; percent: number; newClients: boolean; afterNoShows: number };
  loyalty: { enabled: boolean; every: number; rewardServiceId: string };
  cancelHours: number;
  lateFeePercent: number;
  maxCancellations: number;
  policy: string;
  appearance?: BookingAppearance;
};

export const bookingRules = () => {
  const rules = booking();
  const unit = rules.minNoticeUnit === "hours" ? 60 : rules.minNoticeUnit === "days" ? 1440 : 1;
  return { ...rules, minNoticeMinutes: rules.minNotice * unit };
};

export const tipOptions = () => db.settings.sections.tips as { options: { id: string; type: "percent" | "amount"; value: number }[]; defaultId: string | null };

/** Los barberos que el cliente puede elegir en una sucursal, en el orden del calendario. */
export const bookableBarbers = (branchId: string) => barbersIn(branchId).filter((barber) => barber.bookingVisible !== false);

const memberOf = (id: string) => db.team.members.find((member) => member.id === id);

/** Lo que cobra un barbero por un servicio, o `null` si no lo hace. */
export function barberPrice(barberId: string, serviceId: string, branchId?: string): number | null {
  const member = memberOf(barberId);
  const service = db.services.items.find((item) => item.id === serviceId);
  if (!member || !service) return null;
  const override = member.services.find((item) => item.serviceId === serviceId);
  if (override && !override.offered) return null;
  // Su precio en Equipo; si no tiene, el de la sucursal (la que se pide o la suya) o el general.
  return override?.price ?? servicePriceIn(serviceId, branchId ?? member.homeBranchId);
}

export const publicServicesIn = (branchId: string) =>
  db.services.items.filter((item) => item.visibility === "public" && item.activeBranchIds.includes(branchId));

export const serviceName = (id: string) => db.services.items.find((item) => item.id === id)?.name ?? id;
export const durationOf = (serviceIds: readonly string[]) =>
  serviceIds.reduce((sum, id) => sum + (db.services.items.find((item) => item.id === id)?.durationMin ?? 0), 0);

/**
 * El horario de hoy de la sede: el suyo (Configuración › Sucursales), recortado a lo que trabaja el equipo ese
 * día. Si hoy cierra, el de la sede tal cual (la reserva dirá que no hay horas).
 */
export function branchHoursToday(branchId: string): { opensAt: string; closesAt: string } {
  // «Hoy» es el de la sucursal, no el de quien reserva desde otra zona.
  const today = branchNow(branchId).slice(0, 10);
  const own = hoursOnDate(branchHours(branchId), today);
  const ranges = bookableBarbers(branchId).flatMap((barber) => {
    const member = memberOf(barber.id);
    return member ? hoursOn(member, today) : [];
  });
  if (!own || ranges.length === 0) {
    const fallback = own ?? Object.values(branchHours(branchId)).find((day) => day !== null) ?? { open: "09:00", close: "19:00" };
    return { opensAt: fallback.open, closesAt: fallback.close };
  }
  return {
    opensAt: clockOf(Math.max(parseClock(own.open), Math.min(...ranges.map((range) => parseClock(range.start))))),
    closesAt: clockOf(Math.min(parseClock(own.close), Math.max(...ranges.map((range) => parseClock(range.end))))),
  };
}

export function shop() {
  const rules = bookingRules();
  // La apariencia propia de la reserva (Configuración › Reserva online); sin ella, la general.
  const appearance = rules.appearance && !rules.appearance.useGeneral ? rules.appearance : null;
  const tips = tipOptions();
  const company = db.settings.sections.company as { name: string; phone: string };
  const branches = (db.settings.lists.branches as unknown as { id: string; name: string; address: string; city: string; phone: string; status: string }[])
    .filter((branch) => branch.status === "active")
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      phone: branch.phone,
      ...branchHoursToday(branch.id),
      imageUrl: BRANCH_PHOTOS[branch.id] ?? null,
      barbers: bookableBarbers(branch.id).length,
      // Cada sucursal cobra en su moneda, con su impuesto y con los métodos de su pasarela.
      currency: branchCurrency(branch.id),
      taxPercent: branchTaxPercent(branch.id),
      onlineMethods: branchOnlineMethods(branch.id),
      /** El país de la sede (para el texto del consentimiento). */
      country: consentCountryOf(branchCountry(branch.id)),
    }));
  return {
    // La marca de la barbería tal como la subió en Identidad; sin ella, Barberlytics.
    name: db.branding.name ?? "Barberlytics",
    // Un logo propio de la reserva gana al de Identidad de marca.
    logoUrl: appearance?.logo ?? db.branding.logo,
    logoDarkUrl: appearance?.logo ? appearance.logoDark : db.branding.logoDark,
    coverUrl: COVER,
    phone: company.phone,
    currency: (db.settings.sections.pricing as { currency: string }).currency,
    taxInclusive: taxInclusive(),
    minNoticeMinutes: rules.minNoticeMinutes,
    slotMinutes: rules.slotInterval,
    cancelHours: rules.cancelHours,
    lateFeePercent: rules.lateFeePercent,
    maxCancellations: rules.maxCancellations,
    policy: rules.policy,
    // El cupón de bienvenida que la reserva aplica sola al cliente nuevo (Configuración › Cupones).
    welcomePromo: welcomeCoupon(),
    tipOptions: tips.options,
    defaultTipId: tips.defaultId,
    payment: rules.paymentMethods,
    cardFee: cardFeeRule(),
    // Con lo que costarían esas visitas sueltas (precio de lista del servicio), para mostrar el ahorro.
    packages: rules.paymentMethods.card ? packageOffers().map((offer) => ({ ...offer, regular: (db.services.items.find((item) => item.id === offer.serviceId)?.price ?? 0) * offer.sessions })) : [],
    deposit: rules.deposit.enabled && rules.paymentMethods.payAtShop && rules.paymentMethods.card ? { percent: rules.deposit.percent } : null,
    branches,
    appearance,
  };
}

/** El recargo por tarjeta de Configuración, si está encendido (el mismo que cobra la agenda). */
export function cardFeeRule(): { name: string; rate: number; type: "percent" | "amount" } | null {
  const fee = db.settings.sections.cardFee as { enabled: boolean; name: string; rate: number; type: "percent" | "amount" };
  return fee.enabled ? { name: fee.name, rate: fee.rate, type: fee.type } : null;
}

const POPULAR = new Set(["svc_corte", "svc_combo", "svc_fade"]);

export function catalog(branchId: string) {
  const services = publicServicesIn(branchId);
  const barbers = bookableBarbers(branchId).map((barber) => {
    const member = memberOf(barber.id);
    const prices = Object.fromEntries(services.flatMap((service) => {
      const price = barberPrice(barber.id, service.id, branchId);
      return price === null ? [] : [[service.id, price]];
    }));
    return {
      id: barber.id,
      name: barber.name,
      avatarUrl: barber.avatarUrl,
      level: barber.level,
      description: member?.description ?? "",
      skills: member?.skills ?? [],
      instagram: member?.instagram ?? "",
      facebook: member?.facebook ?? "",
      gallery: member?.gallery ?? [],
      // El promedio y el conteo salen de las reseñas reales (y las sembradas de la demo).
      ...ratingOf(barber.id),
      prices,
    };
  });
  const products = db.products.items
    // Lo agotado en la sucursal no se ofrece en línea.
    .filter((item) => item.visibility === "public" && item.sellable && item.activeBranchIds.includes(branchId) && stockLevel(branchId, item.id).onHand > 0)
    .map((item) => ({ id: item.id, name: item.name, description: item.description, category: db.products.categories.find((category) => category.id === item.categoryId)?.name ?? "", price: productPriceIn(item.id, branchId), taxPercent: itemTaxPercent(item.taxRate, branchId), imageUrl: item.imageUrl }));
  return {
    services: services.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: db.services.categories.find((category) => category.id === item.categoryId)?.name ?? "",
      durationMin: item.durationMin,
      price: servicePriceIn(item.id, branchId),
      // La tasa con la que se cobra en esta sucursal: la del servicio o, si no tiene, la de la sucursal.
      taxPercent: itemTaxPercent(item.taxRate, branchId),
      imageUrl: item.imageUrl,
      isCombo: item.kind === "combo",
      popular: POPULAR.has(item.id),
    })),
    barbers,
    products,
  };
}

/** Los festivos en que cierra el negocio (Configuración › Perfil del negocio), por motivo. */
const closedHolidays = (): readonly string[] => (db.settings.sections.business as { holidays?: string[] } | undefined)?.holidays ?? [];

/** Cerrado por un cierre de la sede, por un festivo de su país en que el negocio no abre o porque ese día no abre. */
export const isClosed = (branchId: string, day: string): boolean =>
  (db.settings.lists.closures as unknown as { startDate: string; endDate: string; branchIds: string[] }[]).some(
    (closure) => closure.branchIds.includes(branchId) && closure.startDate <= day && day <= closure.endDate
  ) ||
  closedForHoliday(branchCountry(branchId), closedHolidays(), day) !== null ||
  hoursOnDate(branchHours(branchId), day) === null;

/** ¿Puede este barbero atender a esa hora, todo el tramo, sin pisar nada? */
export function barberFree(branchId: string, barberId: string, day: string, startMinute: number, durationMin: number, excludeId?: string): boolean {
  const member = memberOf(barberId);
  if (!member) return false;
  // Dentro de su horario y del de la sede: nadie atiende con la barbería cerrada.
  const fits = fitsInHours(hoursOnDate(branchHours(branchId), day), startMinute, durationMin) && hoursOn(member, day).some((range) => parseClock(range.start) <= startMinute && startMinute + durationMin <= parseClock(range.end));
  return fits && clashMessage(branchId, barberId, day, startMinute, durationMin, excludeId) === null;
}

/** Las horas del día con quién puede atender en cada una. */
export function availability(branchId: string, day: string, serviceIds: readonly string[], barberId: string | null, excludeId?: string) {
  if (isClosed(branchId, day)) return [];
  const rules = bookingRules();
  const durationMin = Math.max(rules.slotInterval, durationOf(serviceIds));
  appointmentsOn(branchId, day);
  const candidates = bookableBarbers(branchId).filter((barber) => (barberId ? barber.id === barberId : true) && serviceIds.every((id) => barberPrice(barber.id, id) !== null));
  // Lo que ya pasó se mide con el reloj de la sucursal: quien reserva desde otra zona ve las horas de la sede.
  const nowLocal = branchNow(branchId);
  const today = nowLocal.slice(0, 10);
  const earliest = day === today ? parseClock(nowLocal.slice(11, 16)) + rules.minNoticeMinutes : day < today ? Number.MAX_SAFE_INTEGER : 0;
  const { opensAt, closesAt } = branchHoursToday(branchId);
  const slots: { time: string; barberIds: string[] }[] = [];
  for (let minute = parseClock(opensAt); minute + durationMin <= parseClock(closesAt); minute += rules.slotInterval) {
    if (minute < earliest) continue;
    const free = candidates.filter((barber) => barberFree(branchId, barber.id, day, minute, durationMin, excludeId)).map((barber) => barber.id);
    if (free.length > 0) slots.push({ time: clockOf(minute), barberIds: free });
  }
  return slots;
}

const digits = (value: string) => value.replace(/\D/g, "");

/** El cliente de la agenda con ese celular, o nada. */
export function clientByPhone(phone: string): MockClient | undefined {
  const demo = DEMO_PHONES[`+${digits(phone)}`];
  if (demo) return db.calendar.clients.find((client) => client.id === demo);
  return db.calendar.clients.find((client) => client.id !== WALK_IN_CLIENT.id && digits(client.phone) === digits(phone) && !profileOf(client).deleted);
}

export const isBlockedPhone = (phone: string, client?: MockClient): boolean =>
  `+${digits(phone)}` === BLOCKED_PHONE || (client ? profileOf(client).blocked : false);

const reservationOf = (appointmentId: string): { reservation: MockReservation; line: MockReservation["lines"][number] } | null => {
  for (const reservation of db.booking.reservations) {
    const line = reservation.lines.find((item) => item.appointmentId === appointmentId);
    if (line) return { reservation, line };
  }
  return null;
};

const isLive = (item: MockAppointment) => item.status !== "cancelled" && item.status !== "no_show";

export function customerOf(client: MockClient) {
  const profile = profileOf(client);
  const mine = db.calendar.appointments.filter((item) => item.clientId === client.id);
  const now = Date.now();
  const last = [...mine].filter((item) => item.status === "paid" || startInstant(item).getTime() < now).sort((a, b) => b.start.localeCompare(a.start))[0];
  const barberId = last?.barberId ?? client.preferredBarberId;
  const lastVisit = last
    ? { branchId: last.branchId, serviceIds: last.serviceIds, barberId, at: last.start }
    : client.visits > 0
      ? { branchId: profile.branchId, serviceIds: ["svc_corte"], barberId, at: client.lastVisitAt ?? new Date().toISOString() }
      : null;
  const cards = cardsOf(client.id);
  return {
    id: client.id,
    firstName: client.name.split(" ")[0] ?? client.name,
    name: client.name,
    phone: client.phone,
    email: profile.email,
    isNew: client.visits === 0 && !last,
    onlineOnly: profile.onlineOnly,
    guests: profile.guests.map((guest) => ({ id: guest.id, name: guest.name, relation: guest.relation })),
    lastVisit,
    credit: db.booking.credits[client.id] ?? 0,
    upcoming: mine.filter((item) => isLive(item) && item.status === "scheduled" && startInstant(item).getTime() >= now).length,
    cards,
    hasSavedCards: cards.length > 0,
    depositRequired: needsDeposit(client, client.visits === 0 && !last),
    loyalty: loyaltyOf(client),
    packages: activePackages(client.id).map(({ id, name, serviceId, remaining, total, expiresAt }) => ({ id, name, serviceId, remaining, total, expiresAt })),
  };
}

/**
 * ¿Debe dejar anticipo para pagar en la barbería? Solo si la barbería lo pide y aplica a este
 * cliente: nuevo (si así lo configuró) o con tantas inasistencias. El habitual no paga anticipo.
 */
function needsDeposit(client: MockClient, isNew: boolean): boolean {
  const { deposit, paymentMethods } = bookingRules();
  if (!deposit.enabled || !paymentMethods.card) return false;
  return (deposit.newClients && isNew) || (deposit.afterNoShows > 0 && client.noShows >= deposit.afterNoShows);
}

/** El anticipo: el porcentaje configurado de lo comprado con impuesto (sin propina ni recargo). */
export function depositAmount(totals: { subtotal: number; tax: number }): number {
  return depositOf(totals, bookingRules().deposit.percent);
}

/**
 * La membresía: cada `every` visitas gana una cortesía. Las ganadas salen de sus
 * visitas; las usadas se cuentan aparte. Un cliente de la demo arranca con a lo más una por usar.
 */
export function loyaltyOf(client: MockClient): { every: number; progress: number; available: number; rewardServiceId: string; rewardName: string; rewardValue: number } | null {
  const { loyalty } = bookingRules();
  if (!loyalty.enabled || loyalty.every < 2) return null;
  const earned = Math.floor(client.visits / loyalty.every);
  const used = db.booking.loyaltyUsed?.[client.id] ?? Math.max(0, earned - 1);
  const service = db.services.items.find((item) => item.id === loyalty.rewardServiceId);
  return { every: loyalty.every, progress: client.visits % loyalty.every, available: Math.max(0, earned - used), rewardServiceId: loyalty.rewardServiceId, rewardName: service?.name ?? "", rewardValue: service?.price ?? 0 };
}

/** Usa una cortesía: queda una menos por usar. */
export function redeemLoyalty(client: MockClient): void {
  const current = loyaltyOf(client);
  if (!current || current.available === 0) return;
  const earned = Math.floor(client.visits / current.every);
  db.booking.loyaltyUsed = { ...(db.booking.loyaltyUsed ?? {}), [client.id]: earned - current.available + 1 };
}

/** Las tarjetas tokenizadas de un cliente. */
export const cardsOf = (clientId: string): MockSavedCard[] => db.booking.cards?.[clientId] ?? (clientId === DEMO_GUESTS_CLIENT ? [...DEMO_CARDS] : []);

/** Guarda una tarjeta tokenizada (sin número completo ni CVC); si ya estaba, no la repite. */
export function saveCard(clientId: string, card: Omit<MockSavedCard, "id">): MockSavedCard {
  const current = cardsOf(clientId);
  const existing = current.find((item) => item.brand === card.brand && item.last4 === card.last4 && item.expMonth === card.expMonth && item.expYear === card.expYear);
  if (existing) return existing;
  const saved = { ...card, id: `card_${Date.now().toString(36)}` };
  db.booking.cards = { ...(db.booking.cards ?? {}), [clientId]: [...current, saved] };
  return saved;
}

/** Cambia el titular o el vencimiento de una tarjeta guardada; el número es de la pasarela y no se toca. */
export function updateCard(clientId: string, cardId: string, changes: Pick<MockSavedCard, "holder" | "expMonth" | "expYear">): MockSavedCard | null {
  const current = cardsOf(clientId);
  const card = current.find((item) => item.id === cardId);
  if (!card) return null;
  const updated = { ...card, ...changes };
  db.booking.cards = { ...(db.booking.cards ?? {}), [clientId]: current.map((item) => (item.id === cardId ? updated : item)) };
  return updated;
}

/** Quita una tarjeta guardada; devuelve si existía. */
export function removeCard(clientId: string, cardId: string): boolean {
  const current = cardsOf(clientId);
  if (!current.some((item) => item.id === cardId)) return false;
  db.booking.cards = { ...(db.booking.cards ?? {}), [clientId]: current.filter((item) => item.id !== cardId) };
  return true;
}

/** Una cita de la agenda como la ve el cliente. */
export function bookedOf(item: MockAppointment) {
  const link = reservationOf(item.id);
  const member = memberOf(item.barberId);
  const branch = (db.settings.lists.branches as unknown as { id: string; name: string }[]).find((entry) => entry.id === item.branchId);
  const price = link?.line.price ?? item.serviceIds.reduce((sum, id) => sum + (barberPrice(item.barberId, id, item.branchId) ?? 0), 0);
  const status = item.status === "cancelled" ? "cancelled" : item.status === "no_show" ? "no_show" : item.status === "paid" ? "completed" : startInstant(item).getTime() + item.durationMin * 60_000 < Date.now() ? "completed" : "scheduled";
  return {
    review: reviewOfAppointment(item.id) ? { rating: reviewOfAppointment(item.id)?.rating ?? 0 } : null,
    id: item.id,
    reservationId: link?.reservation.id ?? null,
    branchId: item.branchId,
    branchName: branch?.name ?? item.branchId,
    /** La zona de la sede: la hora de la cita es la de allí (para el .ics y los enlaces de calendario). */
    timeZone: branchTimeZone(item.branchId),
    personName: link?.line.guestName ?? db.calendar.clients.find((client) => client.id === item.clientId)?.name ?? "",
    guestRelation: link?.line.guestRelation ?? null,
    serviceIds: item.serviceIds,
    serviceNames: item.serviceIds.map(serviceName),
    barberId: item.barberId,
    barberName: member ? memberName(member) : "",
    barberAvatarUrl: member?.avatarUrl ?? null,
    noPreference: link?.line.noPreference ?? false,
    start: item.start,
    durationMin: item.durationMin,
    price,
    paid: link?.line.paid ?? 0,
    status,
  } as const;
}

export function reservationView(reservation: MockReservation) {
  const client = db.calendar.clients.find((item) => item.id === reservation.customerId);
  const appointments = reservation.lines
    .map((line) => db.calendar.appointments.find((item) => item.id === line.appointmentId))
    .filter((item): item is MockAppointment => item !== undefined)
    .map(bookedOf);
  return {
    id: reservation.id,
    number: reservation.number,
    createdAt: reservation.createdAt,
    customerId: reservation.customerId,
    customerName: client?.name ?? "",
    email: client ? profileOf(client).email : "",
    phone: client?.phone ?? "",
    appointments,
    products: reservation.products,
    promoCode: reservation.promoCode,
    totals: reservation.totals,
    payment: reservation.payment,
  };
}

/** Las citas de un cliente, las que vienen y las que ya pasaron. */
export function myAppointments(clientId: string) {
  const now = Date.now();
  const mine = db.calendar.appointments.filter((item) => item.clientId === clientId).map(bookedOf);
  const upcoming = mine.filter((item) => item.status === "scheduled" && startInstant(item).getTime() >= now).sort((a, b) => a.start.localeCompare(b.start));
  const past = mine.filter((item) => !upcoming.includes(item)).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12);
  const reservations = db.booking.reservations.filter((item) => item.customerId === clientId).map(reservationView);
  return { upcoming, past, reservations };
}

export const findReservationLine = reservationOf;

const DAY_MS = 86_400_000;
/** Cuántos días a partir de la fecha que le toca se buscan horas para proponer. */
const SUGGESTION_SEARCH_DAYS = 10;
const SUGGESTION_OPTIONS = 3;
/** Horas habituales de quien aún no tiene historial de horas en la agenda. */
const USUAL_FALLBACK = [600, 660, 900, 1020];

/** La hora a la que suele venir: la mediana de sus citas pasadas, o una estable por cliente. */
function usualMinute(client: MockClient): number {
  const past = db.calendar.appointments
    .filter((item) => item.clientId === client.id && isLive(item) && startInstant(item).getTime() < Date.now())
    .map((item) => parseClock(item.start.slice(11, 16)))
    .sort((a, b) => a - b);
  if (past.length > 0) return past[Math.floor(past.length / 2)];
  return USUAL_FALLBACK[hashOf(client.id, 7) % USUAL_FALLBACK.length];
}

/**
 * La próxima cita que le toca según su frecuencia de visita (FOV): la fecha
 * es la última visita más su ritmo, y la hora, la que suele elegir, con su
 * barbero de siempre. Si ese día no hay hueco se mira hacia delante; si su
 * barbero no tiene sitio en días, con cualquiera.
 */
export function visitSuggestion(client: MockClient) {
  const customer = customerOf(client);
  const last = customer.lastVisit;
  if (!last || !client.visitEveryDays) return null;
  const lastDay = new Date(`${last.at.slice(0, 10)}T00:00:00`);
  const due = new Date(lastDay.getTime() + client.visitEveryDays * DAY_MS);
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const from = due.getTime() < today.getTime() ? today : due;
  const usual = usualMinute(client);
  const byCloseness = (a: { time: string }, b: { time: string }) => Math.abs(parseClock(a.time) - usual) - Math.abs(parseClock(b.time) - usual);

  const search = (barberId: string | null) => {
    const options: { start: string; barberId: string; sameBarber: boolean }[] = [];
    for (let offset = 0; offset < SUGGESTION_SEARCH_DAYS && options.length < SUGGESTION_OPTIONS; offset += 1) {
      const day = dateKey(new Date(from.getTime() + offset * DAY_MS));
      const slots = availability(last.branchId, day, last.serviceIds, barberId).sort(byCloseness);
      // Del primer día con sitio, las dos horas más cercanas a la suya; de los siguientes, una.
      const take = options.length === 0 ? 2 : 1;
      for (const slot of slots.slice(0, take)) {
        const chosen = barberId ?? (last.barberId && slot.barberIds.includes(last.barberId) ? last.barberId : slot.barberIds[0]);
        options.push({ start: `${day}T${slot.time}`, barberId: chosen, sameBarber: chosen === last.barberId });
      }
    }
    return options.slice(0, SUGGESTION_OPTIONS);
  };

  const sameBarber = last.barberId ? search(last.barberId) : [];
  const options = sameBarber.length > 0 ? sameBarber : search(null);
  if (options.length === 0) return null;
  return {
    everyDays: client.visitEveryDays,
    lastVisitAt: last.at,
    dueDate: dateKey(due),
    isOverdue: due.getTime() < today.getTime(),
    usualTime: clockOf(usual),
    branchId: last.branchId,
    serviceIds: last.serviceIds,
    options,
  };
}

const GALLERY_EXTRA = [
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&h=800&fit=crop&auto=format&q=70",
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&h=800&fit=crop&auto=format&q=70",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200&h=800&fit=crop&auto=format&q=70",
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200&h=800&fit=crop&auto=format&q=70",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&h=800&fit=crop&auto=format&q=70",
];
const DAYS_IN_WEEK = 7;

/**
 * El perfil de una sede: lo que se mira antes de elegirla. La descripción, la
 * dirección, el teléfono y el horario de cada día son los de Configuración ›
 * Sucursales; un día que la sede abre pero sin nadie del equipo sale cerrado.
 */
export function branchDetail(branchId: string) {
  const branch = (db.settings.lists.branches as unknown as { id: string; name: string; address: string; city: string; state: string; zipcode: string; phone: string; description: string; status: string }[]).find(
    (item) => item.id === branchId && item.status === "active"
  );
  if (!branch) return null;
  const members = bookableBarbers(branchId).map((barber) => memberOf(barber.id)).filter((member) => member !== undefined);
  // El horario que publica la sede; un día que abre pero sin nadie del equipo se muestra cerrado.
  const week = branchHours(branchId);
  const hours = Array.from({ length: DAYS_IN_WEEK }, (_, day) => {
    const own = week[String(day) as keyof typeof week];
    const staffed = members.some((member) => member.schedule[String(day)]);
    return own && staffed ? { day, opensAt: own.open, closesAt: own.close } : { day, opensAt: null, closesAt: null };
  });
  const business = db.settings.sections.business as { website: string; instagram: string; facebook: string };
  const own = BRANCH_PHOTOS[branchId];
  const fullAddress = `${branch.address}, ${branch.city}, ${branch.state} ${branch.zipcode}`;
  return {
    id: branch.id,
    name: branch.name,
    description:
      branch.description.trim() ||
      `Nuestra sede de ${branch.city}: ${members.length} barberos, de corte clásico a diseño y barba a navaja. Reserva con tu barbero de siempre o con quien tenga el primer hueco.`,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    zipcode: branch.zipcode,
    phone: branch.phone,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`,
    links: { website: business.website.trim(), instagram: business.instagram.trim(), facebook: business.facebook.trim() },
    // Primero se iguala el tamaño y luego se quitan repetidas: la foto propia también está entre las de ejemplo.
    gallery: [own, ...GALLERY_EXTRA].filter((src): src is string => Boolean(src)).map((src) => src.replace("w=640&h=400", "w=1200&h=800")).filter((src, index, all) => all.indexOf(src) === index).slice(0, 5),
    hours,
    barbers: members.length,
    closures: (db.settings.lists.closures as unknown as { startDate: string; endDate: string; branchIds: string[]; description: string }[])
      .filter((closure) => closure.branchIds.includes(branchId) && closure.endDate >= dateKey(new Date()))
      .map((closure) => ({ startDate: closure.startDate, endDate: closure.endDate, description: closure.description })),
  };
}

/** La tasa media de una reserva en su sucursal: cada servicio (al precio de su barbero) y cada producto con la suya. */
export function reservationTaxPercent(branchId: string, planned: readonly { barberId: string; serviceIds: readonly string[] }[], products: readonly { productId: string; price: number; qty: number }[]): number {
  return accountTaxPercent(branchId, {
    services: planned.flatMap((item) => item.serviceIds.map((serviceId) => ({ id: serviceId, amount: barberPrice(item.barberId, serviceId, branchId) ?? 0 }))),
    products: products.map((line) => ({ id: line.productId, amount: line.price * line.qty })),
  });
}
