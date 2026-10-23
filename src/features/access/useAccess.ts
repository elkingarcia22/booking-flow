import * as React from "react";
import { buildAccess, type Access } from "./access";

export const AccessContext = React.createContext<Access | null>(null);

/** Fuera del layout (pruebas de una pantalla suelta, la doc) se mira como dueño: se ve todo. */
const FALLBACK = buildAccess({ role: "owner" });

export function useAccess(): Access {
  return React.useContext(AccessContext) ?? FALLBACK;
}
