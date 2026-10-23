import { readJsonBody } from "../../server/http/request.js";
import { guardPaid } from "../../server/auth/guard.js";
import { readTtsConfig, synthesize } from "../../server/tts/tts.js";

/**
 * POST /api/tts — la voz de Clipper: `{ text, lang: "es" | "en" }` → audio mp3. Con sesión firmada
 * (del equipo, o de invitado en la reserva en línea) y con cupo por sesión; sin servicio de voz
 * configurado responde 501 y la app usa la voz del navegador.
 */
export async function POST(request: Request): Promise<Response> {
  const session = guardPaid(request, { name: "tts", quota: { perMinute: 30, perDay: 600 }, ipPerMinute: 60, scopes: ["staff", "guest"] });
  if (session instanceof Response) return session;
  return synthesize(await readJsonBody(request), readTtsConfig());
}
