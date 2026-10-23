import { delay, http, HttpResponse, type DefaultBodyType } from "msw";
import { accountById, db } from "../db";
import { forbidden, isBarber, sessionOf } from "../session";
import { WALK_IN_CLIENT, type MockClient } from "../calendar/seed";
import { memberName } from "../team/seed";
import { isCustomerSource, lastCutOf, linkReferral, referralSummary, referrerByCode } from "./loyalty";
import { deriveProfile, historyOf, lifecycleOf, paymentsOf, productsOf, ticketOf, type MockCustomerAppointment, type MockCustomerProfile, type MockGuest } from "./seed";

/**
 * Los endpoints de clientes del backend simulado. Reproducen
 * docs/API_CONTRACT.md (sección «Clientes»): el directorio con el segmento
 * de cada quien, la ficha completa con su historial, el alta, la edición
 * —bloqueo incluido—, el borrado y los invitados.
 */

const BASE = "*/api";
const LATENCY_MS = 200;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function error(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return HttpResponse.json({ code, message, ...extra }, { status });
}

function requireAuth(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const accountId = token ? db.sessions.get(token) : undefined;
  return accountById(accountId) ?? null;
}

const asRecord = (body: DefaultBodyType): Record<string, unknown> => (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const profileOf = (client: MockClient): MockCustomerProfile => db.customers.profiles[client.id] ?? deriveProfile(client);
/* Un cliente borrado sale del directorio, pero sigue en la agenda: sus citas y cobros pasados no se pierden. */
const realClients = () => db.calendar.clients.filter((client) => client.id !== WALK_IN_CLIENT.id && !profileOf(client).deleted);
const findClient = (id: string | readonly string[] | undefined) => realClients().find((client) => client.id === id);

/** Cuánto hacia atrás cuenta una cita cobrada para que el cliente siga siendo «suyo» del barbero. */
const OWN_WINDOW_MS = 365 * 86_400_000;

export function barberName(id: string | null): string | null {
  const member = db.team.members.find((item) => item.id === id);
  return member ? memberName(member) : null;
}

const barberIdsOfTeam = () => db.team.members.filter((member) => member.role === "barbero-comision" || member.role === "barbero-renta").map((member) => member.id);

/**
 * Con qué barberos tiene relación hoy: una cita por atender o una cobrada en
 * los últimos 12 meses. Es la mitad de «cliente suyo» (la otra es el barbero
 * preferido); ver `features/customers/customerAccess.ts`.
 */
function servedBy(history: readonly MockCustomerAppointment[], now = Date.now()): string[] {
  const ids = history.filter((item) => item.barberId !== null && (item.status === "scheduled" || (item.status === "completed" && now - new Date(item.start).getTime() <= OWN_WINDOW_MS))).map((item) => item.barberId as string);
  return [...new Set(ids)];
}

/** Por cliente, los barberos con los que tiene una cita viva en la agenda real del último año (o por venir). */
export type AgendaBarbers = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * La agenda real cuenta igual que el historial de la ficha: un cliente atendido (o agendado) con un barbero
 * es suyo, lo haya traído la semilla o una cita creada en la app. Se lee una sola vez por petición.
 */
export function agendaBarbers(now = Date.now()): AgendaBarbers {
  const map = new Map<string, Set<string>>();
  for (const item of db.calendar.appointments) {
    if (item.status === "cancelled" || item.status === "no_show" || now - new Date(item.start).getTime() > OWN_WINDOW_MS) continue;
    const set = map.get(item.clientId) ?? new Set<string>();
    set.add(item.barberId);
    map.set(item.clientId, set);
  }
  return map;
}

/** La fila de la lista de un cliente (segmento, visitas, etiquetas…): con ella se filtran grupos y campañas. */
export function customerSummary(client: MockClient, agenda: AgendaBarbers = agendaBarbers()) {
  const profile = profileOf(client);
  const { segment, lastVisitAt } = lifecycleOf(client, profile.blocked);
  const history = historyOf(client, lastVisitAt, segment, barberIdsOfTeam());
  const medicalNotes = client.notes.filter((note) => note.kind !== "note").length;
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    avatarUrl: client.avatarUrl ?? null,
    email: profile.email,
    branchId: profile.branchId,
    segment,
    blocked: profile.blocked,
    ltv: client.visits * ticketOf(client) + productsOf(client.id, lastVisitAt).reduce((sum, item) => sum + item.total, 0),
    visits: client.visits,
    cancellations: client.cancellations,
    noShows: client.noShows,
    lastVisitAt,
    visitEveryDays: client.visitEveryDays,
    preferredBarber: barberName(client.preferredBarberId),
    preferredBarberId: client.preferredBarberId,
    barberIds: [...new Set([...servedBy(history), ...(agenda.get(client.id) ?? [])])],
    birthDate: profile.birthDate,
    createdAt: profile.createdAt,
    medicalNotes,
    tags: profile.tags ?? [],
    source: profile.source ?? null,
  };
}

