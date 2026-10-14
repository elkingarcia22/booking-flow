import { delay, http, HttpResponse, type DefaultBodyType } from "msw";
import { ACCOUNTS, db } from "../db";
import { localIso, parseClock, type MockAppointment, type MockClient } from "../calendar/seed";
import { appointmentsOn } from "../calendar/handlers";
import { profileOf, saveProfile } from "../customers/handlers";
import { cancellationTerms, chargesCardFee, computeTotals, coverByPackages, findPromo, promoDiscount, tipAmount } from "@/features/booking/pricing";
import {
  availability,
  barberFree,
  branchDetail,
  barberPrice,
  bookableBarbers,
  bookedOf,
  bookingRules,
  cardFeeRule,
  depositAmount,
  redeemLoyalty,
  cardsOf,
  removeCard,
  saveCard,
  updateCard,
  catalog,
  clientByPhone,
  customerOf,
  durationOf,
  findReservationLine,
  isBlockedPhone,
  myAppointments,
  reservationView,
  serviceName,
  shop,
  taxPercent,
  tipOptions,
  visitSuggestion,
} from "./logic";
import { alternatives, earliest, joinWaitlist, type WaitlistWindow } from "./alternatives";
import { cancelMessages, offerFreedSlot, rescheduleMessages, scheduleMessages } from "./reminders";
import { MAX_REPEATS, REPEAT_WEEKS, repeatAppointment, type RepeatWeeks } from "./recurring";
import { addReview, reviewOfAppointment, reviewsOf } from "./reviews";
import { createGiftCard, findGiftCard, spendGiftCard } from "./giftCards";
import { activePackages, buyPackage, packageOffers, spendPackages } from "./packages";
import { FUNNEL_STEPS, funnelSummary, recordEvent } from "./funnel";

/** Lo que se puede regalar en una tarjeta. */
const GIFT_MIN = 10;
const GIFT_MAX = 500;
import { MAX_PHOTO_CHARS, MAX_REFERENCE_PHOTOS, PHOTO_PATTERN } from "@/features/booking/flow/referencePhoto";
import { DECLINED_CARD, DEMO_GUESTS, DEMO_GUESTS_CLIENT, DEMO_OTP, type MockBookingLine, type MockReservation } from "./state";

/**
 * La reserva en línea del backend simulado (docs/API_CONTRACT.md, «Reserva en
 * línea»). Pública: no pide la sesión de la app, sino la suya. El celular
 * recibe un código (a cualquier número, para no revelar quién es cliente) y al
 * verificarlo se entrega un token en `x-booking-token`. Todo lo que actúa en
 * nombre de alguien —crear el perfil, reservar, cobrar una tarjeta guardada, la
 * lista de espera, «Mis citas»— toma al cliente de ese token, nunca de un id que
 * mande el navegador. Sin token, 403 (no 401: un 401 cerraría la sesión de quien
 * esté dentro de la app).
 */

