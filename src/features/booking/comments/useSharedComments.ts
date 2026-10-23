import * as React from "react";
import type { CommentAuthor, CommentThread } from "@/components/comments";
import {
  commentEventSchema,
  diffThreads,
  freshThreadIds,
  reduceEvents,
  type CommentEvent,
} from "./commentEvents";

const ENDPOINT = "/api/comments";
const POLL_MS = 15_000;
const STORAGE_KEY = "thema.comments.reviewer";
/** Lo que aún no llegó a la hoja: sin esto, un comentario hecho sin servidor se perdía al recargar. */
const PENDING_KEY = "thema.comments.pending";
const FALLBACK_NAME = "Revisor";
export const MAX_REVIEWER_NAME = 60;

interface StoredReviewer {
  id: string;
  name: string;
}

function readReviewer(): StoredReviewer | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredReviewer>) : null;
    return parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string"
      ? { id: parsed.id, name: parsed.name }
      : null;
  } catch {
    return null;
  }
}

function saveReviewer(reviewer: StoredReviewer) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewer));
  } catch {
    // Sin almacenamiento (ventana privada): firma esta sesión y vuelve a preguntar la próxima.
  }
}

function readPending(): CommentEvent[] {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const event = commentEventSchema.safeParse(item);
          return event.success ? [event.data] : [];
        })
      : [];
  } catch {
    return [];
  }
}

/**
 * Guarda la cola sumándola a la que ya había: la reserva y la plataforma pueden tener cada una la
 * suya abierta a la vez. Solo sale lo que la hoja ya confirmó.
 */
