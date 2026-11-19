import { z } from "zod";
import type { CommentThread } from "../../../components/comments/commentTypes.js";

/**
 * Los comentarios de revisión se guardan como un registro de acciones, no como el estado final: cada
 * comentario, respuesta, «resolver», «reabrir» o «eliminar» es una fila nueva y nada se borra ni se
 * sobrescribe. El estado de cada hilo sale de leer ese registro en orden (`reduceEvents`).
 *
 * Este archivo lo comparten el navegador y la función de Vercel (`api/comments`), así que no importa
 * nada con alias ni de React.
 */
export const COMMENT_ACTIONS = ["create", "reply", "resolve", "reopen", "delete"] as const;
export type CommentAction = (typeof COMMENT_ACTIONS)[number];

export const MAX_COMMENT_BODY = 1000;

export const commentEventSchema = z.object({
  /** Único por acción: evita contarla dos veces si se reintenta el envío. */
  id: z.string().min(1).max(80),
  /** Fecha ISO 8601 de cuando se hizo. */
  at: z.string().min(1).max(40),
  action: z.enum(COMMENT_ACTIONS),
  threadId: z.string().min(1).max(80),
  messageId: z.string().max(80).optional(),
  authorId: z.string().min(1).max(80),
  authorName: z.string().min(1).max(80),
  body: z.string().max(MAX_COMMENT_BODY).optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  context: z.string().max(200).optional(),
  contextLabel: z.string().max(160).optional(),
  /** Dónde se dejó el comentario (solo en «create»): ruta, módulo, sección y elemento. */
  route: z.string().max(300).optional(),
  module: z.string().max(200).optional(),
  section: z.string().max(300).optional(),
  element: z.string().max(200).optional(),
});
export type CommentEvent = z.infer<typeof commentEventSchema>;

export const commentEventsRequestSchema = z.object({ events: z.array(commentEventSchema).min(1).max(20) });

/** El estado de los hilos a partir del registro, en el orden en que llegó. */
export function reduceEvents(events: readonly CommentEvent[]): CommentThread[] {
  const threads = new Map<string, CommentThread>();
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const author = { id: event.authorId, name: event.authorName };
    const thread = threads.get(event.threadId);
    switch (event.action) {
      case "create":
        if (thread) break;
        threads.set(event.threadId, {
          id: event.threadId,
          x: event.x ?? 0,
          y: event.y ?? 0,
          context: event.context,
          contextLabel: event.contextLabel,
          location: event.route || event.module || event.section || event.element ? { route: event.route, module: event.module, section: event.section, element: event.element } : undefined,
          resolved: false,
          unread: false,
          messages: [{ id: event.messageId ?? event.id, author, body: event.body ?? "", createdAt: event.at }],
        });
        break;
      case "reply":
        if (thread && !thread.messages.some((message) => message.id === (event.messageId ?? event.id))) {
          thread.messages = [...thread.messages, { id: event.messageId ?? event.id, author, body: event.body ?? "", createdAt: event.at }];
        }
        break;
      case "resolve":
        if (thread) thread.resolved = true;
        break;
      case "reopen":
        if (thread) thread.resolved = false;
        break;
      case "delete":
        threads.delete(event.threadId);
        break;
    }
  }
  return [...threads.values()];
}

export interface CommentActor {
  id: string;
  name: string;
}

let eventSequence = 0;
export function newEventId(): string {
  eventSequence += 1;
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${eventSequence}-${random.slice(0, 8)}`;
}

/** La ubicación del hilo como campos del evento, recortada a lo que acepta el registro. */
function locationFields(thread: CommentThread): Pick<CommentEvent, "route" | "module" | "section" | "element"> {
  const cut = (value: string | undefined, max: number) => (value ? value.slice(0, max) : undefined);
  const location = thread.location;
  if (!location) return {};
  return { route: cut(location.route, 300), module: cut(location.module, 200), section: cut(location.section, 300), element: cut(location.element, 200) };
}

/** Las acciones que hay entre dos estados de los hilos: lo que se mandó a guardar con un cambio. */
export function diffThreads(previous: readonly CommentThread[], next: readonly CommentThread[], actor: CommentActor, at = new Date().toISOString()): CommentEvent[] {
  const events: CommentEvent[] = [];
  const before = new Map(previous.map((thread) => [thread.id, thread]));
  const after = new Set(next.map((thread) => thread.id));
  const base = { at, authorId: actor.id, authorName: actor.name };
  for (const thread of next) {
    const old = before.get(thread.id);
    if (!old) {
      const [first, ...rest] = thread.messages;
      if (first) {
        events.push({ ...base, id: newEventId(), action: "create", threadId: thread.id, messageId: first.id, authorId: first.author.id, authorName: first.author.name, at: first.createdAt, body: first.body, x: thread.x, y: thread.y, context: thread.context, contextLabel: thread.contextLabel, ...locationFields(thread) });
      }
      for (const message of rest) {
        events.push({ ...base, id: newEventId(), action: "reply", threadId: thread.id, messageId: message.id, authorId: message.author.id, authorName: message.author.name, at: message.createdAt, body: message.body });
      }
      continue;
    }
    const known = new Set(old.messages.map((message) => message.id));
    for (const message of thread.messages) {
      if (known.has(message.id)) continue;
      events.push({ ...base, id: newEventId(), action: "reply", threadId: thread.id, messageId: message.id, authorId: message.author.id, authorName: message.author.name, at: message.createdAt, body: message.body });
    }
    if (thread.resolved !== old.resolved) events.push({ ...base, id: newEventId(), action: thread.resolved ? "resolve" : "reopen", threadId: thread.id });
  }
  for (const thread of previous) {
    if (!after.has(thread.id)) events.push({ ...base, id: newEventId(), action: "delete", threadId: thread.id });
  }
  return events;
}

export interface FreshThreads {
  /** Los hilos que pasan a no leídos. */
  fresh: string[];
  /** Cuántos mensajes tiene cada hilo ahora: la referencia para la próxima vez. */
  known: Map<string, number>;
}

/**
 * Qué hilos quedan como no leídos al llegar comentarios: los nuevos o con más mensajes que la vez
 * anterior cuyo último mensaje es de otra persona. Lo propio nunca queda sin leer. Mientras no
 * haya llegado nada del servidor (`loaded` falso) solo se anota cuántos mensajes tiene cada hilo.
 */
export function freshThreadIds(threads: readonly CommentThread[], known: ReadonlyMap<string, number>, authorId: string, loaded: boolean): FreshThreads {
  const next = new Map(known);
  const fresh: string[] = [];
  for (const thread of threads) {
    const before = known.get(thread.id);
    const last = thread.messages[thread.messages.length - 1];
    if (loaded && last && last.author.id !== authorId && (before === undefined || thread.messages.length > before)) fresh.push(thread.id);
    next.set(thread.id, thread.messages.length);
  }
  return { fresh, known: next };
}