const BASE = "*/api/booking";
const LATENCY_MS = 250;
const PAY_LATENCY_MS = 900;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const START = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const error = (status: number, code: string, message: string, extra?: Record<string, unknown>) => HttpResponse.json({ code, message, ...extra }, { status });
const asRecord = (body: DefaultBodyType): Record<string, unknown> => (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const findClient = (id: string) => db.calendar.clients.find((client) => client.id === id);

/** Una sesión verificada es de un cliente (su id) o de un celular nuevo aún sin perfil (`phone:+57…`). */
const PHONE_SESSION = "phone:";
/** La sesión de vista previa (reconocido por su celular, sin código): solo sirve para su propuesta de visita. */
const PREVIEW_SESSION = "preview:";
const sessionValue = (request: Request): string | undefined => {
  const token = request.headers.get("x-booking-token");
  return token ? db.bookingSessions.get(token) : undefined;
};

function sessionClient(request: Request): MockClient | null {
  const value = sessionValue(request);
  return value && !value.startsWith(PHONE_SESSION) && !value.startsWith(PREVIEW_SESSION) ? findClient(value) ?? null : null;
}

/** El cliente de una sesión verificada o de vista previa: solo para lo que se ve sin código. */
function previewClient(request: Request): MockClient | null {
  const value = sessionValue(request);
  if (value?.startsWith(PREVIEW_SESSION)) return findClient(value.slice(PREVIEW_SESSION.length)) ?? null;
  return sessionClient(request);
}

/** El celular verificado de una sesión que todavía no tiene perfil. */
const sessionPhone = (request: Request): string | null => {
  const value = sessionValue(request);
  return value?.startsWith(PHONE_SESSION) ? value.slice(PHONE_SESSION.length) : null;
};

const NO_SESSION = () => error(403, "booking_session", "Tu sesión venció. Escribe tu celular y el código otra vez.");

/**
 * Límites contra quien prueba números o códigos a ciegas: 5 códigos por celular
 * cada 10 minutos y 5 intentos fallidos por código. En memoria, como haría un
 * almacén rápido en el servidor real.
 */
const CODE_LIMIT = 5;
const CODE_WINDOW_MS = 10 * 60_000;
const ATTEMPT_LIMIT = 5;
const codeRequests = new Map<string, number[]>();
/** Consultas de «¿ya es cliente?» por origen, para que no sirvan para recorrer números. */
const CHECK_LIMIT = 20;
let phoneChecks: number[] = [];
const codeFailures = new Map<string, number>();
const phoneKey = (phone: string) => phone.replace(/\D/g, "");
/** Para las pruebas: cada prueba empieza sin intentos acumulados. */
export function resetBookingLimits(): void {
  codeRequests.clear();
  codeFailures.clear();
  phoneChecks = [];
}

/** Luhn: la misma comprobación que hace la pasarela antes de hablar con el banco. */
function validCard(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  [...digits].reverse().forEach((char, index) => {
    let value = Number(char);
    if (index % 2 === 1) value = value * 2 > 9 ? value * 2 - 9 : value * 2;
    sum += value;
  });
  return sum % 10 === 0;
}

const brandOf = (number: string): string => (number.startsWith("4") ? "Visa" : number.startsWith("5") ? "Mastercard" : number.startsWith("3") ? "Amex" : "Tarjeta");

/**
 * Cobra con tarjeta (guardada por su token, nueva o la billetera): una reserva, un anticipo o una
 * tarjeta de regalo. Devuelve la marca y los últimos 4, o la respuesta de error de la pasarela.
 */
function chargeCard(client: MockClient, input: Record<string, unknown>, via: "card" | "wallet"): { last4: string; brand: string } | Response {
  const savedCardId = text(input.savedCardId);
  if (via === "card" && savedCardId) {
    // Una tarjeta guardada se cobra con su token: aquí nunca llega el número.
    const saved = cardsOf(client.id).find((item) => item.id === savedCardId);
    if (!saved) return error(422, "card_invalid", "Esa tarjeta ya no está guardada. Elige otra.", { fields: { card: ["Esa tarjeta ya no está guardada. Elige otra."] } });
    return { last4: saved.last4, brand: saved.brand };
  }
  const card = asRecord(input.card as DefaultBodyType);
  const number = via === "wallet" ? "4242424242424242" : text(card.number).replace(/\D/g, "");
  if (!validCard(number)) return error(422, "card_invalid", "Revisa el número de la tarjeta.", { fields: { card: ["Revisa el número de la tarjeta."] } });
  if (number === DECLINED_CARD) return error(402, "card_declined", "El banco rechazó la tarjeta. Prueba con otra o paga en la barbería.");
  const [expMonth, expYear] = text(card.expiry).split("/").map(Number);
  if (via === "card" && card.save === true && expMonth && expYear) {
    saveCard(client.id, { brand: brandOf(number), last4: number.slice(-4), expMonth, expYear: 2000 + expYear, holder: text(card.name) });
  }
  return { last4: number.slice(-4), brand: via === "wallet" ? "Wallet" : brandOf(number) };
}


interface PlannedItem {
  guestName: string | null;
  guestRelation: string | null;
  serviceIds: string[];
  barberId: string;
  noPreference: boolean;
  day: string;
  time: string;
  durationMin: number;
  price: number;
}

/** Comprueba cada cita y, sin preferencia, le asigna el primer barbero libre (en el orden del calendario). */
function planItems(branchId: string, items: unknown[], client: MockClient): { planned: PlannedItem[] } | { problem: string } {
  const planned: PlannedItem[] = [];
  const taken: { barberId: string; day: string; start: number; end: number }[] = [];
  const minNotice = bookingRules().minNoticeMinutes;
  for (const raw of items) {
    const item = asRecord(raw as DefaultBodyType);
    const serviceIds = strings(item.serviceIds);
    const start = text(item.start);
    if (serviceIds.length === 0) return { problem: "Cada cita necesita al menos un servicio." };
    if (!START.test(start)) return { problem: "Elige fecha y hora para cada cita." };
    const day = start.slice(0, 10);
    const time = start.slice(11, 16);
    const minute = parseClock(time);
    if (new Date(start).getTime() < Date.now() + minNotice * 60_000) return { problem: "Esa hora ya no se puede reservar. Elige otra." };
    const durationMin = durationOf(serviceIds);
    appointmentsOn(branchId, day);
    const overlapsTaken = (barberId: string) => taken.some((slot) => slot.barberId === barberId && slot.day === day && minute < slot.end && slot.start < minute + durationMin);
    const wanted = text(item.barberId);
    const candidates = bookableBarbers(branchId).filter((barber) => (wanted ? barber.id === wanted : true) && serviceIds.every((id) => barberPrice(barber.id, id) !== null));
    const chosen = candidates.find((barber) => !overlapsTaken(barber.id) && barberFree(branchId, barber.id, day, minute, durationMin));
    if (!chosen) return { problem: wanted ? "El barbero no está disponible a esa hora. Por favor elige otra." : "Ese horario acaba de ser tomado. Por favor elige otro." };
    taken.push({ barberId: chosen.id, day, start: minute, end: minute + durationMin });
    const guestId = text(item.guestId);
    const guest = guestId ? profileOf(client).guests.find((entry) => entry.id === guestId) : undefined;
    const guestName = guest?.name ?? (text(item.guestName) || null);
    planned.push({
      guestName,
      guestRelation: guest?.relation ?? (guestName ? text(item.guestRelation) || null : null),
      serviceIds,
      barberId: chosen.id,
      noPreference: !wanted,
      day,
      time,
      durationMin,
      price: serviceIds.reduce((sum, id) => sum + (barberPrice(chosen.id, id) ?? 0), 0),
    });
  }
  return { planned };
}

/** Los invitados nuevos quedan guardados en la ficha del cliente para la próxima vez. */
function rememberGuests(client: MockClient, planned: readonly PlannedItem[]) {
  const profile = profileOf(client);
  const known = new Set(profile.guests.map((guest) => guest.name.toLowerCase()));
  const fresh = planned.filter((item) => item.guestName && !known.has(item.guestName.toLowerCase()));
  if (fresh.length === 0) return;
  const guests = [...profile.guests, ...fresh.map((item, index) => ({ id: `gst_${Date.now().toString(36)}_${index}`, name: item.guestName as string, relation: item.guestRelation ?? "", visits: 0 }))];
  saveProfile(client.id, { ...profile, guests });
}

/** La clienta de la demo llega con su hijo y su pareja guardados en la ficha (una sola vez). */
function seedDemoGuests(client: MockClient | undefined) {
  if (!client || client.id !== DEMO_GUESTS_CLIENT || db.booking.demoGuestsSeeded) return;
  const profile = profileOf(client);
  if (profile.guests.length === 0) saveProfile(client.id, { ...profile, guests: DEMO_GUESTS.map((guest) => ({ ...guest })) });
  db.booking = { ...db.booking, demoGuestsSeeded: true };
  db.persist();
}

export const bookingHandlers = [
  http.get(`${BASE}/shop`, async () => {
    await delay(LATENCY_MS);
    return HttpResponse.json(shop());
  }),

  http.get(`${BASE}/branches/:id`, async ({ params }) => {
    await delay(LATENCY_MS);
    const detail = branchDetail(String(params.id));
    return detail ? HttpResponse.json(detail) : error(404, "not_found", "Esa sede no existe.");
  }),

  http.get(`${BASE}/catalog`, async ({ request }) => {
    await delay(LATENCY_MS);
    const branchId = new URL(request.url).searchParams.get("branchId") ?? "";
    if (!shop().branches.some((branch) => branch.id === branchId)) return error(404, "not_found", "Esa sede no existe.");
    return HttpResponse.json(catalog(branchId));
  }),

  http.get(`${BASE}/availability`, async ({ request }) => {
    await delay(LATENCY_MS);
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId") ?? "";
    const date = url.searchParams.get("date") ?? "";
    const serviceIds = (url.searchParams.get("serviceIds") ?? "").split(",").filter(Boolean);
    const barberId = url.searchParams.get("barberId");
    const exclude = url.searchParams.get("exclude") ?? undefined;
    if (!DAY_KEY.test(date)) return error(422, "validation", "La fecha debe ser AAAA-MM-DD.");
    if (serviceIds.length === 0) return error(422, "validation", "Elige al menos un servicio.");
    return HttpResponse.json({ date, slots: availability(branchId, date, serviceIds, barberId, exclude) });
  }),

  http.get(`${BASE}/alternatives`, async ({ request }) => {
    await delay(LATENCY_MS);
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId") ?? "";
    const date = url.searchParams.get("date") ?? "";
    const serviceIds = (url.searchParams.get("serviceIds") ?? "").split(",").filter(Boolean);
    const barberId = url.searchParams.get("barberId") || null;
    if (!DAY_KEY.test(date)) return error(422, "validation", "La fecha debe ser AAAA-MM-DD.");
    if (serviceIds.length === 0) return error(422, "validation", "Elige al menos un servicio.");
    return HttpResponse.json({ date, items: alternatives(branchId, date, serviceIds, barberId) });
  }),

  http.get(`${BASE}/earliest`, async ({ request }) => {
    await delay(LATENCY_MS);
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId") ?? "";
    const serviceIds = (url.searchParams.get("serviceIds") ?? "").split(",").filter(Boolean);
    const barberId = url.searchParams.get("barberId") || null;
    if (serviceIds.length === 0) return error(422, "validation", "Elige al menos un servicio.");
    return HttpResponse.json({ slot: earliest(branchId, serviceIds, barberId) });
  }),

  http.post(`${BASE}/waitlist`, async ({ request }) => {
    await delay(LATENCY_MS);
    const input = asRecord(await request.json().catch(() => ({})));
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const branchId = text(input.branchId);
    const date = text(input.date);
    const serviceIds = strings(input.serviceIds);
    const barberId = text(input.barberId) || null;
    const window = (["morning", "afternoon", "evening", "any"] as const).find((item) => item === input.window);
    if (!(db.settings.lists.branches as unknown as { id: string }[]).some((branch) => branch.id === branchId)) return error(422, "validation", "Elige una sede.");
    if (!DAY_KEY.test(date)) return error(422, "validation", "La fecha debe ser AAAA-MM-DD.");
    if (serviceIds.length === 0 || !serviceIds.every((id) => db.services.items.some((item) => item.id === id))) return error(422, "validation", "Elige al menos un servicio.");
    if (!window) return error(422, "validation", "Elige mañana, tarde, noche o cualquier hora.");
    const entry = joinWaitlist({ branchId, clientId: client.id, date, serviceIds, barberId, window: window as WaitlistWindow });
    return HttpResponse.json({ id: entry.id, date, window }, { status: 201 });
  }),

  http.delete(`${BASE}/waitlist/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const entry = db.calendar.waitlist.find((item) => item.id === params.id);
    // Solo quien se apuntó puede salir de la lista.
    if (!entry || entry.clientId !== client.id) return error(404, "not_found", "Esa entrada no existe.");
    db.calendar.waitlist = db.calendar.waitlist.filter((item) => item.id !== entry.id);
    db.persist();
    return new HttpResponse(null, { status: 204 });
  }),

  // Sus tarjetas guardadas: cambia titular o vencimiento, o la quita. Devuelve el perfil con la lista al día.
  http.patch(`${BASE}/me/cards/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const input = asRecord(await request.json().catch(() => ({})));
    const holder = text(input.holder);
    const expMonth = Number(input.expMonth);
    const expYear = Number(input.expYear);
    if (holder.length < 3) return error(422, "validation", "Escribe el nombre como aparece en la tarjeta.", { fields: { holder: ["Escribe el nombre como aparece en la tarjeta."] } });
    const validMonth = Number.isInteger(expMonth) && expMonth >= 1 && expMonth <= 12 && Number.isInteger(expYear);
    if (!validMonth || new Date(expYear, expMonth, 1).getTime() <= Date.now()) return error(422, "validation", "Esa fecha de vencimiento ya pasó.", { fields: { expiry: ["Esa fecha de vencimiento ya pasó."] } });
    if (!updateCard(client.id, String(params.id), { holder, expMonth, expYear })) return error(404, "not_found", "Esa tarjeta ya no está guardada.");
    db.persist();
    return HttpResponse.json(customerOf(client));
  }),

  http.delete(`${BASE}/me/cards/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    if (!removeCard(client.id, String(params.id))) return error(404, "not_found", "Esa tarjeta ya no está guardada.");
    db.persist();
    return HttpResponse.json(customerOf(client));
  }),

  http.get(`${BASE}/me/suggestion`, async ({ request }) => {
    await delay(LATENCY_MS);
    const client = previewClient(request);
    if (!client) return NO_SESSION();
    // Sin ritmo de visitas todavía (cliente nuevo) no hay nada que proponer.
    return HttpResponse.json({ suggestion: visitSuggestion(client) });
  }),

  http.post(`${BASE}/customers`, async ({ request }) => {
    await delay(LATENCY_MS);
    const input = asRecord(await request.json().catch(() => ({})));
    // El celular es el verificado con el código, no el que diga el formulario.
    const already = sessionClient(request);
    if (already) return HttpResponse.json(customerOf(already));
    const phone = sessionPhone(request);
    if (!phone) return NO_SESSION();
    const firstName = text(input.firstName);
    const lastName = text(input.lastName);
    const email = text(input.email);
    const fields: Record<string, string[]> = {};
    if (firstName.length < 2) fields.firstName = ["Escribe tu nombre."];
    if (lastName.length < 2) fields.lastName = ["Escribe tu apellido."];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = ["Revisa el correo."];
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    const token = request.headers.get("x-booking-token") ?? "";
    const existing = clientByPhone(phone);
    if (existing) {
      db.bookingSessions.set(token, existing.id);
      return HttpResponse.json(customerOf(existing));
    }
    const client: MockClient = { id: `cli_web_${Date.now().toString(36)}`, name: `${firstName} ${lastName}`, phone, type: "new", visits: 0, cancellations: 0, noShows: 0, lastVisitAt: null, preferredBarberId: null, visitEveryDays: null, notes: [], avatarUrl: null };
    db.calendar.clients = [...db.calendar.clients, client];
    const now = new Date().toISOString();
    saveProfile(client.id, { ...profileOf(client), email, onlineOnly: false, blocked: false, guests: [], createdAt: now, marketingConsent: { accepted: input.marketing === true, at: now, source: "booking" } });
    // La sesión del celular pasa a ser la del cliente recién creado.
    db.bookingSessions.set(token, client.id);
    return HttpResponse.json(customerOf(client), { status: 201 });
  }),

  http.post(`${BASE}/promo`, async ({ request }) => {
    await delay(LATENCY_MS);
    const input = asRecord(await request.json().catch(() => ({})));
    const client = sessionClient(request);
    const result = findPromo(text(input.code), { isNewClient: client ? customerOf(client).isNew : true, appointments: Number(input.appointments) || 1 });
    if ("problem" in result) return error(422, "promo_invalid", "Ese cupón no aplica.", { problem: result.problem });
    return HttpResponse.json(result.promo);
  }),

  http.post(`${BASE}/reservations`, async ({ request }) => {
    await delay(PAY_LATENCY_MS);
    const input = asRecord(await request.json().catch(() => ({})));
    // Quien reserva (y a quien se cobra una tarjeta guardada) es el de la sesión verificada.
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const branchId = text(input.branchId);
    const items = Array.isArray(input.items) ? input.items : [];
    if (items.length === 0) return error(422, "validation", "Aún no hay citas.");
    const plan = planItems(branchId, items, client);
    if ("problem" in plan) return error(409, "conflict", plan.problem);
    const productLines = (Array.isArray(input.products) ? input.products : []).map((raw) => asRecord(raw as DefaultBodyType)).flatMap((line) => {
      const product = db.products.items.find((item) => item.id === text(line.productId));
      const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
      return product && qty > 0 ? [{ productId: product.id, name: product.name, qty, price: product.price }] : [];
    });
    const servicesTotal = plan.planned.reduce((sum, item) => sum + item.price, 0);
    const productsTotal = productLines.reduce((sum, line) => sum + line.price * line.qty, 0);
    const customer = customerOf(client);
    const promoResult = text(input.promoCode) ? findPromo(text(input.promoCode), { isNewClient: customer.isNew, appointments: plan.planned.length }) : null;
    const promo = promoResult && "promo" in promoResult ? promoResult.promo : null;
    const tip = tipOptions().options.find((option) => option.id === text(input.tipId)) ?? null;
    const method = text(input.method) as MockReservation["payment"]["method"];
    // Cortesía de cliente frecuente: si la pide y tiene una por usar, se descuenta el servicio de cortesía
    // a lo que cobra el barbero de la cita que lo lleva (cada barbero tiene su precio).
    const loyalty = input.useReward === true ? customer.loyalty : null;
    const rewardItem = loyalty ? plan.planned.find((item) => item.serviceIds.includes(loyalty.rewardServiceId)) : undefined;
    const rewardValue = loyalty && loyalty.available > 0 ? ((rewardItem && barberPrice(rewardItem.barberId, loyalty.rewardServiceId)) ?? loyalty.rewardValue) : 0;
    // Paquetes: cada cita con un servicio que tiene visitas por usar se paga con una.
    const coverage = input.usePackages === true ? coverByPackages(plan.planned.map((item) => item.serviceIds.map((serviceId) => ({ serviceId, price: barberPrice(item.barberId, serviceId) ?? 0 }))), activePackages(client.id)) : { amount: 0, used: {} };
    // Tarjeta de regalo: paga primero; lo que sobra queda en ella.
    const giftCode = text(input.giftCode);
    const giftCard = giftCode ? findGiftCard(giftCode) : undefined;
    if (giftCode && (!giftCard || giftCard.balance <= 0)) return error(422, "gift_invalid", "Esa tarjeta de regalo no existe o ya no tiene saldo.");
    const totals = computeTotals({ services: servicesTotal, products: productsTotal, discount: promoDiscount(promo, servicesTotal + productsTotal), taxPercent: taxPercent(), tip: tipAmount(tip, servicesTotal), cardFee: chargesCardFee(method) ? cardFeeRule() : null, giftBalance: giftCard?.balance ?? 0, reward: rewardValue, prepaid: coverage.amount });

    const rules = bookingRules();
    let payment: MockReservation["payment"];
    if (totals.total === 0 && totals.gift > 0) {
      // La tarjeta de regalo cubre todo: no hay nada más que cobrar.
      payment = { method: "gift", status: "paid", last4: null, brand: null, paid: 0 };
    } else if (method === "shop") {
      if (!rules.paymentMethods.payAtShop || customer.onlineOnly) return error(422, "validation", "Esta reserva se paga en línea.");
      // Cliente nuevo o con inasistencias: para pagar en la barbería deja un anticipo con tarjeta.
      const deposit = customer.depositRequired ? Math.min(depositAmount(totals), totals.total) : 0;
      if (deposit > 0) {
        if (!text(input.savedCardId) && !input.card) return error(422, "card_required", "Elige una tarjeta para el anticipo.", { fields: { card: ["Elige una tarjeta para el anticipo."] } });
        const charged = chargeCard(client, input, "card");
        if (charged instanceof Response) return charged;
        payment = { method, status: "pending", last4: charged.last4, brand: charged.brand, paid: deposit };
      } else {
        payment = { method, status: "pending", last4: null, brand: null, paid: 0 };
      }
    } else if (method === "credit") {
      if (customer.credit < totals.total) return error(422, "validation", "Tu saldo a favor no alcanza para esta reserva.");
      db.booking.credits = { ...db.booking.credits, [client.id]: Math.round((customer.credit - totals.total) * 100) / 100 };
      payment = { method, status: "paid", last4: null, brand: null, paid: totals.total };
    } else if (method === "card" || method === "wallet") {
      if (!rules.paymentMethods.card) return error(422, "validation", "Esta barbería no cobra en línea.");
      const charged = chargeCard(client, input, method);
      if (charged instanceof Response) return charged;
      payment = { method, status: "paid", last4: charged.last4, brand: charged.brand, paid: totals.total };
    } else {
      return error(422, "validation", "Elige cómo vas a pagar.");
    }

    if (totals.reward > 0) redeemLoyalty(client);
    if (totals.prepaid > 0) spendPackages(client.id, coverage.used);
    // Lo pagado con la tarjeta de regalo cuenta como pagado (si se cancela, vuelve como saldo a favor).
    if (giftCard && totals.gift > 0) {
      spendGiftCard(giftCard.code, totals.gift);
      payment = { ...payment, paid: Math.round((payment.paid + totals.gift) * 100) / 100 };
    }

    const reservationId = `rsv_${Date.now().toString(36)}`;
    const paidShare = payment.paid === 0 ? 0 : payment.paid / Math.max(1, totals.total);
    const notes = text(input.notes) || null;
    const referencePhotos = (Array.isArray(input.referencePhotos) ? input.referencePhotos : []).map((photo) => text(photo)).filter(Boolean);
    const badPhoto = referencePhotos.length > MAX_REFERENCE_PHOTOS || referencePhotos.some((photo) => !(PHOTO_PATTERN.test(photo) && photo.length <= MAX_PHOTO_CHARS));
    if (badPhoto) return error(422, "validation", "La foto no se pudo subir. Prueba con otra.", { fields: { referencePhotos: ["La foto no se pudo subir. Prueba con otra."] } });
    // Varias citas en un solo agendamiento quedan enlazadas en la agenda.
    const linkId = plan.planned.length > 1 ? `lnk_${reservationId}` : null;
    const created: MockAppointment[] = plan.planned.map((item, index) => ({
      id: `apt_web_${Date.now().toString(36)}_${index}`,
      linkId,
      branchId,
      clientId: client.id,
      barberId: item.barberId,
      requestedBarberId: item.noPreference ? null : item.barberId,
      serviceIds: item.serviceIds,
      products: index === 0 ? productLines.map((line) => ({ productId: line.productId, qty: line.qty })) : [],
      start: localIso(item.day, item.time),
      durationMin: item.durationMin,
      status: "scheduled",
      barberReady: false,
      walkIn: false,
      source: "online",
      repeat: "none",
      seriesId: null,
      notes: [item.guestName ? `Para ${item.guestName}${item.guestRelation ? ` (${item.guestRelation})` : ""}` : null, notes, referencePhotos.length > 0 ? "Trae foto de referencia" : null].filter(Boolean).join(" · ") || null,
      referencePhotos,
      createdAt: new Date().toISOString(),
      createdBy: "Reserva en línea",
      history: [{ id: `h_${Math.random().toString(36).slice(2, 9)}`, at: new Date().toISOString(), actor: client.name, event: "created" }],
      payment: null,
    }));
    const lines: MockBookingLine[] = plan.planned.map((item, index) => ({ appointmentId: created[index].id, guestName: item.guestName, guestRelation: item.guestRelation, price: item.price, paid: Math.round(item.price * paidShare * 100) / 100, noPreference: item.noPreference }));
    const reservation: MockReservation = {
      id: reservationId,
      number: `BL-${String(1000 + db.booking.reservations.length + 1)}`,
      createdAt: new Date().toISOString(),
      customerId: client.id,
      branchId,
      lines,
      products: productLines,
      promoCode: promo?.code ?? null,
      giftCode: giftCard?.code ?? null,
      utm: (() => {
        const utm = asRecord(input.utm as DefaultBodyType);
        return text(utm.source) ? { source: text(utm.source).slice(0, 40), medium: text(utm.medium).slice(0, 40), campaign: text(utm.campaign).slice(0, 60) } : null;
      })(),
      totals,
      payment,
    };
    db.calendar.appointments = [...created, ...db.calendar.appointments];
    db.booking.reservations = [reservation, ...db.booking.reservations];
    for (const appointment of created) scheduleMessages(appointment, client.phone);
    rememberGuests(client, plan.planned);
    db.persist();
    return HttpResponse.json(reservationView(reservation), { status: 201 });
  }),

  http.post(`${BASE}/phone/check`, async ({ request }) => {
    await delay(LATENCY_MS);
    const phone = text(asRecord(await request.json().catch(() => ({}))).phone);
    if (phoneKey(phone).length < 8) return error(422, "validation", "Escribe un celular válido.", { fields: { phone: ["Escribe un celular válido."] } });
    const now = Date.now();
    phoneChecks = phoneChecks.filter((at) => now - at < CODE_WINDOW_MS);
    if (phoneChecks.length >= CHECK_LIMIT) return error(429, "rate_limited", "Muchas consultas seguidas. Espera unos minutos e inténtalo otra vez.");
    phoneChecks = [...phoneChecks, now];
    const client = clientByPhone(phone);
    // Un número bloqueado responde como cliente, sin perfil: lo sabe tras el código.
    if (isBlockedPhone(phone, client)) return HttpResponse.json({ returning: true, token: null, customer: null });
    if (!client) return HttpResponse.json({ returning: false, token: null, customer: null });
    seedDemoGuests(client);
    const token = `bkp_${crypto.randomUUID()}`;
    db.bookingSessions.set(token, `${PREVIEW_SESSION}${client.id}`);
    // Lo justo para su bienvenida: nada de correo, tarjetas, saldo, paquetes ni membresía hasta el código.
    const customer = { ...customerOf(client), email: "", cards: [], credit: 0, packages: [], loyalty: null };
    return HttpResponse.json({ returning: true, token, customer });
  }),

  http.post(`${BASE}/otp/request`, async ({ request }) => {
    await delay(LATENCY_MS);
    const phone = text(asRecord(await request.json().catch(() => ({}))).phone);
    if (phoneKey(phone).length < 8) return error(422, "validation", "Escribe un celular válido.", { fields: { phone: ["Escribe un celular válido."] } });
    const now = Date.now();
    const recent = (codeRequests.get(phoneKey(phone)) ?? []).filter((at) => now - at < CODE_WINDOW_MS);
    if (recent.length >= CODE_LIMIT) return error(429, "rate_limited", "Pediste muchos códigos. Espera unos minutos e inténtalo otra vez.");
    codeRequests.set(phoneKey(phone), [...recent, now]);
    codeFailures.delete(phoneKey(phone));
    // Responde igual sea o no cliente: el número no revela nada hasta verificar el código.
    // El código va por mensaje de texto (SMS), no por WhatsApp.
    return HttpResponse.json({ sentTo: `•••• ${phoneKey(phone).slice(-4)}`, channel: "sms" });
  }),

  http.post(`${BASE}/otp/verify`, async ({ request }) => {
    await delay(LATENCY_MS);
    const input = asRecord(await request.json().catch(() => ({})));
    const phone = text(input.phone);
    const failures = codeFailures.get(phoneKey(phone)) ?? 0;
    if (failures >= ATTEMPT_LIMIT) return error(429, "otp_locked", "Demasiados intentos. Pide un código nuevo.");
    if (text(input.code) !== DEMO_OTP) {
      codeFailures.set(phoneKey(phone), failures + 1);
      return error(422, "otp_invalid", "Ese código no es. Revisa el mensaje e inténtalo otra vez.", { attemptsLeft: ATTEMPT_LIMIT - failures - 1, fields: { code: ["Código incorrecto."] } });
    }
    codeFailures.delete(phoneKey(phone));
    const client = clientByPhone(phone);
    if (isBlockedPhone(phone, client)) return HttpResponse.json({ token: null, status: "blocked", customer: null });
    const token = `bk_${crypto.randomUUID()}`;
    if (!client) {
      db.bookingSessions.set(token, `${PHONE_SESSION}${phone}`);
      return HttpResponse.json({ token, status: "new", customer: null });
    }
    seedDemoGuests(client);
    db.bookingSessions.set(token, client.id);
    return HttpResponse.json({ token, status: "known", customer: customerOf(client) });
  }),

  http.get(`${BASE}/me/appointments`, async ({ request }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return error(403, "booking_session", "Vuelve a pedir el código para ver tus citas.");
    return HttpResponse.json(myAppointments(client.id));
  }),

  http.patch(`${BASE}/appointments/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return error(403, "booking_session", "Vuelve a pedir el código para cambiar tus citas.");
    const existing = db.calendar.appointments.find((item) => item.id === params.id && item.clientId === client.id);
    if (!existing) return error(404, "not_found", "Esa cita no existe.");
    const input = asRecord(await request.json().catch(() => ({})));
    const start = text(input.start);
    if (!START.test(start)) return error(422, "validation", "Elige fecha y hora.");
    const terms = cancellationTerms({ start: new Date(existing.start), now: new Date(), cancelHours: bookingRules().cancelHours, lateFeePercent: 0, price: 0, paid: 0 });
    if (!terms.isFree) return error(409, "too_late", `Ya no se puede cambiar en línea: faltan menos de ${bookingRules().cancelHours} h. Llama a la barbería.`);
    const day = start.slice(0, 10);
    const minute = parseClock(start.slice(11, 16));
    const wanted = text(input.barberId);
    const candidates = bookableBarbers(existing.branchId).filter((barber) => (wanted ? barber.id === wanted : true) && existing.serviceIds.every((id) => barberPrice(barber.id, id) !== null));
    appointmentsOn(existing.branchId, day);
    const chosen = candidates.find((barber) => barberFree(existing.branchId, barber.id, day, minute, existing.durationMin, existing.id));
    if (!chosen) return error(409, "conflict", "Ese horario ya no está disponible. Por favor elige otro.");
    const updated: MockAppointment = { ...existing, start: localIso(day, start.slice(11, 16)), barberId: chosen.id, history: [...existing.history, { id: `h_${Math.random().toString(36).slice(2, 9)}`, at: new Date().toISOString(), actor: client.name, event: `moved:${start}` }] };
    db.calendar.appointments = db.calendar.appointments.map((item) => (item.id === updated.id ? updated : item));
    rescheduleMessages(updated, client.phone);
    db.persist();
    return HttpResponse.json(bookedOf(updated));
  }),

  http.post(`${BASE}/events`, async ({ request }) => {
    const input = asRecord(await request.json().catch(() => ({})));
    const step = FUNNEL_STEPS.find((item) => item === input.step);
    const surface = (["link", "widget", "preview"] as const).find((item) => item === input.surface) ?? "preview";
    const sessionId = text(input.sessionId).slice(0, 64);
    if (!step || !sessionId) return new HttpResponse(null, { status: 204 });
    recordEvent({ sessionId, step, at: new Date().toISOString(), surface, source: text(input.source).slice(0, 40).toLowerCase() || "directo" });
    db.persist();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/funnel`, async ({ request }) => {
    await delay(LATENCY_MS);
    // Es del dueño: pide la sesión de la app, no la del cliente.
    const header = request.headers.get("authorization");
    const appToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!ACCOUNTS.some((account) => account.id === (appToken ? db.sessions.get(appToken) : undefined))) return error(401, "unauthorized", "Tu sesión expiró.");
    const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
    return HttpResponse.json(funnelSummary(days));
  }),

  http.post(`${BASE}/packages/buy`, async ({ request }) => {
    await delay(PAY_LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const input = asRecord(await request.json().catch(() => ({})));
    const offer = packageOffers().find((item) => item.id === text(input.packageId));
    if (!offer) return error(404, "not_found", "Ese paquete ya no está a la venta.");
    if (!text(input.savedCardId) && !input.card) return error(422, "card_required", "Elige con qué tarjeta pagas.", { fields: { card: ["Elige con qué tarjeta pagas."] } });
    const charged = chargeCard(client, input, "card");
    if (charged instanceof Response) return charged;
    const owned = buyPackage(client.id, offer);
    db.persist();
    const { id, name, serviceId, remaining, total, expiresAt } = owned;
    return HttpResponse.json({ package: { id, name, serviceId, remaining, total, expiresAt }, paidWith: `${charged.brand} •••• ${charged.last4}` }, { status: 201 });
  }),

  http.post(`${BASE}/gift-cards/check`, async ({ request }) => {
    await delay(LATENCY_MS);
    const code = text(asRecord(await request.json().catch(() => ({}))).code);
    const card = code ? findGiftCard(code) : undefined;
    if (!card) return error(404, "gift_invalid", "No encontramos esa tarjeta de regalo. Revisa el código.");
    if (card.balance <= 0) return error(422, "gift_empty", "Esa tarjeta de regalo ya no tiene saldo.");
    return HttpResponse.json({ code: card.code, balance: card.balance });
  }),

  http.post(`${BASE}/gift-cards`, async ({ request }) => {
    await delay(PAY_LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const input = asRecord(await request.json().catch(() => ({})));
    const amount = Math.round(Number(input.amount) * 100) / 100;
    const recipientName = text(input.recipientName);
    const recipientContact = text(input.recipientContact);
    const fields: Record<string, string[]> = {};
    if (!(amount >= GIFT_MIN && amount <= GIFT_MAX)) fields.amount = [`Entre ${GIFT_MIN} y ${GIFT_MAX}.`];
    if (recipientName.length < 2) fields.recipientName = ["¿Para quién es?"];
    if (recipientContact.replace(/\D/g, "").length < 8) fields.recipientContact = ["Escribe su celular para mandarle el código."];
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    if (!text(input.savedCardId) && !input.card) return error(422, "card_required", "Elige con qué tarjeta pagas.", { fields: { card: ["Elige con qué tarjeta pagas."] } });
    const charged = chargeCard(client, input, "card");
    if (charged instanceof Response) return charged;
    const card = createGiftCard({ initial: amount, buyerId: client.id, recipientName, recipientContact, message: text(input.message).slice(0, 200) });
    db.persist();
    return HttpResponse.json({ code: card.code, amount: card.initial, sentTo: `•••• ${recipientContact.replace(/\D/g, "").slice(-4)}`, paidWith: `${charged.brand} •••• ${charged.last4}` }, { status: 201 });
  }),

  http.get(`${BASE}/barbers/:id/reviews`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const limit = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 5));
    const all = reviewsOf(String(params.id));
    // Público: solo el nombre con inicial, la nota, el comentario y la fecha.
    return HttpResponse.json({ items: all.slice(0, limit).map(({ id, clientName, rating, comment, createdAt }) => ({ id, clientName, rating, comment, createdAt })), total: all.length });
  }),

  http.post(`${BASE}/appointments/:id/review`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const appointment = db.calendar.appointments.find((item) => item.id === params.id && item.clientId === client.id);
    if (!appointment) return error(404, "not_found", "Esa cita no existe.");
    // Solo se califica lo que pasó: cobrada o ya terminada, nunca cancelada ni inasistencia.
    if (bookedOf(appointment).status !== "completed") return error(409, "not_completed", "Podrás calificarla cuando termine tu cita.");
    if (reviewOfAppointment(appointment.id)) return error(409, "already_reviewed", "Ya calificaste esta cita.");
    const input = asRecord(await request.json().catch(() => ({})));
    const rating = Math.round(Number(input.rating));
    if (!(rating >= 1 && rating <= 5)) return error(422, "validation", "Elige de 1 a 5 estrellas.", { fields: { rating: ["Elige de 1 a 5 estrellas."] } });
    const comment = text(input.comment).slice(0, 500);
    const [first = "", last = ""] = client.name.split(" ");
    const review = addReview({ appointmentId: appointment.id, clientId: client.id, clientName: `${first} ${last ? `${last[0]}.` : ""}`.trim(), barberId: appointment.barberId, rating, comment });
    db.persist();
    return HttpResponse.json({ id: review.id, rating: review.rating }, { status: 201 });
  }),

  http.post(`${BASE}/appointments/:id/repeat`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return NO_SESSION();
    const original = db.calendar.appointments.find((item) => item.id === params.id && item.clientId === client.id);
    if (!original || original.status === "cancelled") return error(404, "not_found", "Esa cita no existe.");
    const input = asRecord(await request.json().catch(() => ({})));
    const everyWeeks = REPEAT_WEEKS.find((weeks) => weeks === Number(input.everyWeeks));
    const count = Math.floor(Number(input.count));
    if (!everyWeeks) return error(422, "validation", "Elige cada cuántas semanas.");
    if (!(count >= 1 && count <= MAX_REPEATS)) return error(422, "validation", `Entre 1 y ${MAX_REPEATS} citas.`);
    const { created, skipped } = repeatAppointment(original, everyWeeks as RepeatWeeks, count, client.phone);
    db.persist();
    return HttpResponse.json({ created: created.map(bookedOf), skipped }, { status: 201 });
  }),

  http.post(`${BASE}/appointments/:id/cancel`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return error(403, "booking_session", "Vuelve a pedir el código para cancelar.");
    const existing = db.calendar.appointments.find((item) => item.id === params.id && item.clientId === client.id);
    if (!existing || existing.status !== "scheduled") return error(404, "not_found", "Esa cita ya no se puede cancelar.");
    const rules = bookingRules();
    const done = db.booking.cancellations[client.id] ?? 0;
    if (done >= rules.maxCancellations) return error(409, "limit", "Llegaste al límite de cancelaciones en línea. Llama a la barbería.");
    const view = bookedOf(existing);
    const terms = cancellationTerms({ start: new Date(existing.start), now: new Date(), cancelHours: rules.cancelHours, lateFeePercent: rules.lateFeePercent, price: view.price, paid: view.paid });
    if (terms.isPast) return error(409, "too_late", "Esa cita ya empezó.");
    const wantsCredit = text(asRecord(await request.json().catch(() => ({}))).refundTo) === "credit";
    const refundTo = terms.refund === 0 ? "none" : wantsCredit ? "credit" : "card";
    if (refundTo === "credit") db.booking.credits = { ...db.booking.credits, [client.id]: Math.round(((db.booking.credits[client.id] ?? 0) + terms.refund) * 100) / 100 };
    db.booking.cancellations = { ...db.booking.cancellations, [client.id]: done + 1 };
    const link = findReservationLine(existing.id);
    if (link) {
      const reservation = { ...link.reservation, lines: link.reservation.lines.map((line) => (line.appointmentId === existing.id ? { ...line, paid: 0 } : line)) };
      db.booking.reservations = db.booking.reservations.map((item) => (item.id === reservation.id ? reservation : item));
    }
    cancelMessages(existing.id);
    const updated: MockAppointment = { ...existing, status: "cancelled", history: [...existing.history, { id: `h_${Math.random().toString(36).slice(2, 9)}`, at: new Date().toISOString(), actor: client.name, event: "status:cancelled" }] };
    db.calendar.appointments = db.calendar.appointments.map((item) => (item.id === updated.id ? updated : item));
    // El hueco no se pierde: se ofrece a la lista de espera de esa hora.
    offerFreedSlot(existing);
    db.persist();
    return HttpResponse.json({ appointment: bookedOf(updated), fee: terms.fee, refund: terms.refund, refundTo });
  }),

  // Nota y fotos para el barbero, ya con la reserva hecha: se suman a las de sus citas.
  http.post(`${BASE}/reservations/:id/details`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = sessionClient(request);
    if (!client) return error(403, "booking_session", "Vuelve a pedir el código para agregar tu nota.");
    const reservation = db.booking.reservations.find((item) => item.id === params.id && item.customerId === client.id);
    if (!reservation) return error(404, "not_found", "Esa reserva no existe.");
    const input = asRecord(await request.json().catch(() => ({})));
    const note = text(input.notes);
    const photos = (Array.isArray(input.referencePhotos) ? input.referencePhotos : []).map((photo) => text(photo)).filter(Boolean);
    const badPhoto = photos.length > MAX_REFERENCE_PHOTOS || photos.some((photo) => !(PHOTO_PATTERN.test(photo) && photo.length <= MAX_PHOTO_CHARS));
    if (badPhoto) return error(422, "validation", "La foto no se pudo subir. Prueba con otra.", { fields: { referencePhotos: ["La foto no se pudo subir. Prueba con otra."] } });
    const ids = new Set(reservation.lines.map((line) => line.appointmentId));
    db.calendar.appointments = db.calendar.appointments.map((item) =>
      ids.has(item.id)
        ? {
            ...item,
            notes: [item.notes, note, photos.length > 0 ? "Trae foto de referencia" : null].filter(Boolean).join(" · ") || null,
            referencePhotos: [...(item.referencePhotos ?? []), ...photos].slice(0, MAX_REFERENCE_PHOTOS),
          }
        : item
    );
    db.persist();
    return HttpResponse.json({ saved: true });
  }),

  http.post(`${BASE}/reservations/:id/receipt`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const reservation = db.booking.reservations.find((item) => item.id === params.id);
    if (!reservation) return error(404, "not_found", "Ese recibo no existe.");
    const input = asRecord(await request.json().catch(() => ({})));
    const channel = text(input.channel) === "sms" ? "sms" : "email";
    const to = text(input.to);
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return error(422, "validation", "Revisa el correo.", { fields: { to: ["Revisa el correo."] } });
    if (channel === "sms" && to.replace(/\D/g, "").length < 8) return error(422, "validation", "Revisa el celular.", { fields: { to: ["Revisa el celular."] } });
    return HttpResponse.json({ channel, to });
  }),
];

/** Para las pruebas: el nombre de un servicio tal como sale en el recibo. */
export const bookingServiceName = serviceName;
