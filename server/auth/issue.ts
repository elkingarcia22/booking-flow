import { jsonError, rateLimited } from "../http/request.js";
import { randomUUID } from "node:crypto";
import { DEMO_ACCOUNTS, DEMO_OTP_CODE, DEMO_TENANT, normalizePhone } from "./demoAccounts.js";
import { GUEST_TTL_S, STAFF_TTL_S, readSessionSecret, signSession } from "./session.js";

/**
 * Emitir la sesión firmada. Dos puertas:
 * - `staff`: celular + código de una cuenta de la demo. Es el sustituto del backend real, que la emitirá
 *   al entrar; `SESSION_DEMO_LOGIN=off` lo apaga en cuanto ese backend exista.
 * - `guest`: el cliente en la reserva en línea, sin cuenta: media hora y solo la voz de Clipper.
 */

const serverEnv = (): Record<string, string | undefined> => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** Intentos de entrar por IP y minuto: un código de 6 dígitos no se adivina a este ritmo. */
const STAFF_PER_MINUTE = 10;
/** Sesiones de invitado por IP cada 10 minutos: de sobra para quien reserva, poco para quien abusa. */
const GUEST_PER_WINDOW = 5;
const GUEST_WINDOW_MS = 10 * 60_000;

export function issueStaffSession(request: Request, body: unknown, env: Record<string, string | undefined> = serverEnv()): Response {
  if (env.SESSION_DEMO_LOGIN?.trim() === "off") return jsonError(404, "not_found", "La sesión la emite el backend al entrar.");
  const secret = readSessionSecret(env);
  if (!secret) return jsonError(503, "session_not_configured", "Falta SESSION_SECRET en el servidor.");
  if (rateLimited(request, "session", STAFF_PER_MINUTE, 60_000)) return jsonError(429, "rate_limited", "Demasiados intentos. Espera un momento.");
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const account = DEMO_ACCOUNTS.find((item) => item.phone === normalizePhone(record.phone));
  const code = env.DEMO_OTP_CODE?.trim() || DEMO_OTP_CODE;
  if (!account || record.code !== code) return jsonError(401, "invalid_code", "El celular o el código no son válidos.");
  const ttl = STAFF_TTL_S;
  const token = signSession({ sub: account.sub, tid: DEMO_TENANT, role: account.role, mid: account.mid, scope: "staff" }, secret, ttl);
  return json(200, { token, expiresIn: ttl });
}

export function issueGuestSession(request: Request, env: Record<string, string | undefined> = serverEnv()): Response {
  const secret = readSessionSecret(env);
  if (!secret) return jsonError(503, "session_not_configured", "Falta SESSION_SECRET en el servidor.");
  if (rateLimited(request, "session-guest", GUEST_PER_WINDOW, GUEST_WINDOW_MS)) return jsonError(429, "rate_limited", "Demasiadas sesiones seguidas. Espera un momento.");
  const token = signSession({ sub: `guest_${randomUUID()}`, tid: DEMO_TENANT, role: "guest", scope: "guest" }, secret, GUEST_TTL_S);
  return json(200, { token, expiresIn: GUEST_TTL_S });
}
