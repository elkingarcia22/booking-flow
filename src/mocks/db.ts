/**
 * Base de datos en memoria del backend simulado. Es determinista: la misma
 * semilla produce los mismos registros, así las pruebas E2E y las capturas
 * son reproducibles. Se reinicia al recargar la página.
 */
import { seededRandom } from "./random";
import { ACCOUNT_PHOTOS, userPhoto, TEAM_PHOTOS } from "./media";
import { emptyCustomers, type MockCustomersState } from "./customers/seed";
import { seedServices, type MockServicesState } from "./services/seed";
import { seedProducts, type MockProductsState } from "./products/seed";
import { seedExpensePayments, seedExpenses, seedSuppliers, type MockSupplier, type MockExpense, type MockExpenseCustomCategory } from "./expenses/seed";
import { seedSettings, upgradeSettings, type MockSettingsState } from "./settings/seed";
import { emptyPayroll, type MockPayrollState } from "./payroll/state";
import { emptyRegister, type MockRegisterState } from "./register/state";
import { emptyInventory, type MockInventoryState } from "./inventory/state";
import { emptyFrontDesk, type MockFrontDeskState } from "./frontDesk/state";
import { emptyBooking, type MockBookingState } from "./booking/state";
import { seedBlocks, seedClients, type MockAppointment, type MockClient, type MockSale, type MockTimeBlock, type MockWaitlistEntry } from "./calendar/seed";
import { withBarberPrices } from "./team/pricing";
import type { MockClosure, MockHolidayClosed, MockScheduleChange, MockSchedulePlan, MockScheduleTemplate } from "./team/scheduleModel";
import { LEVELS, seedOrders, seedOverrides, seedTeam, seedTemplates, type MockBranchOrder, type MockLevel, type MockScheduleOverride, type MockTeamMember, type MockAbsence } from "./team/seed";
import type { MockPayoutChange, MockShiftRequest, MockTimeEntry } from "./team/operationsState";

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
  user: { id: string; name: string; phone: string; email: string; role: MockUserRole; avatarUrl: string | null; teamRole: MockTeamRole; memberId: string };
}

/** El rol en la barbería y la ficha de equipo de quien entra: con ellos el servidor recorta lo que ve. */
export type MockTeamRole = "owner" | "admin" | "recepcion" | "barbero-comision" | "barbero-renta";

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
    user: { id: "usr_0001", name: "Carolina Vargas", phone: "+573001234567", email: "admin@thema.dev", role: "admin", avatarUrl: ACCOUNT_PHOTOS.owner, teamRole: "owner", memberId: "team-01" },
  },
  {
    id: "acc_manager",
    phone: "+573007654321",
    email: "lider@thema.dev",
    providers: ["microsoft"],
    user: { id: "usr_0002", name: "Julián Ospina", phone: "+573007654321", email: "lider@thema.dev", role: "manager", avatarUrl: ACCOUNT_PHOTOS.manager, teamRole: "admin", memberId: "team-02" },
  },
  /* Una cuenta por rol del equipo, para probar lo que el servidor deja ver a cada uno. */
  {
    id: "acc_reception",
    phone: "+573005550103",
    email: "recepcion@thema.dev",
    providers: [],
    user: { id: "usr_0003", name: "Lucía Bernal", phone: "+573005550103", email: "recepcion@thema.dev", role: "member", avatarUrl: TEAM_PHOTOS["team-03"] ?? null, teamRole: "recepcion", memberId: "team-03" },
  },
  {
    id: "acc_barber",
    phone: "+573005550104",
    email: "barbero@thema.dev",
    providers: [],
    user: { id: "usr_0004", name: "Andrés Beltrán", phone: "+573005550104", email: "barbero@thema.dev", role: "member", avatarUrl: TEAM_PHOTOS["team-04"] ?? null, teamRole: "barbero-comision", memberId: "team-04" },
  },
  {
    id: "acc_renter",
    phone: "+573005550130",
    email: "renta@thema.dev",
    providers: [],
    user: { id: "usr_0030", name: "Paola Zuluaga", phone: "+573005550130", email: "renta@thema.dev", role: "member", avatarUrl: TEAM_PHOTOS["team-30"] ?? null, teamRole: "barbero-renta", memberId: "team-30" },
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
  /** Ausencias pedidas, aprobadas o rechazadas. */
  absences?: MockAbsence[];
  /** Fichajes de entrada y salida de los empleados (sin el barbero de renta). */
  timeEntries?: MockTimeEntry[];
  /** Pedidos de cubrir un turno abierto o de cambiar un turno con alguien. */
  shiftRequests?: MockShiftRequest[];
  /** Cambios de forma de pago (comisión ↔ renta ↔ salario) con su fecha. */
  payoutChanges?: MockPayoutChange[];
  /** Horarios con vigencia y ciclo de 1 a 4 semanas (docs/WORK_HOURS_RESEARCH.md). */
  plans?: MockSchedulePlan[];
  /** Plantillas de horario con nombre («Mañana», «Tarde»…), por sede. */
  templates?: MockScheduleTemplate[];
  /** Cierres propios de cada sede (día entero o con horario reducido). */
  closures?: MockClosure[];
  /** Los festivos que una sede cierra. */
  holidaysClosed?: MockHolidayClosed[];
  /** Quién cambió qué horario y cuándo (y si se le avisó al barbero). */
  scheduleLog?: MockScheduleChange[];
}

