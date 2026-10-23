import { galleryFor, TEAM_PHOTOS } from "../media";

/**
 * El equipo del backend simulado: las personas de las cuatro sucursales con
 * todo lo que guarda su ficha (perfil, servicios, compensación o pagos,
 * horario fijo, permisos y opciones), los niveles, el orden de los barberos
 * y las excepciones de horario de una semana concreta.
 *
 * Son las mismas 25 personas del home de equipo (`features/team/teamHome.tsx`)
 * con los mismos ids, para que la lista y la ficha hablen de la misma gente.
 */

export type MockTeamRole = "owner" | "admin" | "recepcion" | "barbero-comision" | "barbero-renta";
export type MockTeamStatus = "active" | "invited" | "inactive";

export interface MockWorkingRange {
  start: string;
  end: string;
  /** Turno partido: los descansos del día dentro de la franja (el almuerzo). */
  breaks?: { start: string; end: string }[];
}

/** Lo que hace falta en los últimos 90 días (y de antigüedad) para llegar a un nivel; `null` = no se mide. */
export interface MockLevelCriteria {
  services90: number | null;
  rebookRate: number | null;
  rating: number | null;
  months: number | null;
}

export interface MockLevel {
  id: string;
  name: string;
  /** Cuánto sobre el precio de la carta cobra quien está en este nivel (1 = el precio de la carta). */
  priceFactor?: number;
  criteria?: MockLevelCriteria;
}

export interface MockServiceOverride {
  serviceId: string;
  offered: boolean;
  price: number | null;
  newClientPrice: number | null;
  loyaltyPrice: number | null;
  durationMin: number | null;
  splitCommission: number | null;
  extraCommission: number | null;
}

export type MockCompensationType = "commission" | "scale" | "salary";

export interface MockCompensation {
  type: MockCompensationType;
  basic: number;
  recurring: number | null;
  walkIn: number | null;
  noPreference: number | null;
  newClient: number | null;
  productPercent: number | null;
  salary: number | null;
  scale: { from: number; percent: number }[];
}

export interface MockPayments {
  rentBase: number;
  walkInDeduction: number;
  newClientDeduction: number;
  noPreferenceDeduction: number;
  bankName: string;
  accountNumber: string;
}

export type MockPermissionColumn = "view" | "create" | "edit" | "delete" | "active";
export type MockPermissions = Record<string, Partial<Record<MockPermissionColumn, boolean>>>;

export type MockReminderChannel = "email" | "sms" | "push";

export interface MockMemberOptions {
  tips: boolean;
  multipleAppointments: boolean;
  newClients: boolean;
  clientCancel: { enabled: boolean; channels: MockReminderChannel[]; hours: number; minutes: number };
  intervalMinutes: number;
  reminders: { channel: MockReminderChannel; hours: number; minutes: number }[];
  social: string;
  link: string;
}

export interface MockTeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: MockTeamRole;
  /** Sucursal de origen: donde se creó. */
  homeBranchId: string;
  /** Sucursales donde está activa. */
  branchIds: string[];
  status: MockTeamStatus;
  avatarUrl: string | null;
  /** El código personal; dato sensible. */
  code: string;
  description: string;
  instagram: string;
  facebook: string;
  bookingVisible: boolean;
  levelId: string | null;
  skills: string[];
  gallery: string[];
  /** Un gerente que además atiende. */
  isAlsoBarber: boolean;
  services: MockServiceOverride[];
  compensation: MockCompensation | null;
  payments: MockPayments | null;
  /** Horario fijo por día de la semana (0 = domingo); `null` = no trabaja. */
  schedule: Record<string, MockWorkingRange | null>;
  permissions: MockPermissions;
  options: MockMemberOptions;
  createdAt: string;
  /** La última vez que se le mandó (o recordó) la invitación; con ella no se le insiste dos veces el mismo día. */
  lastInviteAt?: string;
  /** Cuándo se desactivó: deja de salir en la agenda y en la reserva, pero su historia queda. */
  deactivatedAt?: string;
}

