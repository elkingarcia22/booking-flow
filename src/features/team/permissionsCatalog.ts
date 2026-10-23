import type { AppMessageKey } from "@/app/i18n/types";
import type { PermissionColumn, Permissions, TeamRole } from "./types";

/**
 * La matriz de permisos tal como se lee: los bloques, las filas con las
 * columnas que existen en cada una y los valores de fábrica de cada rol.
 * Los ids son los mismos que guarda el backend; aquí solo se les pone
 * nombre y se agrupan.
 */

export const PERMISSION_COLUMNS: readonly PermissionColumn[] = ["view", "create", "edit", "delete", "active"];

export const PERMISSION_COLUMN_KEYS: Record<PermissionColumn, AppMessageKey> = {
  view: "teamMember.permissions.view",
  create: "teamMember.permissions.create",
  edit: "teamMember.permissions.edit",
  delete: "teamMember.permissions.delete",
  active: "teamMember.permissions.active",
};

export interface PermissionRowSpec {
  id: string;
  labelKey: AppMessageKey;
  columns: readonly PermissionColumn[];
}

export interface PermissionBlockSpec {
  id: string;
  labelKey: AppMessageKey;
  rows: readonly PermissionRowSpec[];
}

const ALL: readonly PermissionColumn[] = ["view", "create", "edit", "delete", "active"];
const ACTIVE: readonly PermissionColumn[] = ["active"];

export const PERMISSION_BLOCKS: readonly PermissionBlockSpec[] = [
  {
    id: "bookings",
    labelKey: "teamMember.permissions.block.bookings",
    rows: [
      { id: "calendar", labelKey: "teamMember.permissions.row.calendar", columns: ACTIVE },
      { id: "appointments", labelKey: "teamMember.permissions.row.appointments", columns: ALL },
      { id: "block-calendar", labelKey: "teamMember.permissions.row.blockCalendar", columns: ALL },
      { id: "clients", labelKey: "teamMember.permissions.row.clients", columns: ALL },
      { id: "client-info", labelKey: "teamMember.permissions.row.clientInfo", columns: ACTIVE },
      { id: "import-clients", labelKey: "teamMember.permissions.row.importClients", columns: ACTIVE },
      { id: "export-clients", labelKey: "teamMember.permissions.row.exportClients", columns: ACTIVE },
    ],
  },
  {
    id: "team",
    labelKey: "teamMember.permissions.block.team",
    rows: [
      { id: "team", labelKey: "teamMember.permissions.row.team", columns: ALL },
      { id: "managers", labelKey: "teamMember.permissions.row.managers", columns: ALL },
      { id: "barber-payments", labelKey: "teamMember.permissions.row.barberPayments", columns: ACTIVE },
      { id: "levels", labelKey: "teamMember.permissions.row.levels", columns: ALL },
      { id: "lineup", labelKey: "teamMember.permissions.row.lineup", columns: ALL },
      { id: "barber-order", labelKey: "teamMember.permissions.row.barberOrder", columns: ALL },
    ],
  },
  { id: "metrics", labelKey: "teamMember.permissions.block.metrics", rows: [{ id: "kpis", labelKey: "teamMember.permissions.row.kpis", columns: ACTIVE }] },
  {
    id: "inventory",
    labelKey: "teamMember.permissions.block.inventory",
    rows: [
      { id: "products", labelKey: "teamMember.permissions.row.products", columns: ALL },
      { id: "product-categories", labelKey: "teamMember.permissions.row.categories", columns: ALL },
    ],
  },
  {
    id: "services",
    labelKey: "teamMember.permissions.block.services",
    rows: [
      { id: "services", labelKey: "teamMember.permissions.row.services", columns: ALL },
      { id: "service-categories", labelKey: "teamMember.permissions.row.categories", columns: ALL },
      { id: "service-lineup", labelKey: "teamMember.permissions.row.lineup", columns: ["view", "edit", "active"] },
    ],
  },
  { id: "pos", labelKey: "teamMember.permissions.block.pos", rows: [{ id: "prices", labelKey: "teamMember.permissions.row.prices", columns: ACTIVE }] },
  {
    id: "business",
    labelKey: "teamMember.permissions.block.business",
    rows: [
      { id: "closures", labelKey: "teamMember.permissions.row.closures", columns: ALL },
      { id: "payroll", labelKey: "teamMember.permissions.row.payroll", columns: ["view", "create", "edit"] },
      { id: "permissions", labelKey: "teamMember.permissions.row.permissions", columns: ["view", "edit", "active"] },
      { id: "account-settings", labelKey: "teamMember.permissions.row.accountSettings", columns: ["view", "edit", "active"] },
      { id: "expenses", labelKey: "teamMember.permissions.row.expenses", columns: ALL },
      // Ver las cuentas cobradas; editar es devolver un pago o reasignar a quién se le acredita.
      { id: "transactions", labelKey: "teamMember.permissions.row.transactions", columns: ["view", "edit"] },
    ],
  },
];

const ALL_ROWS = PERMISSION_BLOCKS.flatMap((block) => block.rows);

const full = (id: string): Permissions => {
  const row = ALL_ROWS.find((item) => item.id === id);
  return { [id]: Object.fromEntries((row?.columns ?? []).map((column) => [column, true])) };
};
const some = (id: string, columns: readonly PermissionColumn[]): Permissions => ({ [id]: Object.fromEntries(columns.map((column) => [column, true])) });
const merge = (...parts: Permissions[]): Permissions => Object.assign({}, ...parts);

/**
 * Los permisos con los que nace cada rol; después se personalizan por persona.
 *
 * Es la matriz de fábrica de producción (centro de ayuda, «Tabla de permisos por rol»;
 * docs/roles/05-configuracion.md §2) con tres decisiones encima (docs/ROLES_PLAN.md):
 * - el barbero por comisión no ve los gastos de la sucursal (era la renta del local, entre otros);
 * - recepción no ve Métricas: cobra y agenda, pero no lleva los números del negocio;
 * - Transacciones tiene su fila: recepción las ve (las del día), el de renta las suyas.
 * Lo que un barbero ve «suyo» (su columna, sus clientes, sus cifras) no sale de aquí sino del
 * alcance de su rol (`features/access`).
 */
export const ROLE_DEFAULT_PERMISSIONS: Readonly<Record<TeamRole, Permissions>> = {
  owner: merge(...ALL_ROWS.map((row) => full(row.id))),
  admin: merge(
    ...ALL_ROWS.filter((row) => !["barber-payments", "barber-order", "export-clients"].includes(row.id)).map((row) => full(row.id))
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

/** Cuántas casillas hay marcadas sobre cuántas existen. */
export function permissionSummary(permissions: Permissions): { granted: number; total: number } {
  let granted = 0;
  let total = 0;
  for (const row of ALL_ROWS) {
    for (const column of row.columns) {
      total += 1;
      if (permissions[row.id]?.[column]) granted += 1;
    }
  }
  return { granted, total };
}

/** Las secciones del menú que esa persona ve: las filas con «Ver» (o «Activo» cuando es lo único que hay). */
export function visibleSections(permissions: Permissions): string[] {
  return ALL_ROWS.filter((row) => (row.columns.includes("view") ? permissions[row.id]?.view : permissions[row.id]?.active)).map((row) => row.id);
}
