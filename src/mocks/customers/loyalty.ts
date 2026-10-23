import { delay, http, HttpResponse, type DefaultBodyType } from "msw";
import { MAX_PHOTO_CHARS, PHOTO_PATTERN } from "@/features/booking/flow/referencePhoto";
import { db } from "../db";
import { forbidden, isBarber, isManager, sessionOf, unauthorized } from "../session";
import { WALK_IN_CLIENT, type MockClient } from "../calendar/seed";
import { agendaBarbers, isOwnClient, profileOf, saveProfile } from "./handlers";
import { CUSTOMER_SOURCES, hashOf, type MockCustomerSource, type MockCutFormula, type MockCutRecord, type MockReferral } from "./seed";

/**
 * Lo que la barbería recuerda y premia de cada cliente (docs/API_CONTRACT.md, «Clientes › Cortes, etiquetas y
 * referidos»):
 *
 * - **Cortes**: la fórmula (máquina, número, degradado, barba, producto) y las fotos del resultado de cada visita, para
 *   repetirlo igual aunque lo atienda otro barbero.
 * - **Etiquetas**: grupos propios para filtrar y escribir («cera mate», «estudiante»), una o varias fichas a la vez.
 * - **Referidos**: cada cliente tiene un código; quien llega con él queda referido y, al cobrarse su primera visita,
 *   los dos reciben saldo a favor (Configuración › Marketing).
 */

const BASE = "*/api";
const LATENCY_MS = 200;
export const MAX_CUT_PHOTOS = 4;
const MAX_FIELD = 200;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;
const FORMULA_KEYS: readonly (keyof MockCutFormula)[] = ["tool", "guard", "fade", "beard", "products", "notes"];