/**
 * «Cliente suyo» (la misma regla en Clientes y en la agenda): lo prefiere, o lo atendió o lo tiene agendado
 * en el último año, según el historial de la ficha o la agenda real.
 */
export function isOwnClient(client: MockClient, memberId: string, agenda: AgendaBarbers = agendaBarbers()): boolean {
  const item = customerSummary(client, agenda);
  return item.preferredBarberId === memberId || item.barberIds.includes(memberId);
}

function detail(client: MockClient) {
  const profile = profileOf(client);
  const base = customerSummary(client);
  const history = historyOf(client, base.lastVisitAt, base.segment, barberIdsOfTeam());
  const past = history.filter((item) => item.status !== "scheduled");
  const booked = Math.max(1, client.visits + client.cancellations + client.noShows);
  const share = (part: number) => Math.round((part / booked) * 1000) / 10;
  const h = client.id.length + client.visits;
  return {
    ...base,
    country: profile.country,
    state: profile.state,
    city: profile.city,
    address: profile.address,
    zipcode: profile.zipcode,
    onlineOnly: profile.onlineOnly,
    stats: {
      avgTicket: client.visits === 0 ? 0 : ticketOf(client),
      transactions: client.visits,
      completedRate: share(client.visits),
      cancelledRate: share(client.cancellations),
      noShowRate: share(client.noShows),
      rebookRate: client.visits < 2 ? 0 : Math.min(96, 35 + ((h * 7) % 55)),
      leadTimeDays: client.visits === 0 ? 0 : 1 + (h % 9),
    },
    notes: client.notes,
    conduct: client.conduct ?? [],
    guests: profile.guests,
    appointments: history.map((item) => ({ id: item.id, service: item.service, start: item.start, barber: barberName(item.barberId), barberId: item.barberId, source: item.source, requestedBarber: item.requestedBarber, status: item.status, total: item.total })),
    lastAppointmentId: past[0]?.id ?? null,
    payments: paymentsOf(client.id, history),
    products: productsOf(client.id, base.lastVisitAt),
    referral: referralSummary(client),
    lastCut: lastCutOf(client.id),
  };
}

export function saveProfile(clientId: string, profile: MockCustomerProfile) {
  db.customers.profiles = { ...db.customers.profiles, [clientId]: profile };
  db.persist();
}

/**
 * El celular identifica al cliente: dos números son el mismo sin contar el indicativo del país (así
 * «+57 300 123 4567» y «3001234567», o «+1 617…» y «617…», son uno). El correo es opcional.
 */
const COUNTRY_CODES = ["57", "1"] as const;
const LOCAL_MIN = 8;
const phoneKey = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  const code = COUNTRY_CODES.find((prefix) => digits.startsWith(prefix) && digits.length - prefix.length >= LOCAL_MIN + 1);
  return code ? digits.slice(code.length) : digits;
};
export const findByPhone = (phone: string, exceptId: string | null = null): MockClient | undefined => {
  const key = phoneKey(phone);
  return key.length < 8 ? undefined : realClients().find((client) => client.id !== exceptId && phoneKey(client.phone) === key);
};

/** Valida lo que captura el formulario; devuelve los errores por campo y, si el celular ya es de alguien, quién. */
function validateInput(input: Record<string, unknown>, currentId: string | null) {
  const fields: Record<string, string[]> = {};
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const phone = text(input.phone);
  const email = text(input.email).toLowerCase();
  const birthDate = text(input.birthDate);
  if (firstName.length < 2) fields.firstName = ["Escribe el nombre."];
  if (lastName.length < 2) fields.lastName = ["Escribe el apellido."];
  const duplicate = phone.replace(/\D/g, "").length >= 8 ? findByPhone(phone, currentId) : undefined;
  if (phone.replace(/\D/g, "").length < 8) fields.phone = ["Escribe un celular válido."];
  else if (duplicate) fields.phone = [`Ya existe ${duplicate.name} con ese celular.`];
  if (email && !EMAIL.test(email)) fields.email = ["Escribe un correo válido."];
  if (birthDate && (!DAY_KEY.test(birthDate) || birthDate > new Date().toISOString().slice(0, 10))) fields.birthDate = ["Esa fecha no es válida."];
  return { fields, duplicateOf: duplicate ? { id: duplicate.id, name: duplicate.name } : null, values: { firstName, lastName, phone, email, birthDate: birthDate || null, country: text(input.country), state: text(input.state), city: text(input.city), address: text(input.address), zipcode: text(input.zipcode), onlineOnly: input.onlineOnly === true } };
}