/**
 * Una ausencia: vacaciones, incapacidad, un permiso. Quien va por comisión o salario la pide y el
 * dueño o el administrador la aprueba; el barbero de renta la registra sin aprobación (ROLES_PLAN #4).
 * Aprobada, se vuelve un bloqueo en el calendario.
 */
export interface MockAbsence {
  id: string;
  memberId: string;
  branchId: string;
  kind: "vacation" | "sick" | "personal";
  /** AAAA-MM-DD, ambos incluidos. */
  startDate: string;
  endDate: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** Por qué se rechazó. */
  reason: string | null;
  /** El bloqueo que creó al aprobarse. */
  blockId: string | null;
}

export interface MockLineupEntry {
  memberId: string;
  enabled: boolean;
}

export interface MockBranchOrder {
  branchId: string;
  calendar: string[];
  walkIn: MockLineupEntry[];
  noPreference: MockLineupEntry[];
}

export interface MockScheduleOverride {
  id: string;
  memberId: string;
  /** AAAA-MM-DD. */
  date: string;
  /** `null` = ese día no trabaja. */
  range: MockWorkingRange | null;
}

/* ------------------------------------------------------------- permisos */

/**
 * La matriz: cada fila dice qué columnas tiene. Los ids son estables y el
 * front los traduce. Es la misma matriz de Configuración › Permisos.
 */
export const PERMISSION_ROWS: readonly { id: string; block: string; columns: readonly MockPermissionColumn[] }[] = [
  { id: "calendar", block: "bookings", columns: ["active"] },
  { id: "appointments", block: "bookings", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "block-calendar", block: "bookings", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "clients", block: "bookings", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "client-info", block: "bookings", columns: ["active"] },
  { id: "import-clients", block: "bookings", columns: ["active"] },
  { id: "export-clients", block: "bookings", columns: ["active"] },
  { id: "team", block: "team", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "managers", block: "team", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "barber-payments", block: "team", columns: ["active"] },
  { id: "levels", block: "team", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "lineup", block: "team", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "barber-order", block: "team", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "kpis", block: "metrics", columns: ["active"] },
  { id: "products", block: "inventory", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "product-categories", block: "inventory", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "services", block: "services", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "service-categories", block: "services", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "service-lineup", block: "services", columns: ["view", "edit", "active"] },
  { id: "prices", block: "pos", columns: ["active"] },
  { id: "closures", block: "business", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "payroll", block: "business", columns: ["view", "create", "edit"] },
  { id: "permissions", block: "business", columns: ["view", "edit", "active"] },
  { id: "account-settings", block: "business", columns: ["view", "edit", "active"] },
  { id: "expenses", block: "business", columns: ["view", "create", "edit", "delete", "active"] },
  { id: "transactions", block: "business", columns: ["view", "edit"] },
];

const full = (id: string): MockPermissions => {
  const row = PERMISSION_ROWS.find((item) => item.id === id);
  return { [id]: Object.fromEntries((row?.columns ?? []).map((column) => [column, true])) };
};
const some = (id: string, columns: readonly MockPermissionColumn[]): MockPermissions => ({ [id]: Object.fromEntries(columns.map((column) => [column, true])) });
const merge = (...parts: MockPermissions[]): MockPermissions => Object.assign({}, ...parts);