const asRecord = (body: DefaultBodyType): Record<string, unknown> => (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const error = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => HttpResponse.json({ code, message, ...extra }, { status });
const round2 = (value: number) => Math.round(value * 100) / 100;

const clientOf = (id: unknown): MockClient | undefined => db.calendar.clients.find((client) => client.id === id && client.id !== WALK_IN_CLIENT.id && !profileOf(client).deleted);

/** El barbero escribe solo en sus clientes; el resto del equipo, en todos. */
function guard(request: Request, client: MockClient): Response | null {
  const session = sessionOf(request);
  if (!session) return unauthorized();
  if (isBarber(session) && !isOwnClient(client, session.memberId, agendaBarbers())) return forbidden("Ese cliente no es tuyo.");
  return null;
}

// ── Cortes ───────────────────────────────────────────────────────────────────────────────────────

export const cutsOf = (clientId: string): MockCutRecord[] => [...(db.customers.cuts?.[clientId] ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

/** El último corte, para la ficha y el panel de la cita («fade bajo, 1 a los lados»). */
export const lastCutOf = (clientId: string): MockCutRecord | null => cutsOf(clientId)[0] ?? null;

const saveCuts = (clientId: string, cuts: MockCutRecord[]) => {
  db.customers = { ...db.customers, cuts: { ...(db.customers.cuts ?? {}), [clientId]: cuts } };
  db.persist();
};

// ── Etiquetas ────────────────────────────────────────────────────────────────────────────────────

/** Una etiqueta limpia: minúsculas, sin espacios dobles y corta. Vacía = inválida. */
export const normalizeTag = (value: unknown): string => text(value).toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);

const tagsFrom = (input: unknown): string[] => (Array.isArray(input) ? [...new Set(input.map(normalizeTag).filter(Boolean))] : []);

/** Todas las etiquetas en uso, con cuántos clientes las tienen: para elegir y para el filtro de la lista. */
export function tagCatalog(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const client of db.calendar.clients) {
    const profile = profileOf(client);
    if (profile.deleted || client.id === WALK_IN_CLIENT.id) continue;
    for (const tag of profile.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

// ── Referidos ────────────────────────────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** El código de referido de un cliente: su nombre y cuatro caracteres fijos («MARCELA7K2Q»). No cambia. */
export function referralCodeOf(client: MockClient): string {
  const first = (client.name.split(" ")[0] ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "AMIGO";
  const suffix = Array.from({ length: 4 }, (_, index) => CODE_ALPHABET[hashOf(client.id, index + 11) % CODE_ALPHABET.length]).join("");
  return `${first}${suffix}`;
}

/** El cliente dueño de un código de referido (sin importar mayúsculas ni espacios). */
export function referrerByCode(code: unknown): MockClient | undefined {
  const wanted = text(code).toUpperCase().replace(/\s+/g, "");
  if (wanted.length < 5) return undefined;
  return db.calendar.clients.find((client) => client.id !== WALK_IN_CLIENT.id && !profileOf(client).deleted && referralCodeOf(client) === wanted);
}

export interface ReferralRules {
  enabled: boolean;
  /** Saldo a favor para cada uno (quien refiere y el referido). */
  reward: number;
  /** Cuántos premios puede ganar un cliente por referir (tope contra el abuso). */
  maxPerReferrer: number;
}

export const referralRules = (): ReferralRules => {
  const marketing = (db.settings.sections as Record<string, Record<string, unknown> | undefined>).marketing;
  const referral = (marketing?.referral ?? {}) as Partial<ReferralRules>;
  return { enabled: referral.enabled === true, reward: Number(referral.reward) || 0, maxPerReferrer: Number(referral.maxPerReferrer) || 0 };
};

/** Anota que `referred` llegó por `referrer` (al crearlo con el código). Uno no se refiere a sí mismo. */
export function linkReferral(referred: MockClient, referrer: MockClient, now = new Date()): void {
  if (referred.id === referrer.id) return;
  saveProfile(referred.id, { ...profileOf(referred), referredBy: referrer.id, source: "referral" });
  const record: MockReferral = { id: `ref_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`, referrerId: referrer.id, referredId: referred.id, status: "pending", createdAt: now.toISOString(), rewardedAt: null, amount: 0 };
  db.customers = { ...db.customers, referrals: [...(db.customers.referrals ?? []).filter((item) => item.referredId !== referred.id), record] };
  db.persist();
}

const addCredit = (clientId: string, amount: number) => {
  db.booking.credits = { ...db.booking.credits, [clientId]: round2((db.booking.credits[clientId] ?? 0) + amount) };
};

/**
 * Al cobrarse una visita: si es la primera de un cliente referido y el premio sigue pendiente, los dos reciben su saldo
 * a favor. Lo llama el cobro de la caja; devuelve el referido premiado o `null`.
 */
export function rewardReferral(clientId: string, now = new Date()): MockReferral | null {
  const rules = referralRules();
  const pending = (db.customers.referrals ?? []).find((item) => item.referredId === clientId && item.status === "pending");
  if (!rules.enabled || rules.reward <= 0 || !pending) return null;
  const earned = (db.customers.referrals ?? []).filter((item) => item.referrerId === pending.referrerId && item.status === "rewarded").length;
  if (rules.maxPerReferrer > 0 && earned >= rules.maxPerReferrer) return null;
  const rewarded: MockReferral = { ...pending, status: "rewarded", rewardedAt: now.toISOString(), amount: rules.reward };
  addCredit(pending.referrerId, rules.reward);
  addCredit(pending.referredId, rules.reward);
  db.customers = { ...db.customers, referrals: (db.customers.referrals ?? []).map((item) => (item.id === pending.id ? rewarded : item)) };
  db.persist();
  return rewarded;
}

/** Lo de referidos para la ficha: su código, quién lo trajo y a cuántos trajo. */
export function referralSummary(client: MockClient) {
  const profile = profileOf(client);
  const referrer = profile.referredBy ? db.calendar.clients.find((item) => item.id === profile.referredBy) : undefined;
  const mine = (db.customers.referrals ?? []).filter((item) => item.referrerId === client.id);
  return {
    code: referralCodeOf(client),
    referredBy: referrer ? { id: referrer.id, name: referrer.name } : null,
    referred: mine.length,
    rewarded: mine.filter((item) => item.status === "rewarded").length,
    earned: round2(mine.reduce((sum, item) => sum + item.amount, 0)),
  };
}

export const isCustomerSource = (value: unknown): value is MockCustomerSource => CUSTOMER_SOURCES.includes(value as MockCustomerSource);

// ── Endpoints ────────────────────────────────────────────────────────────────────────────────────

export const loyaltyHandlers = [
  // Las etiquetas en uso (para el filtro y para sugerir al etiquetar).
  http.get(`${BASE}/customers/tags`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!sessionOf(request)) return unauthorized();
    return HttpResponse.json({ items: tagCatalog() });
  }),

  // Etiquetar varias fichas a la vez: suma `add` y quita `remove` a cada una.
  http.post(`${BASE}/customers/tags`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    if (isBarber(session)) return forbidden("Las etiquetas las pone recepción, el administrador o el dueño.");
    const input = asRecord(await request.json().catch(() => ({})));
    const ids = Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === "string").slice(0, 500) : [];
    const add = tagsFrom(input.add);
    const remove = new Set(tagsFrom(input.remove));
    if (ids.length === 0 || (add.length === 0 && remove.size === 0)) return error(422, "validation", "Elige clientes y una etiqueta.", { fields: { tags: ["Escribe o elige una etiqueta."] } });
    let updated = 0;
    for (const id of ids) {
      const client = clientOf(id);
      if (!client) continue;
      const profile = profileOf(client);
      const tags = [...new Set([...(profile.tags ?? []).filter((tag) => !remove.has(tag)), ...add])].slice(0, MAX_TAGS);
      saveProfile(client.id, { ...profile, tags });
      updated += 1;
    }
    return HttpResponse.json({ updated, items: tagCatalog() });
  }),

  // Las etiquetas de una ficha, enteras (reemplaza las que tenía).
  http.put(`${BASE}/customers/:id/tags`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = clientOf(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const denied = guard(request, client);
    if (denied) return denied;
    if (isBarber(sessionOf(request)!)) return forbidden("Las etiquetas las pone recepción, el administrador o el dueño.");
    const tags = tagsFrom(asRecord(await request.json().catch(() => ({}))).tags).slice(0, MAX_TAGS);
    saveProfile(client.id, { ...profileOf(client), tags });
    return HttpResponse.json({ tags });
  }),

  // Los cortes del cliente, del más reciente al más viejo.
  http.get(`${BASE}/customers/:id/cuts`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = clientOf(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const denied = guard(request, client);
    if (denied) return denied;
    return HttpResponse.json({ items: cutsOf(client.id).map((cut) => ({ ...cut, barber: barberNameOf(cut.barberId) })) });
  }),

  // Anotar un corte: la fórmula y hasta 4 fotos del resultado.
  http.post(`${BASE}/customers/:id/cuts`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = clientOf(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const denied = guard(request, client);
    if (denied) return denied;
    const session = sessionOf(request)!;
    const input = asRecord(await request.json().catch(() => ({})));
    const raw = asRecord(input.formula as DefaultBodyType);
    const formula = Object.fromEntries(FORMULA_KEYS.map((key) => [key, text(raw[key]).slice(0, MAX_FIELD)])) as unknown as MockCutFormula;
    const photos = Array.isArray(input.photos) ? input.photos.filter((photo): photo is string => typeof photo === "string") : [];
    const fields: Record<string, string[]> = {};
    if (FORMULA_KEYS.every((key) => !formula[key]) && photos.length === 0) fields.formula = ["Anota algo del corte o sube una foto."];
    if (photos.length > MAX_CUT_PHOTOS) fields.photos = [`Hasta ${MAX_CUT_PHOTOS} fotos.`];
    else if (photos.some((photo) => !PHOTO_PATTERN.test(photo) || photo.length > MAX_PHOTO_CHARS)) fields.photos = ["Una foto no es válida o pesa demasiado."];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text(input.date)) ? text(input.date) : new Date().toISOString().slice(0, 10);
    const appointment = db.calendar.appointments.find((item) => item.id === input.appointmentId && item.clientId === client.id);
    if (Object.keys(fields).length > 0) return error(422, "validation", "Revisa los campos marcados.", { fields });
    const barberId = appointment?.barberId ?? (isBarber(session) ? session.memberId : (typeof input.barberId === "string" ? input.barberId : null));
    const cut: MockCutRecord = { id: `cut_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, clientId: client.id, date: appointment?.start.slice(0, 10) ?? date, appointmentId: appointment?.id ?? null, barberId, formula, photos, createdAt: new Date().toISOString(), by: session.account.user.name };
    saveCuts(client.id, [...(db.customers.cuts?.[client.id] ?? []), cut]);
    return HttpResponse.json({ ...cut, barber: barberNameOf(cut.barberId) }, { status: 201 });
  }),

  // Borrar un corte anotado: quien lo anotó o gerencia.
  http.delete(`${BASE}/customers/:id/cuts/:cutId`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const client = clientOf(params.id);
    if (!client) return error(404, "not_found", "Ese cliente no existe.");
    const denied = guard(request, client);
    if (denied) return denied;
    const session = sessionOf(request)!;
    const cut = (db.customers.cuts?.[client.id] ?? []).find((item) => item.id === params.cutId);
    if (!cut) return error(404, "not_found", "Ese corte no existe.");
    if (!isManager(session) && cut.by !== session.account.user.name) return forbidden("Lo borra quien lo anotó o el administrador.");
    saveCuts(client.id, (db.customers.cuts?.[client.id] ?? []).filter((item) => item.id !== cut.id));
    return new HttpResponse(null, { status: 204 });
  }),

  // Quién trajo a quién: la ficha lo muestra; un código sirve para ver de quién es (al crear un cliente).
  http.get(`${BASE}/customers/referrals/check`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!sessionOf(request)) return unauthorized();
    const referrer = referrerByCode(new URL(request.url).searchParams.get("code"));
    if (!referrer) return error(404, "not_found", "Ese código no es de ningún cliente.");
    return HttpResponse.json({ id: referrer.id, name: referrer.name });
  }),
];

function barberNameOf(id: string | null): string | null {
  const member = db.team.members.find((item) => item.id === id);
  return member ? `${member.firstName} ${member.lastName}` : null;
}
