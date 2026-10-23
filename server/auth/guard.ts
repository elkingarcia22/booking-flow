import { isSameOrigin, jsonError, quotaExceeded, rateLimited, type Quota } from "../http/request.js";
import { requireSession, type ServerClaims, type SessionScope } from "./session.js";

/**
 * La puerta de las funciones que cuestan dinero: que no venga de otro sitio, que traiga una sesión
 * firmada con el alcance que toca, que la IP no esté martillando y que esa sesión no haya gastado ya
 * su cupo. Devuelve la sesión o la respuesta de rechazo.
 */
export interface PaidGuard {
  /** Nombre del cupo (`tts`, `clipper`…): cada función lleva la cuenta aparte. */
  name: string;
  /** Por sesión: por minuto y por día. */
  quota: Quota;
  /** Por IP y minuto: el freno de quien no tiene sesión y prueba tokens. */
  ipPerMinute: number;
  scopes?: readonly SessionScope[];
}

export function guardPaid(request: Request, guard: PaidGuard): ServerClaims | Response {
  if (!isSameOrigin(request)) return jsonError(403, "forbidden", "Origen no permitido.");
  if (rateLimited(request, guard.name, guard.ipPerMinute, 60_000)) return jsonError(429, "rate_limited", "Demasiadas peticiones. Espera un momento.");
  const session = requireSession(request, { scopes: guard.scopes });
  if (session instanceof Response) return session;
  if (quotaExceeded(session.sub, guard.name, guard.quota)) return jsonError(429, "quota_exceeded", "Llegaste al tope de uso por ahora. Inténtalo más tarde.");
  return session;
}
