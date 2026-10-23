import { workingRangesOn } from "../team/scheduleModel";
import { rangesOf } from "@/features/team/shiftRanges";
import { delay, http, HttpResponse, type DefaultBodyType } from "msw";
import { promoDiscount } from "@/features/booking/pricing";
import { COUPON_PROBLEMS, checkCoupon, redeemCoupon } from "../marketing/coupons";
import { rewardReferral } from "../customers/loyalty";
import { onVisitPaid } from "../marketing/automations";
import { paymentEntriesOf } from "../transactions/ledger";
import { cartTotals } from "@/features/branches/tax";
import { accountById, db } from "../db";
import { withRisk } from "./risk";
import { barberOf, ownAppointments, ownBlocks, ownClientIds, redactClient } from "./scope";
import { forbidden, sessionOf } from "../session";
import { moveStock, releaseAppointmentStock, syncAppointmentStock } from "../inventory/stock";
import { branchNow, itemTaxPercent, taxInclusive } from "../settings/branchRules";
import { appointmentAccount } from "./account";
import { cancelMessages, newConfirmToken, offerFreedSlot, rescheduleMessages, scheduleMessages } from "../booking/reminders";
import { productPriceIn, servicePriceIn } from "../catalogPrices";
import { barbersOf, isBarberRole, memberName, type MockTeamMember, type MockWorkingRange } from "../team/seed";
import type { MockCatalogService } from "../services/seed";
import type { MockCatalogProduct } from "../products/seed";
import { deriveProfile } from "../customers/seed";
import { createGiftCard, spendGiftCard } from "../booking/giftCards";
import { discountOf, parseExtras, splitOfParts } from "./checkoutExtras";
import {
  WALK_IN_CLIENT,
  blockAppliesOn,
  clockOf,
  dateKey,
  localIso,
  parseClock,
  seedDay,
  type MockAppointment,
  type MockAppointmentStatus,
  type MockBarber,
  type MockBlockCategory,
  type MockBlockRepeat,
  type MockClient,
  type MockClientNote,
  type MockConductReason,
  type MockConductReport,
  type MockHistoryEntry,
  type MockPaymentMethod,
  type MockProduct,
  type MockService,
  type MockRepeatRule,
  type MockTimeBlock,
  type MockWaitlistEntry,
} from "./seed";
import { resourceConflict } from "@/features/calendar/resourceModel";
import { seedResources } from "../services/seed";
import { MAX_PHOTO_CHARS, MAX_REFERENCE_PHOTOS, PHOTO_PATTERN } from "@/features/booking/flow/referencePhoto";

/**
 * Los endpoints del calendario del backend simulado. Reproducen
 * docs/API_CONTRACT.md (sección «Calendario»): el día de una sucursal, la
 * ocupación del mes, el catálogo, y las mutaciones de una cita desde que se
 * agenda hasta que se cobra.
 */

/** Las fotos de la semilla son enlaces de la galería; se aceptan al volver a guardar la cita. */
const isSeedPhoto = (photo: string): boolean => photo.startsWith("https://images.unsplash.com/");

const BASE = "*/api";
const LATENCY_MS = 200;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;
const CLOCK = /^\d{2}:\d{2}$/;
const STATUSES: readonly MockAppointmentStatus[] = ["scheduled", "arrived", "seated", "paid", "no_show", "cancelled"];
const REPEATS: readonly MockRepeatRule[] = ["none", "weekly", "biweekly", "triweekly", "monthly", "bimonthly", "quarterly"];
const BLOCK_CATEGORIES: readonly MockBlockCategory[] = ["sick", "vacation", "holiday", "lunch", "meeting", "business", "personal"];
const BLOCK_REPEATS: readonly MockBlockRepeat[] = ["none", "daily", "weekly", "monthly"];
const METHODS: readonly MockPaymentMethod[] = ["cash", "card", "link", "mixed", "transfer"];
/** Cuántas citas crea una serie repetida. */
const SERIES_LENGTH = 12;
const REPEAT_DAYS: Record<Exclude<MockRepeatRule, "none">, { days?: number; months?: number }> = {
  weekly: { days: 7 },
  biweekly: { days: 14 },
  triweekly: { days: 21 },
  monthly: { months: 1 },
  bimonthly: { months: 2 },
  quarterly: { months: 3 },
};

function error(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return HttpResponse.json({ code, message, ...extra }, { status });
}

