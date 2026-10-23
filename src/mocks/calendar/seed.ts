import { seededRandom } from "../db";
import { REFERENCE_PHOTO_NOTE, clientPhoto, referencePhotosFor } from "../media";

/**
 * Los datos del calendario del backend simulado: el equipo con su horario,
 * los clientes, el catálogo y una agenda que se genera día a día de forma
 * determinista (la misma fecha produce las mismas citas), así las pruebas y
 * las capturas se repiten y navegar por el mes siempre encuentra algo.
 */

export interface MockWorkingRange {
  start: string;
  end: string;
}

/**
 * Lo que el calendario sabe de un barbero. Sale del equipo
 * (`mocks/team`): el horario fijo por día de la semana, su nivel y si toma
 * clientes sin cita, según el orden de la sucursal.
 */
export interface MockBarber {
  id: string;
  branchId: string;
  name: string;
  avatarUrl: string | null;
  level: string | null;
  /** Franjas por día de la semana (0 = domingo). Sin entrada, no trabaja. */
  workingHours: Partial<Record<number, MockWorkingRange[]>>;
  acceptsWalkIns: boolean;
  bookingVisible: boolean;
  /** Lo que cobra por cada servicio (su precio en Equipo). */
  prices?: Record<string, number>;
}

export type MockClientType = "walkin" | "new" | "retained" | "frequent" | "vip";
export type MockNoteKind = "note" | "medication" | "allergy";

export interface MockClientNote {
  id: string;
  kind: MockNoteKind;
  text: string;
  createdAt: string;
}

export type MockConductReason = "rude" | "disrespect" | "intoxicated" | "haggles" | "hygiene" | "other";

export interface MockConductReport {
  id: string;
  reasons: MockConductReason[];
  text: string;
  appointmentId: string | null;
  by: string;
  createdAt: string;
}

export interface MockClient {
  id: string;
  name: string;
  phone: string;
  type: MockClientType;
  visits: number;
  cancellations: number;
  noShows: number;
  lastVisitAt: string | null;
  preferredBarberId: string | null;
  /** Cada cuántos días suele volver; `null` si no hay ritmo aún. */
  visitEveryDays: number | null;
  notes: MockClientNote[];
  /** La foto que subió el cliente, o `null` (se pintan sus iniciales). */
  avatarUrl: string | null;
  /** Su correo, para el recibo y los avisos; no todos lo dejan. */
  email?: string | null;
  /** Lo que el equipo reportó de su actitud, el más reciente primero. */
  conduct?: MockConductReport[];
}

export interface MockService {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  price: number;
  /** La tasa con la que se cobra en la sucursal del catálogo. */
  taxPercent?: number;
  imageUrl?: string | null;
}

export interface MockProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  taxPercent?: number;
  imageUrl?: string | null;
}

export type MockAppointmentStatus = "scheduled" | "arrived" | "seated" | "paid" | "no_show" | "cancelled";
export type MockAppointmentSource = "internal" | "online" | "walkin";
export type MockRepeatRule = "none" | "weekly" | "biweekly" | "triweekly" | "monthly" | "bimonthly" | "quarterly";
export type MockPaymentMethod = "cash" | "card" | "link" | "mixed" | "transfer";

export interface MockHistoryEntry {
  id: string;
  at: string;
  actor: string;
  event: string;
}

export interface MockPayment {
  method: MockPaymentMethod;
  tip: number;
  tax: number;
  total: number;
  paidAt: string;
  /** Lo que de ese total ya estaba pagado en línea (propina incluida): en caja se cobró el resto. */
  prepaid?: number;
  /** Con `mixed`: cuánto fue en efectivo y cuánto con tarjeta. */
  split?: { cash: number; card: number };
  /** Lo descontado en la caja y por qué. */
  discount?: number;
  discountReason?: string | null;
  /** Lo pagado con una tarjeta de regalo del cliente. */
  gift?: { code: string; amount: number };
  /** Una tarjeta de regalo vendida en el mismo cobro. */
  giftSale?: { code: string; amount: number };
  /** El pago dividido en partes, cada una con su método. */
  parts?: { method: "cash" | "card" | "link" | "transfer"; amount: number; deviceId?: string }[];
  /** Con transferencia (Nequi, Daviplata, Bre-B, Zelle, banco…): por dónde y la referencia que dio el cliente. */
  transfer?: { via: string; reference: string | null };
  /** El datáfono con que se pasó la tarjeta. */
  deviceId?: string;
  /** El recargo por tarjeta cobrado (Configuración › Recargo por tarjeta), como línea aparte de la cuenta. */
  surcharge?: number;
  surchargeName?: string;
  /** El cupón canjeado en la caja (su descuento va en `discount`). */
  coupon?: string;
}