/** Los permisos de fábrica de cada rol: los mismos que `ROLE_DEFAULT_PERMISSIONS` (features/team/permissionsCatalog.ts). */
export const ROLE_PERMISSION_DEFAULTS: Readonly<Record<MockTeamRole, MockPermissions>> = {
  owner: merge(...PERMISSION_ROWS.map((row) => full(row.id))),
  admin: merge(
    ...PERMISSION_ROWS.filter((row) => !["barber-payments", "barber-order", "export-clients"].includes(row.id)).map((row) => full(row.id))
  ),
  recepcion: merge(
    full("calendar"),
    full("appointments"),
    full("block-calendar"),
    some("clients", ["view", "create", "edit", "active"]),
    full("client-info"),
    full("import-clients"),
    some("products", ["view"]),
    some("product-categories", ["view"]),
    full("prices"),
    some("account-settings", ["view", "edit"]),
    some("transactions", ["view"])
  ),
  "barbero-comision": merge(
    full("calendar"),
    full("appointments"),
    some("block-calendar", ["view", "active"]),
    some("clients", ["view", "create", "active"]),
    some("team", ["view"]),
    full("prices"),
    some("account-settings", ["view"])
  ),
  "barbero-renta": merge(
    full("calendar"),
    full("appointments"),
    full("block-calendar"),
    full("clients"),
    full("import-clients"),
    full("export-clients"),
    full("prices"),
    some("account-settings", ["view"]),
    full("expenses"),
    some("transactions", ["view"])
  ),
};

/* -------------------------------------------------------------- niveles */

/** Turno partido: el mismo descanso todos los días que trabaja (el almuerzo). */
const withBreak = (schedule: Record<string, MockWorkingRange | null>, pause: { start: string; end: string }): Record<string, MockWorkingRange | null> =>
  Object.fromEntries(Object.entries(schedule).map(([day, range]) => [day, range ? { ...range, breaks: [pause] } : null]));

/** Los niveles, del primero al último: el orden es el camino de ascenso. */
export const LEVELS: readonly MockLevel[] = [
  { id: "lvl_aprendiz", name: "Aprendiz", priceFactor: 0.8, criteria: { services90: null, rebookRate: null, rating: null, months: null } },
  { id: "lvl_junior", name: "Junior", priceFactor: 0.9, criteria: { services90: 60, rebookRate: null, rating: 4.3, months: 3 } },
  { id: "lvl_senior", name: "Senior", priceFactor: 1, criteria: { services90: 150, rebookRate: 40, rating: 4.5, months: 12 } },
  { id: "lvl_master", name: "Master", priceFactor: 1.25, criteria: { services90: 250, rebookRate: 55, rating: 4.7, months: 24 } },
];

/* ------------------------------------------------------------- personas */

const DEFAULT_OPTIONS: MockMemberOptions = {
  tips: true,
  multipleAppointments: false,
  newClients: true,
  clientCancel: { enabled: true, channels: ["sms", "push"], hours: 2, minutes: 0 },
  intervalMinutes: 30,
  reminders: [{ channel: "push", hours: 0, minutes: 15 }],
  social: "",
  link: "",
};

const DEFAULT_COMMISSION: MockCompensation = { type: "commission", basic: 40, recurring: 45, walkIn: 35, noPreference: 35, newClient: 50, productPercent: 10, salary: null, scale: [] };

const DEFAULT_PAYMENTS: MockPayments = { rentBase: 320, walkInDeduction: 20, newClientDeduction: 20, noPreferenceDeduction: 15, bankName: "Bank of America", accountNumber: "000123454471" };

type Days = readonly number[];
const MON_SAT: Days = [1, 2, 3, 4, 5, 6];
const MON_FRI: Days = [1, 2, 3, 4, 5];
const TUE_SAT: Days = [2, 3, 4, 5, 6];
const WED_SAT: Days = [3, 4, 5, 6];

const week = (days: Days, start: string, end: string, extra: Record<string, MockWorkingRange | null> = {}): Record<string, MockWorkingRange | null> => ({
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [String(day), days.includes(day) ? { start, end } : null])),
  ...extra,
});

const NO_SCHEDULE = week([], "09:00", "18:00");

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".");

interface Draft {
  status?: MockTeamStatus;
  levelId?: string | null;
  schedule?: Record<string, MockWorkingRange | null>;
  branchIds?: string[];
  isAlsoBarber?: boolean;
  description?: string;
  instagram?: string;
  facebook?: string;
  skills?: string[];
  bookingVisible?: boolean;
  compensation?: Partial<MockCompensation>;
  payments?: Partial<MockPayments>;
  options?: Partial<MockMemberOptions>;
}

