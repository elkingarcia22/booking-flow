import * as React from "react";
import type { CommentAuthor, CommentThread } from "@/components/comments";
import { diffThreads, reduceEvents, type CommentEvent } from "./commentEvents";

const ENDPOINT = "/api/comments";
const POLL_MS = 15_000;
const STORAGE_KEY = "thema.comments.reviewer";
const FALLBACK_NAME = "Revisor";

interface StoredReviewer {
  id: string;
  name: string;
}

function readReviewer(): StoredReviewer | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredReviewer>) : null;
    return parsed && typeof parsed.id === "string" && typeof parsed.name === "string" ? { id: parsed.id, name: parsed.name } : null;
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

/**
 * Quién comenta. Sin cuentas en la vista previa, cada navegador se presenta una vez con su nombre y
 * queda guardado: es la firma de sus comentarios en la hoja.
 */
export function useReviewer() {
  const [reviewer, setReviewer] = React.useState<StoredReviewer>(() => readReviewer() ?? { id: `r-${Math.random().toString(36).slice(2, 10)}`, name: FALLBACK_NAME });
  const askName = React.useCallback(() => {
    if (readReviewer()) return;
    const typed = window.prompt("¿Cómo te llamas? Va en la firma de tus comentarios.", "")?.trim().slice(0, 60);
    const next = { id: reviewer.id, name: typed || FALLBACK_NAME };
    saveReviewer(next);
    setReviewer(next);
  }, [reviewer.id]);
  const author = React.useMemo<CommentAuthor>(() => ({ id: reviewer.id, name: reviewer.name }), [reviewer]);
  return { author, askName };
}

async function fetchEvents(signal?: AbortSignal): Promise<CommentEvent[] | null> {
  try {
    const response = await fetch(ENDPOINT, { signal, headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { events?: CommentEvent[] };
    return Array.isArray(payload.events) ? payload.events : null;
  } catch {
    return null;
  }
}

async function sendEvents(events: CommentEvent[]): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Los hilos de comentarios compartidos: se leen de `/api/comments` (la hoja de Google), se
 * refrescan cada pocos segundos y cada acción se manda a guardar. Si el servidor no responde (en
 * local, sin configurar o sin red) los comentarios siguen funcionando en memoria y se reintentan.
 *
 * «No leído» es de cada navegador: no se guarda, se calcula con lo que llega de otras personas.
 */
export function useSharedComments(author: CommentAuthor) {
  const [remote, setRemote] = React.useState<CommentEvent[]>([]);
  const [pending, setPending] = React.useState<CommentEvent[]>([]);
  const [unreadIds, setUnreadIds] = React.useState<ReadonlySet<string>>(new Set());
  const loaded = React.useRef(false);
  const knownMessages = React.useRef(new Map<string, number>());
  const sending = React.useRef(new Set<string>());

  const events = React.useMemo(() => {
    const confirmed = new Set(remote.map((event) => event.id));
    return [...remote, ...pending.filter((event) => !confirmed.has(event.id))];
  }, [remote, pending]);
  const base = React.useMemo(() => reduceEvents(events), [events]);
  const threads = React.useMemo<CommentThread[]>(() => base.map((thread) => ({ ...thread, unread: unreadIds.has(thread.id) })), [base, unreadIds]);
  const threadsRef = React.useRef(threads);
  React.useLayoutEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Lo que llegó de otras personas desde la última vez queda como no leído.
  React.useEffect(() => {
    const fresh: string[] = [];
    for (const thread of base) {
      const before = knownMessages.current.get(thread.id);
      const last = thread.messages[thread.messages.length - 1];
      if (loaded.current && last && last.author.id !== author.id && (before === undefined || thread.messages.length > before)) fresh.push(thread.id);
      knownMessages.current.set(thread.id, thread.messages.length);
    }
    if (fresh.length > 0) setUnreadIds((current) => new Set([...current, ...fresh]));
  }, [base, author.id]);

  const flush = React.useCallback(async (batch: CommentEvent[]) => {
    const toSend = batch.filter((event) => !sending.current.has(event.id));
    if (toSend.length === 0) return;
    toSend.forEach((event) => sending.current.add(event.id));
    const ok = await sendEvents(toSend);
    toSend.forEach((event) => sending.current.delete(event.id));
    // Si no salió, sigue en `pending` y se reintenta en el próximo refresco.
    if (ok) {
      const refreshed = await fetchEvents();
      if (refreshed) setRemote(refreshed);
    }
  }, []);

  const pendingRef = React.useRef(pending);
  React.useLayoutEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  React.useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      const next = await fetchEvents(controller.signal);
      if (!next || controller.signal.aborted) return;
      setRemote(next);
      loaded.current = true;
      const confirmed = new Set(next.map((event) => event.id));
      const stillPending = pendingRef.current.filter((event) => !confirmed.has(event.id));
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
  }, [flush]);

  const onThreadsChange = React.useCallback(
    (next: CommentThread[]) => {
      const added = diffThreads(threadsRef.current, next, author);
      setUnreadIds(new Set(next.filter((thread) => thread.unread).map((thread) => thread.id)));
      if (added.length === 0) return;
      setPending((current) => [...current, ...added]);
      void flush(added);
    },
    [author, flush]
  );

  return { threads, onThreadsChange };
}
