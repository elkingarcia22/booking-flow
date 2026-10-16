import * as React from "react"
import { CommentsContext, type CommentDraft, type CommentMode, type CommentsContextValue } from "./commentsContext"
import {
  DEFAULT_COMMENT_FILTER,
  DEFAULT_COMMENT_LABELS,
  type CommentAuthor,
  type CommentFilter,
  type CommentLabels,
  type CommentThread,
} from "./commentTypes"

export interface CommentsProviderProps {
  /** Quién comenta: firma los hilos y respuestas nuevos. */
  currentUser: CommentAuthor
  /** Hilos iniciales (sin control). */
  defaultThreads?: CommentThread[]
  /** Hilos controlados: con esto, cada cambio llega por `onThreadsChange`. */
  threads?: CommentThread[]
  onThreadsChange?: (threads: CommentThread[]) => void
  /** La vista activa (p. ej. el dispositivo de la vista previa). */
  context?: string
  contextLabel?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** `C` entra y sale del modo comentar; `Esc` sale. Activos por defecto. */
  shortcuts?: boolean
  labels?: Partial<CommentLabels>
  children: React.ReactNode
}

let sequence = 0
function newId(prefix: string) {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence}`
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

/**
 * CommentsProvider
 *
 * El estado de los comentarios de una pantalla: los hilos, si el panel está
 * abierto, si el clic comenta o navega, el hilo elegido y el filtro. Lo
 * comparten `CommentsToggle`, `CommentLayer` y `CommentsPanel`, que se montan
 * donde toque dentro de él.
 *
 * @example
 * <CommentsProvider currentUser={yo} defaultThreads={hilos} context={vista}>
 *   <header><CommentsToggle /></header>
 *   <CommentLayer>{pantalla}</CommentLayer>
 *   <CommentsPanel />
 * </CommentsProvider>
 */
export function CommentsProvider({
  currentUser,
  defaultThreads = [],
  threads: threadsProp,
  onThreadsChange,
  context,
  contextLabel,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  shortcuts = true,
  labels: labelsProp,
  children,
}: CommentsProviderProps) {
  const [innerThreads, setInnerThreads] = React.useState<CommentThread[]>(defaultThreads)
  const threads = threadsProp ?? innerThreads
  const threadsRef = React.useRef(threads)
  React.useLayoutEffect(() => {
    threadsRef.current = threads
  }, [threads])

  const [innerOpen, setInnerOpen] = React.useState(defaultOpen)
  const open = openProp ?? innerOpen
  const [mode, setModeState] = React.useState<CommentMode>("browse")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<CommentDraft | null>(null)
  const [filter, setFilter] = React.useState<CommentFilter>(DEFAULT_COMMENT_FILTER)

  const labels = React.useMemo(() => ({ ...DEFAULT_COMMENT_LABELS, ...labelsProp }), [labelsProp])

  const commit = React.useCallback(
    (update: (current: CommentThread[]) => CommentThread[]) => {
      const next = update(threadsRef.current)
      threadsRef.current = next
      if (threadsProp === undefined) setInnerThreads(next)
      onThreadsChange?.(next)
    },
    [threadsProp, onThreadsChange]
  )

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInnerOpen(next)
      onOpenChange?.(next)
      // Cerrar el panel devuelve la pantalla a la normalidad.
      if (!next) {
        setModeState("browse")
        setDraft(null)
        setSelectedId(null)
      }
    },
    [openProp, onOpenChange]
  )

  const setMode = React.useCallback(
    (next: CommentMode) => {
      setModeState(next)
      if (next === "comment") {
        if (!open) setOpen(true)
      } else {
        setDraft(null)
      }
    },
    [open, setOpen]
  )

  const patch = React.useCallback(
    (threadId: string, change: Partial<CommentThread>) => commit((current) => current.map((thread) => (thread.id === threadId ? { ...thread, ...change } : thread))),
    [commit]
  )

  const select = React.useCallback(
    (id: string | null) => {
      setSelectedId(id)
      setDraft(null)
      // Abrir un hilo es leerlo.
      if (id && threadsRef.current.find((thread) => thread.id === id)?.unread) patch(id, { unread: false })
    },
    [patch]
  )

  const createThread = React.useCallback(
    (body: string, at: CommentDraft) => {
      const thread: CommentThread = {
        id: newId("thread"),
        x: at.x,
        y: at.y,
        context: at.context,
        contextLabel: at.context === context ? contextLabel : undefined,
        resolved: false,
        unread: false,
        messages: [{ id: newId("msg"), author: currentUser, body, createdAt: new Date().toISOString() }],
      }
      commit((current) => [...current, thread])
      setDraft(null)
      setSelectedId(thread.id)
      return thread
    },
    [commit, currentUser, context, contextLabel]
  )

  const reply = React.useCallback(
    (threadId: string, body: string) =>
      commit((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? { ...thread, messages: [...thread.messages, { id: newId("msg"), author: currentUser, body, createdAt: new Date().toISOString() }] }
            : thread
        )
      ),
    [commit, currentUser]
  )

  const setResolved = React.useCallback((threadId: string, resolved: boolean) => patch(threadId, { resolved }), [patch])
  const setUnread = React.useCallback((threadId: string, unread: boolean) => patch(threadId, { unread }), [patch])
  const removeThread = React.useCallback(
    (threadId: string) => {
      commit((current) => current.filter((thread) => thread.id !== threadId))
      setSelectedId((current) => (current === threadId ? null : current))
    },
    [commit]
  )

  // Los atajos de Figma: C para comentar, Esc para soltar lo que haya (borrador → modo → hilo).
  React.useEffect(() => {
    if (!shortcuts) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "Escape") {
        if (draft) setDraft(null)
        else if (mode === "comment") setMode("browse")
        else if (selectedId) setSelectedId(null)
        else return
        event.preventDefault()
        return
      }
      if ((event.key === "c" || event.key === "C") && !isTyping(event.target)) {
        event.preventDefault()
        setMode(mode === "comment" ? "browse" : "comment")
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [shortcuts, draft, mode, selectedId, setMode])

  const unreadCount = React.useMemo(() => threads.filter((thread) => thread.unread && !thread.resolved).length, [threads])

  const value = React.useMemo<CommentsContextValue>(
    () => ({
      threads,
      currentUser,
      labels,
      context,
      contextLabel,
      open,
      setOpen,
      mode,
      setMode,
      selectedId,
      select,
      draft,
      setDraft,
      filter,
      setFilter,
      unreadCount,
      createThread,
      reply,
      setResolved,
      setUnread,
      removeThread,
    }),
    [threads, currentUser, labels, context, contextLabel, open, setOpen, mode, setMode, selectedId, select, draft, filter, unreadCount, createThread, reply, setResolved, setUnread, removeThread]
  )

  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>
}