function person(index: number, firstName: string, lastName: string, role: MockTeamRole, branchId: string, draft: Draft = {}): MockTeamMember {
  const isBarber = role === "barbero-comision" || role === "barbero-renta";
  const id = `team-${String(index).padStart(2, "0")}`;
  return {
    id,
    firstName,
    lastName,
    email: `${slug(`${firstName} ${lastName}`)}@barberia.com`,
    phone: `+1 617 555 0${String(100 + index).slice(-3)}`,
    role,
    homeBranchId: branchId,
    branchIds: draft.branchIds ?? (role === "owner" ? ["ma", "nc", "ri", "ut"] : [branchId]),
    status: draft.status ?? "active",
    avatarUrl: TEAM_PHOTOS[id] ?? null,
    code: String(4000 + index * 7),
    description: draft.description ?? "",
    // Demo: los barberos traen sus redes para que el perfil de reserva las muestre (Facebook, solo en la mitad).
    instagram: draft.instagram ?? (isBarber ? `https://instagram.com/${slug(`${firstName} ${lastName}`).replace(/-/g, ".")}` : ""),
    facebook: draft.facebook ?? (isBarber && index % 2 === 0 ? `https://facebook.com/${slug(`${firstName} ${lastName}`).replace(/-/g, ".")}` : ""),
    bookingVisible: draft.bookingVisible ?? true,
    levelId: isBarber ? (draft.levelId === undefined ? "lvl_senior" : draft.levelId) : null,
    skills: draft.skills ?? (isBarber ? ["Corte clásico", "Barba"] : []),
    gallery: isBarber && (draft.status ?? "active") === "active" ? galleryFor(index) : [],
    isAlsoBarber: draft.isAlsoBarber ?? false,
    services: [],
    compensation: role === "barbero-comision" ? { ...DEFAULT_COMMISSION, ...draft.compensation } : null,
    payments: role === "barbero-renta" ? { ...DEFAULT_PAYMENTS, ...draft.payments } : null,
    schedule: draft.schedule ?? (isBarber ? week(MON_SAT, "09:00", "18:00") : NO_SCHEDULE),
    permissions: ROLE_PERMISSION_DEFAULTS[role],
    options: { ...DEFAULT_OPTIONS, ...draft.options },
    createdAt: new Date(Date.UTC(2026, 0, 6 + index * 3)).toISOString(),
  };
}

