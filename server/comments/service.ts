import { commentEventsRequestSchema, type CommentEvent } from "../../src/features/booking/comments/commentEvents.js";
import type { CommentsServerConfig } from "./config.js";
import { createGoogleClient, parseServiceAccount } from "../feedback/google.js";
import { createSheetStore, type CommentsStore } from "./sheetStore.js";

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export interface CommentsService {
  /** Todo el registro de acciones, en el orden en que se guardó. */
  list(): Promise<Reply>;
  /** Agrega acciones al registro; las que ya estaban (mismo id) no se repiten. */
  record(payload: unknown): Promise<Reply>;
}

const fail = (status: number, code: string, message: string): Reply => ({ status, body: { code, message } });

export interface CommentsServiceOptions {
  config: CommentsServerConfig;
  /** Para pruebas: un almacén en memoria en lugar de la hoja de Google. */
  store?: CommentsStore;
  fetchImpl?: typeof fetch;
  log?: (message: string, error: unknown) => void;
}

export function createCommentsService(options: CommentsServiceOptions): CommentsService {
  const { config } = options;
  const log = options.log ?? ((message, error) => console.error(`[comments] ${message}`, error));
  let store: CommentsStore | null = options.store ?? null;

  function getStore(): CommentsStore | null {
    if (store) return store;
    if (!config.googleServiceAccount) return null;
    const client = createGoogleClient(parseServiceAccount(config.googleServiceAccount), { fetchImpl: options.fetchImpl });
    store = createSheetStore(client, { sheetId: config.sheetId, shareWith: config.shareWith });
    return store;
  }

  return {
    async list() {
      const target = getStore();
      if (!target) return fail(503, "server", "Los comentarios todavía no están configurados en el servidor.");
      try {
        return { status: 200, body: { events: await target.read() } };
      } catch (error) {
        log("no se pudieron leer los comentarios", error);
        return fail(502, "upstream", "No se pudieron leer los comentarios.");
      }
    },
    async record(payload) {
      const parsed = commentEventsRequestSchema.safeParse(payload);
      if (!parsed.success) return fail(400, "invalid", "Los comentarios no tienen el formato esperado.");
      const target = getStore();
      if (!target) return fail(503, "server", "Los comentarios todavía no están configurados en el servidor.");
      try {
        // Reintentar un envío no duplica filas: las acciones que ya están (mismo id) se descartan.
        const existing = new Set((await target.read()).map((event) => event.id));
        const fresh: CommentEvent[] = parsed.data.events.filter((event) => !existing.has(event.id));
        if (fresh.length > 0) await target.append(fresh);
        return { status: 200, body: { saved: fresh.length } };
      } catch (error) {
        log("no se pudo guardar el comentario", error);
        return fail(502, "upstream", "No se pudo guardar el comentario.");
      }
    },
  };
}
