import { createSign } from "node:crypto";

/**
 * Cliente mínimo de las APIs de Google con una cuenta de servicio, sin la SDK
 * de Google: firmar el JWT es un RS256 de `node:crypto` y el resto es `fetch`.
 * Así la función pesa poco y arranca rápido.
 */
export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export const GOOGLE_SCOPES = [
  // `drive` y no `drive.file`: los adjuntos van a una carpeta de una unidad
  // compartida que la cuenta no creó, y `drive.file` no llega a ella.
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_LIFETIME_S = 3600;
/** Se renueva un minuto antes de que caduque. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export class GoogleApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
  }
}

/** Acepta el JSON tal cual o en base64 (más cómodo de pegar en una variable de entorno). */
export function parseServiceAccount(raw: string): ServiceAccount {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido (ni base64 de uno).");
  }
  const record = parsed as Partial<ServiceAccount> | null;
  if (!record || typeof record.client_email !== "string" || typeof record.private_key !== "string") {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no trae client_email y private_key.");
  }
  // Al pegar el JSON en una variable de entorno los saltos de línea pueden llegar escapados.
  return { client_email: record.client_email, private_key: record.private_key.replace(/\\n/g, "\n") };
}

const base64Url = (value: string) => Buffer.from(value).toString("base64url");

export function signServiceAccountJwt(account: ServiceAccount, scopes: readonly string[], nowMs: number): string {
  const issuedAt = Math.floor(nowMs / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: scopes.join(" "),
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_S,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key, "base64url");
  return `${header}.${claims}.${signature}`;
}

export interface GoogleClient {
  /** Llama a una API de Google con el token de la cuenta de servicio y devuelve el JSON. */
  json<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T>;
  /** Lo mismo, pero devuelve la respuesta entera: para leer cabeceras, como la de una sesión de subida. */
  raw(url: string, init: { method: string; headers?: Record<string, string>; body?: unknown }): Promise<Response>;
}

export interface GoogleClientOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  scopes?: readonly string[];
}

export function createGoogleClient(account: ServiceAccount, options: GoogleClientOptions = {}): GoogleClient {
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const scopes = options.scopes ?? GOOGLE_SCOPES;
  let cached: { token: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (cached && now() < cached.expiresAt - TOKEN_REFRESH_MARGIN_MS) return cached.token;
    const response = await doFetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signServiceAccountJwt(account, scopes, now()),
      }),
    });
    const payload = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
    if (!response.ok || !payload?.access_token) {
      throw new GoogleApiError(response.status, payload?.error_description ?? "Google no entregó un token de acceso.");
    }
    cached = { token: payload.access_token, expiresAt: now() + (payload.expires_in ?? TOKEN_LIFETIME_S) * 1000 };
    return cached.token;
  }

  return {
    async raw(url, init) {
      const response = await doFetch(url, {
        method: init.method,
        headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json; charset=UTF-8", ...init.headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new GoogleApiError(response.status, payload?.error?.message ?? `Google respondió ${response.status}.`);
      }
      return response;
    },
    async json<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
      const response = await doFetch(url, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if (response.status === 204) return undefined as T;
      const payload = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
      if (!response.ok) throw new GoogleApiError(response.status, payload?.error?.message ?? `Google respondió ${response.status}.`);
      return payload as T;
    },
  };
}