export const customersHandlers = [
  http.get(`${BASE}/customers`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    // Un barbero recibe solo sus clientes (su preferido o atendido en el último año), no la base entera.
    const session = sessionOf(request);
    const own = session && isBarber(session) ? session.memberId : null;
    const agenda = agendaBarbers();
    const items = realClients()
      .map((client) => customerSummary(client, agenda))
      .filter((item) => own === null || item.preferredBarberId === own || item.barberIds.includes(own))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return HttpResponse.json({ items });
  }),

  http.get(`${BASE}/customers/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = findClient(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const session = sessionOf(request);
    if (session && isBarber(session)) {
      const item = customerSummary(client);
      if (item.preferredBarberId !== session.memberId && !item.barberIds.includes(session.memberId)) return forbidden("Ese cliente no es tuyo.");
    }
    return HttpResponse.json(detail(client));
  }),

  http.post(`${BASE}/customers`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const input = asRecord(await request.json().catch(() => ({})));
    const { fields, values, duplicateOf } = validateInput(input, null);
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields, ...(duplicateOf ? { details: { fields, duplicateOf } } : {}) });
    const client: MockClient = {
      id: `cli_${Date.now().toString(36)}`,
      name: `${values.firstName} ${values.lastName}`,
      phone: values.phone,
      type: "new",
      visits: 0,
      cancellations: 0,
      noShows: 0,
      lastVisitAt: null,
      preferredBarberId: null,
      visitEveryDays: null,
      notes: [],
      avatarUrl: null,
    };
    // Con un código de referido que no es de nadie no se crea: se corrige o se deja vacío.
    const referralCode = text(input.referralCode);
    const referrer = referralCode ? referrerByCode(referralCode) : undefined;
    if (referralCode && !referrer) return error(422, "validation", "Revisa los campos marcados.", { fields: { referralCode: ["Ese código no es de ningún cliente."] } });
    db.calendar.clients = [...db.calendar.clients, client];
    saveProfile(client.id, {
      source: isCustomerSource(input.source) ? input.source : null,
      email: values.email,
      branchId: text(input.branchId) || "ma",
      country: values.country,
      state: values.state,
      city: values.city,
      address: values.address,
      zipcode: values.zipcode,
      birthDate: values.birthDate,
      onlineOnly: values.onlineOnly,
      blocked: false,
      createdAt: new Date().toISOString(),
      guests: [],
    });
    if (referrer) linkReferral(client, referrer);
    return HttpResponse.json(detail(client), { status: 201 });
  }),

  http.patch(`${BASE}/customers/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = findClient(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const input = asRecord(await request.json().catch(() => ({})));
    const profile = profileOf(client);

    /* Bloquear o desbloquear viaja solo: no exige volver a mandar la ficha. */
    if (typeof input.blocked === "boolean" && Object.keys(input).length === 1) {
      saveProfile(client.id, { ...profile, blocked: input.blocked });
      return HttpResponse.json(detail(client));
    }
    /* «Reserva y pago solo en línea» también (lo pone la agenda tras un «No asistió»). */
    if (typeof input.onlineOnly === "boolean" && Object.keys(input).length === 1) {
      saveProfile(client.id, { ...profile, onlineOnly: input.onlineOnly });
      return HttpResponse.json(detail(client));
    }

    const { fields, values, duplicateOf } = validateInput(input, client.id);
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields, ...(duplicateOf ? { details: { fields, duplicateOf } } : {}) });
    const updated: MockClient = { ...client, name: `${values.firstName} ${values.lastName}`, phone: values.phone };
    db.calendar.clients = db.calendar.clients.map((item) => (item.id === updated.id ? updated : item));
    saveProfile(client.id, { ...profile, email: values.email, country: values.country, state: values.state, city: values.city, address: values.address, zipcode: values.zipcode, birthDate: values.birthDate, onlineOnly: values.onlineOnly, ...(input.source === null || isCustomerSource(input.source) ? { source: input.source } : {}) });
    return HttpResponse.json(detail(updated));
  }),

  /* Borrar es lógico: el cliente sale del directorio y ya no se agenda, pero su historial queda. */
  http.delete(`${BASE}/customers/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = findClient(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    saveProfile(client.id, { ...profileOf(client), deleted: true });
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/customers/:id/guests`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = findClient(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const input = asRecord(await request.json().catch(() => ({})));
    const name = text(input.name);
    if (name.length < 2) return error(422, "validation", "Revisa los campos marcados.", { fields: { name: ["Escribe el nombre del invitado."] } });
    const guest: MockGuest = { id: `gst_${Date.now().toString(36)}`, name, relation: text(input.relation), visits: 0 };
    const profile = profileOf(client);
    saveProfile(client.id, { ...profile, guests: [...profile.guests, guest] });
    return HttpResponse.json(detail(client), { status: 201 });
  }),

  http.delete(`${BASE}/customers/:id/guests/:guestId`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    if (!requireAuth(request)) return error(401, "unauthorized", "Tu sesión expiró.");
    const client = findClient(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const profile = profileOf(client);
    if (!profile.guests.some((guest) => guest.id === params.guestId)) return error(404, "not_found", "Ese invitado no existe.");
    saveProfile(client.id, { ...profile, guests: profile.guests.filter((guest) => guest.id !== params.guestId) });
    return HttpResponse.json(detail(client));
  }),
];