/** Una devolución: desde la caja, o la que hizo la reserva en línea al cancelar. */
export interface MockVoidedPayment {
  id: string;
  at: string;
  by: string;
  reason: string;
  /** Los movimientos del cobro tal como estaban (cobro por medio y propina). */
  entries: { kind: "charge" | "tip"; method: string; amount: number; at: string; by: string }[];
}

export interface MockRefund {
  id: string;
  amount: number;
  /** A dónde volvió el dinero. */
  to: "cash" | "card" | "credit";
  reason: string;
  at: string;
  by: string;
  /** Lo que se devolvió, línea por línea (los productos vuelven al inventario). */
  items?: { kind: "service" | "product" | "tip"; id: string; qty: number; amount: number }[];
}

/**
 * Lo que ya quedó resuelto en la reserva en línea para esta cita: lo pagado
 * (tarjeta, anticipo, saldo, tarjeta de regalo), la propina que dejó y lo
 * descontado (cupón, cortesía, paquete). La caja cobra solo lo que falta.
 */
export interface MockOnlineSettlement {
  reservation: string;
  method: string;
  paid: number;
  tip: number;
  discount: number;
}

/** Un anticipo pedido desde la cita: cuánto, por dónde salió el enlace y si ya se pagó. */
export interface MockDepositRequest {
  /** El del enlace (`/reservar/anticipo?token=`). */
  token: string;
  amount: number;
  status: "requested" | "paid" | "cancelled";
  requestedAt: string;
  by: string;
  channels: ("sms" | "email")[];
  paidAt?: string;
}

export interface MockAppointment {
  id: string;
  branchId: string;
  clientId: string;
  barberId: string;
  requestedBarberId: string | null;
  serviceIds: string[];
  products: { productId: string; qty: number }[];
  /** Inicio en ISO local (sin zona): la agenda es de la sucursal, no de UTC. */
  start: string;
  durationMin: number;
  status: MockAppointmentStatus;
  barberReady: boolean;
  walkIn: boolean;
  source: MockAppointmentSource;
  repeat: MockRepeatRule;
  seriesId: string | null;
  notes: string | null;
  /** Fotos del corte que quiere el cliente (data URL), si las mandó al reservar en línea. */
  referencePhotos?: string[];
  /** Precios cambiados al cobrar: por servicio (en el orden de `serviceIds`) y por producto (unitario). */
  servicePrices?: (number | null)[];
  productPrices?: Record<string, number>;
  /** Lo descontado al cobrar (en dinero, antes de impuestos). */
  checkoutDiscount?: number;
  createdAt: string;
  createdBy: string;
  history: MockHistoryEntry[];
  payment: MockPayment | null;
  /** Lo resuelto al reservar en línea; sin reserva en línea, nada. */
  online?: MockOnlineSettlement | null;
  /** De dónde vino la reserva en línea (los `utm_*` del enlace); `null` si llegó directo. */
  utm?: MockUtm | null;
  /** Lo devuelto de esta cuenta. */
  refunds?: MockRefund[];
  /**
   * Cobros borrados (se cobró por error). El libro de pagos no borra: guarda lo que se había registrado y
   * le suma un contramovimiento con quién lo anuló y por qué.
   */
  voidedPayments?: MockVoidedPayment[];
  /** Si el cliente confirmó que viene: por el enlace del mensaje o porque recepción lo marcó. */
  confirmation?: { status: "confirmed" | "declined" | "reschedule_requested"; at: string; via: "link" | "reception" | "whatsapp" } | null;
  /** El token del enlace «Confirmar» del mensaje de WhatsApp. */
  confirmToken?: string;
  /** Lo que ya se descontó del inventario por esta cita (al reservarla en línea o al cobrarla). */
  stockTaken?: { productId: string; qty: number }[];
  linkId?: string | null;
  /** El anticipo pedido desde la cita, si se pidió. */
  depositRequest?: MockDepositRequest | null;
}

export type MockBlockCategory = "sick" | "vacation" | "holiday" | "lunch" | "meeting" | "business" | "personal";
export type MockBlockRepeat = "none" | "daily" | "weekly" | "monthly";

