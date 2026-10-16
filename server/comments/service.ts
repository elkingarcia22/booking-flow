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

  /** `null` si no hay cuenta de Google; lanza si la que hay no es válida (lo atrapa `guarded`). */
  function getStore(): CommentsStore | null {
    if (store) return store;
    if (!config.googleServiceAccount) return null;
    const client = createGoogleClient(parseServiceAccount(config.googleServiceAccount), { fetchImpl: options.fetchImpl });
    store = createSheetStore(client, { sheetId: config.sheetId, shareWith: config.shareWith, linkAccess: config.linkAccess });
    return store;
  }

  const NOT_CONFIGURED = fail(503, "server", "Los comentarios todavía no están configurados en el servidor.");
  const reason = (error: unknown) => (error instanceof Error ? error.message : "error desconocido");

  /** Ejecuta con el almacén y convierte cualquier fallo (cuenta inválida, Google caído, API sin activar) en una respuesta que dice qué pasó. */
  async function withStore(step: string, run: (target: CommentsStore) => Promise<Reply>): Promise<Reply> {
    try {
      const target = getStore();
      return target ? await run(target) : NOT_CONFIGURED;
    } catch (error) {
      log(step, error);
      const message = reason(error);
      // Una cuenta de servicio no tiene espacio en Drive: la hoja la crea una persona y se la comparte.
      const hint = /quota/i.test(message) ? " Crea la hoja en tu propio Drive, compártela como Editor con la cuenta de servicio y pon su id en COMMENTS_SHEET_ID." : "";
      return fail(502, "upstream", `${step}: ${message}${hint}`);
    }
  }

  return {
    list: () => withStore("No se pudieron leer los comentarios", async (target) => ({ status: 200, body: { events: await target.read() } })),
    async record(payload) {
      const parsed = commentEventsRequestSchema.safeParse(payload);
      if (!parsed.success) return fail(400, "invalid", "Los comentarios no tienen el formato esperado.");
      return withStore("No se pudo guardar el comentario", async (target) => {
        // Reintentar un envío no duplica filas: las acciones que ya están (mismo id) se descartan.
        const existing = new Set((await target.read()).map((event) => event.id));
        const fresh: CommentEvent[] = parsed.data.events.filter((event) => !existing.has(event.id));
        if (fresh.length > 0) await target.append(fresh);
        return { status: 200, body: { saved: fresh.length } };
      });
    },
  };
}
