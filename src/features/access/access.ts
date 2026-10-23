import { ROLE_DEFAULT_PERMISSIONS } from "@/features/team/permissionsCatalog";
import type { PermissionColumn, Permissions, TeamRole } from "@/features/team/types";

/**
 * Quién está mirando y qué puede hacer: el rol con el que entra, su ficha de
 * equipo (si es barbero, «lo suyo» se recorta por ella) y sus permisos.
 *
 * Es la única fuente para decidir qué se ve: el menú, las rutas, los filtros
 * de cada pantalla y los botones preguntan aquí, no al rol a mano. El mapa de
 * qué ve cada rol en cada módulo está en docs/ROLES_PLAN.md y docs/roles/.
 */

/** Todo lo de la sucursal o solo lo suyo (su columna, sus clientes, sus cifras). */
export type AccessScope = "all" | "own";

export interface AccessMember {
  id: string;
  name: string;
}

export interface Access {
  role: TeamRole;
  /** La ficha de equipo de quien mira; con ella se recorta «lo suyo». */
  member: AccessMember | null;
  permissions: Permissions;
  scope: AccessScope;
  isBarber: boolean;
  /** Se está mirando como otro rol («Ver como»), no con el propio. */
  previewing: boolean;
  /** Si tiene esa casilla de la matriz (por defecto, «Ver»). */
  can: (row: string, column?: PermissionColumn) => boolean;
}

export const TEAM_ROLES: readonly TeamRole[] = ["owner", "admin", "recepcion", "barbero-comision", "barbero-renta"];

export const isBarberRole = (role: TeamRole): boolean => role === "barbero-comision" || role === "barbero-renta";

/**
 * Dónde aterriza cada rol (producción: el barbero entra al calendario y el
 * dueño a Inicio; recepción vive en el calendario).
 */
export const ROLE_HOME: Readonly<Record<TeamRole, string>> = {
  owner: "/metricas",
  admin: "/metricas",
  recepcion: "/calendario",
  "barbero-comision": "/calendario",
  "barbero-renta": "/calendario",
};

/**
 * La sesión todavía trae el rol de la plantilla (`admin | manager | member`) y no
 * dice qué ficha de equipo es la persona. Mientras el contrato no traiga
 * `teamRole` y `memberId`, se traduce aquí.
 */
export function teamRoleFromSession(role: string | undefined): TeamRole {
  // Primero los de la plantilla: su `admin` es quien administra la cuenta (la dueña en el
  // equipo de prueba, Carolina Vargas), no el administrador de una locación.
  if (role === "admin") return "owner";
  if (role === "manager") return "admin";
  if (role === "member") return "recepcion";
  if (role && (TEAM_ROLES as readonly string[]).includes(role)) return role as TeamRole;
  // Falla cerrado: un rol que no se reconoce ve lo mínimo (lo suyo de barbero), nunca lo del dueño.
  return "barbero-comision";
}

/**
 * «Ver como» solo hacia abajo: el dueño revisa cualquier rol; el administrador, todos menos el
 * dueño; el resto solo se ve a sí mismo. Así nadie se asoma a pantallas que su rol no abre.
 */
const VIEWABLE: Readonly<Record<TeamRole, readonly TeamRole[]>> = {
  owner: TEAM_ROLES,
  admin: ["admin", "recepcion", "barbero-comision", "barbero-renta"],
  recepcion: ["recepcion"],
  "barbero-comision": ["barbero-comision"],
  "barbero-renta": ["barbero-renta"],
};

export const canViewAs = (own: TeamRole, target: TeamRole): boolean => VIEWABLE[own].includes(target);

/**
 * Una persona de ejemplo por rol en la sucursal principal (el seed del equipo), para
 * que «Ver como» enseñe la plataforma de alguien real: su columna, sus clientes, su
 * pago. Cuando la sesión traiga `memberId`, la propia persona sale de ahí.
 */
export const DEMO_MEMBER: Readonly<Record<TeamRole, AccessMember>> = {
  owner: { id: "team-01", name: "Carolina Vargas" },
  admin: { id: "team-02", name: "Mateo Herrera" },
  recepcion: { id: "team-03", name: "Lucía Bernal" },
  "barbero-comision": { id: "team-04", name: "Andrés Beltrán" },
  "barbero-renta": { id: "team-30", name: "Paola Zuluaga" },
};

export function buildAccess({ role, member = DEMO_MEMBER[role], permissions = ROLE_DEFAULT_PERMISSIONS[role], previewing = false }: { role: TeamRole; member?: AccessMember | null; permissions?: Permissions; previewing?: boolean }): Access {
  const isBarber = isBarberRole(role);
  return {
    role,
    member,
    permissions,
    scope: isBarber ? "own" : "all",
    isBarber,
    previewing,
    // El dueño tiene acceso total aunque su matriz exista (producción).
    can: (row, column = "view") => role === "owner" || Boolean(permissions[row]?.[column] ?? (column === "view" ? permissions[row]?.active : false)),
  };
}

/** Las áreas de la plataforma que se abren o no según el rol. */
export type AccessArea =
  | "metrics"
  | "calendar"
  | "customers"
  | "team"
  | "services"
  | "products"
  | "expenses"
  | "payroll"
  | "transactions"
  | "settings"
  | "designSystem"
  /** «Lo que llevo» (comisión) o «Mi negocio» (renta): el pago del propio barbero. */
  | "myPay";

/**
 * Si un área se abre. Casi todas salen de la matriz; dos excepciones:
 * - Métricas: el barbero no tiene «Indicadores empresariales», pero ve las suyas (producción las enseña con sus cifras);
 * - el sistema de diseño es una herramienta interna, solo para quien administra.
 */
export function canOpen(access: Access, area: AccessArea): boolean {
  switch (area) {
    case "metrics":
      return access.can("kpis", "active") || access.isBarber;
    case "calendar":
      return access.can("calendar", "active");
    case "customers":
      return access.can("clients");
    case "team":
      return access.can("team");
    case "services":
      return access.can("services");
    case "products":
      return access.can("products");
    case "expenses":
      return access.can("expenses");
    case "payroll":
      return access.can("payroll");
    case "transactions":
      return access.can("transactions");
    case "settings":
      return access.can("account-settings");
    case "designSystem":
      return access.role === "owner" || access.role === "admin";
    case "myPay":
      return access.isBarber;
  }
}