export function seedTeam(): MockTeamMember[] {
  return [
    person(1, "Carolina", "Vargas", "owner", "ma", { isAlsoBarber: false }),
    person(2, "Mateo", "Herrera", "admin", "ma"),
    person(3, "Lucía", "Bernal", "recepcion", "ma"),
    person(4, "Andrés", "Beltrán", "barbero-comision", "ma", { levelId: "lvl_master", schedule: week(MON_SAT, "09:00", "19:00"), description: "Especialista en corte clásico y barba a navaja.", instagram: "https://instagram.com/andres.barber", facebook: "https://facebook.com/andres.barber", skills: ["Corte clásico", "Barba a navaja", "Fade"], compensation: { basic: 45, recurring: 50 } }),
    person(29, "Emilio", "Arango", "barbero-comision", "ma", { levelId: "lvl_junior", schedule: week(MON_SAT, "10:00", "19:00"), skills: ["Corte clásico", "Fade", "Corte niño"] }),
    person(30, "Paola", "Zuluaga", "barbero-renta", "ma", { levelId: "lvl_senior", schedule: week(TUE_SAT, "09:00", "17:00"), instagram: "https://instagram.com/paola.cuts", skills: ["Barba a navaja", "Barba", "Diseño", "Corte clásico"] }),
    person(5, "Nicolás", "Duarte", "barbero-comision", "ma", { levelId: "lvl_senior", schedule: withBreak(week(TUE_SAT, "10:00", "20:00"), { start: "14:00", end: "15:00" }), skills: ["Fade", "Diseño", "Barba"] }),
    person(6, "Valeria", "Marín", "barbero-renta", "ma", { levelId: "lvl_master", schedule: week(MON_FRI, "08:00", "16:00"), bookingVisible: true, options: { newClients: false }, skills: ["Corte clásico", "Barba a navaja", "Tratamientos"] }),
    person(7, "Tomás", "Peña", "barbero-renta", "ma", { levelId: "lvl_junior", schedule: week(WED_SAT, "12:00", "22:00"), skills: ["Fade", "Corte clásico", "Corte niño"] }),
    person(8, "Daniela", "Osorio", "barbero-comision", "ma", { levelId: "lvl_senior", schedule: week(MON_SAT, "09:00", "18:00", { "3": { start: "09:00", end: "13:00" } }), skills: ["Color", "Tratamientos", "Corte clásico"], compensation: { type: "salary", salary: 650 } }),
    person(9, "Julián", "Cifuentes", "barbero-comision", "ma", { status: "invited", levelId: "lvl_aprendiz", schedule: NO_SCHEDULE, skills: [] }),
    // Massachusetts es la sucursal grande a propósito: con once barberos la
    // agenda del día no cabe en pantalla y se desplaza a lo ancho (diez trabajando un viernes).
    person(26, "Samuel", "Pardo", "barbero-comision", "ma", { levelId: "lvl_senior", schedule: week(MON_SAT, "09:00", "18:00"), skills: ["Fade", "Barba", "Corte clásico"] }),
    person(27, "Martín", "Quiroga", "barbero-renta", "ma", { levelId: "lvl_junior", schedule: week(TUE_SAT, "11:00", "20:00"), skills: ["Corte clásico", "Barba", "Corte niño"] }),
    person(28, "Lorena", "Lemos", "barbero-comision", "ma", { levelId: "lvl_master", schedule: week(MON_FRI, "08:00", "17:00"), skills: ["Color", "Diseño", "Tratamientos"], compensation: { basic: 45, recurring: 50 } }),

    person(10, "Valentina", "Ruiz", "admin", "nc"),
    person(11, "Camilo", "Restrepo", "barbero-comision", "nc", { levelId: "lvl_senior", schedule: week(MON_SAT, "09:00", "18:00"), skills: ["Fade", "Barba", "Diseño"] }),
    person(12, "Manuela", "Salgado", "barbero-renta", "nc", { levelId: "lvl_master", schedule: week(TUE_SAT, "11:00", "20:00"), skills: ["Corte clásico", "Barba a navaja", "Color"] }),
    person(13, "Esteban", "Lara", "barbero-renta", "nc", { levelId: "lvl_junior", schedule: week(MON_FRI, "10:00", "17:00"), skills: ["Corte clásico", "Corte niño", "Fade"] }),
    person(14, "Paula", "Cárdenas", "recepcion", "nc"),
    person(15, "Samuel", "Ortiz", "barbero-comision", "nc", { status: "invited", levelId: null, schedule: NO_SCHEDULE }),

    person(16, "Diego", "Salazar", "admin", "ri"),
    person(17, "Renata", "Méndez", "recepcion", "ri"),
    person(18, "Juliana", "Prieto", "barbero-comision", "ri", { levelId: "lvl_master", schedule: week(MON_SAT, "09:00", "18:00"), skills: ["Corte clásico", "Barba a navaja", "Tratamientos"] }),
    person(19, "Felipe", "Guzmán", "barbero-comision", "ri", { levelId: "lvl_senior", schedule: week(TUE_SAT, "12:00", "21:00"), skills: ["Fade", "Diseño", "Barba"] }),
    person(20, "Antonia", "Vélez", "barbero-renta", "ri", { levelId: "lvl_senior", schedule: week(MON_FRI, "08:00", "15:00"), skills: ["Corte clásico", "Color", "Corte niño"] }),
    person(21, "Rubén", "Castaño", "barbero-renta", "ri", { status: "inactive", levelId: "lvl_junior", schedule: NO_SCHEDULE }),

    person(22, "Ana", "Torres", "admin", "ut"),
    person(23, "Santiago", "Rico", "barbero-comision", "ut", { levelId: "lvl_senior", schedule: week(MON_SAT, "09:00", "18:00"), skills: ["Fade", "Barba", "Corte clásico"] }),
    person(24, "Gabriela", "Nieto", "barbero-renta", "ut", { levelId: "lvl_master", schedule: week(TUE_SAT, "10:00", "19:00"), skills: ["Corte clásico", "Barba a navaja", "Diseño"] }),
    person(25, "Isabella", "Franco", "recepcion", "ut", { status: "invited" }),
  ];
}

