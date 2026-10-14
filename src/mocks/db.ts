/**
 * Base de datos en memoria del backend simulado. Es determinista: la misma
 * semilla produce los mismos registros, así las pruebas E2E y las capturas
 * son reproducibles. Se reinicia al recargar la página.
 */
import { seededRandom } from "./random";
import { ACCOUNT_PHOTOS, userPhoto } from "./media";
import { emptyCustomers, type MockCustomersState } from "./customers/seed";
import { seedServices, type MockServicesState } from "./services/seed";
import { seedProducts, type MockProductsState } from "./products/seed";
import { seedExpenses, type MockExpense } from "./expenses/seed";
import { seedSettings, type MockSettingsState } from "./settings/seed";
import { emptyBooking, type MockBookingState } from "./booking/state";
import { seedBlocks, seedClients, type MockAppointment, type MockClient, type MockSale, type MockTimeBlock, type MockWaitlistEntry } from "./calendar/seed";
import { withBarberPrices } from "./team/pricing";
import { LEVELS, seedOrders, seedOverrides, seedTeam, type MockBranchOrder, type MockLevel, type MockScheduleOverride, type MockTeamMember } from "./team/seed";

export type MockUserStatus = "active" | "invited" | "inactive";
export type MockUserRole = "admin" | "manager" | "member";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  area: string;
  role: MockUserRole;
  status: MockUserStatus;
  createdAt: string;
  lastActiveAt: string | null;
  avatarUrl: string | null;
}

export type MockAuthProvider = "google" | "microsoft";

export interface MockAccount {
  id: string;
  /** Celular en E.164; es la llave de entrada (se verifica con un código por SMS). */
  phone: string;
  email: string;
  /** Cuentas externas vinculadas: entrar con Google o con Outlook cae aquí. */
  providers: readonly MockAuthProvider[];
  user: { id: string; name: string; phone: string; email: string; role: MockUserRole; avatarUrl: string | null };
}

const FIRST = ["Ana", "Luis", "María", "Carlos", "Antonia", "Andrés", "Valentina", "Diego", "Renata", "Mateo", "Camila", "Juan", "Daniela", "Santiago", "Paula", "Nicolás", "Isabella", "Sebastián", "Gabriela", "Tomás"];
const LAST = ["Pérez", "Gómez", "Ruiz", "Díaz", "Torres", "Rojas", "Castro", "Herrera", "Méndez", "Vargas", "Moreno", "Jiménez", "Ortiz", "Silva", "Ramírez"];
const AREAS = ["Producto", "Ingeniería", "Ventas", "Personas", "Marketing", "Finanzas", "Operaciones", "Soporte"];

export { seededRandom };

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function seedUsers(count = 57, seed = 7): MockUser[] {
  const rand = seededRandom(seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const base = Date.UTC(2026, 0, 6);
  return Array.from({ length: count }, (_, index) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const second = pick(LAST);
    const name = `${first} ${last} ${second}`;
    const status: MockUserStatus = rand() < 0.78 ? "active" : rand() < 0.5 ? "invited" : "inactive";
    const createdAt = new Date(base + Math.floor(rand() * 240) * 86_400_000).toISOString();
    return {
      id: `usr_${String(index + 1).padStart(4, "0")}`,
      name,
      email: `${slug(first)}.${slug(last)}${index}@empresa.com`,
      area: pick(AREAS),
      role: index === 0 ? "admin" : rand() < 0.15 ? "manager" : "member",
      status,
      createdAt,
      lastActiveAt: status === "invited" ? null : new Date(base + Math.floor(rand() * 260) * 86_400_000).toISOString(),
      avatarUrl: userPhoto(index + 1, name),
    };
  });
}

export const ACCOUNTS: readonly MockAccount[] = [
  {
    id: "acc_admin",
    phone: "+573001234567",
    email: "admin@thema.dev",
    providers: ["google"],
    user: { id: "usr_0001", name: "Carolina Vargas", phone: "+573001234567", email: "admin@thema.dev", role: "admin", avatarUrl: ACCOUNT_PHOTOS.owner },
  },
  {
    id: "acc_manager",
    phone: "+573007654321",
    email: "lider@thema.dev",
    providers: ["microsoft"],
    user: { id: "usr_0002", name: "Julián Ospina", phone: "+573007654321", email: "lider@thema.dev", role: "manager", avatarUrl: ACCOUNT_PHOTOS.manager },
  },
];

/** Identidad de la empresa: su logo para fondos claros y, opcional, para oscuros. */
export interface MockBranding {
  name: string | null;
  logo: string | null;
  logoDark: string | null;
  updatedAt: string | null;
}

const EMPTY_BRANDING: MockBranding = { name: null, logo: null, logoDark: null, updatedAt: null };

/** La agenda: lo que se genera por día se recuerda para que las mutaciones sobrevivan. */
export interface MockCalendarState {
  clients: MockClient[];
  appointments: MockAppointment[];
  blocks: MockTimeBlock[];
  waitlist: MockWaitlistEntry[];
  sales: MockSale[];
  /** `sucursal:AAAA-MM-DD` de los días ya generados. */
  seededDays: string[];
}

const emptyCalendar = (): MockCalendarState => ({
  clients: seedClients(),
  appointments: [],
  blocks: seedBlocks(),
  waitlist: [],
  sales: [],
  seededDays: [],
});