const emptyTeam = (): MockTeamState => {
  const members = withBarberPrices(seedTeam(), seedServices().items);
  return { members, levels: [...LEVELS], orders: seedOrders(members), overrides: seedOverrides(), templates: seedTemplates() };
};

/** Un dispositivo desde el que entró una cuenta: un id que guarda el navegador y cómo se ve («Chrome en macOS»). */
/** La meta de ingreso de una sede en un mes («AAAA-MM»). */
export interface MockGoal {
  branchId: string;
  month: string;
  revenue: number;
  setBy: string;
  setAt: string;
}

/** Un vencimiento de un gasto fijo que ya se pagó. */
export interface MockExpensePayment {
  id: string;
  expenseId: string;
  /** El vencimiento que cubre («AAAA-MM-DD»). */
  dueDate: string;
  amount: number;
  paidAt: string;
  method: "cash" | "bank" | "card" | "wallet" | null;
  by: string;
}

export interface MockKnownDevice {
  id: string;
  label: string;
  firstSeen: string;
  lastSeen: string;
}

/** Un aviso de seguridad para la propia cuenta. */
export interface MockSecurityEvent {
  id: string;
  accountId: string;
  /** `newDevice`: entró desde un dispositivo nuevo; `locked`: se bloqueó el acceso con su número. */
  kind: "newDevice" | "locked";
  label: string;
  at: string;
}