function requireAuth(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const accountId = token ? db.sessions.get(token) : undefined;
  return accountById(accountId) ?? null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const asRecord = (body: DefaultBodyType): Record<string, unknown> => (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** El horario fijo de una persona, como franjas por día de la semana. */
function fixedHours(member: MockTeamMember): MockBarber["workingHours"] {
  return Object.fromEntries(
    Object.entries(member.schedule)
      .filter(([, range]) => range !== null)
      .map(([day, range]) => [Number(day), rangesOf(range as MockWorkingRange)])
  );
}

/**
 * Las franjas de una persona un día concreto: el plan que rige (con su ciclo) o su horario fijo, la
 * excepción de esa fecha y el cierre de la sede (festivo cerrado o cierre propio). Ver team/scheduleModel.
 */
export function hoursOn(member: MockTeamMember, day: string, branchId?: string): { start: string; end: string }[] {
  return workingRangesOn(member, day, branchId);
}

/** Los barberos activos de la sucursal, en su orden de calendario, como los ve la agenda. */
export function barbersIn(branchId: string): MockBarber[] {
  const order = db.team.orders.find((item) => item.branchId === branchId);
  return barbersOf(db.team.members, db.team.orders, branchId).map((member) => ({
    id: member.id,
    branchId,
    name: memberName(member),
    avatarUrl: member.avatarUrl,
    level: db.team.levels.find((level) => level.id === member.levelId)?.name ?? null,
    workingHours: fixedHours(member),
    acceptsWalkIns: order?.walkIn.find((entry) => entry.memberId === member.id)?.enabled ?? isBarberRole(member.role),
    bookingVisible: member.bookingVisible,
    // Lo que cobra cada barbero: la cuenta de la cita va a su precio, como en la reserva en línea.
    prices: Object.fromEntries(member.services.flatMap((item) => (item.price === null ? [] : [[item.serviceId, item.price]]))),
  }));
}

const findBarber = (id: string) => db.team.members.find((member) => member.id === id && (isBarberRole(member.role) || member.isAlsoBarber));

/** Las citas que la semilla generaría para un día, sin guardarlas. */
function generateDay(branchId: string, day: string): MockAppointment[] {
  const weekday = new Date(`${day}T00:00:00`).getDay();
  const barbers = barbersIn(branchId).map((barber) => {
    const member = db.team.members.find((item) => item.id === barber.id);
    return { ...barber, workingHours: { [weekday]: member ? hoursOn(member, day, branchId) : [] } };
  });
  return seedDay({ branchId, day, barbers, clients: db.calendar.clients, now: new Date(), blocks: db.calendar.blocks.filter((block) => block.branchId === branchId && blockAppliesOn(block, day)), resources: db.services.resources ?? seedResources() });
}

/** Las citas de un día de una sucursal, generándolas la primera vez que se piden. */
export function appointmentsOn(branchId: string, day: string): MockAppointment[] {
  const key = `${branchId}:${day}`;
  if (!db.calendar.seededDays.includes(key)) {
    db.calendar.appointments.push(...generateDay(branchId, day));
    db.calendar.seededDays.push(key);
    db.persist();
  }
  return db.calendar.appointments.filter((item) => item.branchId === branchId && item.start.startsWith(day));
}

/**
 * Las citas de un día para mirarlas sin abrirlo: si el día ya se abrió, las guardadas; si no, las que
 * la semilla generaría (las mismas que verá al abrirlo), sin llenar el almacenamiento del navegador.
 */
export function peekAppointmentsOn(branchId: string, day: string): MockAppointment[] {
  if (db.calendar.seededDays.includes(`${branchId}:${day}`)) return appointmentsOn(branchId, day);
  return generateDay(branchId, day);
}

/** El ritmo se saca de estas semanas hacia atrás (sin contar hoy). */
export const RHYTHM_WEEKS = 8;
const rhythmCache = new Map<string, ReturnType<typeof computeRhythm>>();

const dayKeyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function computeRhythm(branchId: string, own: string | null, now: Date) {
  const totals = Array.from({ length: 7 }, () => ({ sum: 0, samples: 0 }));
  for (let back = 1; back <= RHYTHM_WEEKS * 7; back++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const count = peekAppointmentsOn(branchId, dayKeyOf(date)).filter((item) => (!own || item.barberId === own) && item.status !== "cancelled" && item.status !== "no_show").length;
    // Un día sin una sola cita estaba cerrado: no cuenta para el promedio.
    if (count === 0) continue;
    totals[date.getDay()].sum += count;
    totals[date.getDay()].samples += 1;
  }
  const weekdays = totals.map((item, weekday) => ({ weekday, average: item.samples > 0 ? item.sum / item.samples : 0, samples: item.samples }));
  const open = totals.filter((item) => item.samples > 0);
  const average = open.reduce((sum, item) => sum + item.sum, 0) / Math.max(1, open.reduce((sum, item) => sum + item.samples, 0));
  return { weeks: RHYTHM_WEEKS, average, weekdays };
}

/** Cuántas citas suele tener cada día de la semana en una sucursal (o en la columna de un barbero). */
export function rhythmOf(branchId: string, own: string | null, now = new Date()) {
  const key = `${branchId}:${own ?? "all"}:${dayKeyOf(now)}`;
  const cached = rhythmCache.get(key);
  if (cached) return cached;
  const rhythm = computeRhythm(branchId, own, now);
  rhythmCache.set(key, rhythm);
  return rhythm;
}

/** Lo más que se puede pedir de una vez: tres meses. */
const MAX_RANGE_DAYS = 92;

export const blocksOn = (branchId: string, day: string): MockTimeBlock[] =>
  db.calendar.blocks.filter((block) => block.branchId === branchId && blockAppliesOn(block, day));

const findAppointment = (id: string | readonly string[] | undefined) => db.calendar.appointments.find((item) => item.id === id);

/** El permiso aparte para anotar alergias y medicamentos (ver features/legal/consent.ts). */
const hasHealthConsent = (client: MockClient): boolean => (db.customers.profiles[client.id] ?? deriveProfile(client)).healthConsent?.accepted === true;
const healthConsentRequired = () => error(409, "health_consent_required", "Para anotar alergias o medicamentos, primero pide al cliente su permiso (en su ficha).");

function entry(actor: string, event: string): MockHistoryEntry {
  return { id: `h_${Math.random().toString(36).slice(2, 9)}`, at: new Date().toISOString(), actor, event };
}

/** Quien firma un cambio: la persona de la sesión o, si lo decidió el asistente, él. */
const ASSISTANT_ACTOR = "Asistente";
/** Quién queda en el historial: la persona, el asistente de la agenda o Clipper con quien aprobó el cambio. */
const actorOf = (accountName: string, input: Record<string, unknown>): string => (input.actor === "assistant" ? ASSISTANT_ACTOR : input.actor === "clipper" ? `Clipper · ${accountName}` : accountName);

/**
 * Por qué una cita no cabe donde se pide: otra cita viva del mismo barbero o
 * un bloqueo en el mismo tramo. La misma regla que aplica la agenda antes de
 * soltar; aquí es la última puerta, por si llega por otro camino.
 */
export function clashMessage(branchId: string, barberId: string, day: string, startMinute: number, durationMin: number, excludeId?: string): string | null {
  const end = startMinute + durationMin;
  const clash = appointmentsOn(branchId, day).find((item) => {
    if (item.id === excludeId || item.barberId !== barberId || item.status === "cancelled" || item.status === "no_show") return false;
    const start = parseClock(item.start.slice(11, 16));
    return startMinute < start + item.durationMin && start < end;
  });
  if (clash) return `Se pisa con la cita de ${db.calendar.clients.find((client) => client.id === clash.clientId)?.name ?? "otro cliente"}.`;
  const block = blocksOn(branchId, day).find((item) => item.barberId === barberId && startMinute < parseClock(item.endTime) && parseClock(item.startTime) < end);
  return block ? "Se pisa con un bloqueo del barbero." : null;
}

/**
 * Si la cita pide un recurso especial (el sillón de lavado…) que a esa hora
 * ya está completo. La misma regla que la agenda (`resourceConflict`).
 */
export function resourceMessage(branchId: string, candidate: Pick<MockAppointment, "id" | "serviceIds" | "barberId" | "durationMin" | "start" | "status">): string | null {
  const conflict = resourceConflict(db.services.resources ?? seedResources(), appointmentsOn(branchId, candidate.start.slice(0, 10)), { services: catalogServices(), barbers: [] }, candidate);
  if (!conflict) return null;
  const names = conflict.with.map((item) => db.calendar.clients.find((client) => client.id === item.clientId)?.name.split(" ")[0]).filter(Boolean);
  return `${conflict.resource.name} está ocupado a esa hora (lo usa ${names.join(", ") || "otra cita"}).`;
}

/** Lo que pide un bloqueo (alta o edición): barbero, categoría, repetición, fechas y horas. */
function validateBlock(input: Record<string, unknown>) {
  const fields: Record<string, string[]> = {};
  const barber = findBarber(text(input.barberId));
  const category = text(input.category) as MockBlockCategory;
  const repeat = (text(input.repeat) || "none") as MockBlockRepeat;
  const startDate = text(input.startDate);
  const endDate = text(input.endDate) || startDate;
  const startTime = text(input.startTime);
  const endTime = text(input.endTime);
  if (!barber) fields.barberId = ["Elige un barbero."];
  if (!BLOCK_CATEGORIES.includes(category)) fields.category = ["Elige una categoría."];
  if (!BLOCK_REPEATS.includes(repeat)) fields.repeat = ["Repetición inválida."];
  if (!DAY_KEY.test(startDate)) fields.startDate = ["Elige la fecha de inicio."];
  if (!DAY_KEY.test(endDate) || endDate < startDate) fields.endDate = ["La fecha fin no puede ser anterior al inicio."];
  if (!CLOCK.test(startTime)) fields.startTime = ["Elige la hora de inicio."];
  if (!CLOCK.test(endTime) || parseClock(endTime) <= parseClock(startTime)) fields.endTime = ["La hora de cierre debe ser posterior a la de inicio."];
  return { fields, values: { barber, category, repeat, startDate, endDate, startTime, endTime } };
}

function replaceAppointment(updated: MockAppointment) {
  db.calendar.appointments = db.calendar.appointments.map((item) => (item.id === updated.id ? updated : item));
  db.persist();
  return HttpResponse.json(updated);
}

function addDaysIso(day: string, spec: { days?: number; months?: number }, times: number): string {
  const date = new Date(`${day}T00:00:00`);
  if (spec.days) date.setDate(date.getDate() + spec.days * times);
  if (spec.months) date.setMonth(date.getMonth() + spec.months * times);
  return dateKey(date);
}

/** Minutos de jornada de un barbero un día, y minutos reservados ese día. */
function occupancyFor(barberIds: readonly string[], branchId: string, day: string) {
  const capacity = barberIds.reduce((sum, id) => {
    const member = db.team.members.find((item) => item.id === id);
    return sum + (member ? hoursOn(member, day) : []).reduce((total, range) => total + parseClock(range.end) - parseClock(range.start), 0);
  }, 0);
  const appointments = appointmentsOn(branchId, day).filter((item) => barberIds.includes(item.barberId) && item.status !== "cancelled" && item.status !== "no_show");
  const booked = appointments.reduce((sum, item) => sum + item.durationMin, 0);
  return { occupancy: capacity === 0 ? null : Math.min(1, booked / capacity), count: appointments.length };
}

function validateAppointmentInput(body: DefaultBodyType) {
  const input = asRecord(body);
  const fields: Record<string, string[]> = {};
  const clientId = text(input.clientId);
  const barberId = text(input.barberId);
  const start = text(input.start);
  const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.filter((id): id is string => typeof id === "string") : [];
  const repeat = (text(input.repeat) || "none") as MockRepeatRule;
  if (!db.calendar.clients.some((client) => client.id === clientId)) fields.clientId = ["Elige un cliente."];
  if (!findBarber(barberId)) fields.barberId = ["Elige un barbero."];
  if (serviceIds.length === 0 || !serviceIds.every((id) => catalogServices().some((service) => service.id === id))) fields.serviceIds = ["Elige al menos un servicio."];
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(start)) fields.start = ["Elige fecha y hora."];
  if (!REPEATS.includes(repeat)) fields.repeat = ["Repetición inválida."];
  return { fields, values: { clientId, barberId, start: start.slice(0, 16) + ":00", serviceIds, repeat, walkIn: input.walkIn === true, requestedBarberId: input.requestedBarberId === null ? null : text(input.requestedBarberId) || barberId, notes: text(input.notes) || null } };
}

/**
 * Lo que la agenda puede agendar sale del catálogo de servicios
 * (`mocks/services`): servicios y combos, con el nombre de su categoría. Para
 * validar una cita valen todos —una ya agendada conserva su servicio aunque
 * luego se desactive—; el catálogo que se ofrece solo trae los activos.
 */
const toAgenda = (item: MockCatalogService): MockService => ({ id: item.id, name: item.name, category: db.services.categories.find((category) => category.id === item.categoryId)?.name ?? "", durationMin: item.durationMin, price: item.price, imageUrl: item.imageUrl });
export const catalogServices = (): MockService[] => db.services.items.map(toAgenda);

/* Lo mismo con los productos (`mocks/products`): para cobrar vale cualquiera
   que exista; el catálogo que se ofrece solo trae los activos y vendibles. */
const toSale = (item: MockCatalogProduct): MockProduct => ({ id: item.id, name: item.name, category: db.products.categories.find((category) => category.id === item.categoryId)?.name ?? "", price: item.price, imageUrl: item.imageUrl });
const catalogProducts = (): MockProduct[] => db.products.items.map(toSale);
// El catálogo de una sucursal lleva la tasa con la que se cobra ahí: la del artículo o la de la sucursal.
const sellableIn = (branchId: string): MockProduct[] => db.products.items.filter((item) => item.sellable && item.activeBranchIds.includes(branchId)).map((item) => ({ ...toSale(item), price: productPriceIn(item.id, branchId), taxPercent: itemTaxPercent(item.taxRate, branchId) }));
const bookableIn = (branchId: string): MockService[] => db.services.items.filter((item) => item.activeBranchIds.includes(branchId)).map((item) => ({ ...toAgenda(item), price: servicePriceIn(item.id, branchId), taxPercent: itemTaxPercent(item.taxRate, branchId) }));

/** Un barbero escribe en la ficha de sus clientes; los demás roles, en cualquiera. */
const CONDUCT_REASONS = ["rude", "disrespect", "intoxicated", "haggles", "hygiene", "other"] as const;

function canTouchClient(request: Request, clientId: string): boolean {
  const own = barberOf(request);
  return !own || ownClientIds(own).has(clientId);
}

/**
 * Quién bloquea la agenda: dueño, administrador y recepción, a cualquiera; el barbero de renta, la suya;
 * el de comisión no bloquea (pide una ausencia en Equipo). `null` si puede.
 */
function blockDenied(request: Request, barberId: string): Response | null {
  const session = sessionOf(request);
  if (session?.teamRole === "barbero-comision") return forbidden("Pide la ausencia en Equipo › Ausencias: el bloqueo lo pone la barbería.");
  if (session?.teamRole === "barbero-renta" && barberId !== session.memberId) return forbidden("Solo bloqueas tu agenda.");
  return null;
}

/** Lo que la ficha del cliente restringe (bloqueado, solo pago en línea), para que la agenda lo muestre y lo cambie. */
function withRestrictions<T extends { id: string }>(client: T & Parameters<typeof deriveProfile>[0]) {
  if (client.id === WALK_IN_CLIENT.id) return client;
  const profile = db.customers.profiles[client.id] ?? deriveProfile(client);
  return { ...client, blocked: profile.blocked, onlineOnly: profile.onlineOnly };
}

/** Un cobro listo para aplicarse: todo validado, nada tocado todavía. */
interface CheckoutPlan {
  commit: () => MockAppointment;
}

/**
 * Valida el cobro de una cita sin tocar nada (`Response` con el error si algo no cuadra) y devuelve cómo aplicarlo. Así
 * una visita de varias citas se cobra entera o no se cobra (`/visits/checkout`).
 */
function planCheckout(request: Request, account: NonNullable<ReturnType<typeof requireAuth>>, existing: MockAppointment, input: Record<string, unknown>): Response | CheckoutPlan {
  const own = barberOf(request);
  if (own && existing.barberId !== own) return forbidden("Solo cobras tus citas.");
  if (existing.status === "paid") return error(409, "conflict", "Esta cita ya está cobrada.");
  if (existing.status === "cancelled" || existing.status === "no_show") return error(409, "conflict", "Una cita cancelada o a la que no asistió no se cobra.");
  const method = text(input.method) as MockPaymentMethod;
  if (!METHODS.includes(method)) return error(422, "validation", "Elige cómo paga el cliente.", { fields: { method: ["Elige un método de pago."] } });
  const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.filter((id): id is string => typeof id === "string" && catalogServices().some((service) => service.id === id)) : existing.serviceIds;
  if (serviceIds.length === 0) return error(422, "validation", "Una cuenta necesita al menos un servicio.", { fields: { serviceIds: ["Añade un servicio."] } });
  const products = Array.isArray(input.products)
    ? input.products
        .map((item) => asRecord(item as DefaultBodyType))
        .filter((item) => typeof item.productId === "string" && catalogProducts().some((product) => product.id === item.productId))
        .map((item) => ({ productId: item.productId as string, qty: Math.max(1, Number(item.qty) || 1) }))
    : existing.products;
  const tip = Math.max(0, Number(input.tip) || 0);
  const surcharge = method === "card" || method === "mixed" ? Math.max(0, Number(input.surcharge) || 0) : 0;
  // Los precios cambiados en la caja: el barbero de comisión cobra a precio de lista.
  const priceInput = { servicePrices: input.servicePrices, productPrices: input.productPrices };
  const changesPrices = Array.isArray(priceInput.servicePrices) || (typeof priceInput.productPrices === "object" && priceInput.productPrices !== null);
  if (changesPrices && sessionOf(request)?.teamRole === "barbero-comision") return forbidden("El precio lo cambia la barbería.");
  const servicePrices = Array.isArray(priceInput.servicePrices) ? serviceIds.map((_, index) => { const value = (priceInput.servicePrices as unknown[])[index]; return typeof value === "number" && value >= 0 ? round2(value) : null; }) : undefined;
  const productPrices = typeof priceInput.productPrices === "object" && priceInput.productPrices !== null ? Object.fromEntries(Object.entries(priceInput.productPrices as Record<string, unknown>).filter(([id, value]) => products.some((line) => line.productId === id) && typeof value === "number" && value >= 0).map(([id, value]) => [id, round2(value as number)])) : undefined;
  // El descuento de la caja va sobre lo que vale la cuenta (después del descuento en línea, antes de impuestos).
  const listBill = appointmentAccount(existing, serviceIds, products, { servicePrices, productPrices });
  // Un cupón de la barbería (Configuración › Cupones) reemplaza al descuento a mano: se valida con sus reglas y topes.
  const couponCode = text(input.coupon);
  const client = db.calendar.clients.find((item) => item.id === existing.clientId);
  const coupon = couponCode ? checkCoupon(couponCode, { clientId: existing.clientId, isNewClient: (client?.visits ?? 0) === 0, appointments: 1, serviceIds, branchId: existing.branchId }) : null;
  if (coupon && "problem" in coupon) return error(422, "promo_invalid", COUPON_PROBLEMS[coupon.problem], { fields: { coupon: [COUPON_PROBLEMS[coupon.problem]] }, details: { problem: coupon.problem } });
  const discountBase = round2(listBill.subtotal - listBill.discount);
  const discount = coupon && "promo" in coupon ? { amount: promoDiscount(coupon.promo, discountBase), reason: `Cupón ${coupon.promo.code}` } : discountOf(input.discount, discountBase);
  if (typeof discount === "string") return error(422, "validation", discount, { fields: { discount: [discount] } });
  const extras = parseExtras(input, method);
  if (typeof extras === "string") return error(422, "validation", extras);
  // Lo pagado en la reserva en línea ya está cobrado: aquí entra solo lo que falta, con el impuesto de la sucursal.
  const priced = { ...existing, ...(discount.amount > 0 ? { checkoutDiscount: discount.amount } : {}) };
  const bill = appointmentAccount(priced, serviceIds, products, { servicePrices, productPrices });
  const paidAt = new Date().toISOString();
  // Lo que entra ahora: el saldo, la propina, el recargo y la tarjeta de regalo que se vende; menos lo que paga con la suya.
  const giftUsed = extras.gift ? Math.min(extras.gift.amount, round2(bill.due + tip + (extras.giftSale?.amount ?? 0))) : 0;
  const dueNow = round2(bill.due + tip + surcharge + (extras.giftSale?.amount ?? 0) - giftUsed);
  // Mixto (efectivo + tarjeta) o dividido en partes: tiene que cuadrar con lo que se cobra.
  const splitInput = asRecord(input.split as DefaultBodyType);
  const split = extras.parts ? splitOfParts(extras.parts) : method === "mixed" ? { cash: round2(Math.max(0, Number(splitInput.cash) || 0)), card: round2(Math.max(0, Number(splitInput.card) || 0)) } : undefined;
  if (extras.parts && Math.abs(extras.parts.reduce((sum, part) => sum + part.amount, 0) - dueNow) > 0.01) return error(422, "validation", "Las partes tienen que sumar lo que se cobra.", { fields: { parts: ["Las partes tienen que sumar lo que se cobra."] } });
  if (!extras.parts && split && Math.abs(split.cash + split.card - dueNow) > 0.01) return error(422, "validation", "El efectivo y la tarjeta tienen que sumar lo que se cobra.", { fields: { split: ["El efectivo y la tarjeta tienen que sumar lo que se cobra."] } });
  return {
    commit: () => {
      // Ya cuadra: se descuenta la tarjeta de regalo del cliente y se crea la que se vende.
      if (extras.gift && giftUsed > 0) spendGiftCard(extras.gift.code, giftUsed);
      const sold = extras.giftSale ? createGiftCard({ initial: extras.giftSale.amount, buyerId: existing.clientId, recipientName: extras.giftSale.recipientName, recipientContact: extras.giftSale.recipientContact, message: "" }) : null;
      const payment = {
        method,
        tip: round2(bill.prepaidTip + tip),
        tax: bill.tax,
        total: round2(bill.total + bill.prepaidTip + tip + surcharge),
        prepaid: round2(bill.prepaid + bill.prepaidTip),
        paidAt,
        ...(split ? { split } : {}),
        ...(discount.amount > 0 ? { discount: discount.amount, discountReason: discount.reason } : {}),
        ...(extras.gift && giftUsed > 0 ? { gift: { code: extras.gift.code, amount: giftUsed } } : {}),
        ...(sold ? { giftSale: { code: sold.code, amount: sold.initial } } : {}),
        ...(extras.parts ? { parts: extras.parts } : {}),
        ...(extras.deviceId ? { deviceId: extras.deviceId } : {}),
        ...(extras.transfer ? { transfer: extras.transfer } : {}),
        // El recargo va como línea propia: el total cuadra con el datáfono y se ve qué fue recargo.
        ...(surcharge > 0 ? { surcharge: round2(surcharge), surchargeName: (db.settings.sections.cardFee as { name?: string } | undefined)?.name || "Recargo por tarjeta" } : {}),
        ...(coupon && "promo" in coupon ? { coupon: coupon.promo.code } : {}),
      };
      if (coupon && "promo" in coupon) redeemCoupon(coupon.promo.code, existing.clientId, "checkout", existing.id);
      // La primera visita cobrada de un cliente referido premia a los dos; y salen solos las gracias y la reseña
      // si están encendidos (Configuración › Marketing).
      rewardReferral(existing.clientId);
      onVisitPaid(existing);
      db.persist();
      // Lo vendido sale del inventario de la sucursal (si se reservó en línea, solo la diferencia con lo apartado).
      return syncAppointmentStock(
        {
          ...priced,
          serviceIds,
          products,
          ...(servicePrices ? { servicePrices } : {}),
          ...(productPrices ? { productPrices } : {}),
          status: "paid",
          payment,
          history: [...existing.history, entry(account.user.name, `paid:${method}`)],
        },
        "sale",
        account.user.name
      );
    },
  };
}

export const calendarHandlers = [
  http.get(`${BASE}/calendar/catalog`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const branchId = new URL(request.url).searchParams.get("branchId") ?? "ma";
    // Un barbero recibe su columna y la ficha de sus clientes; de los demás, solo el nombre.
    const own = barberOf(request);
    const mine = own ? ownClientIds(own) : null;
    return HttpResponse.json({
      barbers: own ? barbersIn(branchId).filter((barber) => barber.id === own) : barbersIn(branchId),
      clients: mine ? db.calendar.clients.map((client) => (mine.has(client.id) || client.id === WALK_IN_CLIENT.id ? withRestrictions(client) : redactClient(client))) : db.calendar.clients.map(withRestrictions),
      services: bookableIn(branchId),
      products: sellableIn(branchId),
      taxInclusive: taxInclusive(),
    });
  }),

  http.get(`${BASE}/calendar/day`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const url = new URL(request.url);
    const day = url.searchParams.get("date") ?? "";
    const branchId = url.searchParams.get("branchId") ?? "ma";
    if (!DAY_KEY.test(day)) return error(422, "validation", "La fecha debe ser AAAA-MM-DD.", { fields: { date: ["Fecha inválida."] } });
    // Un barbero recibe su columna: sus citas, sus bloqueos y su horario.
    const own = barberOf(request);
    const hours = Object.fromEntries(barbersIn(branchId).filter((barber) => !own || barber.id === own).map((barber) => [barber.id, hoursOn(db.team.members.find((member) => member.id === barber.id)!, day, branchId)]));
    // Cada cita por atender lleva su riesgo de no venir (ver risk.ts).
    const now = new Date();
    return HttpResponse.json({ date: day, appointments: ownAppointments(appointmentsOn(branchId, day), own).map((item) => withRisk(item, now)), blocks: ownBlocks(blocksOn(branchId, day), own), hours });
  }),

  http.get(`${BASE}/calendar/appointments`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const branchId = url.searchParams.get("branchId") ?? "ma";
    if (!DAY_KEY.test(from) || !DAY_KEY.test(to)) return error(422, "validation", "Las fechas deben ser AAAA-MM-DD.", { fields: { from: ["Fecha inválida."], to: ["Fecha inválida."] } });
    const start = new Date(`${from}T00:00:00`);
    const days = Math.round((new Date(`${to}T00:00:00`).getTime() - start.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > MAX_RANGE_DAYS) return error(422, "validation", `El rango va de 1 a ${MAX_RANGE_DAYS} días.`, { fields: { to: ["Rango inválido."] } });
    const items = Array.from({ length: days }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      return peekAppointmentsOn(branchId, `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
    }).flat();
    return HttpResponse.json({ from, to, items: ownAppointments(items, barberOf(request)) });
  }),

  http.get(`${BASE}/calendar/rhythm`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const branchId = new URL(request.url).searchParams.get("branchId") ?? "ma";
    // Un barbero ve el ritmo de su columna: lo suyo es lo que le dice si el día viene pesado.
    return HttpResponse.json(rhythmOf(branchId, barberOf(request)));
  }),

  http.get(`${BASE}/calendar/month`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? "";
    const branchId = url.searchParams.get("branchId") ?? "ma";
    const barberId = url.searchParams.get("barberId");
    if (!MONTH_KEY.test(month)) return error(422, "validation", "El mes debe ser AAAA-MM.", { fields: { month: ["Mes inválido."] } });
    // Un barbero ve la ocupación de su columna, pida la que pida.
    const own = barberOf(request);
    const barberIds = own ? [own] : barberId ? [barberId] : barbersIn(branchId).map((barber) => barber.id);
    const [year, monthIndex] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthIndex, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = `${month}-${String(index + 1).padStart(2, "0")}`;
      return { date: day, ...occupancyFor(barberIds, branchId, day) };
    });
    return HttpResponse.json({ month, days });
  }),

  http.post(`${BASE}/appointments`, async ({ request }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const rawBody = (await request.json().catch(() => ({}))) as DefaultBodyType;
    const { fields, values } = validateAppointmentInput(rawBody);
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    // Un barbero agenda en su columna y con las reglas de la casa: nunca fuerza.
    const own = barberOf(request);
    if (own && values.barberId !== own) return forbidden("Solo agendas en tu columna.");
    const barberMember = findBarber(values.barberId)!;
    const body = asRecord(rawBody);
    // La cita va a la sede donde se crea (la de la cabecera), si el barbero trabaja en ella; si no, a la suya.
    const requestedBranch = text(body.branchId);
    const branchId = requestedBranch && barberMember.branchIds.includes(requestedBranch) ? requestedBranch : (barberMember.branchIds[0] ?? "ma");
    const barber = { id: barberMember.id, branchId, name: memberName(barberMember) };
    const durationMin = values.serviceIds.reduce((sum, id) => sum + (catalogServices().find((service) => service.id === id)?.durationMin ?? 0), 0);
    const day = values.start.slice(0, 10);
    const time = values.start.slice(11, 16);
    appointmentsOn(barber.branchId, day);
    // Un cliente sin cita que se registra hoy ya está en el local: nace «llegó», no «agendada».
    const arrivedNow = values.walkIn && values.repeat === "none" && day === branchNow(branchId).slice(0, 10);
    const clash = body.force === true && !own ? null : (clashMessage(barber.branchId, values.barberId, day, parseClock(time), durationMin) ?? resourceMessage(barber.branchId, { id: "", serviceIds: values.serviceIds, barberId: values.barberId, durationMin, start: values.start, status: "scheduled" }));
    if (clash) return error(409, "conflict", clash, { fields: { start: [clash] } });
    const seriesId = values.repeat === "none" ? null : `ser_${Date.now().toString(36)}`;
    const occurrences = values.repeat === "none" ? 1 : SERIES_LENGTH;
    const created: MockAppointment[] = [];
    for (let index = 0; index < occurrences; index += 1) {
      const occurrenceDay = index === 0 ? day : addDaysIso(day, REPEAT_DAYS[values.repeat as Exclude<MockRepeatRule, "none">], index);
      appointmentsOn(barber.branchId, occurrenceDay);
      const id = `apt_${Date.now().toString(36)}_${index}`;
      created.push({
        id,
        branchId: barber.branchId,
        clientId: values.clientId,
        barberId: values.barberId,
        requestedBarberId: values.requestedBarberId,
        serviceIds: values.serviceIds,
        products: [],
        start: localIso(occurrenceDay, time),
        durationMin,
        status: arrivedNow ? "arrived" : "scheduled",
        barberReady: false,
        walkIn: values.walkIn,
        source: values.walkIn ? "walkin" : "internal",
        repeat: values.repeat,
        seriesId,
        notes: values.notes,
        createdAt: new Date().toISOString(),
        createdBy: actorOf(account.user.name, body),
        history: arrivedNow ? [entry(actorOf(account.user.name, body), "walkin"), entry(actorOf(account.user.name, body), "status:arrived")] : [entry(actorOf(account.user.name, body), values.walkIn ? "walkin" : "created")],
        payment: null,
        confirmToken: newConfirmToken(),
      });
    }
    db.calendar.appointments = [...created, ...db.calendar.appointments];
    // Como la reserva en línea: confirmación y recordatorios por WhatsApp. Un cliente sin cita (ya está aquí) no los necesita.
    const phone = db.calendar.clients.find((client) => client.id === values.clientId)?.phone;
    if (!values.walkIn && phone) for (const appointment of created) scheduleMessages(appointment, phone);
    db.persist();
    return HttpResponse.json(created[0], { status: 201 });
  }),

  http.patch(`${BASE}/appointments/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const existing = findAppointment(params.id);
    if (!existing) return error(404, "not_found", "Esa cita no existe.");
    // Un barbero cambia sus citas, sin pasarlas a otro barbero y sin forzar.
    const own = barberOf(request);
    const body = asRecord(await request.json().catch(() => ({})));
    const input: Record<string, unknown> = own ? { ...body, force: false } : body;
    if (own && existing.barberId !== own) return forbidden("Esa cita no es tuya.");
    if (own && typeof input.barberId === "string" && input.barberId !== own) return forbidden("No pasas la cita a otro barbero.");
    const actor = actorOf(account.user.name, input);
    const fields: Record<string, string[]> = {};
    const history = [...existing.history];
    let next: MockAppointment = { ...existing };

    if (typeof input.status === "string") {
      if (!STATUSES.includes(input.status as MockAppointmentStatus)) fields.status = ["Estado inválido."];
      else if (existing.status === "paid" && input.status !== "paid") fields.status = ["Una cita cobrada no cambia de estado."];
      // «Cobrada» solo la pone el cobro (`/checkout`), que guarda cuánto, cómo y quién: aquí quedaría sin pago.
      else if (input.status === "paid" && existing.status !== "paid") fields.status = ["Para cobrarla, usa el cobro."];
      else {
        next = { ...next, status: input.status as MockAppointmentStatus };
        history.push(entry(actor, `status:${input.status}`));
      }
    }
    if (typeof input.barberReady === "boolean") {
      next = { ...next, barberReady: input.barberReady };
      if (input.barberReady) history.push(entry(actor, "barber_ready"));
    }
    if (typeof input.start === "string") {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(input.start)) fields.start = ["Fecha inválida."];
      else {
        next = { ...next, start: input.start.slice(0, 16) + ":00" };
        history.push(entry(actor, `moved:${input.start.slice(0, 16)}`));
      }
    }
    if (typeof input.barberId === "string" && input.barberId !== existing.barberId) {
      const barber = findBarber(input.barberId);
      if (!barber) fields.barberId = ["Ese barbero no existe."];
      else {
        next = { ...next, barberId: barber.id };
        history.push(entry(actor, `barber:${memberName(barber)}`));
      }
    }
    // Cambiar de cliente hasta cobrar (el barbero de comisión, solo mientras no ha llegado: lo cuida la agenda).
    if (typeof input.clientId === "string" && input.clientId !== existing.clientId) {
      const client = db.calendar.clients.find((item) => item.id === input.clientId);
      if (!client || client.type === "walkin") fields.clientId = ["Ese cliente no existe."];
      else if (existing.status === "paid" || existing.status === "cancelled" || existing.status === "no_show") fields.clientId = ["Esta cita ya se cerró: su cliente no cambia."];
      else {
        next = { ...next, clientId: client.id, confirmation: null };
        history.push(entry(actor, `client:${client.name}`));
      }
    }
    if (typeof input.durationMin === "number") {
      if (input.durationMin < 15 || input.durationMin > 480) fields.durationMin = ["La duración va de 15 minutos a 8 horas."];
      else {
        next = { ...next, durationMin: input.durationMin };
        history.push(entry(actor, `duration:${input.durationMin}`));
      }
    }
    if (Array.isArray(input.serviceIds)) {
      const serviceIds = input.serviceIds.filter((id): id is string => typeof id === "string" && catalogServices().some((service) => service.id === id));
      if (serviceIds.length === 0) fields.serviceIds = ["Elige al menos un servicio."];
      else next = { ...next, serviceIds, durationMin: serviceIds.reduce((sum, id) => sum + (catalogServices().find((service) => service.id === id)?.durationMin ?? 0), 0) };
    }
    if (input.notes !== undefined) next = { ...next, notes: text(input.notes) || null };
    // Las fotos del corte que se suman desde la agenda: las mismas reglas que en la reserva en línea.
    if (input.referencePhotos !== undefined) {
      const photos = (Array.isArray(input.referencePhotos) ? input.referencePhotos : []).map((photo) => text(photo)).filter(Boolean);
      const badPhoto = photos.length > MAX_REFERENCE_PHOTOS || photos.some((photo) => !(isSeedPhoto(photo) || (PHOTO_PATTERN.test(photo) && photo.length <= MAX_PHOTO_CHARS)));
      if (badPhoto) fields.referencePhotos = ["La foto no se pudo subir. Prueba con otra."];
      else next = { ...next, referencePhotos: photos };
    }
    if (input.linkId !== undefined) {
      const linkId = typeof input.linkId === "string" && input.linkId.trim() !== "" ? input.linkId.trim() : null;
      if ((existing.linkId ?? null) !== linkId) {
        next = { ...next, linkId };
        history.push(entry(actor, linkId ? "linked" : "unlinked"));
      }
    }
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    // Si cambió de sitio, de barbero o de duración, no puede pisar a nadie.
    const moved = next.start !== existing.start || next.barberId !== existing.barberId || next.durationMin !== existing.durationMin;
    // Devolverle la vida a una cita cancelada tampoco puede pisar a quien tomó el hueco.
    const revived = (existing.status === "cancelled" || existing.status === "no_show") && next.status === "scheduled";
    if ((moved || revived) && input.force !== true && next.status !== "cancelled" && next.status !== "no_show") {
      const clash = clashMessage(existing.branchId, next.barberId, next.start.slice(0, 10), parseClock(next.start.slice(11, 16)), next.durationMin, existing.id) ?? resourceMessage(existing.branchId, next);
      if (clash) return error(409, "conflict", clash, { fields: { start: [clash] } });
    }
    // Recepción marca la confirmación (por teléfono, en persona) o la deja sin confirmar.
    if (input.confirmation === "confirmed" || input.confirmation === "pending") {
      next = { ...next, confirmation: input.confirmation === "confirmed" ? { status: "confirmed", at: new Date().toISOString(), via: "reception" } : null };
      history.push(entry(actor, input.confirmation === "confirmed" ? "confirmed" : "unconfirmed"));
    }
    const reason = text(input.reason);
    if (reason) history.push(entry(actor, `reason:${reason}`));
    // Los mensajes siguen a la cita: moverla los reprograma; cancelarla los anula y ofrece el hueco a la lista de espera.
    const phone = db.calendar.clients.find((client) => client.id === next.clientId)?.phone;
    const otherClient = next.clientId !== existing.clientId;
    // Otro cliente: los avisos del anterior se anulan y se le programan al nuevo.
    if (otherClient) cancelMessages(existing.id);
    if ((next.status === "cancelled" || next.status === "no_show") && existing.status !== next.status) {
      cancelMessages(existing.id);
      if (next.status === "cancelled") offerFreedSlot(existing);
      // Lo que tenía apartado del inventario vuelve a la estantería.
      next = releaseAppointmentStock(next, actor);
    } else if ((next.start !== existing.start || revived || otherClient) && next.status === "scheduled" && phone) rescheduleMessages({ ...next, confirmToken: next.confirmToken ?? newConfirmToken() }, phone);
    return replaceAppointment({ ...next, confirmToken: next.confirmToken ?? newConfirmToken(), history });
  }),

  http.post(`${BASE}/appointments/:id/checkout`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const existing = findAppointment(params.id);
    if (!existing) return error(404, "not_found", "Esa cita no existe.");
    const plan = planCheckout(request, account, existing, asRecord(await request.json().catch(() => ({}))));
    if (plan instanceof Response) return plan;
    return replaceAppointment(plan.commit());
  }),

  // Cobrar una visita de varias citas de una vez: se valida todo antes de tocar nada; si una falla, ninguna se cobra.
  http.post(`${BASE}/visits/checkout`, async ({ request }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const items = asRecord(await request.json().catch(() => ({}))).items;
    if (!Array.isArray(items) || items.length === 0 || items.length > 10) return error(422, "validation", "Di qué citas se cobran.");
    const plans: CheckoutPlan[] = [];
    for (const [index, raw] of items.entries()) {
      const item = asRecord(raw as DefaultBodyType);
      const existing = findAppointment(text(item.id));
      if (!existing) return error(404, "not_found", "Una de las citas no existe.", { details: { index } });
      const plan = planCheckout(request, account, existing, asRecord(item.input as DefaultBodyType));
      if (plan instanceof Response) {
        const body = (await plan.clone().json().catch(() => ({}))) as Record<string, unknown>;
        return HttpResponse.json({ ...body, details: { ...asRecord(body.details as DefaultBodyType), index, appointmentId: existing.id } }, { status: plan.status });
      }
      plans.push(plan);
    }
    const paid = plans.map((plan) => plan.commit());
    db.calendar.appointments = db.calendar.appointments.map((item) => paid.find((entry) => entry.id === item.id) ?? item);
    db.persist();
    return HttpResponse.json({ items: paid });
  }),

  // Devolver una cuenta cobrada, entera o en parte, a efectivo o a la tarjeta.
  http.post(`${BASE}/appointments/:id/refund`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const existing = findAppointment(params.id);
    if (!existing) return error(404, "not_found", "Esa cita no existe.");
    // Devolver dinero es de la caja (recepción, administrador, dueño), no del barbero.
    if (barberOf(request)) return forbidden("Las devoluciones las hace la caja.");
    if (existing.status !== "paid" || !existing.payment) return error(409, "conflict", "Solo se devuelve una cuenta cobrada.");
    const input = asRecord(await request.json().catch(() => ({})));
    const amount = round2(Number(input.amount));
    const reason = text(input.reason);
    const to = text(input.to);
    // Lo que se puede devolver: lo que vale la cuenta más la propina, menos lo ya devuelto (igual que en Transacciones).
    const bill = appointmentAccount(existing);
    const refundable = round2(bill.total + existing.payment.tip - bill.refunded);
    const fields: Record<string, string[]> = {};
    if (!Number.isFinite(amount) || amount <= 0) fields.amount = ["Escribe cuánto se devuelve."];
    else if (amount > refundable) fields.amount = [`Se puede devolver hasta ${refundable}.`];
    if (reason.length < 3) fields.reason = ["Di por qué se devuelve."];
    if (to !== "cash" && to !== "card") fields.to = ["Elige a dónde vuelve el dinero."];
    // Las líneas que se devuelven: un producto no puede volver más veces de las que se vendió.
    const items = (Array.isArray(input.items) ? input.items : [])
      .map((item) => asRecord(item as DefaultBodyType))
      .filter((item) => (item.kind === "service" || item.kind === "product" || item.kind === "tip") && typeof item.id === "string")
      .map((item) => ({ kind: item.kind as "service" | "product" | "tip", id: item.id as string, qty: Math.max(1, Math.round(Number(item.qty) || 1)), amount: round2(Number(item.amount) || 0) }));
    const returnedBefore = (productId: string) => (existing.refunds ?? []).flatMap((item) => item.items ?? []).filter((item) => item.kind === "product" && item.id === productId).reduce((sum, item) => sum + item.qty, 0);
    for (const item of items.filter((line) => line.kind === "product")) {
      const sold = existing.products.find((line) => line.productId === item.id)?.qty ?? 0;
      if (item.qty > sold - returnedBefore(item.id)) fields.items = ["Ese producto ya se devolvió."];
    }
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    // Los productos devueltos vuelven a la estantería de la sucursal.
    for (const item of items.filter((line) => line.kind === "product")) moveStock({ branchId: existing.branchId, productId: item.id, delta: item.qty, reason: "return", ref: existing.id, by: account.user.name });
    const refund = { id: `rf_${Date.now().toString(36)}`, amount, to: to as "cash" | "card", reason, at: new Date().toISOString(), by: account.user.name, ...(items.length > 0 ? { items } : {}) };
    return replaceAppointment({ ...existing, refunds: [...(existing.refunds ?? []), refund], history: [...existing.history, entry(account.user.name, `refund:${amount}`)] });
  }),

  /**
   * Borrar la venta (se cobró por error): la cita vuelve a «en silla» sin pago, para cobrarla bien. Lo
   * vendido vuelve al inventario, la tarjeta de regalo usada recupera su saldo y la que se vendió queda
   * sin saldo. Solo dueño y administrador, y sin devoluciones de por medio.
   */
  http.post(`${BASE}/appointments/:id/void-payment`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const existing = findAppointment(params.id);
    if (!existing) return error(404, "not_found", "Esa cita no existe.");
    const role = sessionOf(request)?.teamRole;
    if (role && role !== "owner" && role !== "admin") return forbidden("Borrar una venta es del dueño o del administrador.");
    if (existing.status !== "paid" || !existing.payment) return error(409, "conflict", "Solo se borra una venta cobrada.");
    if ((existing.refunds ?? []).length > 0) return error(409, "conflict", "Esta venta tiene devoluciones: deshazla desde Transacciones.");
    const reason = text(asRecord(await request.json().catch(() => ({}))).reason);
    if (reason.length < 3) return error(422, "validation", "Di por qué se borra la venta.", { fields: { reason: ["Di por qué se borra la venta."] } });
    const payment = existing.payment;
    // El libro de pagos no borra: guarda lo cobrado y suma el contramovimiento (ver transactions/ledger).
    const voided = { id: `void_${Date.now().toString(36)}`, at: new Date().toISOString(), by: account.user.name, reason, entries: paymentEntriesOf(existing).map(({ kind, method, amount, at, by }) => ({ kind: kind as "charge" | "tip", method, amount, at, by })) };
    if (payment.gift) spendGiftCard(payment.gift.code, -payment.gift.amount);
    if (payment.giftSale) spendGiftCard(payment.giftSale.code, payment.giftSale.amount);
    const released = releaseAppointmentStock(existing, account.user.name);
    return replaceAppointment({ ...released, status: "seated", payment: null, checkoutDiscount: undefined, servicePrices: undefined, productPrices: undefined, stockTaken: [], voidedPayments: [...(existing.voidedPayments ?? []), voided], history: [...existing.history, entry(account.user.name, `voided:${reason}`)] });
  }),

  // Alergias y medicamentos son datos sensibles: sin el permiso aparte del cliente no se guardan (409).
  http.post(`${BASE}/clients/:id/notes`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = db.calendar.clients.find((item) => item.id === params.id);
    if (!client || client.id === WALK_IN_CLIENT.id) return error(404, "not_found", "Ese cliente no existe.");
    if (!canTouchClient(request, client.id)) return forbidden("Ese cliente no es tuyo.");
    const input = asRecord(await request.json().catch(() => ({})));
    const kind = text(input.kind) as MockClientNote["kind"];
    const body = text(input.text);
    const fields: Record<string, string[]> = {};
    if (!["note", "medication", "allergy"].includes(kind)) fields.kind = ["Elige el tipo de nota."];
    if (body.length < 3) fields.text = ["Escribe la nota."];
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    if (kind !== "note" && !hasHealthConsent(client)) return healthConsentRequired();
    const note: MockClientNote = { id: `note_${Date.now().toString(36)}`, kind, text: body, createdAt: new Date().toISOString() };
    const updated = { ...client, notes: [note, ...client.notes] };
    db.calendar.clients = db.calendar.clients.map((item) => (item.id === updated.id ? updated : item));
    db.persist();
    return HttpResponse.json(updated, { status: 201 });
  }),

  // Corregir una nota: cambia su texto o su tipo; conserva la fecha en que se escribió.
  http.patch(`${BASE}/clients/:id/notes/:noteId`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = db.calendar.clients.find((item) => item.id === params.id);
    const current = client?.notes.find((note) => note.id === params.noteId);
    if (!client || !current) return error(404, "not_found", "Esa nota no existe.");
    if (!canTouchClient(request, client.id)) return forbidden("Ese cliente no es tuyo.");
    const input = asRecord(await request.json().catch(() => ({})));
    const kind = (input.kind === undefined ? current.kind : text(input.kind)) as MockClientNote["kind"];
    const body = input.text === undefined ? current.text : text(input.text);
    const fields: Record<string, string[]> = {};
    if (!["note", "medication", "allergy"].includes(kind)) fields.kind = ["Elige el tipo de nota."];
    if (body.length < 3) fields.text = ["Escribe la nota."];
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    if (kind !== "note" && !hasHealthConsent(client)) return healthConsentRequired();
    const updated = { ...client, notes: client.notes.map((note) => (note.id === current.id ? { ...note, kind, text: body } : note)) };
    db.calendar.clients = db.calendar.clients.map((item) => (item.id === updated.id ? updated : item));
    db.persist();
    return HttpResponse.json(updated);
  }),

  // La actitud del cliente: uno o más motivos y, si hace falta, lo que pasó. Lo reporta quien lo atendió o la barbería.
  http.post(`${BASE}/clients/:id/conduct`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = db.calendar.clients.find((item) => item.id === params.id);
    if (!client || client.id === WALK_IN_CLIENT.id) return error(404, "not_found", "Ese cliente no existe.");
    if (!canTouchClient(request, client.id)) return forbidden("Ese cliente no es tuyo.");
    const input = asRecord(await request.json().catch(() => ({})));
    const reasons = (Array.isArray(input.reasons) ? input.reasons : []).filter((reason): reason is MockConductReason => typeof reason === "string" && (CONDUCT_REASONS as readonly string[]).includes(reason));
    const body = text(input.text);
    const fields: Record<string, string[]> = {};
    if (reasons.length === 0) fields.reasons = ["Elige al menos un motivo."];
    if (reasons.includes("other") && body.length < 3) fields.text = ["Cuenta qué pasó."];
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    const appointmentId = text(input.appointmentId) || null;
    const report: MockConductReport = { id: `conduct_${Date.now().toString(36)}`, reasons: [...new Set(reasons)], text: body, appointmentId, by: account.user.name, createdAt: new Date().toISOString() };
    const updated = { ...client, conduct: [report, ...(client.conduct ?? [])] };
    db.calendar.clients = db.calendar.clients.map((item) => (item.id === updated.id ? updated : item));
    db.persist();
    return HttpResponse.json(updated, { status: 201 });
  }),

  http.delete(`${BASE}/clients/:id/conduct/:reportId`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = db.calendar.clients.find((item) => item.id === params.id);
    if (!client || !(client.conduct ?? []).some((report) => report.id === params.reportId)) return error(404, "not_found", "Ese reporte no existe.");
    if (!canTouchClient(request, client.id)) return forbidden("Ese cliente no es tuyo.");
    const updated = { ...client, conduct: (client.conduct ?? []).filter((report) => report.id !== params.reportId) };
    db.calendar.clients = db.calendar.clients.map((item) => (item.id === updated.id ? updated : item));
    db.persist();
    return HttpResponse.json(updated);
  }),

  http.delete(`${BASE}/clients/:id/notes/:noteId`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = db.calendar.clients.find((item) => item.id === params.id);
    if (!client || !client.notes.some((note) => note.id === params.noteId)) return error(404, "not_found", "Esa nota no existe.");
    if (!canTouchClient(request, client.id)) return forbidden("Ese cliente no es tuyo.");
    const updated = { ...client, notes: client.notes.filter((note) => note.id !== params.noteId) };
    db.calendar.clients = db.calendar.clients.map((item) => (item.id === updated.id ? updated : item));
    db.persist();
    return HttpResponse.json(updated);
  }),

  http.post(`${BASE}/blocks`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const input = asRecord(await request.json().catch(() => ({})));
    const denied = blockDenied(request, text(input.barberId));
    if (denied) return denied;
    const { fields, values } = validateBlock(input);
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    const { barber, category, repeat, startDate, endDate, startTime, endTime } = values;
    // Con la aprobación encendida, el bloqueo que pone un barbero espera a que lo aprueben.
    const needsApproval = (db.settings.sections.booking as { blocksNeedApproval?: boolean }).blocksNeedApproval === true && Boolean(barberOf(request));
    const block: MockTimeBlock = {
      id: `blk_${Date.now().toString(36)}`,
      branchId: barber!.branchIds[0] ?? "ma",
      barberId: barber!.id,
      category,
      repeat,
      startDate,
      endDate,
      startTime,
      endTime,
      description: text(input.description) || null,
      ...(needsApproval ? { status: "pending" as const, requestedBy: sessionOf(request)?.account.user.name ?? "" } : {}),
    };
    db.calendar.blocks = [...db.calendar.blocks, block];
    db.persist();
    return HttpResponse.json(block, { status: 201 });
  }),

  /** Los bloqueos de la sucursal (un barbero, solo los suyos), para la lista de ausencias y bloqueos. */
  http.get(`${BASE}/calendar/blocks`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const branchId = new URL(request.url).searchParams.get("branchId") ?? "ma";
    const own = barberOf(request);
    return HttpResponse.json({ items: db.calendar.blocks.filter((block) => block.branchId === branchId && (!own || block.barberId === own)) });
  }),

  /** Aprobar un bloqueo pendiente: dueño, administrador o recepción. Rechazarlo es borrarlo. */
  http.post(`${BASE}/blocks/:id/approve`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    if (barberOf(request)) return forbidden("Los bloqueos los aprueba la barbería.");
    const target = db.calendar.blocks.find((block) => block.id === params.id);
    if (!target) return error(404, "not_found", "Ese bloqueo no existe.");
    const approved: MockTimeBlock = { ...target, status: undefined, requestedBy: undefined };
    db.calendar.blocks = db.calendar.blocks.map((block) => (block.id === target.id ? approved : block));
    db.persist();
    return HttpResponse.json(approved);
  }),

  /** Editar un bloqueo: lo mismo que el alta; si esperaba aprobación, sigue esperándola. */
  http.patch(`${BASE}/blocks/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const target = db.calendar.blocks.find((block) => block.id === params.id);
    if (!target) return error(404, "not_found", "Ese bloqueo no existe.");
    const input = { ...target, ...asRecord(await request.json().catch(() => ({}))) };
    const denied = blockDenied(request, target.barberId) ?? blockDenied(request, text(input.barberId));
    if (denied) return denied;
    const { fields, values } = validateBlock(input);
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    const updated: MockTimeBlock = { ...target, barberId: values.barber!.id, category: values.category, repeat: values.repeat, startDate: values.startDate, endDate: values.endDate, startTime: values.startTime, endTime: values.endTime, description: text(input.description) || null };
    db.calendar.blocks = db.calendar.blocks.map((block) => (block.id === target.id ? updated : block));
    db.persist();
    return HttpResponse.json(updated);
  }),

  http.delete(`${BASE}/blocks/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const target = db.calendar.blocks.find((block) => block.id === params.id);
    if (!target) return error(404, "not_found", "Ese bloqueo no existe.");
    const denied = blockDenied(request, target.barberId);
    if (denied) return denied;
    db.calendar.blocks = db.calendar.blocks.filter((block) => block.id !== params.id);
    db.persist();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/waitlist`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId") ?? "ma";
    const day = url.searchParams.get("date");
    // Un barbero ve las suyas y las de «cualquier barbero» (las puede tomar).
    const own = barberOf(request);
    const items = db.calendar.waitlist.filter((item) => item.branchId === branchId && (!day || item.slots.some((slot) => slot.date === day)) && (!own || item.barberId === null || item.barberId === own));
    return HttpResponse.json({ items });
  }),

  http.post(`${BASE}/waitlist`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const input = asRecord(await request.json().catch(() => ({})));
    const fields: Record<string, string[]> = {};
    const clientId = text(input.clientId);
    const serviceId = text(input.serviceId);
    // Un barbero apunta en la lista de espera consigo.
    const own = barberOf(request);
    if (own && text(input.barberId) && text(input.barberId) !== own) return forbidden("Solo te apuntas a ti en la lista de espera.");
    const barberId = own ?? (text(input.barberId) || null);
    const branchId = text(input.branchId) || "ma";
    const slots = Array.isArray(input.slots)
      ? input.slots.map((slot) => asRecord(slot as DefaultBodyType)).filter((slot) => DAY_KEY.test(text(slot.date)) && CLOCK.test(text(slot.time))).map((slot) => ({ date: text(slot.date), time: text(slot.time) }))
      : [];
    if (!db.calendar.clients.some((client) => client.id === clientId)) fields.clientId = ["Elige un cliente."];
    if (!catalogServices().some((service) => service.id === serviceId)) fields.serviceId = ["Elige un servicio."];
    if (barberId && !findBarber(barberId)) fields.barberId = ["Ese barbero no existe."];
    if (slots.length === 0) fields.slots = ["Añade al menos una fecha y hora."];
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    const item: MockWaitlistEntry = { id: `wl_${Date.now().toString(36)}`, branchId, clientId, serviceId, barberId, slots, createdAt: new Date().toISOString() };
    db.calendar.waitlist = [...db.calendar.waitlist, item];
    db.persist();
    return HttpResponse.json(item, { status: 201 });
  }),

  http.delete(`${BASE}/waitlist/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const entryToRemove = db.calendar.waitlist.find((item) => item.id === params.id);
    if (!entryToRemove) return error(404, "not_found", "Esa entrada no existe.");
    const own = barberOf(request);
    if (own && entryToRemove.barberId !== null && entryToRemove.barberId !== own) return forbidden("Esa entrada es de otro barbero.");
    db.calendar.waitlist = db.calendar.waitlist.filter((item) => item.id !== params.id);
    db.persist();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/sales`, async ({ request }) => {
    await delay(LATENCY_MS);
    const account = requireAuth(request);
    if (!account) return error(401, "unauthorized", "Tu sesión expiró.");
    const input = asRecord(await request.json().catch(() => ({})));
    const method = text(input.method) as MockPaymentMethod;
    const items = Array.isArray(input.items)
      ? input.items.map((item) => asRecord(item as DefaultBodyType)).filter((item) => catalogProducts().some((product) => product.id === item.productId)).map((item) => ({ productId: item.productId as string, qty: Math.max(1, Number(item.qty) || 1) }))
      : [];
    const fields: Record<string, string[]> = {};
    if (items.length === 0) fields.items = ["Elige al menos un producto."];
    if (!METHODS.includes(method)) fields.method = ["Elige un método de pago."];
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    const branchId = text(input.branchId) || "ma";
    // La venta de mostrador lleva el impuesto de la sucursal donde se hace, como una cita.
    const { tax, total } = cartTotals(
      items.map((item) => {
        const product = db.products.items.find((row) => row.id === item.productId);
        return { amount: productPriceIn(item.productId, branchId) * item.qty, percent: itemTaxPercent(product?.taxRate, branchId) };
      }),
      0,
      taxInclusive()
    );
    // Quién vendió: comisiona en su nómina. El barbero vende a su nombre; recepción elige (o la venta es de la barbería).
    const own = barberOf(request);
    const sellerInput = text(input.sellerId);
    const sellerId = own ?? (sellerInput && db.team.members.some((member) => member.id === sellerInput) ? sellerInput : null);
    const sale = { id: `sale_${Date.now().toString(36)}`, branchId, items, method, tax, total, paidAt: new Date().toISOString(), sellerId };
    db.calendar.sales = [...db.calendar.sales, sale];
    for (const item of items) moveStock({ branchId, productId: item.productId, delta: -item.qty, reason: "sale", ref: sale.id, by: account.user.name });
    db.persist();
    return HttpResponse.json(sale, { status: 201 });
  }),
];

/** Expuesto para las pruebas: cuántos minutos dura la jornada de alguien un día. */
export const workingClock = clockOf;
