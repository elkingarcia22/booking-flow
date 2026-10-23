import { PRODUCTS, SERVICES, type MockClient } from "../calendar/seed";
import { HEALTH_CONSENT_VERSION, consentCountryOf, consentVersionOf } from "@/features/legal/consent";
import { PRODUCT_PHOTOS } from "../media";

/**
 * Los clientes del backend simulado. El directorio sale de los mismos
 * clientes que usa el calendario (`db.calendar.clients`), así una persona es
 * la misma en la agenda y en su ficha; aquí se le añade lo que la agenda no
 * necesita: contacto, dirección, en qué momento de la relación está y su
 * historial. Todo se deriva del id, de forma determinista.
 */

export type MockSegment = "new" | "retained" | "frequent" | "vip" | "atRisk" | "lost" | "recovered" | "blocked";

export interface MockGuest {
  id: string;
  name: string;
  relation: string;
  visits: number;
}

export interface MockCustomerProfile {
  email: string;
  branchId: string;
  country: string;
  state: string;
  city: string;
  address: string;
  zipcode: string;
  birthDate: string | null;
  onlineOnly: boolean;
  blocked: boolean;
  createdAt: string;
  guests: MockGuest[];
  /**
   * Aceptó recibir promociones: cuándo y desde dónde. Sin esto, no se le escribe más que lo de sus
   * citas (Ley 1581: consentimiento previo, expreso e informado, y que se pueda probar).
   */
  /** El permiso de promociones, con el texto que se aceptó (versión y país): es la prueba. */
  marketingConsent?: { accepted: boolean; at: string; source: "booking" | "app" | "whatsapp" | "sms"; version?: string; country?: string };
  /** El permiso aparte para anotar alergias y medicamentos: sin él no se guardan. */
  healthConsent?: { accepted: boolean; at: string; source: "booking" | "app"; version: string; by?: string };
  /** Se borraron sus datos personales por solicitud (el historial contable queda, anónimo). */
  erasedAt?: string;
  /** Respondió STOP/BAJA por SMS: no se le manda ningún SMS (tampoco los de sus citas) hasta ALTA. */
  smsStop?: { at: string } | null;
  /** Borrado del directorio; la agenda conserva sus citas. */
  deleted?: boolean;
  /** La tanda de importación que lo trajo (para poder deshacerla). */
  importBatch?: string;
  /** Etiquetas propias («cera mate», «VIP», «estudiante»), en minúsculas y sin repetir. */
  tags?: string[];
  /** Cómo llegó: lo que respondió a «¿cómo nos conociste?» o lo que dijo su enlace. */
  source?: MockCustomerSource | null;
  /** Quién lo refirió (id del cliente), si llegó con un código de referido. */
  referredBy?: string | null;
}

export const CUSTOMER_SOURCES = ["instagram", "google", "facebook", "tiktok", "referral", "walkin", "other"] as const;
export type MockCustomerSource = (typeof CUSTOMER_SOURCES)[number];

/** Solo lo que cambió o se creó; el resto se deriva al vuelo. */
/** Una solicitud de un titular sobre sus datos: lo que pidió, por dónde, el plazo y cómo se resolvió. */
export interface MockPrivacyRequest {
  id: string;
  clientId: string;
  /** El nombre al momento de pedirlo (si luego se borra, el registro dice de quién era). */
  clientName: string;
  type: "access" | "export" | "rectify" | "erase" | "revoke" | "other";
  channel: "app" | "phone" | "email" | "in_person" | "whatsapp" | "sms";
  status: "open" | "done";
  note: string;
  requestedAt: string;
  /** Hasta cuándo hay que responder según el país de la sede. */
  dueAt: string;
  doneAt: string | null;
  by: string;
}

/** La fórmula de un corte: lo que hay que repetir la próxima vez. Todo es texto libre y opcional. */
export interface MockCutFormula {
  /** Máquina o técnica («clipper», «tijera»). */
  tool: string;
  /** Números de peine o guarda («1 a los lados, 3 arriba»). */
  guard: string;
  /** El degradado («bajo», «medio», «skin»). */
  fade: string;
  /** Barba y contornos. */
  beard: string;
  /** Producto que se usó o se recomendó. */
  products: string;
  notes: string;
}

