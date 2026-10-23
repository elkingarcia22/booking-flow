/**
 * La sesión firmada que piden las funciones que cuestan dinero (`/api/tts`, `/api/clipper`,
 * `/api/narrative`, `/api/whatsapp/queue`; ver server/auth). Es otra cosa que el token del backend
 * simulado: la firma un servidor con un secreto que el navegador nunca ve.
 *
 * - **Equipo**: se pide al entrar con el código (`POST /api/session`) y dura un turno.
 * - **Invitado**: el cliente en la reserva en línea pide una de media hora (`POST /api/session/guest`)
 *   la primera vez que suena la voz de Clipper; solo vale para la voz.
 *
 * Vive en `sessionStorage` como el token de la app y se borra al salir. Si no hay sesión, la petición
 * sale igual y el servidor responde 401: cada pantalla ya sabe qué hacer sin la función (voz del
 * navegador, centro de ayuda, resumen automático, mensaje simulado).
 */

export type ServerScope = "staff" | "guest";

interface Stored {
  token: string;
  expiresAt: number;
}

const KEYS: Record<ServerScope, string> = { staff: "thema.server.staff", guest: "thema.server.guest" };
/** Se renueva un poco antes de que caduque, para que no muera a mitad de una conversación. */
const MARGIN_MS = 30_000;

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function read(scope: ServerScope, now = Date.now()): string | null {
  const raw = storage()?.getItem(KEYS[scope]);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<Stored>;
    if (typeof stored.token !== "string" || typeof stored.expiresAt !== "number") return null;
    return stored.expiresAt - MARGIN_MS > now ? stored.token : null;
  } catch {
    return null;
  }
}

function write(scope: ServerScope, token: string, expiresInSeconds: number, now = Date.now()): void {
  storage()?.setItem(KEYS[scope], JSON.stringify({ token, expiresAt: now + expiresInSeconds * 1000 } satisfies Stored));
}

export function clearServerSession(scope?: ServerScope): void {
  for (const key of scope ? [KEYS[scope]] : Object.values(KEYS)) storage()?.removeItem(key);
}

/** El token vigente: el del equipo si lo hay; el de invitado solo si se acepta. */
export function serverToken(allowGuest = false): string | null {
  return read("staff") ?? (allowGuest ? read("guest") : null);
}

const isIssued = (value: unknown): value is { token: string; expiresIn: number } =>
  typeof value === "object" && value !== null && typeof (value as { token?: unknown }).token === "string" && typeof (value as { expiresIn?: unknown }).expiresIn === "number";

async function issue(url: string, body: unknown, fetcher: typeof fetch): Promise<{ token: string; expiresIn: number } | null> {
  try {
    const response = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return isIssued(payload) ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Pide la sesión del equipo con el mismo celular y código con que se entró. Si falla (sin funciones en
 * local, sin secreto en el servidor), la app sigue: solo las funciones pagas responden su respaldo.
 */
export async function obtainStaffSession(credentials: { phone: string; code: string }, fetcher: typeof fetch = fetch): Promise<boolean> {
  const issued = await issue("/api/session", credentials, fetcher);
  if (!issued) return false;
  write("staff", issued.token, issued.expiresIn);
  return true;
}

let guestInFlight: Promise<string | null> | null = null;

/** La sesión de invitado: una sola petición aunque suenen dos frases a la vez. */
function obtainGuestSession(fetcher: typeof fetch): Promise<string | null> {
  guestInFlight ??= issue("/api/session/guest", {}, fetcher)
    .then((issued) => {
      if (!issued) return null;
      write("guest", issued.token, issued.expiresIn);
      return issued.token;
    })
    .finally(() => {
      guestInFlight = null;
    });
  return guestInFlight;
}

export interface ServerFetchOptions {
  /** Vale la sesión de invitado (y se pide si no hay ninguna): solo la voz de Clipper. */
  guest?: boolean;
  /** Para pruebas: quién hace la petición. */
  fetcher?: typeof fetch;
}

/**
 * `fetch` a una función de servidor con la sesión firmada en `Authorization`. Si el servidor dice que
 * la sesión ya no vale, se olvida para no seguir mandándola.
 */
export async function serverFetch(url: string, init: RequestInit = {}, { guest = false, fetcher = fetch }: ServerFetchOptions = {}): Promise<Response> {
  const token = serverToken(guest) ?? (guest ? await obtainGuestSession(fetcher) : null);
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetcher(url, { ...init, headers });
  if (response.status === 401 && token) clearServerSession(read("staff") === token ? "staff" : "guest");
  return response;
}