export interface MockTimeBlock {
  id: string;
  branchId: string;
  barberId: string;
  category: MockBlockCategory;
  repeat: MockBlockRepeat;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  description: string | null;
  /** Pendiente de aprobar (lo puso un barbero con la aprobación encendida); sin él, aprobado. */
  status?: "pending";
  /** Quién lo pidió, si está pendiente. */
  requestedBy?: string;
}

export interface MockWaitlistEntry {
  id: string;
  branchId: string;
  clientId: string;
  serviceId: string;
  barberId: string | null;
  slots: { date: string; time: string }[];
  createdAt: string;
}

export interface MockSale {
  id: string;
  branchId: string;
  items: { productId: string; qty: number }[];
  method: MockPaymentMethod;
  /** El impuesto que va dentro del total; las ventas sembradas no lo traen. */
  tax?: number;
  total: number;
  paidAt: string;
  /** Quién vendió (una ficha del equipo): comisiona en su nómina. Sin él, la venta es de la barbería. */
  sellerId?: string | null;
}

/* --------------------------------------------------------------- catalog */

export const SERVICES: readonly MockService[] = [
  { id: "svc_corte", name: "Corte clásico", category: "Cortes", durationMin: 30, price: 35 },
  { id: "svc_fade", name: "Fade", category: "Cortes", durationMin: 45, price: 45 },
  { id: "svc_nino", name: "Corte niño", category: "Cortes", durationMin: 30, price: 25 },
  { id: "svc_barba", name: "Arreglo de barba", category: "Barba", durationMin: 30, price: 30 },
  { id: "svc_afeitado", name: "Afeitado clásico", category: "Barba", durationMin: 45, price: 40 },
  { id: "svc_combo", name: "Corte + barba", category: "Combos", durationMin: 60, price: 60 },
  { id: "svc_premium", name: "Ritual premium", category: "Combos", durationMin: 90, price: 95 },
  { id: "svc_cejas", name: "Diseño de cejas", category: "Extras", durationMin: 15, price: 12 },
  { id: "svc_tratamiento", name: "Tratamiento capilar", category: "Extras", durationMin: 45, price: 55 },
];

export const PRODUCTS: readonly MockProduct[] = [
  { id: "prd_cera", name: "Cera mate", category: "Styling", price: 18 },
  { id: "prd_pomada", name: "Pomada brillo", category: "Styling", price: 16 },
  { id: "prd_polvo", name: "Polvo texturizante", category: "Styling", price: 20 },
  { id: "prd_aceite", name: "Aceite de barba", category: "Barba", price: 22 },
  { id: "prd_balsamo", name: "Bálsamo de barba", category: "Barba", price: 19 },
  { id: "prd_shampoo", name: "Shampoo diario", category: "Cuidado", price: 14 },
  { id: "prd_acond", name: "Acondicionador", category: "Cuidado", price: 14 },
  { id: "prd_toalla", name: "Toalla de barbería", category: "Accesorios", price: 25 },
];

/* --------------------------------------------------------------- clients */

const CLIENT_FIRST = ["Marcela", "Santiago", "Mariana", "Juan", "Camila", "Andrés", "Valentina", "Sebastián", "Daniela", "Mateo", "Sara", "Nicolás", "Isabella", "Samuel", "Gabriela", "Martín", "Antonia", "Emilio", "Luciana", "Tomás", "Renata", "Diego", "Julieta", "Felipe", "Elena", "Simón", "Paula", "Gael", "Victoria", "Bruno"];
const CLIENT_LAST = ["Gómez", "Pérez", "Rodríguez", "Martínez", "López", "García", "Hernández", "Torres", "Ramírez", "Castro", "Moreno", "Jiménez", "Ortiz", "Silva", "Rojas", "Vargas"];
const TYPES: readonly MockClientType[] = ["new", "retained", "frequent", "vip"];
const NOTE_SAMPLES: readonly [MockNoteKind, string][] = [
  ["note", "Le gusta el fade alto con la barba perfilada."],
  ["note", "Suele llegar 10 minutos tarde; avisar al barbero."],
  ["allergy", "Alergia al aceite de árbol de té."],
  ["medication", "Toma anticoagulantes: cuidado con el afeitado a navaja."],
  ["note", "Prefiere que no le hablen durante el corte."],
];