export const isBarberRole = (role: MockTeamRole): boolean => role === "barbero-comision" || role === "barbero-renta";

/** Los barberos activos en una sucursal, en su orden de calendario. */
export function barbersOf(members: readonly MockTeamMember[], orders: readonly MockBranchOrder[], branchId: string): MockTeamMember[] {
  const order = orders.find((item) => item.branchId === branchId)?.calendar ?? [];
  const list = members.filter((member) => (isBarberRole(member.role) || member.isAlsoBarber) && member.status !== "inactive" && member.branchIds.includes(branchId));
  return [...list].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
  });
}

export function seedOrders(members: readonly MockTeamMember[]): MockBranchOrder[] {
  return ["ma", "nc", "ri", "ut"].map((branchId) => {
    const ids = members.filter((member) => isBarberRole(member.role) && member.branchIds.includes(branchId)).map((member) => member.id);
    return {
      branchId,
      calendar: ids,
      walkIn: ids.map((memberId, index) => ({ memberId, enabled: index % 3 !== 2 })),
      noPreference: ids.map((memberId, index) => ({ memberId, enabled: index % 4 !== 3 })),
    };
  });
}

/** Las plantillas de partida de cada sede: lo que más se repite en una barbería. */
export function seedTemplates(): import("./scheduleModel").MockScheduleTemplate[] {
  const week = (range: MockWorkingRange | null, saturday: MockWorkingRange | null, sunday: MockWorkingRange | null = null) => ({ "0": sunday, "1": range, "2": range, "3": range, "4": range, "5": range, "6": saturday });
  const morning = { start: "08:00", end: "14:00" };
  const afternoon = { start: "13:00", end: "20:00" };
  const split = { start: "09:00", end: "19:00", breaks: [{ start: "13:00", end: "14:00" }] };
  return ["ma", "mb"].flatMap((branchId) => [
    { id: `tpl_${branchId}_morning`, branchId, name: "Mañana", cycleWeeks: 1, weeks: [week(morning, morning)] },
    { id: `tpl_${branchId}_afternoon`, branchId, name: "Tarde", cycleWeeks: 1, weeks: [week(afternoon, afternoon)] },
    { id: `tpl_${branchId}_split`, branchId, name: "Turno partido", cycleWeeks: 1, weeks: [week(split, { start: "09:00", end: "15:00" })] },
    // Rotación de dos semanas: una de mañana con sábado y otra de tarde con el sábado libre.
    { id: `tpl_${branchId}_rotation`, branchId, name: "Rotación mañana / tarde", cycleWeeks: 2, weeks: [week(morning, morning), week(afternoon, null)] },
  ]);
}

/** Una semana con dos excepciones para que se vean. */
export function seedOverrides(): MockScheduleOverride[] {
  return [
    { id: "ovr_1", memberId: "team-05", date: "2026-09-26", range: null },
    { id: "ovr_2", memberId: "team-04", date: "2026-09-28", range: { start: "12:00", end: "19:00" } },
  ];
}

export const memberName = (member: Pick<MockTeamMember, "firstName" | "lastName">): string => `${member.firstName} ${member.lastName}`;
