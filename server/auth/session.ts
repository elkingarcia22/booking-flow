import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { jsonError } from "../http/request.js";

/**
 * La sesión que firman los servidores para las funciones que cuestan dinero (voz, Clipper, narración,
 * cola de WhatsApp). Antes bastaba con que la petición dijera venir de la app (`Origin`/`Referer`),
 * y eso se falsifica con un `curl`. Ahora cada llamada lleva `Authorization: Bearer <token>`: un JWT
 * HS256 firmado con `SESSION_SECRET` que dice quién es, de qué barbería, con qué rol y hasta cuándo.
 *
 * Dos alcances: `staff` (alguien del equipo que entró con su código) y `guest` (el cliente en la
 * reserva en línea, que solo puede pedir la voz de Clipper y con un tope más bajo).
 *
 * El backend real emite el token al entrar, con el mismo secreto. Mientras no exista, `api/session`
 * lo emite para las cuentas de la demo (ver `demoAccounts.ts`).
 */

export type SessionScope = "staff" | "guest";

export interface ServerClaims {
  /** La cuenta (o, para un invitado, un id de un solo uso). */
  sub: string;
  /** La barbería: lo que se encola o se consulta queda dentro de ella. */
  tid: string;
  /** El rol en la barbería (`owner`, `admin`, `recepcion`, `barbero-comision`, `barbero-renta`) o `guest`. */
  role: string;
  /** La ficha de equipo, si la tiene. */
  mid?: string;
  scope: SessionScope;
  /** Emitido y caduca, en segundos desde 1970 (como cualquier JWT). */
  iat: number;
  exp: number;
  jti: string;
}

/** Ocho horas para el equipo (un turno) y media hora para un invitado de la reserva. */
export const STAFF_TTL_S = 8 * 3600;
export const GUEST_TTL_S = 30 * 60;
/** Un secreto más corto se adivina: el de producción sale de `openssl rand -base64 48`. */
export const MIN_SECRET_LENGTH = 32;

const HEADER = { alg: "HS256", typ: "JWT" } as const;

const base64url = (input: Buffer | string): string => Buffer.from(input).toString("base64url");
const sign = (data: string, secret: string): string => createHmac("sha256", secret).update(data).digest("base64url");

const serverEnv = (): Record<string, string | undefined> => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/** En `npm run dev` no hace falta configurar nada: el servidor de desarrollo pone uno al azar por proceso. */
let devSecret: string | null = null;
export function enableDevSessionSecret(): void {
  devSecret ??= randomBytes(48).toString("base64url");
}

/** El secreto con el que se firma y se comprueba; `null` si no hay (las funciones fallan cerradas). */
export function readSessionSecret(env: Record<string, string | undefined> = serverEnv()): string | null {
  const secret = env.SESSION_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  return devSecret;
}

export function signSession(claims: Omit<ServerClaims, "iat" | "exp" | "jti">, secret: string, ttlSeconds: number, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload: ServerClaims = { ...claims, iat, exp: iat + ttlSeconds, jti: randomUUID() };
  const data = `${base64url(JSON.stringify(HEADER))}.${base64url(JSON.stringify(payload))}`;
  return `${data}.${sign(data, secret)}`;
}

const isClaims = (value: unknown): value is ServerClaims => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.sub === "string" &&
    typeof record.tid === "string" &&
    typeof record.role === "string" &&
    (record.scope === "staff" || record.scope === "guest") &&
    typeof record.iat === "number" &&
    typeof record.exp === "number" &&
    typeof record.jti === "string" &&
    (record.mid === undefined || typeof record.mid === "string")
  );
};

/** Los datos del token si la firma cuadra y no ha caducado; `null` en cualquier otro caso. */
export function verifySession(token: string, secret: string, now = Date.now()): ServerClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${payload}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString()) as { alg?: string };
    if (head.alg !== HEADER.alg) return null;
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!isClaims(claims)) return null;
    if (claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

const bearerOf = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
};

export interface RequireOptions {
  /** Qué alcances valen; por defecto solo el equipo. */
  scopes?: readonly SessionScope[];
  secret?: string | null;
  now?: number;
}

/**
 * La sesión de la petición, o la respuesta con la que rechazarla: 503 si el servidor no tiene secreto
 * (mejor no atender que atender a cualquiera), 401 si falta o no vale, 403 si el alcance no alcanza.
 */
export function requireSession(request: Request, options: RequireOptions = {}): ServerClaims | Response {
  const secret = options.secret === undefined ? readSessionSecret() : options.secret;
  if (!secret) return jsonError(503, "session_not_configured", "Falta SESSION_SECRET en el servidor.");
  const token = bearerOf(request);
  if (!token) return jsonError(401, "unauthorized", "Falta la sesión.");
  const claims = verifySession(token, secret, options.now);
  if (!claims) return jsonError(401, "session_expired", "La sesión no vale o caducó. Vuelve a entrar.");
  if (!(options.scopes ?? ["staff"]).includes(claims.scope)) return jsonError(403, "forbidden", "Esta sesión no puede usar esto.");
  return claims;
}