function savePending(
  events: readonly CommentEvent[],
  confirmed: ReadonlySet<string>,
) {
  try {
    const ids = new Set(events.map((event) => event.id));
    const next = [
      ...readPending().filter((event) => !ids.has(event.id)),
      ...events,
    ].filter((event) => !confirmed.has(event.id));
    if (next.length === 0) window.localStorage.removeItem(PENDING_KEY);
    else window.localStorage.setItem(PENDING_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento: quedan en memoria hasta que el servidor responda.
  }
}

/**
 * Quién comenta. Sin cuentas en la vista previa, cada navegador se presenta una vez con su nombre y
 * queda guardado: es la firma de sus comentarios en la hoja. `askName` abre el diálogo (si aún no
 * hay nombre) y `saveName` lo guarda al cerrarlo.
 */
export function useReviewer() {
  const [reviewer, setReviewer] = React.useState<StoredReviewer>(
    () =>
      readReviewer() ?? {
        id: `r-${Math.random().toString(36).slice(2, 10)}`,
        name: FALLBACK_NAME,
      },
  );
  const [isAsking, setIsAsking] = React.useState(false);
  const askName = React.useCallback(() => {
    if (!readReviewer()) setIsAsking(true);
  }, []);
  const saveName = React.useCallback(
    (typed: string) => {
      const next = {
        id: reviewer.id,
        name: typed.trim().slice(0, MAX_REVIEWER_NAME) || FALLBACK_NAME,
      };
      saveReviewer(next);
      setReviewer(next);
      setIsAsking(false);
    },
    [reviewer.id],
  );
  const author = React.useMemo<CommentAuthor>(
    () => ({ id: reviewer.id, name: reviewer.name }),
    [reviewer],
  );
  return { author, isAsking, askName, saveName };
}

async function fetchEvents(
  signal?: AbortSignal,
): Promise<CommentEvent[] | null> {
  try {
    const response = await fetch(ENDPOINT, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { events?: CommentEvent[] };
    return Array.isArray(payload.events) ? payload.events : null;
  } catch {
    return null;
  }
}

async function sendEvents(events: CommentEvent[]): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Los hilos de comentarios compartidos: se leen de `/api/comments` (la hoja de Google), se
 * refrescan cada pocos segundos y cada acción se manda a guardar. Si el servidor no responde (en
 * local, sin configurar o sin red) lo que no se pudo guardar queda en este navegador: sobrevive a
 * una recarga y se manda a la hoja en cuanto el servidor responda.
 *
 * «No leído» es de cada navegador: no se guarda, se calcula con lo que llega de otras personas.
 */
export function useSharedComments(
  author: CommentAuthor,
  options: { include?: (thread: CommentThread) => boolean } = {},
) {
  const { include } = options;
  const [remote, setRemote] = React.useState<CommentEvent[]>([]);
  const [pending, setPending] = React.useState<CommentEvent[]>(readPending);
  const [unreadIds, setUnreadIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const loaded = React.useRef(false);
  const knownMessages = React.useRef<ReadonlyMap<string, number>>(new Map());
  const sending = React.useRef(new Set<string>());

  const events = React.useMemo(() => {
    const confirmed = new Set(remote.map((event) => event.id));
    return [...remote, ...pending.filter((event) => !confirmed.has(event.id))];
  }, [remote, pending]);
  const base = React.useMemo(() => reduceEvents(events), [events]);
  // Todos los hilos de la hoja; `threadsRef` los guarda todos para que el cambio de una sola parte
  // (la reserva o la plataforma) no se lea como si se hubieran borrado los de la otra.
  const allThreads = React.useMemo<CommentThread[]>(
    () =>
      base.map((thread) => ({ ...thread, unread: unreadIds.has(thread.id) })),
    [base, unreadIds],
  );
  const threadsRef = React.useRef(allThreads);
  React.useLayoutEffect(() => {
    threadsRef.current = allThreads;
  }, [allThreads]);
  const includeRef = React.useRef(include);
  React.useLayoutEffect(() => {
    includeRef.current = include;
  }, [include]);
  const threads = React.useMemo(
    () => (include ? allThreads.filter(include) : allThreads),
    [allThreads, include],
  );

  const pendingRef = React.useRef(pending);
  React.useLayoutEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  React.useEffect(
    () => savePending(pending, new Set(remote.map((event) => event.id))),
    [pending, remote],
  );
  const authorIdRef = React.useRef(author.id);
  React.useLayoutEffect(() => {
    authorIdRef.current = author.id;
  }, [author.id]);

  /**
   * Llegan los comentarios del servidor: se guardan y lo que trajeron de otras personas desde la
   * última vez queda como no leído. Se calcula aquí, al recibirlos, y no en un efecto que mire los
   * hilos: así el estado cambia una sola vez por llegada.
   */
  const receive = React.useCallback((next: CommentEvent[]) => {
    setRemote(next);
    const confirmed = new Set(next.map((event) => event.id));
    const threadsNow = reduceEvents([
      ...next,
      ...pendingRef.current.filter((event) => !confirmed.has(event.id)),
    ]);
    const { fresh, known } = freshThreadIds(
      threadsNow,
      knownMessages.current,
      authorIdRef.current,
      loaded.current,
    );
    knownMessages.current = known;
    if (fresh.length > 0)
      setUnreadIds((current) => new Set([...current, ...fresh]));
  }, []);

  const flush = React.useCallback(
    async (batch: CommentEvent[]) => {
      const toSend = batch.filter((event) => !sending.current.has(event.id));
      if (toSend.length === 0) return;
      toSend.forEach((event) => sending.current.add(event.id));
      const ok = await sendEvents(toSend);
      toSend.forEach((event) => sending.current.delete(event.id));
      // Si no salió, sigue en `pending` y se reintenta en el próximo refresco.
      if (ok) {
        const refreshed = await fetchEvents();
        if (refreshed) receive(refreshed);
      }
    },
    [receive],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      const next = await fetchEvents(controller.signal);
      if (!next || controller.signal.aborted) return;
      loaded.current = true;
      receive(next);
      const confirmed = new Set(next.map((event) => event.id));
      const stillPending = pendingRef.current.filter(
        (event) => !confirmed.has(event.id),
      );
      setPending(stillPending);
      void flush(stillPending);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush, receive]);

  const onThreadsChange = React.useCallback(
    (nextScoped: CommentThread[]) => {
      // Lo que llega es solo la parte visible: se le suman los hilos de fuera del alcance tal como están.
      const scope = includeRef.current;
      const next = scope
        ? [
            ...threadsRef.current.filter((thread) => !scope(thread)),
            ...nextScoped,
          ]
        : nextScoped;
      const added = diffThreads(threadsRef.current, next, author);
      setUnreadIds(
        new Set(
          next.filter((thread) => thread.unread).map((thread) => thread.id),
        ),
      );
      if (added.length === 0) return;
      setPending((current) => [...current, ...added]);
      void flush(added);
    },
    [author, flush],
  );

  return { threads, onThreadsChange };
}
