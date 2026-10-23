/**
 * Lo que comparten las funciones de `api/`: no aceptar peticiones de otro sitio y leer el cuerpo con
 * tope. Vive aparte de `server/feedback` para que la voz de Clipper (`api/tts`) no arrastre el feedback.
 */

/** Tope del cuerpo de una petición: de sobra para un comentario de 1000 caracteres y sus metadatos. */
export const MAX_BODY_BYTES = 10_000;

/** Un navegador de otro sitio no puede llamar a estas funciones en nombre de esta app. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Lee el cuerpo como JSON con un tope de tamaño; `undefined` si es demasiado grande o no es JSON. */
export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Más estricto que `isSameOrigin`: para lo que cuesta dinero (voz, WhatsApp) no basta con que no
 * venga de otro sitio; tiene que venir de esta app. Una petición sin `Origin` ni `Referer` (un
 * `curl`, un script) se rechaza.
 */
export function isFromApp(request: Request): boolean {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;
  try {
    return new URL(source).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

const hits = new Map<string, number[]>();

/** Cuenta un golpe contra `key` y dice si ya pasó de `limit` en la ventana. */
function overLimit(key: string, limit: number, windowMs: number, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  hits.set(key, [...recent, now]);
  return false;
}

/**
 * Tope de peticiones por IP en una ventana. Vive en la memoria de cada instancia: frena el abuso
 * casual, no sustituye a un límite compartido (Vercel KV, Upstash) cuando haya tráfico real.
 */
export function rateLimited(request: Request, scope: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return overLimit(`${scope}:ip:${ip}`, limit, windowMs, now);
}

export interface Quota {
  perMinute: number;
  perDay: number;
}

/**
 * Tope por sesión (por cuenta, no por IP): una misma persona no gasta más de `perMinute` en un
 * minuto ni más de `perDay` en un día, cambie o no de red. Mismo límite de memoria que `rateLimited`.
 */
export function quotaExceeded(subject: string, scope: string, quota: Quota, now = Date.now()): boolean {
  if (overLimit(`${scope}:sub:${subject}:m`, quota.perMinute, 60_000, now)) return true;
  return overLimit(`${scope}:sub:${subject}:d`, quota.perDay, 86_400_000, now);
}

export const jsonError = (status: number, code: string, message: string): Response => new Response(JSON.stringify({ code, message }), { status, headers: { "content-type": "application/json" } });