/** Un corte anotado: la fórmula y las fotos del resultado, de una visita. */
export interface MockCutRecord {
  id: string;
  clientId: string;
  /** AAAA-MM-DD de la visita. */
  date: string;
  appointmentId: string | null;
  barberId: string | null;
  formula: MockCutFormula;
  /** Fotos del resultado (data URL), hasta 4. */
  photos: string[];
  createdAt: string;
  by: string;
}

/** Un referido: quién trajo a quién, y si ya se dio el premio (al cobrar la primera visita del nuevo). */
export interface MockReferral {
  id: string;
  referrerId: string;
  referredId: string;
  status: "pending" | "rewarded";
  createdAt: string;
  rewardedAt: string | null;
  /** Lo que recibió cada uno como saldo a favor. */
  amount: number;
}

export interface MockCustomersState {
  profiles: Record<string, MockCustomerProfile>;
  privacyRequests?: MockPrivacyRequest[];
  /** Los cortes anotados de cada cliente. */
  cuts?: Record<string, MockCutRecord[]>;
  referrals?: MockReferral[];
  /** Los grupos guardados (filtros con nombre) y las campañas mandadas a ellos. */
  groups?: MockCustomerGroup[];
  campaigns?: MockCampaign[];
}

export interface MockGroupFilters {
  segment: string | null;
  alert: "atRisk" | "overdue" | "birthday" | "unreliable" | null;
  tag: string | null;
  source: string | null;
}

/** Un grupo guardado: un filtro de Clientes con nombre, para volver a él y mandarle campañas. */
export interface MockCustomerGroup {
  id: string;
  name: string;
  filters: MockGroupFilters;
  createdAt: string;
  by: string;
}

/** Una campaña: a quién, qué decía, cuándo salió y lo que costaría. Los resultados se calculan al pedirla. */
export interface MockCampaign {
  id: string;
  name: string;
  groupId: string | null;
  filters: MockGroupFilters;
  body: string;
  couponCode: string | null;
  createdAt: string;
  by: string;
  /** Cuándo se pidió que saliera (cada mensaje sale en la franja legal de la sede de su cliente). */
  sendAt: string;
  recipients: string[];
  excluded: { noConsent: number; noPhone: number; promoCap: number; blocked: number };
  estimatedCost: number;
  status: "scheduled" | "cancelled";
}

export const emptyCustomers = (): MockCustomersState => ({ profiles: {} });

const DAY_MS = 86_400_000;
const BRANCH_IDS: readonly string[] = ["ma", "ma", "ma", "nc", "ri", "ut"];
const PLACES: readonly (readonly [string, string, string])[] = [
  ["Estados Unidos", "Massachusetts", "Boston"],
  ["Estados Unidos", "North Carolina", "Charlotte"],
  ["Estados Unidos", "Rhode Island", "Providence"],
  ["Colombia", "Bogotá, D.C.", "Bogotá"],
];
const STREETS: readonly string[] = ["Newbury St", "Beacon St", "Tremont St", "Boylston St", "Hanover St", "Charles St"];
const RELATIONS: readonly string[] = ["Hijo", "Hermano", "Amigo", "Primo", "Sobrino"];
const GUEST_NAMES: readonly string[] = ["Santi", "Tomás", "Emilio", "Martín", "Lucas", "Nico"];
const SOURCES = ["internal", "online", "online", "walkin"] as const;
const METHODS = ["card", "card", "cash", "link"] as const;

