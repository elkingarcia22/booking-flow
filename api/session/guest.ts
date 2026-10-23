import { isSameOrigin, jsonError } from "../../server/http/request.js";
import { issueGuestSession } from "../../server/auth/issue.js";

/** POST /api/session/guest — la sesión del cliente en la reserva en línea: media hora, solo la voz. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return jsonError(403, "forbidden", "Origen no permitido.");
  return issueGuestSession(request);
}
