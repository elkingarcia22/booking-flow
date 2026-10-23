import { HttpResponse } from "msw";
import { accountById, db, type MockAccount, type MockTeamRole } from "./db";
import { applyDuePayoutChanges, liveTeamRole } from "./team/payoutSchedule";

/**
 * Quién llama, visto por el servidor: la cuenta de la sesión con su rol en la barbería y su ficha
 * de equipo. Con esto cada endpoint recorta lo que devuelve y rechaza lo que el rol no puede hacer,
 * en vez de confiar en que la pantalla lo esconda (docs/API_CONTRACT.md, «Permisos en el servidor»).
 */
export interface MockSession {
  account: MockAccount;
  teamRole: MockTeamRole;
  memberId: string;
}

export function sessionOf(request: Request): MockSession | null {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const accountId = token ? db.sessions.get(token) : undefined;
  const account = accountById(accountId);
  if (!account) return null;
  // Los cambios de forma de pago con fecha se aplican al llegar el día; el rol del barbero sigue al de su ficha.
  applyDuePayoutChanges();
  return { account, teamRole: liveTeamRole(account), memberId: account.user.memberId };
}

/** Dueño o administrador: gestionan la sucursal (nómina, configuración, equipo). */
export const isManager = (session: MockSession): boolean => session.teamRole === "owner" || session.teamRole === "admin";
export const isBarber = (session: MockSession): boolean => session.teamRole === "barbero-comision" || session.teamRole === "barbero-renta";

export const unauthorized = () => HttpResponse.json({ code: "unauthorized", message: "Tu sesión expiró." }, { status: 401 });
export const forbidden = (message = "Tu rol no puede hacer esto.") => HttpResponse.json({ code: "forbidden", message }, { status: 403 });

/**
 * Lo sensible (eliminar la barbería, claves de una pasarela, dar rol de dueño o administrador, el correo de
 * respaldo) pide confirmar la identidad con un código nuevo: la app manda `X-Step-Up` con el token que da
 * `POST /auth/step-up/verify`, que vale 5 minutos y solo para esa cuenta.
 */
export function hasStepUp(request: Request, now = Date.now()): boolean {
  const session = sessionOf(request);
  const token = request.headers.get("x-step-up");
  const entry = token ? db.stepUps.get(token) : undefined;
  return Boolean(session && entry && entry.accountId === session.account.id && entry.expiresAt > now);
}

export const stepUpRequired = () => HttpResponse.json({ code: "step_up_required", message: "Confirma que eres tú con el código que te enviamos." }, { status: 403 });
