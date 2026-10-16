import type { CommentEvent } from "../../src/features/booking/comments/commentEvents.js";
import type { GoogleClient } from "../feedback/google.js";

/**
 * Donde viven los comentarios: una hoja de Google con una fila por acción (comentar, responder,
 * resolver, reabrir, eliminar). Solo se agregan filas; leerla en orden reconstruye cada hilo.
 *
 * Como la del feedback, la hoja se encuentra por una propiedad de Drive y no por un id guardado:
 * el servidor no tiene estado y cualquier instancia llega a la misma.
 */
export const ACTIONS_TAB = "Acciones";
export const COLUMNS = ["fecha", "accion", "hilo", "mensaje", "autor_id", "autor", "texto", "x", "y", "vista", "vista_nombre", "evento_id"] as const;

const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const MARKER_KEY = "themaBookingComments";
const RANGE = `${ACTIONS_TAB}!A:${String.fromCharCode(64 + COLUMNS.length)}`;

export interface CommentsStore {
  read(): Promise<CommentEvent[]>;
  append(events: readonly CommentEvent[]): Promise<void>;
}

export const toRow = (event: CommentEvent): string[] => [
  event.at,
  event.action,
  event.threadId,
  event.messageId ?? "",
  event.authorId,
  event.authorName,
  event.body ?? "",
  event.x === undefined ? "" : String(event.x),
  event.y === undefined ? "" : String(event.y),
  event.context ?? "",
  event.contextLabel ?? "",
  event.id,
];

export function fromRow(row: readonly string[]): CommentEvent | null {
  const [at, action, threadId, messageId, authorId, authorName, body, x, y, context, contextLabel, id] = row;
  if (!at || !threadId || !authorId || !id) return null;
  if (!["create", "reply", "resolve", "reopen", "delete"].includes(action ?? "")) return null;
  const number = (value: string | undefined) => (value === undefined || value === "" || Number.isNaN(Number(value)) ? undefined : Number(value));
  return {
    id,
    at,
    action: action as CommentEvent["action"],
    threadId,
    messageId: messageId || undefined,
    authorId,
    authorName: authorName || "Anónimo",
    body: body || undefined,
    x: number(x),
    y: number(y),
    context: context || undefined,
    contextLabel: contextLabel || undefined,
  };
}

interface DriveFile {
  id: string;
}

async function findSheet(client: GoogleClient): Promise<string | null> {
  const query = `appProperties has { key='${MARKER_KEY}' and value='1' } and trashed=false`;
  const params = new URLSearchParams({ q: query, fields: "files(id)", orderBy: "createdTime", pageSize: "5" });
  const result = await client.json<{ files?: DriveFile[] }>(`${DRIVE}/files?${params}`);
  return result.files?.[0]?.id ?? null;
}

async function createSheet(client: GoogleClient, shareWith: readonly string[]): Promise<string> {
  const file = await client.json<{ id: string }>(`${DRIVE}/files`, {
    body: { name: "Comentarios · Agendamiento online", mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { [MARKER_KEY]: "1" } },
  });
  // Si otra instancia creó una a la vez, gana la más antigua y esta se borra.
  const oldest = await findSheet(client);
  if (oldest && oldest !== file.id) {
    await client.json(`${DRIVE}/files/${file.id}`, { method: "DELETE" }).catch(() => undefined);
    return oldest;
  }
  await client.json(`${SHEETS}/${file.id}:batchUpdate`, {
    body: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: 0, title: ACTIONS_TAB, gridProperties: { frozenRowCount: 1 } }, fields: "title,gridProperties.frozenRowCount" } },
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.93, blue: 0.95 } } }, fields: "userEnteredFormat(textFormat,backgroundColor)" } },
      ],
    },
  });
  await client.json(`${SHEETS}/${file.id}/values/${encodeURIComponent(`${ACTIONS_TAB}!A1`)}?valueInputOption=RAW`, { method: "PUT", body: { values: [[...COLUMNS]] } });
  for (const emailAddress of shareWith) {
    await client.json(`${DRIVE}/files/${file.id}/permissions?sendNotificationEmail=false`, { body: { type: "user", role: "writer", emailAddress } }).catch(() => undefined);
  }
  return file.id;
}

/** Abre la hoja a cualquiera con el enlace. Repetirlo no cambia nada, así que vale también para una hoja que ya existía. */
async function openToLink(client: GoogleClient, spreadsheetId: string, role: "reader" | "writer"): Promise<void> {
  await client.json(`${DRIVE}/files/${spreadsheetId}/permissions?sendNotificationEmail=false`, { body: { type: "anyone", role } });
}

export function createSheetStore(client: GoogleClient, options: { sheetId?: string; shareWith?: readonly string[]; linkAccess?: "reader" | "writer" } = {}): CommentsStore {
  let sheetId: string | null = null;
  const ensure = async () => {
    if (sheetId) return sheetId;
    const id = options.sheetId ?? (await findSheet(client)) ?? (await createSheet(client, options.shareWith ?? []));
    // Si Google no deja (algunas organizaciones bloquean los enlaces públicos), la hoja sigue sirviendo: solo no queda abierta.
    if (options.linkAccess) await openToLink(client, id, options.linkAccess).catch((error) => console.error("[comments] no se pudo abrir la hoja al enlace", error));
    sheetId = id;
    return id;
  };
  return {
    async read() {
      const id = await ensure();
      const result = await client.json<{ values?: string[][] }>(`${SHEETS}/${id}/values/${encodeURIComponent(RANGE)}`);
      // La primera fila es la cabecera.
      return (result.values ?? []).slice(1).flatMap((row) => fromRow(row) ?? []);
    },
    async append(events) {
      const id = await ensure();
      const params = new URLSearchParams({ valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" });
      // RAW: el texto se guarda tal cual; un comentario que empiece por «=» no se evalúa como fórmula.
      await client.json(`${SHEETS}/${id}/values/${encodeURIComponent(RANGE)}:append?${params}`, { body: { values: events.map(toRow) } });
    },
  };
}