export function hashOf(value: string, salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const DEMO_TAGS: readonly string[][] = [[], [], [], ["cera mate"], ["estudiante"], ["barba"], ["cera mate", "barba"], [], ["vip"], []];
const DEMO_SOURCES: readonly (MockCustomerSource | null)[] = ["instagram", "google", "walkin", null, "referral", "instagram", "facebook", null, "tiktok", "other"];

export function deriveProfile(client: MockClient, now = new Date()): MockCustomerProfile {
  const h = hashOf(client.id);
  const place = PLACES[h % PLACES.length];
  /* El cumpleaños cae en los próximos meses para que la lista siempre tenga
     alguno cerca; uno de cada seis no lo dejó registrado. */
  const birthday = new Date(now.getTime() + (hashOf(client.id, 3) % 150) * DAY_MS);
  const birthDate = h % 6 === 5 ? null : `${1978 + (h % 28)}-${isoDay(birthday).slice(5)}`;
  const guests: MockGuest[] =
    h % 5 === 0
      ? [{ id: `gst_${client.id}_1`, name: GUEST_NAMES[h % GUEST_NAMES.length], relation: RELATIONS[hashOf(client.id, 5) % RELATIONS.length], visits: 1 + (h % 4) }]
      : [];
  return {
    email: `${slug(client.name)}@correo.com`,
    branchId: BRANCH_IDS[hashOf(client.id, 1) % BRANCH_IDS.length],
    country: place[0],
    state: place[1],
    city: place[2],
    address: `${10 + (h % 380)} ${STREETS[h % STREETS.length]}`,
    zipcode: String(10_000 + (h % 80_000)).padStart(5, "0"),
    birthDate,
    // Marcela (cli_001) es la clienta de la demo de reserva en línea: con ella se ve también «Pagar en la barbería».
    onlineOnly: h % 9 === 0 && client.id !== "cli_001",
    blocked: h % 23 === 7,
    createdAt: new Date(now.getTime() - (60 + (hashOf(client.id, 2) % 700)) * DAY_MS).toISOString(),
    guests,
    // Unas cuantas etiquetas y orígenes para que el filtro y Métricas tengan con qué mostrarse.
    tags: DEMO_TAGS[hashOf(client.id, 7) % DEMO_TAGS.length],
    source: DEMO_SOURCES[hashOf(client.id, 8) % DEMO_SOURCES.length],
    // En la demo, quien ya trae alergias o medicamentos anotados dio el permiso al anotarlos.
    // En la demo, unos tres de cada cinco aceptaron promociones al reservar (con el texto vigente de su país): así las
    // campañas, la reactivación y el cumpleaños tienen a quién escribirle. Los demás quedan sin permiso, como en la vida real.
    ...(hashOf(client.id, 9) % 5 < 3 ? { marketingConsent: { accepted: true, at: new Date(now.getTime() - (20 + (hashOf(client.id, 10) % 400)) * DAY_MS).toISOString(), source: "booking" as const, version: consentVersionOf(place[0]), country: consentCountryOf(place[0]) } } : {}),
    ...(client.notes.some((note) => note.kind !== "note") ? { healthConsent: { accepted: true, at: new Date(now.getTime() - (30 + (hashOf(client.id, 4) % 300)) * DAY_MS).toISOString(), source: "app" as const, version: HEALTH_CONSENT_VERSION } } : {}),
  };
}

/**
 * En qué momento de la relación está el cliente y cuándo vino por última vez.
 * El tipo de la agenda (nuevo, retenido, frecuente, VIP) dice cuánto viene;
 * aquí se le suma el tiempo: quien lleva dos ciclos sin volver está en
 * riesgo, quien lleva meses se perdió y quien volvió tras perderse se
 * recuperó. Un bloqueo manda sobre todo lo demás.
 */
export function lifecycleOf(client: MockClient, blocked: boolean, now = new Date()): { segment: MockSegment; lastVisitAt: string | null } {
  if (client.visits === 0) return { segment: blocked ? "blocked" : "new", lastVisitAt: null };
  const h = hashOf(client.id, 7);
  const every = client.visitEveryDays ?? 21;
  const bucket = h % 10;
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  const base: MockSegment = client.type === "walkin" ? "new" : client.type;
  let segment: MockSegment = base;
  let lastVisitAt = ago(1 + (h % Math.max(2, Math.min(every, 25))));
  if (bucket === 0) {
    segment = "lost";
    lastVisitAt = ago(100 + (h % 120));
  } else if (bucket === 1 && client.visits >= 2) {
    segment = "atRisk";
    lastVisitAt = ago(every * 2 + (h % 10));
  } else if ((bucket === 2 || bucket === 3) && client.visits >= 3) {
    segment = "recovered";
    lastVisitAt = ago(3 + (h % 9));
  }
  return { segment: blocked ? "blocked" : segment, lastVisitAt };
}

export interface MockCustomerAppointment {
  id: string;
  service: string;
  start: string;
  barberId: string | null;
  source: (typeof SOURCES)[number];
  requestedBarber: boolean;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  total: number;
}

export interface MockCustomerPayment {
  id: string;
  date: string;
  status: "paid" | "refunded";
  amount: number;
  method: (typeof METHODS)[number];
  reference: string;
}

export interface MockCustomerProduct {
  id: string;
  name: string;
  units: number;
  total: number;
  lastBoughtAt: string;
  imageUrl: string | null;
}

export const ticketOf = (client: MockClient): number => 28 + (hashOf(client.id, 11) % 48);

const HISTORY_LIMIT = 12;

export function historyOf(client: MockClient, lastVisitAt: string | null, segment: MockSegment, barberIds: readonly string[], now = new Date()): MockCustomerAppointment[] {
  const h = hashOf(client.id, 13);
  const every = client.visitEveryDays ?? 21;
  const pickBarber = (index: number) => client.preferredBarberId ?? barberIds[(h + index) % Math.max(1, barberIds.length)] ?? null;
  const history: MockCustomerAppointment[] = [];
  const upcoming = segment !== "lost" && segment !== "blocked" && h % 3 === 0;
  if (upcoming) {
    const service = SERVICES[h % SERVICES.length];
    history.push({ id: `apt_${client.id}_next`, service: service.name, start: new Date(now.getTime() + (1 + (h % 9)) * DAY_MS).toISOString(), barberId: pickBarber(0), source: SOURCES[h % SOURCES.length], requestedBarber: client.preferredBarberId !== null, status: "scheduled", total: service.price });
  }
  if (!lastVisitAt) return history;
  const total = Math.min(HISTORY_LIMIT, client.visits + client.cancellations + client.noShows);
  let cancellations = client.cancellations;
  let noShows = client.noShows;
  const last = new Date(lastVisitAt).getTime();
  for (let index = 0; index < total; index += 1) {
    const service = SERVICES[(h + index * 3) % SERVICES.length];
    let status: MockCustomerAppointment["status"] = "completed";
    if (index > 0 && index % 4 === 2 && cancellations > 0) {
      status = "cancelled";
      cancellations -= 1;
    } else if (index > 0 && index % 5 === 3 && noShows > 0) {
      status = "no_show";
      noShows -= 1;
    }
    history.push({
      id: `apt_${client.id}_${index}`,
      service: service.name,
      start: new Date(last - index * every * DAY_MS).toISOString(),
      barberId: pickBarber(index),
      source: SOURCES[(h + index) % SOURCES.length],
      requestedBarber: client.preferredBarberId !== null,
      status,
      total: status === "completed" ? service.price : 0,
    });
  }
  return history;
}

export function paymentsOf(clientId: string, history: readonly MockCustomerAppointment[]): MockCustomerPayment[] {
  const h = hashOf(clientId, 17);
  return history
    .filter((item) => item.status === "completed")
    .map((item, index) => ({
      id: `pay_${item.id}`,
      date: item.start,
      status: h % 8 === 0 && index === 1 ? ("refunded" as const) : ("paid" as const),
      amount: item.total,
      method: METHODS[(h + index) % METHODS.length],
      reference: `${hashOf(item.id).toString(16).padStart(8, "0")}-${hashOf(item.id, 1).toString(16).slice(0, 4)}`,
    }));
}

export function productsOf(clientId: string, lastVisitAt: string | null): MockCustomerProduct[] {
  const h = hashOf(clientId, 19);
  if (!lastVisitAt) return [];
  return Array.from({ length: h % 3 }, (_, index) => {
    const product = PRODUCTS[(h + index * 2) % PRODUCTS.length];
    const units = 1 + ((h >> (index + 1)) % 4);
    return { id: product.id, name: product.name, units, total: units * product.price, lastBoughtAt: lastVisitAt, imageUrl: PRODUCT_PHOTOS[product.id] ?? null };
  });
}
