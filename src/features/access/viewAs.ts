import { TEAM_ROLES } from "./access";
import type { TeamRole } from "@/features/team/types";

/**
 * «Ver como» se recuerda entre recargas: quien revisa cómo ve la plataforma un
 * barbero no quiere volver a elegirlo cada vez. Es una preferencia del
 * navegador, no de la sesión: el token sigue siendo el mismo.
 */
const STORAGE_KEY = "thema.viewAs.v1";

export function readViewAs(): TeamRole | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && (TEAM_ROLES as readonly string[]).includes(stored) ? (stored as TeamRole) : null;
  } catch {
    return null;
  }
}

export function writeViewAs(role: TeamRole | null): void {
  try {
    if (role) window.localStorage.setItem(STORAGE_KEY, role);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Almacenamiento bloqueado: se mira como el rol elegido hasta recargar.
  }
}
