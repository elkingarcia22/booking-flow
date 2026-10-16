import { readCommentsConfig } from "../../server/comments/config.js";
import { createCommentsService, type Reply } from "../../server/comments/service.js";
import { isSameOrigin, readJsonBody } from "../../server/http/request.js";

const toResponse = (reply: Reply): Response => Response.json(reply.body, { status: reply.status, headers: { "Cache-Control": "no-store" } });

/** GET /api/comments — el registro de acciones de los comentarios de la reserva (hoja de Google). */
export async function GET(): Promise<Response> {
  return toResponse(await createCommentsService({ config: readCommentsConfig() }).list());
}

/** POST /api/comments — agrega acciones (comentar, responder, resolver…) al registro. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return toResponse({ status: 403, body: { code: "forbidden", message: "Origen no permitido." } });
  return toResponse(await createCommentsService({ config: readCommentsConfig() }).record(await readJsonBody(request)));
}