export interface MockSecurityState {
  devices: Record<string, MockKnownDevice[]>;
  events: MockSecurityEvent[];
}

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
  /** Las categorías de gasto propias de la barbería (además de las de siempre). */
  expenseCategories: MockExpenseCustomCategory[];
  /** Los vencimientos de gastos fijos ya pagados (cuentas por pagar). */
  expensePayments: MockExpensePayment[];
  /** Los proveedores de la barbería (Gastos › Proveedores). */
  suppliers: MockSupplier[];
  /** La meta de ingreso de cada sede y mes (Métricas). */
  goals: MockGoal[];
  /** Los dispositivos desde los que entró cada cuenta y los avisos de seguridad (nuevo dispositivo). */
  security: MockSecurityState;
  /** Las cuentas que se crearon con el registro (además de las de la demo). */
  signups: MockAccount[];
  /** La configuración: un documento por ajuste y las listas (sucursales, cierres, impuestos, datáfonos). */
  settings: MockSettingsState;
  /** La reserva en línea: recibos, saldo a favor y cancelaciones de cada cliente. */
  booking: MockBookingState;
  /** Los periodos de nómina aprobados o pagados y los ajustes del periodo abierto. */
  payroll: MockPayrollState;
  /** Los cierres de caja de cada sucursal y día. */
  register: MockRegisterState;
  /** Existencias por sucursal y sus movimientos. */
  inventory: MockInventoryState;
  frontDesk: MockFrontDeskState;
  /** Los avisos que cada cuenta ya leyó: `cuenta:aviso`. */
  notificationsRead: string[];
  /** token de «Mis citas» → id de cliente. Solo en memoria. */
  bookingSessions: Map<string, string>;
  /** token → id de cuenta */
  sessions: Map<string, string>;
  /** celular → intentos fallidos seguidos al verificar el código. Solo en memoria. */
  loginFailures: Map<string, number>;
  /** celular → hasta cuándo está bloqueado el acceso. Solo en memoria. */
  loginLocks: Map<string, number>;
  /** celular → cuántas veces se bloqueó seguidas y cuándo fue la última (la espera crece). Solo en memoria. */
  lockHistory: Map<string, { count: number; at: number }>;
  /** celular → código de desbloqueo por correo pendiente: hasta cuándo vale y cuántos fallos lleva. Solo en memoria. */
  unlockRequests: Map<string, { expiresAt: number; failures: number }>;
  /** celular → cuándo pidió sus últimos códigos (tope de envíos). Solo en memoria. */
  codeRequests: Map<string, number[]>;
  /** Confirmaciones de identidad recientes (código otra vez antes de algo sensible): token → cuenta y hasta cuándo vale. */
  stepUps: Map<string, { accountId: string; expiresAt: number }>;
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
const SCHEMA_VERSION = 42;

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
  expenseCategories?: MockExpenseCustomCategory[];
  expensePayments?: MockExpensePayment[];
  suppliers?: MockSupplier[];
  goals?: MockGoal[];
  security?: MockSecurityState;
  signups?: MockAccount[];
  settings?: MockSettingsState;
  booking?: MockBookingState;
  payroll?: MockPayrollState;
  register?: MockRegisterState;
  inventory?: MockInventoryState;
  frontDesk?: MockFrontDeskState;
  notificationsRead?: string[];
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
  const expenses = saved?.expenses ?? seedExpenses();
  const db: MockDb = {
    users: saved?.users ?? seedUsers(),
    branding: saved?.branding ?? EMPTY_BRANDING,
    calendar: saved?.calendar ?? emptyCalendar(),
    team: saved?.team ?? emptyTeam(),
    customers: saved?.customers ?? emptyCustomers(),
    services: saved?.services ?? seedServices(),
    products: saved?.products ?? seedProducts(),
    expenses,
    expenseCategories: saved?.expenseCategories ?? [],
    expensePayments: saved?.expensePayments ?? (saved?.expenses ? [] : seedExpensePayments(expenses)),
    suppliers: saved?.suppliers ?? seedSuppliers(expenses),
    goals: saved?.goals ?? [],
    security: saved?.security ?? { devices: {}, events: [] },
    signups: saved?.signups ?? [],
    settings: saved?.settings ? upgradeSettings(saved.settings) : seedSettings(),
    booking: saved?.booking ?? emptyBooking(),
    payroll: saved?.payroll ?? emptyPayroll(),
    register: saved?.register ?? emptyRegister(),
    inventory: saved?.inventory ?? emptyInventory(),
    frontDesk: saved?.frontDesk ?? emptyFrontDesk(),
    notificationsRead: saved?.notificationsRead ?? [],
    bookingSessions: new Map(),
    sessions: new Map(saved?.sessions ?? []),
    loginFailures: new Map(),
    loginLocks: new Map(),
    lockHistory: new Map(),
    unlockRequests: new Map(),
    codeRequests: new Map(),
    stepUps: new Map(),
    backupEmails: saved?.backupEmails ?? {},
    pendingBackupEmails: new Map(),
    feedback: [],
    feedbackUploads: [],
    persist() {
      try {
        storage()?.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: SCHEMA_VERSION, users: db.users, sessions: [...db.sessions.entries()], branding: db.branding, calendar: db.calendar, team: db.team, customers: db.customers, services: db.services, products: db.products, expenses: db.expenses, expenseCategories: db.expenseCategories, expensePayments: db.expensePayments, suppliers: db.suppliers, goals: db.goals, security: db.security, signups: db.signups, settings: db.settings, booking: db.booking, payroll: db.payroll, register: db.register, inventory: db.inventory, frontDesk: db.frontDesk, notificationsRead: db.notificationsRead, backupEmails: db.backupEmails } satisfies PersistedDb)
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
      db.expenseCategories = [];
      db.expensePayments = seedExpensePayments(db.expenses);
      db.suppliers = seedSuppliers(db.expenses);
      db.goals = [];
      db.security = { devices: {}, events: [] };
      db.signups = [];
      db.settings = seedSettings();
      db.booking = emptyBooking();
      db.payroll = emptyPayroll();
      db.register = emptyRegister();
      db.inventory = emptyInventory();
      db.frontDesk = emptyFrontDesk();
      db.notificationsRead = [];
      db.bookingSessions.clear();
      db.sessions.clear();
      db.loginFailures.clear();
      db.loginLocks.clear();
      db.lockHistory.clear();
      db.unlockRequests.clear();
      db.codeRequests.clear();
      db.stepUps.clear();
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

/** Las cuentas de la demo y las que se crearon con el registro. */
export const allAccounts = (): readonly MockAccount[] => [...ACCOUNTS, ...db.signups];

/** La cuenta con ese id (de la demo o del registro). */
export const accountById = (id: string | null | undefined): MockAccount | undefined => (id ? allAccounts().find((item) => item.id === id) : undefined);