/** Los barberos de Massachusetts (ids del equipo), para repartir preferencias. */
const MA_BARBER_IDS: readonly string[] = ["team-04", "team-05", "team-06", "team-07", "team-08", "team-26", "team-27", "team-28", "team-29", "team-30"];

export const WALK_IN_CLIENT: MockClient = {
  id: "cli_walkin",
  name: "Walk in",
  phone: "000******0000",
  type: "walkin",
  visits: 0,
  cancellations: 0,
  noShows: 0,
  lastVisitAt: null,
  preferredBarberId: null,
  visitEveryDays: null,
  notes: [],
  avatarUrl: null,
};

/** Uno de cada cinco no dejó correo: así se ve el caso de solo SMS. */
const WITHOUT_EMAIL_EVERY = 5;
const emailSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
/** El correo de la demo, sacado del nombre (no consume el dado). */
const demoEmail = (name: string, index: number): string | null => {
  if (index % WITHOUT_EMAIL_EVERY === WITHOUT_EMAIL_EVERY - 1) return null;
  const [first = "", last = ""] = name.split(" ");
  return `${emailSlug(first)}.${emailSlug(last)}@gmail.com`;
};

/**
 * Dos clientes no se llaman igual: si el nombre ya salió, se cambia el
 * apellido por el siguiente libre. No consume el dado, así el resto de la
 * semilla no se mueve.
 */
function uniqueName(name: string, taken: Set<string>): string {
  const [first, last] = name.split(" ");
  let candidate = name;
  for (let step = 1; taken.has(candidate) && step <= CLIENT_LAST.length; step += 1) {
    candidate = `${first} ${CLIENT_LAST[(CLIENT_LAST.indexOf(last ?? "") + step) % CLIENT_LAST.length]}`;
  }
  taken.add(candidate);
  return candidate;
}

const CONDUCT_SAMPLES: readonly Omit<MockConductReport, "id" | "createdAt">[] = [
  { reasons: ["rude"], text: "Le habló feo a la recepcionista cuando le tocó esperar.", appointmentId: null, by: "Recepción" },
  { reasons: ["haggles", "disrespect"], text: "Pidió descuento al cobrar y no quiso pagar el diseño de barba.", appointmentId: null, by: "Recepción" },
];

/** Uno de cada nueve (desde el quinto) trae un reporte; siempre los mismos. */
function conductSample(index: number, base: number): MockConductReport[] {
  if (index % 9 !== 4) return [];
  const sample = CONDUCT_SAMPLES[Math.floor(index / 9) % CONDUCT_SAMPLES.length];
  return [{ ...sample, id: `conduct_seed_${index}`, createdAt: new Date(base - (12 + index) * 86_400_000).toISOString() }];
}