/** El equipo: las personas con su ficha, los niveles, el orden por sucursal y las excepciones de horario. */
export interface MockTeamState {
  members: MockTeamMember[];
  levels: MockLevel[];
  orders: MockBranchOrder[];
  overrides: MockScheduleOverride[];
}

const emptyTeam = (): MockTeamState => {
  const members = withBarberPrices(seedTeam(), seedServices().items);
  return { members, levels: [...LEVELS], orders: seedOrders(members), overrides: seedOverrides() };
};

export interface MockDb {
  /** Feedback de campañas recibido; en memoria, se pierde al recargar. */
  feedback: Record<string, unknown>[];
  /** Adjuntos de feedback «subidos»; solo se guarda qué eran. */
  feedbackUploads: { id: string; name: string; size: number }[];
  users: MockUser[];
  branding: MockBranding;
  calendar: MockCalendarState;
  team: MockTeamState;
  /** Lo que la ficha de un cliente añade a los clientes de la agenda. */
  customers: MockCustomersState;
  /** El catálogo de servicios: de aquí sale lo que la agenda puede agendar. */
  services: MockServicesState;
  /** El catálogo de productos: de aquí sale lo que la caja puede vender. */
  products: MockProductsState;
  /** Lo que sale de caja, por sucursal. */
  expenses: MockExpense[];
  /** La configuración: un documento por ajuste y las listas (sucursales, cierres, impuestos, datáfonos). */
  settings: MockSettingsState;
  /** La reserva en línea: recibos, saldo a favor y cancelaciones de cada cliente. */
  booking: MockBookingState;
  /** token de «Mis citas» → id de cliente. Solo en memoria. */
  bookingSessions: Map<string, string>;
  /** token → id de cuenta */
  sessions: Map<string, string>;
  /** celular → intentos fallidos seguidos al verificar el código. Solo en memoria. */
  loginFailures: Map<string, number>;
  /** id de cuenta → correo de respaldo verificado, por si el SMS no llega al entrar. */
  backupEmails: Record<string, string>;
  /** id de cuenta → correo de respaldo al que se mandó el código y aún no se verifica. Solo en memoria. */
  pendingBackupEmails: Map<string, string>;
  /** Guarda el estado; se llama tras cada mutación para sobrevivir recargas. */
  persist(): void;
  reset(): void;
}

const STORAGE_KEY = "thema.mock.db";
/** Sube cuando cambia la semilla (equipo, catálogo…): lo guardado con otra versión se descarta. */
const SCHEMA_VERSION = 25;

interface PersistedDb {
  version?: number;
  users: MockUser[];
  sessions: [string, string][];
  branding?: MockBranding;
  calendar?: MockCalendarState;
  team?: MockTeamState;
  customers?: MockCustomersState;
  services?: MockServicesState;
  products?: MockProductsState;
  expenses?: MockExpense[];
  settings?: MockSettingsState;
  booking?: MockBookingState;
  backupEmails?: Record<string, string>;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function load(): PersistedDb | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as PersistedDb) : null;
    return saved && saved.version === SCHEMA_VERSION ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Como un backend real, el estado sobrevive a una recarga (en `sessionStorage`,
 * así muere al cerrar la pestaña). En Node (Vitest) no hay almacenamiento y
 * todo es efímero.
 */
export function createDb(): MockDb {
  const saved = load();
  const db: MockDb = {
    users: saved?.users ?? seedUsers(),
    branding: saved?.branding ?? EMPTY_BRANDING,
    calendar: saved?.calendar ?? emptyCalendar(),
    team: saved?.team ?? emptyTeam(),
    customers: saved?.customers ?? emptyCustomers(),
    services: saved?.services ?? seedServices(),
    products: saved?.products ?? seedProducts(),
    expenses: saved?.expenses ?? seedExpenses(),
    settings: saved?.settings ?? seedSettings(),
    booking: saved?.booking ?? emptyBooking(),
    bookingSessions: new Map(),
    sessions: new Map(saved?.sessions ?? []),
    loginFailures: new Map(),
    backupEmails: saved?.backupEmails ?? {},
    pendingBackupEmails: new Map(),
    feedback: [],
    feedbackUploads: [],
    persist() {
      try {
        storage()?.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: SCHEMA_VERSION, users: db.users, sessions: [...db.sessions.entries()], branding: db.branding, calendar: db.calendar, team: db.team, customers: db.customers, services: db.services, products: db.products, expenses: db.expenses, settings: db.settings, booking: db.booking, backupEmails: db.backupEmails } satisfies PersistedDb)
        );
      } catch {
        /* sin almacenamiento: el estado vive solo en memoria */
      }
    },
    reset() {
      db.users = seedUsers();
      db.branding = EMPTY_BRANDING;
      db.calendar = emptyCalendar();
      db.team = emptyTeam();
      db.customers = emptyCustomers();
      db.services = seedServices();
      db.products = seedProducts();
      db.expenses = seedExpenses();
      db.settings = seedSettings();
      db.booking = emptyBooking();
      db.bookingSessions.clear();
      db.sessions.clear();
      db.loginFailures.clear();
      db.backupEmails = {};
      db.pendingBackupEmails.clear();
      db.feedback = [];
      db.feedbackUploads = [];
      try {
        storage()?.removeItem(STORAGE_KEY);
      } catch {
        /* nada que limpiar */
      }
    },
  };
  return db;
}

export const db = createDb();
