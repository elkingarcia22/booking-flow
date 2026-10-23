import * as React from "react";
import { Navigate } from "react-router";
import { canOpen, ROLE_HOME, type Access, type AccessArea } from "./access";
import { AccessContext, useAccess } from "./useAccess";

/** Lo monta el layout de la app con el rol efectivo (el propio o el de «Ver como»). */
export function AccessProvider({ value, children }: { value: Access; children: React.ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

/** Una ruta que solo se abre si el rol tiene el área; si no, «Sin permiso». */
export function RequireArea({ area, children }: { area: AccessArea; children: React.ReactNode }) {
  const access = useAccess();
  return canOpen(access, area) ? <>{children}</> : <Navigate to="/403" replace />;
}

/** La raíz lleva a donde aterriza cada rol. */
export function RoleHome() {
  const access = useAccess();
  return <Navigate to={ROLE_HOME[access.role]} replace />;
}