export function seedClients(count = 44, seed = 11): MockClient[] {
  const rand = seededRandom(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const base = Date.UTC(2026, 8, 1);
  const taken = new Set<string>();
  const clients = Array.from({ length: count }, (_, index) => {
    const type = index === 0 ? "vip" : index === 1 ? "new" : pick(TYPES);
    const visits = type === "new" ? 1 + Math.floor(rand() * 2) : type === "retained" ? 3 + Math.floor(rand() * 5) : type === "frequent" ? 8 + Math.floor(rand() * 10) : 18 + Math.floor(rand() * 25);
    const notes: MockClientNote[] = rand() < 0.4 ? [pick(NOTE_SAMPLES)].map(([kind, text], noteIndex) => ({ id: `note_${index}_${noteIndex}`, kind, text, createdAt: new Date(base - Math.floor(rand() * 90) * 86_400_000).toISOString() })) : [];
    const name = uniqueName(index === 0 ? "Marcela Gómez" : `${pick(CLIENT_FIRST)} ${pick(CLIENT_LAST)}`, taken);
    const barbers = MA_BARBER_IDS;
    return {
      id: `cli_${String(index + 1).padStart(3, "0")}`,
      name,
      phone: `+57 3${String(Math.floor(rand() * 90_000_000) + 10_000_000).padStart(8, "0")}`,
      type,
      visits,
      cancellations: Math.floor(rand() * (type === "vip" ? 4 : 2)),
      noShows: rand() < 0.2 ? 1 : 0,
      lastVisitAt: new Date(base - Math.floor(rand() * 30) * 86_400_000).toISOString(),
      preferredBarberId: rand() < 0.7 ? pick(barbers) : null,
      visitEveryDays: type === "new" ? null : 7 * (1 + Math.floor(rand() * 4)),
      notes,
      avatarUrl: clientPhoto(index + 1, name),
      email: demoEmail(name, index),
      // Sin tocar el azar de la semilla: unos pocos con un reporte de actitud, para verlo en la demo.
      conduct: conductSample(index, base),
    } satisfies MockClient;
  });
  return [WALK_IN_CLIENT, ...clients];
}

/* --------------------------------------------------------------- agenda */

export const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** «2026-09-25» + «10:30» → ISO local sin zona («2026-09-25T10:30:00»). */
export const localIso = (day: string, time: string): string => `${day}T${time}:00`;

export const parseClock = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

export const clockOf = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** De dónde vino una reserva en línea de la semilla: siempre la misma para la misma cita. */
export interface MockUtm {
  source: string;
  medium: string;
  campaign: string;
}

/** Las campañas de la demo: cada una sale por su canal. */
const SEED_CAMPAIGNS: Readonly<Record<string, string>> = { instagram: "martes-2x1-barba", google: "bienvenida-primera-visita", whatsapp: "trae-a-un-amigo" };

function seedUtm(id: string): MockUtm | null {
  const roll = hashKey(`${id}:utm`) % 100;
  // Como en una barbería de barrio: Instagram y Google traen la mayoría; una de cada cinco llega directo.
  const [source, medium] = roll < 32 ? ["instagram", "social"] : roll < 56 ? ["google", "maps"] : roll < 70 ? ["whatsapp", "message"] : roll < 80 ? ["facebook", "social"] : [null, null];
  if (!source || !medium) return null;
  const campaign = hashKey(`${id}:campaign`) % 10 < 3 ? (SEED_CAMPAIGNS[source] ?? "") : "";
  return { source, medium, campaign };
}

function hashKey(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Cada cuántas citas, de media, se vende además un producto. */
const PRODUCT_SALE_EVERY = 5;

/** Cada cuántas citas, de media, una se repite y una trae nota (del hash del id). */
const REPEAT_EVERY = 5;
const NOTE_EVERY = 7;
/** Una de cada tantas citas pegadas a la anterior del mismo barbero es el segundo servicio del mismo cliente. */
const SAME_VISIT_EVERY = 3;
const SEED_NOTES = ["Quiere el mismo corte de la última vez", REFERENCE_PHOTO_NOTE, "Llega con el tiempo justo", "Prefiere máquina 2 a los lados"] as const;

/** Antes de esta hora (10:00) la agenda de hoy se siembra como a las 12:30, para que la demo muestre todos los estados. */
const DEMO_EARLY_BEFORE_MINUTES = 10 * 60;
const DEMO_TODAY_AT_MINUTES = 12 * 60 + 30;

export interface SeedDayOptions {
  branchId: string;
  day: string;
  /** Los barberos de la sucursal ese día, con su horario ya resuelto. */
  barbers: readonly MockBarber[];
  clients: readonly MockClient[];
  /** Ahora, para decidir en qué estado va cada cita de hoy. */
  now: Date;
  /** Los bloqueos de ese día (almuerzos, reuniones…): ahí no se siembran citas. */
  blocks?: readonly MockTimeBlock[];
  /** Los recursos especiales (sillón de lavado…): no se siembran más citas a la vez de las unidades que hay. */
  resources?: readonly { id: string; units: number; serviceIds: readonly string[] }[];
}

/** El servicio de reserva cuando el sorteado necesita un recurso ya completo: un corte no ocupa ninguno. */
const RESOURCE_FREE_FALLBACK = "svc_corte";

/**
 * La agenda de un día: para cada barbero con horario, citas encadenadas con
 * huecos, con servicios del catálogo y clientes de la lista. Las de días
 * pasados están cobradas (con algún plantón o cancelación); las de hoy van
 * según la hora; las futuras siguen agendadas.
 */
export function seedDay({ branchId, day, barbers, clients, now, blocks = [], resources = [] }: SeedDayOptions): MockAppointment[] {
  const rand = seededRandom(hashKey(`${branchId}:${day}`));
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const date = new Date(`${day}T00:00:00`);
  const weekday = date.getDay();
  const isPast = dateKey(now) > day;
  const isToday = dateKey(now) === day;
  // Abriendo la app antes de las 10 casi nada habría pasado y el día saldría entero en «Agendada».
  // Entonces hoy se siembra como a mediodía: la demo trae citas cobradas, en silla, en espera y por
  // venir. Desde las 10 manda la hora real.
  const realMinutes = now.getHours() * 60 + now.getMinutes();
  const nowMinutes = isToday && realMinutes < DEMO_EARLY_BEFORE_MINUTES ? DEMO_TODAY_AT_MINUTES : realMinutes;
  const realClients = clients.filter((client) => client.id !== WALK_IN_CLIENT.id);
  const appointments: MockAppointment[] = [];
  let counter = 0;
  // Lo que ya ocupa cada recurso ese día (minutos), entre todos los barberos.
  const taken = new Map<string, { from: number; to: number }[]>(resources.map((resource) => [resource.id, []]));
  const fits = (serviceId: string, from: number, to: number) =>
    resources.every((resource) => !resource.serviceIds.includes(serviceId) || (taken.get(resource.id) ?? []).filter((use) => from < use.to && use.from < to).length < resource.units);

  for (const barber of barbers) {
    // Cada barbero atiende a quien lo prefiere o no tiene preferencia, no a los clientes de otro: así
    // «sus clientes» (Clientes y la agenda) es un grupo creíble y no la base entera.
    const book = realClients.filter((client) => client.preferredBarberId === barber.id || client.preferredBarberId === null);
    const pool = book.length > 0 ? book : realClients;
    // Nadie va dos veces el mismo día con el mismo barbero (las citas enlazadas se arman aparte).
    const seen = new Set<string>();
    const ranges = barber.workingHours[weekday] ?? [];
    for (const range of ranges) {
      let cursor = parseClock(range.start) + (rand() < 0.5 ? 0 : 30);
      const end = parseClock(range.end);
      while (cursor + 30 <= end) {
        if (rand() < 0.35) {
          cursor += 30;
          continue;
        }
        const drawn = pick(SERVICES);
        // Si el sorteado necesita un recurso que a esa hora ya está completo, va un corte (sin gastar otro dado).
        const service = fits(drawn.id, cursor, cursor + drawn.durationMin) ? drawn : (SERVICES.find((item) => item.id === RESOURCE_FREE_FALLBACK) ?? drawn);
        if (!fits(service.id, cursor, cursor + service.durationMin)) {
          cursor += 30;
          continue;
        }
        if (cursor + service.durationMin > end) break;
        // Nadie agenda encima de un almuerzo o de una reunión: la cita se va a después del bloqueo.
        const from = cursor;
        const blocked = blocks.find((block) => block.barberId === barber.id && from < parseClock(block.endTime) && parseClock(block.startTime) < from + service.durationMin);
        if (blocked) {
          cursor = parseClock(blocked.endTime);
          continue;
        }
        const fresh = pool.filter((item) => !seen.has(item.id));
        const client = pick(fresh.length > 0 ? fresh : pool);
        seen.add(client.id);
        const startMinutes = cursor;
        const endMinutes = cursor + service.durationMin;
        for (const resource of resources) if (resource.serviceIds.includes(service.id)) taken.get(resource.id)?.push({ from: startMinutes, to: endMinutes });
        const status = appointmentStatus({ isPast, isToday, nowMinutes, startMinutes, endMinutes, roll: rand() });
        const walkIn = rand() < 0.12;
        const id = `apt_${day.replace(/-/g, "")}_${barber.id.replace("team-", "")}_${counter++}`;
        const createdAt = new Date(date.getTime() - Math.floor(rand() * 10 + 1) * 86_400_000).toISOString();
        const paidAt = new Date(`${day}T${clockOf(endMinutes)}:00`).toISOString();
        // Una de cada cinco citas se lleva además un producto. Sale del id, no del dado: la agenda sembrada no cambia.
        const productRoll = hashKey(id);
        const product = productRoll % PRODUCT_SALE_EVERY === 0 ? PRODUCTS[productRoll % PRODUCTS.length] : null;
        const sold = product ? [{ productId: product.id, qty: 1 + (productRoll % 2) }] : [];
        const soldTotal = product ? product.price * sold[0].qty : 0;
        // Algunas citas se repiten y otras traen nota. Sale del id, no del dado, para no mover la agenda
        // sembrada. Solo repite quien ya tiene historia (retenido en adelante) y reservó: la primera visita
        // de alguien o un cliente de paso no pueden ser una serie.
        const extraRoll = hashKey(`${id}:extra`);
        const canRepeat = !walkIn && (client.type === "retained" || client.type === "frequent" || client.type === "vip");
        const repeat = canRepeat && extraRoll % REPEAT_EVERY === 0 ? (extraRoll % 2 === 0 ? "weekly" : "biweekly") : "none";
        const notes = extraRoll % NOTE_EVERY === 1 ? SEED_NOTES[extraRoll % SEED_NOTES.length] : null;
        // En el mismo orden de siempre: el sorteo de la semilla no cambia.
        const requestedBarberId = rand() < 0.75 ? barber.id : null;
        const source: MockAppointmentSource = walkIn ? "walkin" : rand() < 0.4 ? "online" : "internal";
        appointments.push({
          id,
          branchId,
          clientId: client.id,
          barberId: barber.id,
          requestedBarberId,
          serviceIds: [service.id],
          products: sold,
          start: localIso(day, clockOf(startMinutes)),
          durationMin: service.durationMin,
          status,
          barberReady: status !== "scheduled",
          walkIn,
          source,
          ...(source === "online" ? { utm: seedUtm(id) } : {}),
          repeat,
          seriesId: repeat === "none" ? null : `ser_${client.id}_${barber.id.replace("team-", "")}`,
          notes,
          // Quien dice traer foto de referencia la trae: así el barbero la ve en el panel de la cita.
          ...(notes === REFERENCE_PHOTO_NOTE ? { referencePhotos: referencePhotosFor(extraRoll) } : {}),
          createdAt,
          createdBy: walkIn ? barber.name : rand() < 0.5 ? "Lucía Bernal" : "Reserva online",
          history: [{ id: `${id}_h0`, at: createdAt, actor: walkIn ? barber.name : "Lucía Bernal", event: walkIn ? "walkin" : "created" }, ...visitSteps(id, day, startMinutes, endMinutes, status, barber.name)],
          payment: status === "paid" ? { method: pick(["cash", "card", "link"] as const), tip: rand() < 0.6 ? Math.round(service.price * 0.15) : 0, tax: 0, total: service.price + soldTotal, paidAt } : null,
        });
        cursor = endMinutes + (rand() < 0.4 ? 0 : 30);
      }
    }
  }
  return splitCombos(chainVisits(appointments));
}

/** Llega entre 8 min antes y 4 min después de su hora; pasa a la silla de 1 a 7 min después. Sale del id. */
const ARRIVAL_SPREAD_MINUTES = 13;
const ARRIVAL_EARLIEST_MINUTES = -8;
const SEAT_WAIT_SPREAD_MINUTES = 7;

/** Lo que pasó en la barbería con una cita ya empezada: llegó, se sentó y se cobró, con su hora. */
function visitSteps(id: string, day: string, startMinutes: number, endMinutes: number, status: MockAppointment["status"], barberName: string): MockHistoryEntry[] {
  if (status !== "arrived" && status !== "seated" && status !== "paid") return [];
  const roll = hashKey(`${id}:visit`);
  const arrived = startMinutes + ARRIVAL_EARLIEST_MINUTES + (roll % ARRIVAL_SPREAD_MINUTES);
  const seated = Math.max(startMinutes, arrived) + 1 + (roll % SEAT_WAIT_SPREAD_MINUTES);
  const at = (minutes: number) => new Date(`${day}T${clockOf(minutes)}:00`).toISOString();
  const steps: MockHistoryEntry[] = [{ id: `${id}_h1`, at: at(arrived), actor: "Lucía Bernal", event: "status:arrived" }];
  if (status === "seated" || status === "paid") steps.push({ id: `${id}_h2`, at: at(seated), actor: barberName, event: "status:seated" });
  if (status === "paid") steps.push({ id: `${id}_h3`, at: at(endMinutes), actor: "Lucía Bernal", event: "status:paid" });
  return steps;
}

/**
 * Los combos que se piden por partes: una cita, varios servicios. Ocupan lo mismo que el combo
 * (corte 30 + barba 30 = 60; fade 45 + afeitado 45 = 90), así que la agenda no se mueve.
 */
const COMBO_PARTS: Readonly<Record<string, readonly string[]>> = {
  svc_combo: ["svc_corte", "svc_barba"],
  svc_premium: ["svc_fade", "svc_afeitado"],
};
/** Uno de cada tantos combos se agenda por partes. Sale del id, no del dado. */
const SPLIT_COMBO_EVERY = 2;

function splitCombos(appointments: readonly MockAppointment[]): MockAppointment[] {
  const priceOf = (ids: readonly string[]) => ids.reduce((sum, id) => sum + (SERVICES.find((service) => service.id === id)?.price ?? 0), 0);
  return appointments.map((item) => {
    const parts = item.serviceIds.length === 1 ? COMBO_PARTS[item.serviceIds[0]] : undefined;
    if (!parts || hashKey(`${item.id}:split`) % SPLIT_COMBO_EVERY !== 0) return item;
    const payment = item.payment ? { ...item.payment, total: item.payment.total - priceOf(item.serviceIds) + priceOf(parts) } : null;
    return { ...item, serviceIds: [...parts], payment };
  });
}

/**
 * Un cliente que agenda dos citas de una vez (corte y después barba) ocupa dos citas seguidas
 * con el mismo barbero, enlazadas: algunas citas pegadas a la anterior pasan a ser del mismo
 * cliente y comparten `linkId`. Sale del id, no del dado: el resto no se mueve.
 */
function chainVisits(appointments: readonly MockAppointment[]): MockAppointment[] {
  const result: MockAppointment[] = [];
  for (const item of appointments) {
    const previous = result[result.length - 1];
    const glued =
      previous &&
      previous.barberId === item.barberId &&
      !previous.walkIn &&
      new Date(previous.start).getTime() + previous.durationMin * 60_000 === new Date(item.start).getTime() &&
      hashKey(`${item.id}:visit`) % SAME_VISIT_EVERY === 0;
    if (!glued) {
      result.push(item);
      continue;
    }
    // Salieron del mismo agendamiento: quedan enlazadas (la primera también).
    const linkId = previous.linkId ?? `lnk_${previous.id}`;
    result[result.length - 1] = { ...previous, linkId };
    result.push({ ...item, clientId: previous.clientId, walkIn: false, source: previous.source, requestedBarberId: previous.requestedBarberId, repeat: "none", seriesId: null, linkId });
  }
  return result;
}

function appointmentStatus({ isPast, isToday, nowMinutes, startMinutes, endMinutes, roll }: { isPast: boolean; isToday: boolean; nowMinutes: number; startMinutes: number; endMinutes: number; roll: number }): MockAppointmentStatus {
  if (isPast) return roll < 0.06 ? "no_show" : roll < 0.12 ? "cancelled" : "paid";
  if (!isToday) return roll < 0.05 ? "cancelled" : "scheduled";
  if (endMinutes <= nowMinutes) return roll < 0.08 ? "no_show" : roll < 0.95 ? "paid" : "seated";
  if (startMinutes <= nowMinutes) return roll < 0.6 ? "seated" : "arrived";
  if (startMinutes - nowMinutes <= 30) return roll < 0.4 ? "arrived" : "scheduled";
  return "scheduled";
}

/** Un almuerzo diario por barbero y un par de bloqueos puntuales, para que se vean. */
export function seedBlocks(): MockTimeBlock[] {
  return [
    { id: "blk_lunch_andres", branchId: "ma", barberId: "team-04", category: "lunch", repeat: "daily", startDate: "2026-01-01", endDate: "2027-12-31", startTime: "13:00", endTime: "14:00", description: null },
    { id: "blk_lunch_daniela", branchId: "ma", barberId: "team-08", category: "lunch", repeat: "daily", startDate: "2026-01-01", endDate: "2027-12-31", startTime: "13:00", endTime: "13:30", description: null },
    { id: "blk_meeting", branchId: "ma", barberId: "team-05", category: "meeting", repeat: "weekly", startDate: "2026-09-04", endDate: "2027-12-31", startTime: "10:00", endTime: "10:30", description: "Reunión de equipo" },
    { id: "blk_vac_valeria", branchId: "ma", barberId: "team-06", category: "vacation", repeat: "none", startDate: "2026-10-05", endDate: "2026-10-09", startTime: "08:00", endTime: "16:00", description: "Vacaciones" },
  ];
}

/** Si un bloqueo (con su repetición) cae en un día concreto. */
export function blockAppliesOn(block: MockTimeBlock, day: string): boolean {
  if (day < block.startDate || day > block.endDate) return false;
  if (block.repeat === "none" || block.repeat === "daily") return true;
  const target = new Date(`${day}T00:00:00`);
  const first = new Date(`${block.startDate}T00:00:00`);
  if (block.repeat === "weekly") return target.getDay() === first.getDay();
  return target.getDate() === first.getDate();
}
