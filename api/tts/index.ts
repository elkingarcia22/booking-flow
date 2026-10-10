import { isSameOrigin, readJsonBody } from "../../server/http/request.js";
import { readTtsConfig, synthesize } from "../../server/tts/tts.js";

/**
 * POST /api/tts — la voz de Clipper: `{ text, lang: "es" | "en" }` → audio mp3. Solo desde la propia
 * app (mismo origen); sin servicio de voz configurado responde 501 y la app usa la voz del navegador.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return new Response(JSON.stringify({ code: "forbidden", message: "Origen no permitido." }), { status: 403, headers: { "content-type": "application/json" } });
  return synthesize(await readJsonBody(request), readTtsConfig());
}
