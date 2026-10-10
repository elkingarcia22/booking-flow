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
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
